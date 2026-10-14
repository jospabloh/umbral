import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller } from "../../shared/auth.ts";
import { fetchLegalVersion } from "../../shared/legalVersion.ts";
import { pingMissionControl } from "../../shared/mcPing.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "status") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominium, condominiumId } = ctx;
      const { version } = await fetchLegalVersion(base44);

      const currentVersion = version.version;
      const condoVersion = condominium?.legal_version || null;
      const condoDecision = condominium?.legal_decision || "pending";
      const needsDecision = condominium
        ? currentVersion !== "unknown" && condoVersion !== currentVersion
        : false;

      let decidedBy = null;
      if (condominium?.legal_decided_at) {
        const res = await base44.asServiceRole.entities.LegalAcceptance.filter(
          { condominium_id: condominiumId, decision: { $in: ["accepted", "rejected"] } },
          { sort: "-decided_at", limit: 1 }
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        if (items.length > 0) {
          decidedBy = {
            name: items[0].decided_by_name,
            email: items[0].decided_by_email,
            at: items[0].decided_at,
            decision: items[0].decision,
            version: items[0].version,
          };
        }
      }

      const canDecide = stored.role === "condo_admin" || stored.role === "admin";

      // Record first-asked timestamp when the admin first sees an undecided version.
      if (needsDecision && condominium && !condominium.legal_first_asked_at && canDecide) {
        await base44.asServiceRole.entities.Condominium.update(condominiumId, {
          ...condominium,
          legal_first_asked_at: new Date().toISOString(),
        });
      }

      let graceRemainingDays = null;
      if (condominium?.legal_first_asked_at && version.grace_days) {
        const asked = new Date(condominium.legal_first_asked_at).getTime();
        const end = asked + version.grace_days * 24 * 60 * 60 * 1000;
        graceRemainingDays = Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
      }

      return Response.json({
        version: currentVersion,
        published: version.published,
        grace_days: version.grace_days,
        changes_es: version.changes_es,
        terms_url: version.terms_url,
        privacy_url: version.privacy_url,
        condo_decision: condoDecision,
        condo_version: condoVersion,
        needs_decision: needsDecision,
        decided_by: decidedBy,
        can_decide: canDecide,
        grace_remaining_days: graceRemainingDays,
      });
    }

    if (action === "decide") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { caller, stored, condominium, condominiumId } = ctx;
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "Solo el administrador del condominio puede decidir." }, { status: 403 });
      }
      if (!condominium) return Response.json({ error: "Sin condominio." }, { status: 400 });
      const decision = body.decision;
      if (decision !== "accepted" && decision !== "rejected") {
        return Response.json({ error: "Decisión no válida." }, { status: 400 });
      }
      const { version } = await fetchLegalVersion(base44);
      const now = new Date().toISOString();
      const prevDecision = condominium.legal_decision;

      await base44.asServiceRole.entities.LegalAcceptance.create({
        condominium_id: condominiumId,
        version: version.version,
        terms_sha256: version.terms_sha256 || "",
        decision,
        decided_at: now,
        decided_by_user_id: caller.id,
        decided_by_name: stored.full_name || "",
        decided_by_email: caller.email,
      });

      await base44.asServiceRole.entities.Condominium.update(condominiumId, {
        ...condominium,
        legal_version: version.version,
        legal_decision: decision,
        legal_decided_at: now,
      });

      // A rejection, or an acceptance that follows a rejection, opens a legal ticket.
      if (decision === "rejected" || (decision === "accepted" && prevDecision === "rejected")) {
        const created = await base44.asServiceRole.entities.SupportTicket.create({
          condominium_id: condominiumId,
          created_by_user_id: caller.id,
          created_by_email: caller.email,
          type: "legal",
          subject: decision === "rejected" ? "Rechazo de términos" : "Aceptación tras rechazo",
          message: `El administrador ${stored.full_name || caller.email} decidió ${decision} la versión ${version.version}.`,
          status: "submitted",
          app: "umbral",
        });
        await pingMissionControl("/api/ingest/ticket-pull", { app: "umbral", ticketId: created.id });
      }

      return Response.json({ ok: true, decision, version: version.version });
    }

    if (action === "history") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { condominiumId } = ctx;
      if (!condominiumId) return Response.json({ items: [] });
      const res = await base44.asServiceRole.entities.LegalAcceptance.filter(
        { condominium_id: condominiumId },
        { sort: "-decided_at", limit: 100 }
      );
      const items = (Array.isArray(res) ? res : res?.items || []).map((i) => ({
        id: i.id,
        version: i.version,
        decision: i.decision,
        decided_at: i.decided_at,
        decided_by_name: i.decided_by_name,
        decided_by_email: i.decided_by_email,
      }));
      return Response.json({ items });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}