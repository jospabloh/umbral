import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { stored, condominiumId, condominium, caller } = ctx;
    if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });

    if (action === "listFees") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.Fee.filter(
        { condominium_id: condominiumId },
        { sort: "-due_date", limit: 500 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "createFee") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const concept = (body.concept || "").trim();
      const amount = Number(body.amount);
      if (!concept) return Response.json({ error: "Concepto requerido." }, { status: 400 });
      if (!amount || amount <= 0) return Response.json({ error: "Monto requerido." }, { status: 400 });
      let unitLabel = "";
      if (body.unit_id) {
        try {
          const u = await base44.asServiceRole.entities.Unit.get(body.unit_id);
          if (u) unitLabel = u.data.internal_id;
        } catch (e) {}
      }
      const fee = await base44.asServiceRole.entities.Fee.create({
        data: {
          condominium_id: condominiumId,
          unit_id: body.unit_id || null,
          unit_label: unitLabel,
          concept,
          amount,
          frequency: body.frequency || "one_time",
          due_date: body.due_date || null,
          status: "active",
          created_by_user_id: caller.id,
        },
      });
      return Response.json({ fee });
    }

    if (action === "cancelFee") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const fee = await base44.asServiceRole.entities.Fee.get(body.fee_id);
      if (!fee || fee.data.condominium_id !== condominiumId) {
        return Response.json({ error: "Cuota no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Fee.update(body.fee_id, {
        data: { ...fee.data, status: "cancelled" },
      });
      return Response.json({ ok: true });
    }

    if (action === "listPayments") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Pagos:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.Payment.filter(
        { condominium_id: condominiumId },
        { sort: "-occurred_at", limit: 500 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "registerPayment") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Pagos:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return Response.json({ error: "Monto requerido." }, { status: 400 });
      if (!body.unit_id) return Response.json({ error: "Unidad requerida." }, { status: 400 });
      let unitLabel = "";
      try {
        const u = await base44.asServiceRole.entities.Unit.get(body.unit_id);
        if (u) unitLabel = u.data.internal_id;
      } catch (e) {}
      const payment = await base44.asServiceRole.entities.Payment.create({
        data: {
          condominium_id: condominiumId,
          unit_id: body.unit_id,
          unit_label: unitLabel,
          amount,
          method: body.method || "cash",
          reference: (body.reference || "").trim() || null,
          applied_to_fee_id: body.applied_to_fee_id || null,
          registered_by_user_id: caller.id,
          registered_by_name: stored.data?.full_name || caller.email,
          occurred_at: body.occurred_at || new Date().toISOString(),
          note: (body.note || "").trim() || null,
        },
      });
      return Response.json({ payment });
    }

    if (action === "getUnitStatement") {
      // Residents see only their own unit; admins/committee need Cuotas:ver for others.
      let unitId = body.unit_id;
      if (stored.role === "resident") {
        unitId = stored.data?.unit_id || null;
        if (!unitId) return Response.json({ error: "Sin unidad asignada." }, { status: 400 });
      } else {
        if (!unitId) return Response.json({ error: "Unidad requerida." }, { status: 400 });
        const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:ver");
        if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      }
      // Fees: active fees for this unit OR general fees (unit_id null).
      const feeRes = await base44.asServiceRole.entities.Fee.filter(
        { condominium_id: condominiumId, status: "active", $or: [{ unit_id: unitId }, { unit_id: null }] },
        { sort: "due_date", limit: 500 }
      );
      const fees = asPage(feeRes);
      const payRes = await base44.asServiceRole.entities.Payment.filter(
        { condominium_id: condominiumId, unit_id: unitId },
        { sort: "-occurred_at", limit: 500 }
      );
      const payments = asPage(payRes);
      const totalFees = fees.reduce((s, f) => s + (f.data.amount || 0), 0);
      const totalPayments = payments.reduce((s, p) => s + (p.data.amount || 0), 0);
      return Response.json({
        unit_id: unitId,
        fees,
        payments,
        total_fees: totalFees,
        total_payments: totalPayments,
        balance: totalFees - totalPayments,
      });
    }

    if (action === "getBalances") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const unitRes = await base44.asServiceRole.entities.Unit.filter(
        { condominium_id: condominiumId },
        { sort: "internal_id", limit: 500 }
      );
      const units = asPage(unitRes);
      const feeAgg = await base44.asServiceRole.entities.Fee.aggregate({
        query: { condominium_id: condominiumId, status: "active" },
        groupBy: "unit_id",
        sum: "amount",
      });
      const payAgg = await base44.asServiceRole.entities.Payment.aggregate({
        query: { condominium_id: condominiumId },
        groupBy: "unit_id",
        sum: "amount",
      });
      const feeMap = {};
      for (const row of feeAgg.rows || []) {
        feeMap[row.unit_id || "__general__"] = row.sum_amount || 0;
      }
      const payMap = {};
      for (const row of payAgg.rows || []) {
        payMap[row.unit_id] = row.sum_amount || 0;
      }
      const generalFees = feeMap["__general__"] || 0;
      const balances = units.map((u) => {
        const fees = (feeMap[u.id] || 0) + generalFees;
        const payments = payMap[u.id] || 0;
        return {
          unit_id: u.id,
          internal_id: u.data.internal_id,
          label: u.data.label,
          resident_name: u.data.resident_name,
          status: u.data.status,
          total_fees: fees,
          total_payments: payments,
          balance: fees - payments,
        };
      });
      return Response.json({ items: balances });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}