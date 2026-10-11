import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Upload, Loader2 } from "lucide-react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const STATUS = { pending: "Pendiente", issued: "Emitida", rejected: "Rechazada" };
const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  issued: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—";
}

export default function InvoicesPanel({ canIssue = false, statusFilter = "" }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ invoice_number: "", note: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState(statusFilter);

  const load = () => {
    setLoading(true);
    const payload = { action: "listInvoiceRequests" };
    if (filter) payload.status = filter;
    base44.functions.invoke("billing", payload)
      .then((res) => setItems(res.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const openIssue = (inv) => {
    setSelected(inv);
    setForm({ invoice_number: "", note: "" });
    setFile(null);
  };

  const issue = async () => {
    if (!form.invoice_number.trim()) {
      toast({ variant: "destructive", title: "Folio fiscal requerido" });
      return;
    }
    setSaving(true);
    try {
      let file_uri = null;
      if (file) {
        const up = await base44.integrations.Core.UploadPrivateFile({ file });
        file_uri = up.file_uri;
      }
      const res = await base44.functions.invoke("billing", {
        action: "issueInvoice",
        invoice_request_id: selected.id,
        invoice_number: form.invoice_number.trim(),
        invoice_file_uri: file_uri,
        note: form.note.trim(),
      });
      const emailError = res.data?.email_error;
      toast({
        title: "Factura emitida",
        description: emailError ? `No se pudo enviar el correo: ${emailError}` : "Se envió al correo de facturación.",
      });
      setSelected(null);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (inv) => {
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: inv.invoice_file_uri });
      window.open(res.signed_url, "_blank");
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo abrir el archivo" });
    }
  };

  const reject = async (inv) => {
    if (!confirm("¿Marcar esta solicitud como rechazada?")) return;
    try {
      await base44.functions.invoke("billing", { action: "rejectInvoice", invoice_request_id: inv.id });
      toast({ title: "Solicitud rechazada" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Cargando..." : `${items.length} solicitud${items.length === 1 ? "" : "es"}`}
        </p>
        <Select value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="issued">Emitidas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No hay solicitudes de factura.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{inv.fiscal_name || inv.unit_label || "Sin nombre fiscal"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[inv.status] || ""}`}>{STATUS[inv.status] || inv.status}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(inv.requested_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {inv.unit_label ? `${inv.unit_label} · ` : ""}{inv.concept || "Mantenimiento"} · {mxn(inv.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    RFC: {inv.fiscal_rfc || "—"} · Correo: {inv.fiscal_email || "—"}
                  </p>
                  {inv.invoice_number && (
                    <p className="mt-1 text-xs text-muted-foreground">Folio fiscal: {inv.invoice_number}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {inv.invoice_file_uri && (
                    <Button variant="outline" size="sm" onClick={() => openFile(inv)}>Ver CFDI</Button>
                  )}
                  {canIssue && inv.status !== "issued" && (
                    <>
                      <Button size="sm" onClick={() => openIssue(inv)}>
                        <Upload className="h-4 w-4" /> Emitir
                      </Button>
                      {inv.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => reject(inv)}>Rechazar</Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Emitir factura fiscal</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">{selected.fiscal_name || selected.unit_label}</p>
                <p className="text-muted-foreground">{selected.concept} · {mxn(selected.amount)}</p>
                <p className="text-muted-foreground">RFC: {selected.fiscal_rfc || "—"}{selected.fiscal_regime ? ` · ${selected.fiscal_regime}` : ""}</p>
                <p className="text-muted-foreground">Uso: {selected.fiscal_use || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="folio">Folio fiscal (UUID)</Label>
                <Input id="folio" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="A1B2C3D4-..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdfi">Archivo del CFDI (PDF)</Label>
                <Input id="cdfi" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">Se adjunta al correo de facturación del solicitante.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nota">Nota (opcional)</Label>
                <Input id="nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={issue} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Emitiendo..." : "Emitir y enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}