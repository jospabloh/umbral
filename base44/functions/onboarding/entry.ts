import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, readUser } from "../../shared/auth.ts";
import { fetchLegalVersion } from "../../shared/legalVersion.ts";
import { pingMissionControl } from "../../shared/mcPing.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "createCondominium") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { caller, stored, condominiumId } = ctx;
      if (condominiumId) {
        return Response.json({ error: "Ya perteneces a un condominio." }, { status: 409 });
      }
      const name = (body.name || "").trim();
      const legal_name = (body.legal_name || "").trim();
      const address = (body.address || "").trim();
      const privacy_contact_email = (body.privacy_contact_email || "").trim();
      if (!name || !legal_name || !address || !privacy_contact_email) {
        return Response.json({ error: "Faltan datos del condominio." }, { status: 400 });
      }
      if (!body.accept_terms) {
        return Response.json({ error: "Debes aceptar los términos para crear el condominio." }, { status: 400 });
      }

      const { version } = await fetchLegalVersion(base44);
      const now = new Date().toISOString();
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const joinCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

      const condo = await base44.asServiceRole.entities.Condominium.create({
        name,
        legal_name,
        address,
        privacy_contact_email,
        join_code: joinCode,
        billing_status: "trial",
        trial_end_at: trialEnd,
        legal_version: version.version,
        legal_decision: "accepted",
        legal_decided_at: now,
        legal_first_asked_at: now,
        access_log_retention_days: 180,
      });

      await base44.asServiceRole.entities.User.update(caller.id, {
        role: "condo_admin",
        condominium_id: condo.id,
      });

      await base44.asServiceRole.entities.LegalAcceptance.create({
        condominium_id: condo.id,
        version: version.version,
        terms_sha256: version.terms_sha256 || "",
        decision: "accepted",
        decided_at: now,
        decided_by_user_id: caller.id,
        decided_by_name: stored.full_name || "",
        decided_by_email: caller.email,
      });

      await pingMissionControl("/api/ingest/tenant-pull", { app: "umbral", tenantId: condo.id });
      return Response.json({ condominium: condo, join_code: joinCode });
    }

    if (action === "redeemJoinCode") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { caller, stored, condominiumId } = ctx;
      if (condominiumId) {
        return Response.json({ error: "Ya perteneces a un condominio." }, { status: 409 });
      }
      const code = (body.join_code || "").trim().toUpperCase();
      if (!code) return Response.json({ error: "Código requerido." }, { status: 400 });

      const res = await base44.asServiceRole.entities.Condominium.filter({ join_code: code }, { limit: 1 });
      const condos = Array.isArray(res) ? res : res?.items || [];
      if (condos.length === 0) {
        return Response.json({ error: "Código de invitación no válido." }, { status: 404 });
      }
      const condo = condos[0];

      await base44.asServiceRole.entities.JoinRequest.create({
        condominium_id: condo.id,
        user_id: caller.id,
        user_email: caller.email,
        user_name: stored.full_name || "",
        requested_role: body.requested_role || "resident",
        requested_unit_id: body.requested_unit_id || null,
        status: "pending",
      });
      return Response.json({ status: "pending", condominium_name: condo.name });
    }

    if (action === "approveMember") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId } = ctx;
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "Solo el administrador del condominio puede aprobar miembros." }, { status: 403 });
      }
      const requestId = body.request_id;
      if (!requestId) return Response.json({ error: "Solicitud requerida." }, { status: 400 });
      const jr = await base44.asServiceRole.entities.JoinRequest.get(requestId);
      if (!jr || jr.condominium_id !== condominiumId) {
        return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      }
      const targetUser = await readUser(base44, jr.user_id);
      if (!targetUser) return Response.json({ error: "Cuenta no encontrada." }, { status: 404 });
      if (targetUser.condominium_id) {
        return Response.json({ error: "Esa cuenta ya pertenece a otro condominio." }, { status: 409 });
      }
      const newRole = body.role || jr.requested_role || "resident";
      if (newRole === "admin") {
        return Response.json({ error: "No se puede asignar ese rol." }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(targetUser.id, {
        role: newRole,
        condominium_id: condominiumId,
        unit_id: body.unit_id || jr.requested_unit_id || "",
      });
      await base44.asServiceRole.entities.JoinRequest.update(requestId, {
        ...jr,
        status: "approved",
        decided_at: new Date().toISOString(),
        decided_by_user_id: stored.id,
      });
      return Response.json({ ok: true });
    }

    if (action === "rejectMember") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId } = ctx;
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "Solo el administrador del condominio puede rechazar miembros." }, { status: 403 });
      }
      const jr = await base44.asServiceRole.entities.JoinRequest.get(body.request_id);
      if (!jr || jr.condominium_id !== condominiumId) {
        return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.JoinRequest.update(body.request_id, {
        ...jr,
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by_user_id: stored.id,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}