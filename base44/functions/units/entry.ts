import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId } = ctx;
      if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });
      const allowed = await hasPermission(base44, stored, condominiumId, "Unidades:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.Unit.filter(
        { condominium_id: condominiumId },
        { sort: "internal_id", limit: 500 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "create") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId, condominium } = ctx;
      if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });
      const allowed = await hasPermission(base44, stored, condominiumId, "Unidades:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const internal_id = (body.internal_id || "").trim();
      if (!internal_id) return Response.json({ error: "Identificador requerido." }, { status: 400 });
      const unit = await base44.asServiceRole.entities.Unit.create({
        data: {
          condominium_id: condominiumId,
          internal_id,
          label: (body.label || "").trim() || internal_id,
          resident_user_id: body.resident_user_id || null,
          resident_name: (body.resident_name || "").trim() || null,
          type: body.type || "casa",
          status: body.resident_user_id ? "active" : "vacant",
        },
      });
      return Response.json({ unit });
    }

    if (action === "update") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId, condominium } = ctx;
      if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });
      const allowed = await hasPermission(base44, stored, condominiumId, "Unidades:modificar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const unit = await base44.asServiceRole.entities.Unit.get(body.unit_id);
      if (!unit || unit.data.condominium_id !== condominiumId) {
        return Response.json({ error: "Unidad no encontrada." }, { status: 404 });
      }
      const updates = {};
      if (body.label !== undefined) updates.label = body.label;
      if (body.type !== undefined) updates.type = body.type;
      if (body.internal_id !== undefined) updates.internal_id = body.internal_id;
      if (body.resident_user_id !== undefined) {
        updates.resident_user_id = body.resident_user_id || null;
        updates.resident_name = (body.resident_name || "").trim() || null;
        updates.status = body.resident_user_id ? "active" : "vacant";
      }
      await base44.asServiceRole.entities.Unit.update(body.unit_id, {
        data: { ...unit.data, ...updates },
      });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const ctx = await resolveCaller(base44);
      if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
      const { stored, condominiumId, condominium } = ctx;
      if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });
      const allowed = await hasPermission(base44, stored, condominiumId, "Unidades:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const unit = await base44.asServiceRole.entities.Unit.get(body.unit_id);
      if (!unit || unit.data.condominium_id !== condominiumId) {
        return Response.json({ error: "Unidad no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Unit.delete(body.unit_id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}