import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ArrowRight, FileText, Wallet, Truck, Users, CalendarDays, AlertCircle } from "lucide-react";
import InvoicesPanel from "@/components/billing/InvoicesPanel";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

const METHOD_LABELS = { transfer: "Transferencia", cash: "Efectivo", card: "Tarjeta", check: "Cheque", other: "Otro" };
const LEAVE_LABELS = { vacation: "Vacaciones", sick: "Incapacidad", personal: "Personal", permit: "Permiso", unpaid: "Sin goce" };

export default function Panel() {
  const { user } = useAuth();
  const [balances, setBalances] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("billing", { action: "getBalances" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("billing", { action: "listInvoiceRequests", status: "pending" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("billing", { action: "listVendorPayments" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("hr", { action: "listStaff" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("hr", { action: "listLeaves", status: "pending" }).catch(() => ({ data: { items: [] } })),
    ]).then(([b, i, v, s, l]) => {
      setBalances(b.data?.items || []);
      setInvoices(i.data?.items || []);
      setVendorPayments(v.data?.items || []);
      setStaff(s.data?.items || []);
      setLeaves(l.data?.items || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const porCobrar = balances.reduce((sum, b) => sum + Math.max(0, b.balance || 0), 0);
  const cobrado = balances.reduce((sum, b) => sum + (b.total_payments || 0), 0);
  const enMora = balances.filter((b) => (b.balance || 0) > 0).length;
  const invoiceTotal = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const activeVendorPayments = vendorPayments.filter((v) => v.status !== "cancelado");
  const vendorTotal = activeVendorPayments.reduce((sum, v) => sum + (v.amount || 0), 0);
  const activeStaff = staff.filter((s) => s.status === "active").length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Por cobrar", value: mxn(porCobrar), hint: `${enMora} unidad${enMora === 1 ? "" : "es"} con saldo`, icon: Wallet, to: "/cuotas" },
    { label: "Cobrado", value: mxn(cobrado), hint: "Pagos de mantenimiento", icon: Wallet, to: "/cuotas" },
    { label: "Pagos a proveedores", value: mxn(vendorTotal), hint: `${activeVendorPayments.length} movimientos`, icon: Truck, to: "/proveedores" },
    { label: "Personal activo", value: String(activeStaff), hint: `${leaves.length} solicitud${leaves.length === 1 ? "" : "es"} pendiente${leaves.length === 1 ? "" : "s"}`, icon: Users, to: "/personal" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.role === "committee" ? "Vista de mesa directiva" : "Gestión administrativa del condominio"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{c.value}</p>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
            </Link>
          );
        })}
      </div>

      {invoices.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {invoices.length} factura{invoices.length === 1 ? "" : "s"} pendiente{invoices.length === 1 ? "" : "s"} de emitir · {mxn(invoiceTotal)}
            </p>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Facturas pendientes</h2>
        </div>
        <InvoicesPanel canIssue statusFilter="pending" />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Pagos a proveedores recientes</h2>
        </div>
        {activeVendorPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <div className="space-y-2">
            {activeVendorPayments.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.supplier_name || "Proveedor"}</p>
                  <p className="text-xs text-muted-foreground">{v.concept} · {METHOD_LABELS[v.method] || v.method}</p>
                </div>
                <span className="text-sm font-medium">{mxn(v.amount)}</span>
              </div>
            ))}
            <Link to="/proveedores" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Ver todo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Solicitudes de personal pendientes</h2>
        </div>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin solicitudes pendientes.</p>
        ) : (
          <div className="space-y-2">
            {leaves.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.staff_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {LEAVE_LABELS[l.type] || l.type} · {new Date(l.start_date).toLocaleDateString("es-MX")} a {new Date(l.end_date).toLocaleDateString("es-MX")} · {l.days} día{l.days === 1 ? "" : "s"}
                  </p>
                </div>
                <Link to="/personal" className="text-sm text-primary hover:underline">Revisar</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}