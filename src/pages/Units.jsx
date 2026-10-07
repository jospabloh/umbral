import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TYPE_LABELS = { casa: "Casa", departamento: "Departamento", local: "Local", estacionamiento: "Estacionamiento" };

export default function Units() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ internal_id: "", label: "", type: "casa", resident_name: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    base44.functions.invoke("units", { action: "list" })
      .then((res) => setUnits(res.items || []))
      .catch(() => toast({ variant: "destructive", title: "Error al cargar unidades" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ internal_id: "", label: "", type: "casa", resident_name: "" });
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ internal_id: u.internal_id, label: u.label || "", type: u.type || "casa", resident_name: u.resident_name || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.internal_id.trim()) { toast({ variant: "destructive", title: "Identificador requerido" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, internal_id: form.internal_id.trim(), label: form.label.trim() || form.internal_id.trim() };
      if (editing) {
        payload.unit_id = editing.id;
        await base44.functions.invoke("units", { action: "update", ...payload });
      } else {
        await base44.functions.invoke("units", { action: "create", ...payload });
      }
      toast({ title: editing ? "Unidad actualizada" : "Unidad creada" });
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar esta unidad?")) return;
    try {
      await base44.functions.invoke("units", { action: "delete", unit_id: id });
      toast({ title: "Unidad eliminada" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Unidades</h1>
            <p className="text-sm text-muted-foreground">{units.length} registradas</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nueva unidad</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : units.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No hay unidades registradas. Crea la primera.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {units.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.internal_id}</span>
                  {u.label && u.label !== u.internal_id && <span className="text-muted-foreground">· {u.label}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {u.status === "active" ? "Ocupada" : "Desocupada"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {TYPE_LABELS[u.type] || u.type}{u.resident_name ? ` · ${u.resident_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(u.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="uid">Identificador</Label>
              <Input id="uid" value={form.internal_id} onChange={(e) => setForm({ ...form, internal_id: e.target.value })} placeholder="Casa 12, A-101" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ulabel">Nombre (opcional)</Label>
              <Input id="ulabel" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Nombre legible" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ures">Residente (opcional)</Label>
              <Input id="ures" value={form.resident_name} onChange={(e) => setForm({ ...form, resident_name: e.target.value })} placeholder="Nombre del residente" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}