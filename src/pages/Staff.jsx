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
import { Users, Plus, Pencil, Trash2, ArrowLeft, Check, X, CalendarDays } from "lucide-react";

const LEAVE_TYPES = { vacation: "Vacaciones", sick: "Incapacidad", personal: "Asunto personal", permit: "Permiso", unpaid: "Sin goce de sueldo" };
const LEAVE_STATUS = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };
const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—");

export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffDialog, setStaffDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sForm, setSForm] = useState({ full_name: "", position: "", department: "", phone: "", email: "", hire_date: "", notes: "" });
  const [lForm, setLForm] = useState({ staff_id: "", type: "vacation", start_date: "", end_date: "", reason: "" });

  const role = user?.role || "user";
  const canWrite = ["admin", "condo_admin"].includes(role);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("hr", { action: "listStaff" }).catch(() => ({ data: { items: [] } })),
      base44.functions.invoke("hr", { action: "listLeaves" }).catch(() => ({ data: { items: [] } })),
    ]).then(([s, l]) => {
      setStaff(s.data?.items || []);
      setLeaves(l.data?.items || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreateStaff = () => {
    setEditing(null);
    setSForm({ full_name: "", position: "", department: "", phone: "", email: "", hire_date: "", notes: "" });
    setStaffDialog(true);
  };

  const openEditStaff = (m) => {
    setEditing(m);
    setSForm({
      full_name: m.full_name || "", position: m.position || "", department: m.department || "",
      phone: m.phone || "", email: m.email || "", hire_date: m.hire_date || "", notes: m.notes || "",
    });
    setStaffDialog(true);
  };

  const saveStaff = async () => {
    if (!sForm.full_name.trim()) { toast({ variant: "destructive", title: "Nombre requerido" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("hr", { action: "saveStaff", staff_id: editing?.id, ...sForm });
      toast({ title: editing ? "Colaborador actualizado" : "Colaborador agregado" });
      setStaffDialog(false);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = async (id) => {
    if (!confirm("¿Eliminar a este colaborador?")) return;
    try {
      await base44.functions.invoke("hr", { action: "deleteStaff", staff_id: id });
      toast({ title: "Colaborador eliminado" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  const saveLeave = async () => {
    if (!lForm.staff_id || !lForm.start_date) { toast({ variant: "destructive", title: "Colaborador y fecha inicial requeridos" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("hr", { action: "createLeave", ...lForm });
      toast({ title: "Solicitud registrada" });
      setLeaveDialog(false);
      setLForm({ staff_id: "", type: "vacation", start_date: "", end_date: "", reason: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id, decision) => {
    try {
      await base44.functions.invoke("hr", { action: "decideLeave", leave_id: id, decision });
      toast({ title: decision === "approved" ? "Solicitud aprobada" : "Solicitud rechazada" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.response?.data?.error || e.message });
    }
  };

  const pendingCount = leaves.filter((l) => l.status === "pending").length;
  const activeCount = staff.filter((s) => s.status === "active").length;

  return (
    <div>
      <Link to="/panel" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al panel
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Personal</h1>
            <p className="text-sm text-muted-foreground">{activeCount} activos · {pendingCount} solicitudes pendientes</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLeaveDialog(true)}><Plus className="h-4 w-4" /> Nueva solicitud</Button>
            <Button onClick={openCreateStaff}><Plus className="h-4 w-4" /> Nuevo colaborador</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Plantilla</TabsTrigger>
          <TabsTrigger value="leaves">Vacaciones y permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : staff.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">Sin colaboradores registrados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.full_name}</span>
                      {m.position && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m.position}</span>}
                      {m.status === "inactive" && <span className="text-xs text-muted-foreground">Inactivo</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[m.phone, m.email, m.hire_date ? `Ingreso ${fmtDate(m.hire_date)}` : null].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditStaff(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeStaff(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          {leaves.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Sin solicitudes registradas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.map((l) => (
                <div key={l.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{l.staff_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[l.status] || ""}`}>{LEAVE_STATUS[l.status] || l.status}</span>
                        <span className="text-xs text-muted-foreground">{LEAVE_TYPES[l.type] || l.type}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {fmtDate(l.start_date)} a {fmtDate(l.end_date)} · {l.days} día{l.days === 1 ? "" : "s"}
                      </p>
                      {l.reason && <p className="mt-0.5 text-sm text-muted-foreground">{l.reason}</p>}
                    </div>
                    {canWrite && l.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(l.id, "approved")}><Check className="h-4 w-4" /> Aprobar</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(l.id, "rejected")}><X className="h-4 w-4" /> Rechazar</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={staffDialog} onOpenChange={setStaffDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar colaborador" : "Nuevo colaborador"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="fn">Nombre completo</Label><Input id="fn" value={sForm.full_name} onChange={(e) => setSForm({ ...sForm, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="po">Puesto</Label><Input id="po" value={sForm.position} onChange={(e) => setSForm({ ...sForm, position: e.target.value })} placeholder="Vigilante" /></div>
              <div className="space-y-1.5"><Label htmlFor="de">Área</Label><Input id="de" value={sForm.department} onChange={(e) => setSForm({ ...sForm, department: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pt">Teléfono</Label><Input id="pt" value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pe">Correo</Label><Input id="pe" type="email" value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="ph">Fecha de ingreso</Label><Input id="ph" type="date" value={sForm.hire_date} onChange={(e) => setSForm({ ...sForm, hire_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="pn">Notas</Label><Textarea id="pn" rows={2} value={sForm.notes} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveStaff} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva solicitud de ausencia</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={lForm.staff_id} onValueChange={(v) => setLForm({ ...lForm, staff_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{staff.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={lForm.type} onValueChange={(v) => setLForm({ ...lForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="sd">Desde</Label><Input id="sd" type="date" value={lForm.start_date} onChange={(e) => setLForm({ ...lForm, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ed">Hasta</Label><Input id="ed" type="date" value={lForm.end_date} onChange={(e) => setLForm({ ...lForm, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="mr">Motivo</Label><Textarea id="mr" rows={2} value={lForm.reason} onChange={(e) => setLForm({ ...lForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveLeave} disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}