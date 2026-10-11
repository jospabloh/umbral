import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import ReportSection from "@/components/reports/ReportSection";
import StatementTable from "@/components/reports/StatementTable";
import BreakdownTable from "@/components/reports/BreakdownTable";
import CollectionsTable from "@/components/reports/CollectionsTable";
import { exportSheets, fileStamp } from "@/lib/excel";
import { ArrowLeft, BarChart3, Download, TrendingDown, TrendingUp, Wallet } from "lucide-react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—");
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function defaultFrom() {
  const now = new Date();
  return `${day(new Date(now.getFullYear(), now.getMonth() - 5, 1))}`;
}
function defaultTo() {
  return day(new Date());
}

const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

const resumenRows = (d) => [
  ["Umbral — Reporte financiero"],
  ["Condominio", d.condominium_name],
  ["Periodo", `${d.range.from} a ${d.range.to}`],
  ["Generado", new Date().toLocaleString("es-MX")],
  [],
  ["Concepto", "Importe"],
  ["Ingresos cobrados", d.totals.ingresos],
  ["Gastos registrados", d.totals.gastos],
  ["Resultado del periodo", d.totals.resultado],
  ["Saldo por cobrar", d.totals.por_cobrar],
];

const estadoRows = (d) => [
  ["Mes", "Ingresos", "Gastos", "Resultado"],
  ...d.months.map((m) => [m.label, m.ingresos, m.gastos, m.resultado]),
  ["Total", d.totals.ingresos, d.totals.gastos, d.totals.resultado],
];

const ingresosRows = (d) => [
  ["Fecha", "Unidad", "Método", "Referencia", "Monto"],
  ...d.ingresos_detalle.map((p) => [fmtDate(p.occurred_at), p.unit_label, p.method, p.reference, p.amount]),
  ["Total", "", "", "", d.totals.ingresos],
];

const gastosRows = (d) => [
  ["Fecha", "Proveedor", "Categoría", "Concepto", "Método", "Referencia", "Monto"],
  ...d.gastos_detalle.map((v) => [fmtDate(v.occurred_at), v.supplier_name, v.category, v.concept, v.method, v.reference, v.amount]),
  ["Total", "", "", "", "", "", d.totals.gastos],
];

const categoriaRows = (d) => [
  ["Categoría", "Movimientos", "Importe"],
  ...d.gastos_por_categoria.map((c) => [c.label, c.count, c.amount]),
  ["Total", "", d.totals.gastos],
];

const metodoRows = (d) => [
  ["Método", "Pagos", "Importe"],
  ...d.ingresos_por_metodo.map((m) => [m.label, m.count, m.amount]),
  ["Total", "", d.totals.ingresos],
];

