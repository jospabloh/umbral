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

    // ---------------- Cuotas ----------------
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
          if (u) unitLabel = u.internal_id;
        } catch (e) {}
      }
      const fee = await base44.asServiceRole.entities.Fee.create({
        condominium_id: condominiumId,
        unit_id: body.unit_id || null,
        unit_label: unitLabel,
        concept,
        amount,
        frequency: body.frequency || "one_time",
        due_date: body.due_date || null,
        status: "active",
        created_by_user_id: caller.id,
      });
      return Response.json({ fee });
    }

    if (action === "cancelFee") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const fee = await base44.asServiceRole.entities.Fee.get(body.fee_id);
      if (!fee || fee.condominium_id !== condominiumId) {
        return Response.json({ error: "Cuota no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Fee.update(body.fee_id, { ...fee, status: "cancelled" });
      return Response.json({ ok: true });
    }

    // ---------------- Pagos de mantenimiento ----------------
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
        if (u) unitLabel = u.internal_id;
      } catch (e) {}
      const payment = await base44.asServiceRole.entities.Payment.create({
        condominium_id: condominiumId,
        unit_id: body.unit_id,
        unit_label: unitLabel,
        amount,
        method: body.method || "cash",
        reference: (body.reference || "").trim() || null,
        applied_to_fee_id: body.applied_to_fee_id || null,
        registered_by_user_id: caller.id,
        registered_by_name: stored.full_name || caller.email,
        occurred_at: body.occurred_at || new Date().toISOString(),
        note: (body.note || "").trim() || null,
      });

      // Optional: the payer needs a fiscal invoice (CFDI).
      if (body.requires_invoice) {
        const req = await base44.asServiceRole.entities.InvoiceRequest.create({
          condominium_id: condominiumId,
          payment_id: payment.id,
          unit_id: body.unit_id,
          unit_label: unitLabel,
          amount,
          concept: (body.invoice_concept || "").trim() || "Cuota de mantenimiento",
          fiscal_rfc: (body.fiscal_rfc || "").trim() || null,
          fiscal_name: (body.fiscal_name || "").trim() || null,
          fiscal_regime: (body.fiscal_regime || "").trim() || null,
          fiscal_use: (body.fiscal_use || "").trim() || null,
          fiscal_email: (body.fiscal_email || "").trim() || null,
          status: "pending",
          requested_by_user_id: caller.id,
          requested_by_name: stored.full_name || caller.email,
          requested_at: new Date().toISOString(),
        });
        return Response.json({ payment, invoice_request: req });
      }
      return Response.json({ payment });
    }

    if (action === "getUnitStatement") {
      // Residents see only their own unit; admins/committee need Cuotas:ver for others.
      let unitId = body.unit_id;
      if (stored.role === "resident") {
        unitId = stored.unit_id || null;
        if (!unitId) return Response.json({ error: "Sin unidad asignada." }, { status: 400 });
      } else {
        if (!unitId) return Response.json({ error: "Unidad requerida." }, { status: 400 });
        const allowed = await hasPermission(base44, stored, condominiumId, "Cuotas:ver");
        if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      }
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
      const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
      const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);
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
          internal_id: u.internal_id,
          label: u.label,
          resident_name: u.resident_name,
          status: u.status,
          total_fees: fees,
          total_payments: payments,
          balance: fees - payments,
        };
      });
      return Response.json({ items: balances });
    }

    // ---------------- Facturas (CFDI) ----------------
    if (action === "listInvoiceRequests") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Pagos:ver");
      const query = { condominium_id: condominiumId };
      if (!allowed) query.requested_by_user_id = caller.id;
      if (body.status) query.status = body.status;
      const res = await base44.asServiceRole.entities.InvoiceRequest.filter(query, {
        sort: "-requested_at",
        limit: 300,
      });
      return Response.json({ items: asPage(res) });
    }

    if (action === "requestInvoice") {
      const payment = await base44.asServiceRole.entities.Payment.get(body.payment_id);
      if (!payment || payment.condominium_id !== condominiumId) {
        return Response.json({ error: "Pago no encontrado." }, { status: 404 });
      }
      if (stored.role === "resident" && payment.unit_id !== stored.unit_id) {
        return Response.json({ error: "Solo puedes solicitar factura de tus propios pagos." }, { status: 403 });
      }
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const req = await base44.asServiceRole.entities.InvoiceRequest.create({
        condominium_id: condominiumId,
        payment_id: payment.id,
        unit_id: payment.unit_id,
        unit_label: payment.unit_label,
        amount: payment.amount,
        concept: (body.concept || "").trim() || "Cuota de mantenimiento",
        fiscal_rfc: (body.fiscal_rfc || "").trim() || null,
        fiscal_name: (body.fiscal_name || "").trim() || null,
        fiscal_regime: (body.fiscal_regime || "").trim() || null,
        fiscal_use: (body.fiscal_use || "").trim() || null,
        fiscal_email: (body.fiscal_email || "").trim() || null,
        status: "pending",
        requested_by_user_id: caller.id,
        requested_by_name: stored.full_name || caller.email,
        requested_at: new Date().toISOString(),
      });
      return Response.json({ invoice_request: req });
    }

    if (action === "issueInvoice") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Pagos:modificar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const inv = await base44.asServiceRole.entities.InvoiceRequest.get(body.invoice_request_id);
      if (!inv || inv.condominium_id !== condominiumId) {
        return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      }
      const invoice_number = (body.invoice_number || "").trim();
      if (!invoice_number) return Response.json({ error: "Folio fiscal requerido." }, { status: 400 });
      const file_uri = body.invoice_file_uri || null;
      const now = new Date().toISOString();
      const updated = {
        ...inv,
        status: "issued",
        invoice_number,
        invoice_file_uri: file_uri,
        issued_at: now,
        issued_by_user_id: caller.id,
        issued_by_name: stored.full_name || caller.email,
        note: (body.note || "").trim() || null,
      };
      await base44.asServiceRole.entities.InvoiceRequest.update(inv.id, updated);

      // Notify the payer. Delivery to a non-registered address depends on the
      // condominium's email setup, so a failure never blocks the issuance.
      let email_sent = false;
      let email_error = null;
      const to = inv.fiscal_email;
      if (to) {
        try {
          const attachments = file_uri
            ? [{ filename: `Factura-${invoice_number}.pdf`, file_url: file_uri }]
            : undefined;
          await base44.asServiceRole.integrations.Core.SendEmail({
            to,
            template_name: "InvoiceIssued",
            variables: {
              condominium_name: condominium?.name || "Tu condominio",
              unit_label: inv.unit_label || "",
              amount: new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(inv.amount || 0),
              invoice_number,
              fiscal_name: inv.fiscal_name || "",
            },
            attachments,
          });
          email_sent = true;
        } catch (e) {
          email_error = e.message || "No se pudo enviar el correo.";
        }
      } else {
        email_error = "La solicitud no tiene correo de contacto.";
      }

      return Response.json({ ok: true, invoice_request: updated, email_sent, email_error });
    }

    if (action === "rejectInvoice") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Pagos:modificar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const inv = await base44.asServiceRole.entities.InvoiceRequest.get(body.invoice_request_id);
      if (!inv || inv.condominium_id !== condominiumId) {
        return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      }
      await base44.asServiceRole.entities.InvoiceRequest.update(inv.id, {
        ...inv,
        status: "rejected",
        note: (body.note || "").trim() || null,
      });
      return Response.json({ ok: true });
    }

    // ---------------- Proveedores ----------------
    if (action === "listSuppliers") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Proveedores:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.Supplier.filter(
        { condominium_id: condominiumId },
        { sort: "name", limit: 300 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "saveSupplier") {
      const isEdit = !!body.supplier_id;
      const key = isEdit ? "Proveedores:modificar" : "Proveedores:crear";
      const allowed = await hasPermission(base44, stored, condominiumId, key);
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const name = (body.name || "").trim();
      if (!name) return Response.json({ error: "Nombre del proveedor requerido." }, { status: 400 });
      const fields = {
        name,
        category: body.category || "otro",
        contact_name: (body.contact_name || "").trim() || null,
        contact_email: (body.contact_email || "").trim() || null,
        contact_phone: (body.contact_phone || "").trim() || null,
        rfc: (body.rfc || "").trim() || null,
        notes: (body.notes || "").trim() || null,
        status: body.status || "active",
      };
      if (isEdit) {
        const existing = await base44.asServiceRole.entities.Supplier.get(body.supplier_id);
        if (!existing || existing.condominium_id !== condominiumId) {
          return Response.json({ error: "Proveedor no encontrado." }, { status: 404 });
        }
        await base44.asServiceRole.entities.Supplier.update(existing.id, { ...existing, ...fields });
        return Response.json({ ok: true });
      }
      const supplier = await base44.asServiceRole.entities.Supplier.create({
        condominium_id: condominiumId,
        ...fields,
      });
      return Response.json({ supplier });
    }

    if (action === "deleteSupplier") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Proveedores:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const existing = await base44.asServiceRole.entities.Supplier.get(body.supplier_id);
      if (!existing || existing.condominium_id !== condominiumId) {
        return Response.json({ error: "Proveedor no encontrado." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Supplier.delete(existing.id);
      return Response.json({ ok: true });
    }

    if (action === "listVendorPayments") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Proveedores:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const query = { condominium_id: condominiumId };
      if (body.supplier_id) query.supplier_id = body.supplier_id;
      const res = await base44.asServiceRole.entities.VendorPayment.filter(query, {
        sort: "-occurred_at",
        limit: 300,
      });
      return Response.json({ items: asPage(res) });
    }

    if (action === "createVendorPayment") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Proveedores:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return Response.json({ error: "Monto requerido." }, { status: 400 });
      const concept = (body.concept || "").trim();
      if (!concept) return Response.json({ error: "Concepto requerido." }, { status: 400 });
      let supplierName = (body.supplier_name || "").trim() || null;
      if (body.supplier_id) {
        try {
          const s = await base44.asServiceRole.entities.Supplier.get(body.supplier_id);
          if (s && s.condominium_id === condominiumId) supplierName = s.name;
        } catch (e) {}
      }
      const vp = await base44.asServiceRole.entities.VendorPayment.create({
        condominium_id: condominiumId,
        supplier_id: body.supplier_id || null,
        supplier_name: supplierName,
        concept,
        amount,
        method: body.method || "transfer",
        reference: (body.reference || "").trim() || null,
        occurred_at: body.occurred_at || new Date().toISOString(),
        status: "registrado",
        registered_by_user_id: caller.id,
        registered_by_name: stored.full_name || caller.email,
        note: (body.note || "").trim() || null,
      });
      return Response.json({ vendor_payment: vp });
    }

    if (action === "cancelVendorPayment") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Proveedores:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const vp = await base44.asServiceRole.entities.VendorPayment.get(body.vendor_payment_id);
      if (!vp || vp.condominium_id !== condominiumId) {
        return Response.json({ error: "Pago no encontrado." }, { status: 404 });
      }
      await base44.asServiceRole.entities.VendorPayment.update(vp.id, { ...vp, status: "cancelado" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}