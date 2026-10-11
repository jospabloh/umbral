import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Truck, Plus, Pencil, Trash2, ArrowLeft, Ban } from "lucide-react";

const CATEGORIES = {
  mantenimiento: "Mantenimiento", seguridad: "Seguridad", limpieza: "Limpieza",
  jardineria: "Jardinería", servicios: "Servicios", suministros: "Suministros", otro: "Otro",
};
const METHOD = { transfer: "Transferencia", cash: "Efectivo", card: "Tarjeta", check: "Cheque", other: "Otro" };
const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—");

export default function Suppliers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sForm, setSForm] = useState({ name: "", category: "otro", contact_name: "", contact_email: "", contact_phone: "", rfc: "", notes: "" });
  const [pForm, setPForm] = useState({ supplier_id: "", concept: "", amount: "", method: "transfer", reference: "" });

  const role = user?.role || "user";
  const canWrite = ["admin", "condo_admin"].includes(role);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("billing", { action: "listSuppliers" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("billing", { action: "listVendorPayments" }).catch(() => ({ data: { items: [] } })),
    ]).then(([s, p]) => {
      setSuppliers(s.data?.items || []);
      setPayments(p.data?.items || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreateSupplier = () => {
    setEditing(null);
    setSForm({ name: "", category: "otro", contact_name: "", contact_email: "", contact_phone: "", rfc: "", notes: "" });
    setSupplierDialog(true);
  };

  const openEditSupplier = (s) => {
    setEditing(s);
    setSForm({
      name: s.name || "", category: s.category || "otro", contact_name: s.contact_name || "",
      contact_email: s.contact_email || "", contact_phone: s.contact_phone || "", rfc: s.rfc || "", notes: s.notes || "",
    });
    setSupplierDialog(true);
  };

  const saveSupplier = async () => {
    if (!sForm.name.trim()) { toast({ variant: "destructive", title: "Nombre requerido" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("billing", {
        action: "saveSupplier",
        supplier_id: editing?.id,
        ...sForm,
      });
      toast({ title: editing ? "Proveedor actualizado" : "Proveedor creado" });
      setSupplierDialog(false);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const removeSupplier = async (id) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    try {
      await base44.functions.invoke("billing", { action: "deleteSupplier", supplier_id: id });
      toast({ title: "Proveedor eliminado" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  const savePayment = async () => {
    if (!pForm.concept.trim() || !pForm.amount) { toast({ variant: "destructive", title: "Concepto y monto requeridos" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("billing", {
        action: "createVendorPayment",
        supplier_id: pForm.supplier_id || null,
        concept: pForm.concept.trim(),
        amount: Number(pForm.amount),
        method: pForm.method,
        reference: pForm.reference.trim(),
      });
      toast({ title: "Pago registrado" });
      setPayDialog(false);
      setPForm({ supplier_id: "", concept: "", amount: "", method: "transfer", reference: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const cancelPayment = async (id) => {
    if (!confirm("¿Cancelar este pago? Se conserva el registro original.")) return;
    try {
      await base44.functions.invoke("billing", { action: "cancelVendorPayment", vendor_payment_id: id });
      toast({ title: "Pago cancelado" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  const total = payments.filter((p) => p.status !== "cancelado").reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div>
      <Link to="/panel" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al panel
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Proveedores</h1>
            <p className="text-sm text-muted-foreground">Total pagado: {mxn(total)}</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPayDialog(true)}><Plus className="h-4 w-4" /> Registrar pago</Button>
            <Button onClick={openCreateSupplier}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Proveedores</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : suppliers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">Sin proveedores registrados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{CATEGORIES[s.category] || s.category}</span>
                      {s.status === "inactive" && <span className="text-xs text-muted-foreground">Inactivo</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[s.contact_name, s.contact_phone, s.contact_email].filter(Boolean).join(" · ") || "Sin contacto"}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditSupplier(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeSupplier(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">Sin pagos registrados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{p.supplier_name || "Proveedor"}</span>
                      {p.status === "cancelado" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Cancelado</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.concept} · {METHOD[p.method] || p.method} · {fmtDate(p.occurred_at)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{mxn(p.amount)}</span>
                    {canWrite && p.status !== "cancelado" && (
                      <Button variant="ghost" size="icon" onClick={() => cancelPayment(p.id)}><Ban className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sn">Nombre o razón social</Label>
              <Input id="sn" value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={sForm.category} onValueChange={(v) => setSForm({ ...sForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="sc">Contacto</Label><Input id="sc" value={sForm.contact_name} onChange={(e) => setSForm({ ...sForm, contact_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="sp">Teléfono</Label><Input id="sp" value={sForm.contact_phone} onChange={(e) => setSForm({ ...sForm, contact_phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="se">Correo</Label><Input id="se" type="email" value={sForm.contact_email} onChange={(e) => setSForm({ ...sForm, contact_email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="sr">RFC</Label><Input id="sr" value={sForm.rfc} onChange={(e) => setSForm({ ...sForm, rfc: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="sno">Notas</Label><Textarea id="sno" rows={2} value={sForm.notes} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveSupplier} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago a proveedor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={pForm.supplier_id} onValueChange={(v) => setPForm({ ...pForm, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc">Concepto</Label>
              <Input id="pc" value={pForm.concept} onChange={(e) => setPForm({ ...pForm, concept: e.target.value })} placeholder="Mantenimiento de jardín" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="pa">Monto</Label><Input id="pa" type="number" value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={pForm.method} onValueChange={(v) => setPForm({ ...pForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(METHOD).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pr">Referencia</Label><Input id="pr" value={pForm.reference} onChange={(e) => setPForm({ ...pForm, reference: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={savePayment} disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}