import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, readUser, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

// Tenant roles a condo admin may assign. Built-in `admin` is the platform's
// (ACACIA Standard module 24) and is never assignable or touchable from here.
const TENANT_ROLES = ["condo_admin", "committee", "guard", "resident"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { caller, stored, condominium, condominiumId } = ctx;

    // ---- condominium ----
    if (action === "getCondominium") {
      if (!condominium) return Response.json({ condominium: null });
      return Response.json({
        condominium: {
          id: condominium.id,
          name: condominium.name,
          legal_name: condominium.legal_name,
          address: condominium.address,
          privacy_contact_email: condominium.privacy_contact_email,
          billing_status: condominium.billing_status,
          trial_end_at: condominium.trial_end_at,
          join_code: condominium.join_code,
          access_log_retention_days: condominium.access_log_retention_days,
        },
      });
    }

    // ---- profile ----
    if (action === "updateProfile") {
      // Two writes: full_name is built-in, so a refusal there must not take the
      // phone change with it.
      if (typeof body.phone === "string") {
        await base44.asServiceRole.entities.User.update(caller.id, { phone: body.phone });
      }
      if (typeof body.full_name === "string") {
        await base44.asServiceRole.entities.User.update(caller.id, { full_name: body.full_name });
      }
      return Response.json({ ok: true });
    }

    // ---- members ----
    if (action === "listMembers") {
      if (!condominiumId) return Response.json({ members: [] });
      // The directory carries every member's email and phone: only roles granted
      // Miembros:ver get it. Others still get the condominium card below.
      const canSeeMembers = await hasPermission(base44, stored, condominiumId, "Miembros:ver");
      const users = canSeeMembers
        ? asPage(await base44.asServiceRole.entities.User.filter(
            { condominium_id: condominiumId },
            { limit: 200 }
          ))
        : [];
      const members = users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        full_name: u.full_name || "",
        phone: u.phone || "",
        unit_id: u.unit_id || null,
      }));
      return Response.json({
        members,
        condominium: condominium
          ? {
              name: condominium.name,
              legal_name: condominium.legal_name,
              address: condominium.address,
              privacy_contact_email: condominium.privacy_contact_email,
              billing_status: condominium.billing_status,
              trial_end_at: condominium.trial_end_at,
              join_code: condominium.join_code,
              access_log_retention_days: condominium.access_log_retention_days,
            }
          : null,
      });
    }

    if (action === "listPending") {
      if (!condominiumId) return Response.json({ requests: [] });
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      const res = await base44.asServiceRole.entities.JoinRequest.filter(
        { condominium_id: condominiumId, status: "pending" },
        { sort: "-created_date", limit: 100 }
      );
      return Response.json({
        requests: asPage(res).map((r) => ({
          id: r.id,
          user_email: r.user_email,
          user_name: r.user_name,
          requested_role: r.requested_role,
          requested_unit_id: r.requested_unit_id,
        })),
      });
    }

    if (action === "changeRole") {
      const block = guardBilling(condominium);
      if (block) return Response.json({ error: block.error }, { status: block.status });
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      const target = await readUser(base44, body.user_id);
      if (!target || target.condominium_id !== condominiumId) {
        return Response.json({ error: "Miembro no encontrado." }, { status: 404 });
      }
      if (target.role === "admin") {
        return Response.json({ error: "No se puede modificar una cuenta de plataforma." }, { status: 403 });
      }
      const newRole = body.role;
      if (!TENANT_ROLES.includes(newRole)) {
        return Response.json({ error: "Rol no válido." }, { status: 400 });
      }
      // Prevent leaving the condo without an admin when demoting the only condo_admin.
      if (target.role === "condo_admin" && newRole !== "condo_admin") {
        const res = await base44.asServiceRole.entities.User.filter(
          { condominium_id: condominiumId, role: "condo_admin" },
          { limit: 100 }
        );
        if (asPage(res).length <= 1) {
          return Response.json({ error: "No puedes dejar el condominio sin administrador." }, { status: 400 });
        }
      }
      await base44.asServiceRole.entities.User.update(target.id, { role: newRole });
      return Response.json({ ok: true });
    }

    if (action === "removeMember") {
      const block = guardBilling(condominium);
      if (block) return Response.json({ error: block.error }, { status: block.status });
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      const target = await readUser(base44, body.user_id);
      if (!target || target.condominium_id !== condominiumId) {
        return Response.json({ error: "Miembro no encontrado." }, { status: 404 });
      }
      if (target.role === "admin") {
        return Response.json({ error: "No se puede modificar una cuenta de plataforma." }, { status: 403 });
      }
      if (target.role === "condo_admin") {
        const res = await base44.asServiceRole.entities.User.filter(
          { condominium_id: condominiumId, role: "condo_admin" },
          { limit: 100 }
        );
        if (asPage(res).length <= 1) {
          return Response.json({ error: "No puedes dejar el condominio sin administrador." }, { status: 400 });
        }
      }
      await base44.asServiceRole.entities.User.update(target.id, {
        role: "user",
        // "" not null: the fields are typed string. Empty counts as no
        // condominium everywhere. Emptying the legacy object too leaves nothing
        // a later migration could copy back in.
        condominium_id: "",
        unit_id: "",
        data: {},
        legacy_migrated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true });
    }

    if (action === "delegateCondominium") {
      const block = guardBilling(condominium);
      if (block) return Response.json({ error: block.error }, { status: block.status });
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      const target = await readUser(base44, body.user_id);
      if (!target || target.condominium_id !== condominiumId) {
        return Response.json({ error: "Miembro no encontrado." }, { status: 404 });
      }
      // Delegating to yourself would promote then demote you, leaving zero admins.
      if (target.id === caller.id) {
        return Response.json({ error: "Elige a otro miembro." }, { status: 400 });
      }
      if (target.role === "admin") {
        return Response.json({ error: "No se puede delegar a una cuenta de plataforma." }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(target.id, { role: "condo_admin" });
      // Only a condo admin steps down; a platform admin acting here keeps its role.
      if (stored.role === "condo_admin") {
        await base44.asServiceRole.entities.User.update(caller.id, { role: "committee" });
      }
      return Response.json({ ok: true });
    }

    if (action === "requestDeletion") {
      if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      await base44.asServiceRole.entities.SupportTicket.create({
        condominium_id: condominiumId,
        created_by_user_id: caller.id,
        type: "arco",
        subject: "Solicitud de borrado del condominio",
        message: body.reason || "Sin motivo adicional.",
        status: "submitted",
        app: "umbral",
      });
      return Response.json({ ok: true });
    }

    // ---- sessions ----
    if (action === "listSessions") {
      const res = await base44.asServiceRole.entities.Session.filter(
        { user_id: caller.id },
        { sort: "-last_seen", limit: 50 }
      );
      return Response.json({
        sessions: asPage(res).map((s) => ({
          id: s.id,
          device_id: s.device_id,
          device_label: s.device_label,
          status: s.status,
          last_seen: s.last_seen,
        })),
      });
    }

    if (action === "revokeSession") {
      const sessionId = body.session_id;
      const session = await base44.asServiceRole.entities.Session.get(sessionId);
      if (!session || session.user_id !== caller.id) {
        return Response.json({ error: "Sesión no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Session.update(sessionId, { ...session, status: "revoked" });
      return Response.json({ ok: true });
    }

    // ---- export ----
    if (action === "exportData") {
      return Response.json({
        condominium: condominium
          ? {
              name: condominium.name,
              legal_name: condominium.legal_name,
              address: condominium.address,
              billing_status: condominium.billing_status,
            }
          : null,
        account: { email: caller.email, role: stored.role, full_name: stored.full_name },
        exported_at: new Date().toISOString(),
      });
    }

    // ---- delete account ----
    if (action === "deleteAccount") {
      if (stored.role === "condo_admin" && condominiumId) {
        const res = await base44.asServiceRole.entities.User.filter(
          { condominium_id: condominiumId, role: "condo_admin" },
          { limit: 100 }
        );
        if (asPage(res).length <= 1) {
          return Response.json({ error: "Delega el condominio antes de borrar tu cuenta." }, { status: 400 });
        }
      }
      await base44.asServiceRole.entities.User.delete(caller.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}