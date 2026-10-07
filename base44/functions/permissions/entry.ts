import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { PERMISSION_DEFAULTS } from "../../shared/permissions.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId } = ctx;
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      let overrides = {};
      if (condominiumId) {
        const res = await base44.asServiceRole.entities.PermissionProfile.filter(
          { condominium_id: condominiumId },
          { limit: 500 }
        );
        for (const p of asPage(res)) {
          overrides[`${p.data.role}:${p.data.permission_key}`] = p.data.allowed === true;
        }
      }
      return Response.json({ defaults: PERMISSION_DEFAULTS, overrides });
    }

    if (action === "set") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominium, condominiumId } = ctx;
      if (stored.role !== "condo_admin" && stored.role !== "admin") {
        return Response.json({ error: "No autorizado." }, { status: 403 });
      }
      const block = guardBilling(condominium);
      if (block) return Response.json({ error: block.error }, { status: block.status });
      const role = body.role;
      const permission_key = body.permission_key;
      const allowed = !!body.allowed;
      if (!condominiumId || !role || !permission_key) {
        return Response.json({ error: "Datos incompletos." }, { status: 400 });
      }
      const res = await base44.asServiceRole.entities.PermissionProfile.filter(
        { condominium_id: condominiumId, role, permission_key },
        { limit: 1 }
      );
      const existing = asPage(res);
      if (existing.length > 0) {
        await base44.asServiceRole.entities.PermissionProfile.update(existing[0].id, {
          data: { ...existing[0].data, allowed },
        });
      } else {
        await base44.asServiceRole.entities.PermissionProfile.create({
          data: { condominium_id: condominiumId, role, permission_key, allowed },
        });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}