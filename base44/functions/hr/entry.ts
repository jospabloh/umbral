import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

// Módulo de personal (HR): plantilla, vacaciones, ausencias y permisos.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { stored, condominiumId, condominium, caller } = ctx;
    if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });

    // ---------------- Plantilla ----------------
    if (action === "listStaff") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Personal:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.StaffMember.filter(
        { condominium_id: condominiumId },
        { sort: "full_name", limit: 300 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "saveStaff") {
      const isEdit = !!body.staff_id;
      const key = isEdit ? "Personal:modificar" : "Personal:crear";
      const allowed = await hasPermission(base44, stored, condominiumId, key);
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const full_name = (body.full_name || "").trim();
      if (!full_name) return Response.json({ error: "Nombre requerido." }, { status: 400 });
      const fields = {
        full_name,
        position: (body.position || "").trim() || null,
        department: (body.department || "").trim() || null,
        phone: (body.phone || "").trim() || null,
        email: (body.email || "").trim() || null,
        hire_date: body.hire_date || null,
        status: body.status || "active",
        notes: (body.notes || "").trim() || null,
      };
      if (isEdit) {
        const existing = await base44.asServiceRole.entities.StaffMember.get(body.staff_id);
        if (!existing || existing.condominium_id !== condominiumId) {
          return Response.json({ error: "Colaborador no encontrado." }, { status: 404 });
        }
        await base44.asServiceRole.entities.StaffMember.update(existing.id, { ...existing, ...fields });
        return Response.json({ ok: true });
      }
      const staff = await base44.asServiceRole.entities.StaffMember.create({
        condominium_id: condominiumId,
        ...fields,
      });
      return Response.json({ staff });
    }

    if (action === "deleteStaff") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Personal:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const existing = await base44.asServiceRole.entities.StaffMember.get(body.staff_id);
      if (!existing || existing.condominium_id !== condominiumId) {
        return Response.json({ error: "Colaborador no encontrado." }, { status: 404 });
      }
      await base44.asServiceRole.entities.StaffMember.delete(existing.id);
      return Response.json({ ok: true });
    }

    // ---------------- Vacaciones, ausencias y permisos ----------------
    if (action === "listLeaves") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Personal:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const query = { condominium_id: condominiumId };
      if (body.staff_id) query.staff_id = body.staff_id;
      if (body.status) query.status = body.status;
      const res = await base44.asServiceRole.entities.StaffLeave.filter(query, {
        sort: "-start_date",
        limit: 300,
      });
      return Response.json({ items: asPage(res) });
    }

    if (action === "createLeave") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Personal:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const staff_id = body.staff_id;
      if (!staff_id) return Response.json({ error: "Colaborador requerido." }, { status: 400 });
      const type = body.type;
      if (!["vacation", "sick", "personal", "permit", "unpaid"].includes(type)) {
        return Response.json({ error: "Tipo no válido." }, { status: 400 });
      }
      const start_date = body.start_date;
      const end_date = body.end_date || body.start_date;
      if (!start_date) return Response.json({ error: "Fecha inicial requerida." }, { status: 400 });
      const staff = await base44.asServiceRole.entities.StaffMember.get(staff_id);
      if (!staff || staff.condominium_id !== condominiumId) {
        return Response.json({ error: "Colaborador no encontrado." }, { status: 404 });
      }
      const ms = new Date(end_date).getTime() - new Date(start_date).getTime();
      const days = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
      const leave = await base44.asServiceRole.entities.StaffLeave.create({
        condominium_id: condominiumId,
        staff_id,
        staff_name: staff.full_name,
        type,
        start_date,
        end_date,
        days,
        reason: (body.reason || "").trim() || null,
        status: "pending",
        requested_by_user_id: caller.id,
        requested_by_name: stored.full_name || caller.email,
        requested_at: new Date().toISOString(),
      });
      return Response.json({ leave });
    }

    if (action === "decideLeave") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Personal:modificar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const decision = body.decision;
      if (decision !== "approved" && decision !== "rejected") {
        return Response.json({ error: "Decisión no válida." }, { status: 400 });
      }
      const leave = await base44.asServiceRole.entities.StaffLeave.get(body.leave_id);
      if (!leave || leave.condominium_id !== condominiumId) {
        return Response.json({ error: "Registro no encontrado." }, { status: 404 });
      }
      await base44.asServiceRole.entities.StaffLeave.update(leave.id, {
        ...leave,
        status: decision,
        decided_at: new Date().toISOString(),
        decided_by_user_id: caller.id,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}