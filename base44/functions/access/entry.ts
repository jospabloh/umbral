import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Public: verify a pass by QR token (no auth required).
    if (action === "verifyPass") {
      const token = (body.token || "").trim();
      if (!token) return Response.json({ error: "Token requerido." }, { status: 400 });
      const res = await base44.asServiceRole.entities.AccessPass.filter({ qr_token: token }, { limit: 1 });
      const passes = asPage(res);
      if (passes.length === 0) {
        return Response.json({ error: "Pase no encontrado." }, { status: 404 });
      }
      const pass = passes[0];
      let condo = null;
      let unit = null;
      try {
        condo = await base44.asServiceRole.entities.Condominium.get(pass.condominium_id);
      } catch (e) {}
      if (pass.unit_id) {
        try {
          unit = await base44.asServiceRole.entities.Unit.get(pass.unit_id);
        } catch (e) {}
      }
      const now = Date.now();
      const validFrom = pass.valid_from ? new Date(pass.valid_from).getTime() : 0;
      const validUntil = pass.valid_until ? new Date(pass.valid_until).getTime() : Infinity;
      const isValid = pass.status === "active" && now >= validFrom && now <= validUntil;
      return Response.json({
        pass: {
          id: pass.id,
          visitor_name: pass.visitor_name,
          visitor_phone: pass.visitor_phone,
          pass_type: pass.pass_type,
          valid_from: pass.valid_from,
          valid_until: pass.valid_until,
          status: pass.status,
          note: pass.note,
        },
        unit: unit ? { id: unit.id, internal_id: unit.internal_id, label: unit.label } : null,
        condominium: condo ? { name: condo.name, address: condo.address } : null,
        valid: isValid,
      });
    }

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { stored, condominiumId, condominium, caller } = ctx;
    if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });

    if (action === "listPasses") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Accesos:ver");
      let items;
      if (allowed) {
        const res = await base44.asServiceRole.entities.AccessPass.filter(
          { condominium_id: condominiumId },
          { sort: "-created_date", limit: 200 }
        );
        items = asPage(res);
      } else {
        // Residents see only passes they created.
        const res = await base44.asServiceRole.entities.AccessPass.filter(
          { condominium_id: condominiumId, created_by_id: caller.id },
          { sort: "-created_date", limit: 100 }
        );
        items = asPage(res);
      }
      return Response.json({ items });
    }

    if (action === "createPass") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Accesos:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const visitor_name = (body.visitor_name || "").trim();
      if (!visitor_name) return Response.json({ error: "Nombre del visitante requerido." }, { status: 400 });
      const now = new Date();
      const validFrom = body.valid_from ? new Date(body.valid_from) : now;
      const validUntil = body.valid_until ? new Date(body.valid_until) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
      let unitId = body.unit_id || null;
      let unitLabel = "";
      // Residents can only create passes for their own unit.
      if (stored.role === "resident") {
        unitId = stored.data?.unit_id || null;
      }
      if (unitId) {
        try {
          const u = await base44.asServiceRole.entities.Unit.get(unitId);
          if (u && u.condominium_id === condominiumId) unitLabel = u.internal_id;
        } catch (e) {}
      }
      const qr_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const pass = await base44.asServiceRole.entities.AccessPass.create({
        condominium_id: condominiumId,
        unit_id: unitId,
        unit_label: unitLabel,
        created_by_user_id: caller.id,
        visitor_name,
        visitor_phone: (body.visitor_phone || "").trim() || null,
        pass_type: body.pass_type || "single",
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
        status: "active",
        qr_token,
        note: (body.note || "").trim() || null,
      });
      return Response.json({ pass });
    }

    if (action === "revokePass") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Accesos:modificar");
      if (!allowed && stored.role !== "resident") {
        return Response.json({ error: "Sin permiso." }, { status: 403 });
      }
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const pass = await base44.asServiceRole.entities.AccessPass.get(body.pass_id);
      if (!pass || pass.condominium_id !== condominiumId) {
        return Response.json({ error: "Pase no encontrado." }, { status: 404 });
      }
      if (!allowed && pass.created_by_user_id !== caller.id) {
        return Response.json({ error: "Solo puedes revocar tus propios pases." }, { status: 403 });
      }
      await base44.asServiceRole.entities.AccessPass.update(body.pass_id, { ...pass, status: "revoked" });
      return Response.json({ ok: true });
    }

    if (action === "listEvents") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Accesos:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.AccessEvent.filter(
        { condominium_id: condominiumId },
        { sort: "-occurred_at", limit: 200 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "registerEvent") {
      if (stored.role !== "guard" && stored.role !== "condo_admin" && stored.role !== "committee" && stored.role !== "admin") {
        return Response.json({ error: "Solo el vigilante puede registrar eventos." }, { status: 403 });
      }
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const event_type = body.event_type;
      if (!["entry", "exit", "denied"].includes(event_type)) {
        return Response.json({ error: "Tipo de evento no válido." }, { status: 400 });
      }
      const now = new Date().toISOString();
      let unitLabel = "";
      if (body.unit_id) {
        try {
          const u = await base44.asServiceRole.entities.Unit.get(body.unit_id);
          if (u) unitLabel = u.internal_id;
        } catch (e) {}
      }
      const event = await base44.asServiceRole.entities.AccessEvent.create({
        condominium_id: condominiumId,
        pass_id: body.pass_id || null,
        unit_id: body.unit_id || null,
        unit_label: unitLabel,
        guard_user_id: caller.id,
        guard_name: stored.data?.full_name || caller.email,
        visitor_name: (body.visitor_name || "").trim() || null,
        event_type,
        occurred_at: body.occurred_at || now,
        note: (body.note || "").trim() || null,
      });
      // Mark single-use passes as used after an entry.
      if (event_type === "entry" && body.pass_id) {
        try {
          const pass = await base44.asServiceRole.entities.AccessPass.get(body.pass_id);
          if (pass && pass.pass_type === "single" && pass.status === "active") {
            await base44.asServiceRole.entities.AccessPass.update(body.pass_id, { ...pass, status: "used" });
          }
        } catch (e) {}
      }
      return Response.json({ event });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}