const cobranzaRows = (d) => [
  ["Unidad", "Residente", "Cuotas", "Pagado", "Saldo"],
  ...d.cobranza.map((c) => [c.internal_id, c.resident_name, c.total_fees, c.total_payments, c.balance]),
  ["Total", "", sum(d.cobranza, "total_fees"), sum(d.cobranza, "total_payments"), sum(d.cobranza, "balance")],
];

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    base44.functions
      .invoke("reports", { action: "getFinancials", from, to })
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || "No se pudo cargar el reporte."))
      .finally(() => setLoading(false));
  }, [from, to]);

  const runExport = (key, label, sheets) => {
    if (!data) return;
    setBusy(key);
    try {
      exportSheets(`Umbral-${label}-${fileStamp()}.xlsx`, sheets);
      toast({ title: "Excel descargado", description: "Ábrelo en Excel o Google Sheets." });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo generar el Excel" });
    } finally {
      setBusy("");
    }
  };

  const cards = data
    ? [
        { label: "Ingresos del periodo", value: mxn(data.totals.ingresos), hint: `${data.totals.ingresos_count} pagos`, icon: TrendingUp, tone: "text-emerald-600" },
        { label: "Gastos del periodo", value: mxn(data.totals.gastos), hint: `${data.totals.gastos_count} movimientos`, icon: TrendingDown, tone: "text-red-600" },
        { label: "Resultado", value: mxn(data.totals.resultado), hint: data.totals.resultado < 0 ? "Déficit" : "Superávit", icon: BarChart3, tone: data.totals.resultado < 0 ? "text-red-600" : "text-emerald-600" },
        { label: "Saldo por cobrar", value: mxn(data.totals.por_cobrar), hint: "Cuotas pendientes", icon: Wallet, tone: "text-amber-600" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Link to="/panel" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al panel
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Reportes</h1>
            <p className="text-sm text-muted-foreground">
              {user?.role === "committee" ? "Vista de mesa directiva" : "Gastos contra ingresos y estado de resultados"}
            </p>
          </div>
        </div>
        <Button onClick={() => runExport("all", "Reporte-financiero", [
          { name: "Resumen", rows: resumenRows(data) },
          { name: "Estado de resultados", rows: estadoRows(data) },
          { name: "Ingresos", rows: ingresosRows(data) },
          { name: "Gastos", rows: gastosRows(data) },
          { name: "Gastos por categoría", rows: categoriaRows(data) },
          { name: "Ingresos por método", rows: metodoRows(data) },
          { name: "Cobranza", rows: cobranzaRows(data) },
        ])} disabled={!data || busy === "all"}>
          <Download className="h-4 w-4" /> Descargar Excel completo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : loading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-xl border border-border bg-card p-5">
                  <Icon className={`h-5 w-5 ${c.tone}`} />
                  <p className="mt-3 text-2xl font-semibold">{c.value}</p>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                </div>
              );
            })}
          </div>

          <ReportSection
            title="Estado de resultados"
            description="Ingresos cobrados menos gastos registrados, por mes."
            exporting={busy === "estado"}
            onExport={() => runExport("estado", "Estado-de-resultados", [{ name: "Estado de resultados", rows: estadoRows(data) }])}
          >
            <StatementTable months={data.months} />
          </ReportSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              title="Gastos por categoría"
              description="A qué se destinó el gasto del periodo."
              exporting={busy === "categorias"}
              onExport={() => runExport("categorias", "Gastos-por-categoria", [{ name: "Gastos por categoría", rows: categoriaRows(data) }])}
            >
              <BreakdownTable rows={data.gastos_por_categoria} header="Categoría" countHeader="Movimientos" emptyText="Sin gastos en el periodo." />
            </ReportSection>

            <ReportSection
              title="Ingresos por método de pago"
              description="Cómo entró el dinero del periodo."
              exporting={busy === "metodos"}
              onExport={() => runExport("metodos", "Ingresos-por-metodo", [{ name: "Ingresos por método", rows: metodoRows(data) }])}
            >
              <BreakdownTable rows={data.ingresos_por_metodo} header="Método" countHeader="Pagos" emptyText="Sin ingresos en el periodo." />
            </ReportSection>
          </div>

          <ReportSection
            title="Cobranza por unidad"
            description="Cuotas acumuladas contra pagos recibidos, por unidad."
            exporting={busy === "cobranza"}
            onExport={() => runExport("cobranza", "Cobranza-por-unidad", [{ name: "Cobranza", rows: cobranzaRows(data) }])}
          >
            <CollectionsTable rows={data.cobranza} />
          </ReportSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              title="Detalle de ingresos"
              description={`${data.ingresos_detalle.length} pagos en el periodo.`}
              exporting={busy === "ingresos"}
              onExport={() => runExport("ingresos", "Ingresos", [{ name: "Ingresos", rows: ingresosRows(data) }])}
            >
              {data.ingresos_detalle.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ingresos en el periodo.</p>
              ) : (
                <div className="space-y-2">
                  {data.ingresos_detalle.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.unit_label || "—"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(p.occurred_at)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</p>
                      </div>
                      <span className="text-sm font-medium text-emerald-600">{mxn(p.amount)}</span>
                    </div>
                  ))}
                  {data.ingresos_detalle.length > 8 && (
                    <p className="text-xs text-muted-foreground">Y {data.ingresos_detalle.length - 8} más en el Excel.</p>
                  )}
                </div>
              )}
            </ReportSection>

            <ReportSection
              title="Detalle de gastos"
              description={`${data.gastos_detalle.length} movimientos en el periodo.`}
              exporting={busy === "gastos"}
              onExport={() => runExport("gastos", "Gastos", [{ name: "Gastos", rows: gastosRows(data) }])}
            >
              {data.gastos_detalle.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin gastos en el periodo.</p>
              ) : (
                <div className="space-y-2">
                  {data.gastos_detalle.slice(0, 8).map((v, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{v.supplier_name || "Proveedor"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(v.occurred_at)} · {v.category} · {v.concept}</p>
                      </div>
                      <span className="text-sm font-medium text-red-600">{mxn(v.amount)}</span>
                    </div>
                  ))}
                  {data.gastos_detalle.length > 8 && (
                    <p className="text-xs text-muted-foreground">Y {data.gastos_detalle.length - 8} más en el Excel.</p>
                  )}
                </div>
              )}
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}