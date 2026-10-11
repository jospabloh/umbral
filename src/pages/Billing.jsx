import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import InvoicesPanel from "@/components/billing/InvoicesPanel";
import RequestInvoiceDialog from "@/components/billing/RequestInvoiceDialog";
import { downloadPaymentReceipt } from "@/lib/receipt";
import { Wallet, Plus, ArrowLeft, Ban, FileText, Receipt, Loader2 } from "lucide-react";

const FREQ = { one_time: "Único", monthly: "Mensual", quarterly: "Trimestral", annual: "Anual" };
const METHOD = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };
const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [balances, setBalances] = useState([]);
  const [units, setUnits] = useState([]);
  const [statement, setStatement] = useState(null);
  const [myInvoices, setMyInvoices] = useState([]);
  const [condo, setCondo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeDialog, setFeeDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [invoicePayment, setInvoicePayment] = useState(null);
  const [feeForm, setFeeForm] = useState({ concept: "", amount: "", frequency: "one_time", due_date: "", unit_id: "" });
  const [payForm, setPayForm] = useState({
    unit_id: "", amount: "", method: "cash", reference: "", requires_invoice: false,
    fiscal_rfc: "", fiscal_name: "", fiscal_regime: "", fiscal_use: "", fiscal_email: "",
  });
  const [saving, setSaving] = useState(false);

  const role = user?.role || "user";
  const isResident = role === "resident";
  const canWrite = ["admin", "condo_admin", "committee"].includes(role);

  useEffect(() => {
    if (!user?.data?.condominium_id) return;
    base44.functions.invoke("account", { action: "getCondominium" })
      .then((res) => setCondo(res.data?.condominium || null))
      .catch(() => {});
  }, [user?.data?.condominium_id]);

  const load = () => {
    setLoading(true);
    if (isResident) {
      Promise.all([
        base44.functions.invoke("billing", { action: "getUnitStatement" }).catch(() => null),
        base44.functions.invoke("billing", { action: "listInvoiceRequests" }).catch(() => ({ data: { items: [] } })),
      ]).then(([st, inv]) => {
        if (st) setStatement(st.data);
        setMyInvoices(inv.data?.items || []);
      }).finally(() => setLoading(false));
    } else {
      Promise.all([
        base44.functions.invoke("billing", { action: "listFees" }).catch(() => ({ data: { items: [] } })),
        base44.functions.invoke("billing", { action: "listPayments" }).catch(() => ({ data: { items: [] } })),
        base44.functions.invoke("billing", { action: "getBalances" }).catch(() => ({ data: { items: [] } })),
        base44.functions.invoke("units", { action: "list" }).catch(() => ({ data: { items: [] } })),
      ]).then(([f, p, b, u]) => {
        setFees(f.data?.items || []);
        setPayments(p.data?.items || []);
        setBalances(b.data?.items || []);
        setUnits(u.data?.items || []);
      }).finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, []);

  const receipt = (payment) => {
    try {
      downloadPaymentReceipt({ payment, condominium: condo });
      toast({ title: "Recibo descargado" });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo generar el recibo" });
    }
  };

  const createFee = async () => {
    if (!feeForm.concept.trim() || !feeForm.amount) { toast({ variant: "destructive", title: "Concepto y monto requeridos" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("billing", {
        action: "createFee",
        concept: feeForm.concept.trim(),
        amount: Number(feeForm.amount),
        frequency: feeForm.frequency,
        due_date: feeForm.due_date || null,
        unit_id: feeForm.unit_id || null,
      });
      toast({ title: "Cuota creada" });
      setFeeDialog(false);
      setFeeForm({ concept: "", amount: "", frequency: "one_time", due_date: "", unit_id: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const cancelFee = async (id) => {
    if (!confirm("¿Cancelar esta cuota?")) return;
    try {
      await base44.functions.invoke("billing", { action: "cancelFee", fee_id: id });
      toast({ title: "Cuota cancelada" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  const registerPayment = async () => {
    if (!payForm.unit_id || !payForm.amount) { toast({ variant: "destructive", title: "Unidad y monto requeridos" }); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("billing", {
        action: "registerPayment",
        unit_id: payForm.unit_id,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference.trim(),
        requires_invoice: payForm.requires_invoice,
        fiscal_rfc: payForm.fiscal_rfc,
        fiscal_name: payForm.fiscal_name,
        fiscal_regime: payForm.fiscal_regime,
        fiscal_use: payForm.fiscal_use,
        fiscal_email: payForm.fiscal_email,
      });
      toast({
        title: "Pago registrado",
        description: payForm.requires_invoice ? "Se agregó a facturas pendientes." : undefined,
      });
      setPayDialog(false);
      const saved = res.data?.payment;
      setPayForm({
        unit_id: "", amount: "", method: "cash", reference: "", requires_invoice: false,
        fiscal_rfc: "", fiscal_name: "", fiscal_regime: "", fiscal_use: "", fiscal_email: "",
      });
      load();
      if (saved) receipt(saved);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  if (isResident) {
    return (
      <div>
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Estado de cuenta</h1>
            <p className="text-sm text-muted-foreground">Cuotas, pagos y facturas</p>
          </div>
        </div>

        {loading || !statement ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saldo actual</span>
                <span className={`text-2xl font-semibold ${statement.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{mxn(statement.balance)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Cuotas: </span>{mxn(statement.total_fees)}</div>
                <div><span className="text-muted-foreground">Pagado: </span>{mxn(statement.total_payments)}</div>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium">Cuotas</h2>
              {statement.fees.length === 0 ? <p className="text-sm text-muted-foreground">Sin cuotas.</p> : (
                <div className="space-y-2">
                  {statement.fees.map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div><span className="text-sm font-medium">{f.concept}</span><p className="text-xs text-muted-foreground">{FREQ[f.frequency]} · Vence {fmtDate(f.due_date)}</p></div>
                      <span className="text-sm font-medium">{mxn(f.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium">Pagos y recibos</h2>
              {statement.payments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos.</p> : (
                <div className="space-y-2">
                  {statement.payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                      <div>
                        <span className="text-sm font-medium">{METHOD[p.method] || p.method}</span>
                        {p.reference && <span className="text-xs text-muted-foreground"> · {p.reference}</span>}
                        <p className="text-xs text-muted-foreground">{fmtDateTime(p.occurred_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-600">{mxn(p.amount)}</span>
                        <Button variant="outline" size="sm" onClick={() => receipt(p)}><Receipt className="h-4 w-4" /> Recibo</Button>
                        <Button variant="ghost" size="sm" onClick={() => setInvoicePayment(p)}>Factura</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {myInvoices.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium">Mis facturas</h2>
                <div className="space-y-2">
                  {myInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div>
                        <span className="text-sm font-medium">{inv.concept}</span>
                        <p className="text-xs text-muted-foreground">
                          {inv.status === "issued" ? `Emitida · ${inv.invoice_number}` : inv.status === "rejected" ? "Rechazada" : "Pendiente de emitir"}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{mxn(inv.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <RequestInvoiceDialog
          payment={invoicePayment}
          open={!!invoicePayment}
          onOpenChange={(o) => !o && setInvoicePayment(null)}
          onRequested={load}
        />
      </div>
    );
  }

  return (
    <div>
      <Link to="/panel" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al panel
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Cuotas y pagos</h1>
            <p className="text-sm text-muted-foreground">Administración financiera</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPayDialog(true)}><Plus className="h-4 w-4" /> Registrar pago</Button>
            <Button onClick={() => setFeeDialog(true)}><Plus className="h-4 w-4" /> Nueva cuota</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">Saldos</TabsTrigger>
          <TabsTrigger value="fees">Cuotas</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="mt-4">
          {loading ? <div className="h-40 animate-pulse rounded-lg bg-muted" /> : (
            <div className="space-y-2">
              {balances.map((b) => (
                <div key={b.unit_id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div><span className="font-medium">{b.internal_id}</span>{b.resident_name && <span className="text-sm text-muted-foreground"> · {b.resident_name}</span>}</div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${b.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{mxn(b.balance)}</div>
                    <div className="text-xs text-muted-foreground">{mxn(b.total_fees)} · {mxn(b.total_payments)}</div>
                  </div>
                </div>
              ))}
              {balances.length === 0 && <p className="text-sm text-muted-foreground">Sin unidades.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <div className="space-y-2">
            {fees.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.concept}</span>
                    {f.status === "cancelled" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Cancelada</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{FREQ[f.frequency]} · {f.unit_label || "Todas las unidades"} · Vence {fmtDate(f.due_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{mxn(f.amount)}</span>
                  {canWrite && f.status === "active" && <Button variant="ghost" size="icon" onClick={() => cancelFee(f.id)}><Ban className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
            {fees.length === 0 && <p className="text-sm text-muted-foreground">Sin cuotas.</p>}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium">{p.unit_label || "—"}</span>
                  <p className="text-xs text-muted-foreground">{METHOD[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ""} · {fmtDateTime(p.occurred_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-emerald-600">{mxn(p.amount)}</span>
                  <Button variant="outline" size="sm" onClick={() => receipt(p)}><Receipt className="h-4 w-4" /> Recibo</Button>
                  <Button variant="ghost" size="sm" onClick={() => setInvoicePayment(p)}>Factura</Button>
                </div>
              </div>
            ))}
            {payments.length === 0 && <p className="text-sm text-muted-foreground">Sin pagos.</p>}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Emite el CFDI, adjunta el archivo y se enviará al correo de facturación del solicitante.</p>
          </div>
          <InvoicesPanel canIssue={canWrite} />
        </TabsContent>
      </Tabs>

      <Dialog open={feeDialog} onOpenChange={setFeeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuota</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="fc">Concepto</Label><Input id="fc" value={feeForm.concept} onChange={(e) => setFeeForm({ ...feeForm, concept: e.target.value })} placeholder="Mantenimiento mensual" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="fa">Monto</Label><Input id="fa" type="number" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Frecuencia</Label>
                <Select value={feeForm.frequency} onValueChange={(v) => setFeeForm({ ...feeForm, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FREQ).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="fd">Vence</Label><Input id="fd" type="date" value={feeForm.due_date} onChange={(e) => setFeeForm({ ...feeForm, due_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Unidad (opcional)</Label>
                <Select value={feeForm.unit_id} onValueChange={(v) => setFeeForm({ ...feeForm, unit_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.internal_id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={createFee} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Unidad</Label>
              <Select value={payForm.unit_id} onValueChange={(v) => setPayForm({ ...payForm, unit_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.internal_id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="pa">Monto</Label><Input id="pa" type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Método</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(METHOD).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pr">Referencia (opcional)</Label><Input id="pr" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></div>

            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={payForm.requires_invoice} onChange={(e) => setPayForm({ ...payForm, requires_invoice: e.target.checked })} className="rounded" />
              Requiere factura fiscal (CFDI)
            </label>

            {payForm.requires_invoice && (
              <div className="space-y-4 rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label htmlFor="ir">RFC</Label><Input id="ir" value={payForm.fiscal_rfc} onChange={(e) => setPayForm({ ...payForm, fiscal_rfc: e.target.value.toUpperCase() })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="in">Razón social</Label><Input id="in" value={payForm.fiscal_name} onChange={(e) => setPayForm({ ...payForm, fiscal_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="ig">Régimen</Label><Input id="ig" value={payForm.fiscal_regime} onChange={(e) => setPayForm({ ...payForm, fiscal_regime: e.target.value })} placeholder="601" /></div>
                  <div className="space-y-1.5"><Label htmlFor="iu">Uso</Label><Input id="iu" value={payForm.fiscal_use} onChange={(e) => setPayForm({ ...payForm, fiscal_use: e.target.value })} placeholder="G03" /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="ie">Correo para la factura</Label><Input id="ie" type="email" value={payForm.fiscal_email} onChange={(e) => setPayForm({ ...payForm, fiscal_email: e.target.value })} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={registerPayment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequestInvoiceDialog
        payment={invoicePayment}
        open={!!invoicePayment}
        onOpenChange={(o) => !o && setInvoicePayment(null)}
        onRequested={load}
      />
    </div>
  );
}