import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const METHOD_LABELS = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  check: "Cheque",
  other: "Otro",
};

const CATEGORY_LABELS = {
  mantenimiento: "Mantenimiento",
  seguridad: "Seguridad",
  limpieza: "Limpieza",
  jardineria: "Jardinería",
  servicios: "Servicios",
  suministros: "Suministros",
  otro: "Otro",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// First day of the month N months back (default report starts six months ago).
function monthsAgoISO(n) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString().slice(0, 10);
}

function monthLabel(key) {
  const [y, m] = String(key).split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || Number.isNaN(idx)) return String(key);
  return `${MONTHS[idx] || m} ${y}`;
}

function monthRange(fromISO, toISO) {
  const keys = [];
  const start = new Date(fromISO);
  const end = new Date(toISO);
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    keys.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

// The bucket column name varies with the aggregate shape; read the first value present.
function bucketKey(row) {
  return row.occurred_at || row.month || row.date || row.bucket || row._id || "";
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { stored, condominium, condominiumId } = ctx;
    if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });

    if (action === "getFinancials") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Reportes:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });

      const from = String(body.from || monthsAgoISO(5)).slice(0, 10);
      const to = String(body.to || todayISO()).slice(0, 10);
      const fromISO = `${from}T00:00:00.000Z`;
      const toISO = `${to}T23:59:59.999Z`;
      const inRange = { condominium_id: condominiumId, occurred_at: { $gte: fromISO, $lte: toISO } };
      const vendidos = { ...inRange, status: "registrado" };

      const [payAggMonth, venAggMonth, payAggMethod, venAggSupplier, payAggUnit, feeAggUnit] = await Promise.all([
        base44.asServiceRole.entities.Payment.aggregate({
          query: inRange,
          dateBucket: { field: "occurred_at", unit: "month" },
          sum: "amount",
        }),
        base44.asServiceRole.entities.VendorPayment.aggregate({
          query: vendidos,
          dateBucket: { field: "occurred_at", unit: "month" },
          sum: "amount",
        }),
        base44.asServiceRole.entities.Payment.aggregate({ query: inRange, groupBy: "method", sum: "amount" }),
        base44.asServiceRole.entities.VendorPayment.aggregate({ query: vendidos, groupBy: "supplier_name", sum: "amount" }),
        base44.asServiceRole.entities.Payment.aggregate({ query: { condominium_id: condominiumId }, groupBy: "unit_id", sum: "amount" }),
        base44.asServiceRole.entities.Fee.aggregate({
          query: { condominium_id: condominiumId, status: "active" },
          groupBy: "unit_id",
          sum: "amount",
        }),
      ]);

      const [payRes, venRes, unitRes, supplierRes] = await Promise.all([
        base44.asServiceRole.entities.Payment.filter(inRange, { sort: "-occurred_at", limit: 1000 }),
        base44.asServiceRole.entities.VendorPayment.filter(vendidos, { sort: "-occurred_at", limit: 1000 }),
        base44.asServiceRole.entities.Unit.filter({ condominium_id: condominiumId }, { sort: "internal_id", limit: 500 }),
        base44.asServiceRole.entities.Supplier.filter({ condominium_id: condominiumId }, { limit: 300 }),
      ]);

      const payMonth = {};
      for (const row of payAggMonth.rows || []) {
        const key = String(bucketKey(row)).slice(0, 7);
        if (key) payMonth[key] = (payMonth[key] || 0) + (row.sum_amount || 0);
      }
      const venMonth = {};
      for (const row of venAggMonth.rows || []) {
        const key = String(bucketKey(row)).slice(0, 7);
        if (key) venMonth[key] = (venMonth[key] || 0) + (row.sum_amount || 0);
      }

      const months = monthRange(fromISO, toISO).map((key) => {
        const ingresos = payMonth[key] || 0;
        const gastos = venMonth[key] || 0;
        return { month: key, label: monthLabel(key), ingresos, gastos, resultado: ingresos - gastos };
      });

      const ingresos = months.reduce((s, m) => s + m.ingresos, 0);
      const gastos = months.reduce((s, m) => s + m.gastos, 0);

      const supplierCategory = {};
      for (const s of asPage(supplierRes)) supplierCategory[s.name] = s.category || "otro";

      const catBuckets = {};
      for (const row of venAggSupplier.rows || []) {
        const cat = supplierCategory[row.supplier_name] || "otro";
        const current = catBuckets[cat] || { category: cat, label: CATEGORY_LABELS[cat] || cat, count: 0, amount: 0 };
        current.count += row.count || 0;
        current.amount += row.sum_amount || 0;
        catBuckets[cat] = current;
      }
      const gastos_por_categoria = Object.values(catBuckets).sort((a, b) => b.amount - a.amount);

      const ingresos_por_metodo = (payAggMethod.rows || [])
        .map((row) => ({
          label: METHOD_LABELS[row.method] || row.method || "Otro",
          count: row.count || 0,
          amount: row.sum_amount || 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const units = asPage(unitRes);
      const feeByUnit = {};
      for (const row of feeAggUnit.rows || []) feeByUnit[row.unit_id || "__general__"] = row.sum_amount || 0;
      const payByUnit = {};
      for (const row of payAggUnit.rows || []) payByUnit[row.unit_id] = row.sum_amount || 0;

      const generalFees = feeByUnit["__general__"] || 0;
      const cobranza = units.map((u) => {
        const fees = (feeByUnit[u.id] || 0) + generalFees;
        const payments = payByUnit[u.id] || 0;
        return {
          internal_id: u.internal_id,
          resident_name: u.resident_name || "",
          status: u.status,
          total_fees: fees,
          total_payments: payments,
          balance: fees - payments,
        };
      });

      const ingresos_detalle = asPage(payRes).map((p) => ({
        occurred_at: p.occurred_at,
        unit_label: p.unit_label || "",
        method: METHOD_LABELS[p.method] || p.method || "",
        reference: p.reference || "",
        amount: p.amount || 0,
      }));

      const gastos_detalle = asPage(venRes).map((v) => {
        const cat = supplierCategory[v.supplier_name] || "otro";
        return {
          occurred_at: v.occurred_at,
          supplier_name: v.supplier_name || "",
          category: CATEGORY_LABELS[cat] || cat,
          concept: v.concept || "",
          method: METHOD_LABELS[v.method] || v.method || "",
          reference: v.reference || "",
          amount: v.amount || 0,
        };
      });

      return Response.json({
        range: { from, to },
        condominium_name: condominium?.name || "",
        totals: {
          ingresos,
          gastos,
          resultado: ingresos - gastos,
          por_cobrar: cobranza.reduce((s, c) => s + Math.max(0, c.balance), 0),
          ingresos_count: ingresos_detalle.length,
          gastos_count: gastos_detalle.length,
        },
        months,
        gastos_por_categoria,
        ingresos_por_metodo,
        cobranza,
        ingresos_detalle,
        gastos_detalle,
      });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}