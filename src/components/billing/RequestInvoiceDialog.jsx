import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

// Solicitud de factura fiscal (CFDI) sobre un pago existente.
export default function RequestInvoiceDialog({ payment, open, onOpenChange, onRequested }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ fiscal_rfc: "", fiscal_name: "", fiscal_regime: "", fiscal_use: "", fiscal_email: "", concept: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.fiscal_rfc.trim() || !form.fiscal_name.trim()) {
      toast({ variant: "destructive", title: "RFC y razón social requeridos" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("billing", { action: "requestInvoice", payment_id: payment.id, ...form });
      toast({ title: "Solicitud enviada", description: "La administración emitirá tu factura." });
      onOpenChange(false);
      onRequested?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar factura fiscal</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">{payment?.concept || "Cuota de mantenimiento"}</p>
            <p className="text-muted-foreground">{mxn(payment?.amount)} · {payment?.unit_label || ""}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            La administración emitirá el CFDI y lo enviará al correo que indiques.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rfc">RFC</Label>
              <Input id="rfc" value={form.fiscal_rfc} onChange={(e) => setForm({ ...form, fiscal_rfc: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs">Razón social</Label>
              <Input id="rs" value={form.fiscal_name} onChange={(e) => setForm({ ...form, fiscal_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg">Régimen fiscal</Label>
              <Input id="reg" value={form.fiscal_regime} onChange={(e) => setForm({ ...form, fiscal_regime: e.target.value })} placeholder="601" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uso">Uso del CFDI</Label>
              <Input id="uso" value={form.fiscal_use} onChange={(e) => setForm({ ...form, fiscal_use: e.target.value })} placeholder="G03" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail">Correo para la factura</Label>
            <Input id="mail" type="email" value={form.fiscal_email} onChange={(e) => setForm({ ...form, fiscal_email: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Enviando..." : "Solicitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}