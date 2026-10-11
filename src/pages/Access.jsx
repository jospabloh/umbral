import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import QrCode from "@/components/qr/QrCode";
import { QrCode as QrIcon, Plus, ArrowLeft, Ban, LogIn, LogOut, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const PASS_TYPE = { single: "Una vez", recurring: "Recurrente", resident: "Residente" };
const STATUS = { active: "Activo", used: "Usado", expired: "Expirado", revoked: "Revocado" };
const EVENT_TYPE = { entry: "Ingreso", exit: "Salida", denied: "Denegado" };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export default function Access() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passes, setPasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrPass, setQrPass] = useState(null);
  const [form, setForm] = useState({ visitor_name: "", visitor_phone: "", pass_type: "single", valid_until: "", note: "" });
  const [saving, setSaving] = useState(false);

  const role = user?.role || "user";
  const canViewAll = ["admin", "condo_admin", "committee", "guard"].includes(role);
  const canCreate = ["admin", "condo_admin", "committee", "guard", "resident"].includes(role);

  const load = () => {
    setLoading(true);
    base44.functions.invoke("access", { action: "listPasses" })
      .then((res) => setPasses(res.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    if (canViewAll) {
      base44.functions.invoke("access", { action: "listEvents" })
        .then((res) => setEvents(res.data?.items || []))
        .catch(() => {});
    }
  };

  useEffect(() => { load(); }, []);

  const createPass = async () => {
    if (!form.visitor_name.trim()) { toast({ variant: "destructive", title: "Nombre del visitante requerido" }); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("access", {
        action: "createPass",
        visitor_name: form.visitor_name.trim(),
        visitor_phone: form.visitor_phone.trim(),
        pass_type: form.pass_type,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        note: form.note.trim(),
      });
      toast({ title: "Pase creado" });
      setDialogOpen(false);
      setForm({ visitor_name: "", visitor_phone: "", pass_type: "single", valid_until: "", note: "" });
      setQrPass(res.data?.pass || null);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id) => {
    if (!confirm("¿Revocar este pase?")) return;
    try {
      await base44.functions.invoke("access", { action: "revokePass", pass_id: id });
      toast({ title: "Pase revocado" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const passUrl = qrPass ? `${window.location.origin}/p/${qrPass.qr_token}` : "";

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <QrIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Accesos</h1>
            <p className="text-sm text-muted-foreground">Pases QR y eventos</p>
          </div>
        </div>
        {canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nuevo pase</Button>}
      </div>

      <Tabs defaultValue="passes">
        <TabsList>
          <TabsTrigger value="passes">Pases</TabsTrigger>
          {canViewAll && <TabsTrigger value="events">Eventos</TabsTrigger>}
        </TabsList>

        <TabsContent value="passes" className="mt-4">
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : passes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No hay pases. {canCreate && "Crea el primero."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {passes.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.visitor_name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                        {STATUS[p.status] || p.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{PASS_TYPE[p.pass_type] || p.pass_type}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.unit_label ? `${p.unit_label} · ` : ""}Vence: {fmtDate(p.valid_until)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setQrPass(p)}>Ver QR</Button>
                    {p.status === "active" && <Button variant="ghost" size="icon" onClick={() => revoke(p.id)}><Ban className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {canViewAll && (
          <TabsContent value="events" className="mt-4">
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <p className="text-muted-foreground">No hay eventos registrados.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    {e.event_type === "entry" ? <LogIn className="h-4 w-4 text-emerald-600" /> : e.event_type === "exit" ? <LogOut className="h-4 w-4 text-blue-600" /> : <Ban className="h-4 w-4 text-red-600" />}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{e.visitor_name || "Sin nombre"}</span>
                      {e.unit_label && <span className="text-sm text-muted-foreground"> · {e.unit_label}</span>}
                      <p className="text-xs text-muted-foreground">{EVENT_TYPE[e.event_type]} · {e.guard_name} · {fmtDate(e.occurred_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo pase de acceso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="vn">Nombre del visitante</Label>
              <Input id="vn" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp">Teléfono (opcional)</Label>
              <Input id="vp" value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.pass_type} onValueChange={(v) => setForm({ ...form, pass_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PASS_TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vu">Vence (opcional)</Label>
                <Input id="vu" type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n">Nota (opcional)</Label>
              <Textarea id="n" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={createPass} disabled={saving}>{saving ? "Creando..." : "Crear pase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrPass} onOpenChange={(o) => !o && setQrPass(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pase de acceso</DialogTitle></DialogHeader>
          {qrPass && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QrCode value={`${window.location.origin}/p/${qrPass.qr_token}`} size={220} />
              <div className="text-center">
                <p className="font-medium">{qrPass.visitor_name}</p>
                {qrPass.unit_label && <p className="text-sm text-muted-foreground">{qrPass.unit_label}</p>}
                <p className="text-sm text-muted-foreground">Vence: {fmtDate(qrPass.valid_until)}</p>
              </div>
              <a href={`${window.location.origin}/p/${qrPass.qr_token}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Abrir página del pase</a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}