import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Megaphone, Plus, ArrowLeft, Pin, Archive } from "lucide-react";
import { Link } from "react-router-dom";

const TYPE_LABELS = { info: "Información", alert: "Alerta", maintenance: "Mantenimiento", meeting: "Asamblea" };
const TYPE_STYLES = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  alert: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  maintenance: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) : "—"; }

export default function Notices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "info", pinned: false });
  const [saving, setSaving] = useState(false);

  const role = user?.role || "user";
  const canCreate = ["admin", "condo_admin", "committee"].includes(role);

  const load = () => {
    setLoading(true);
    base44.functions.invoke("community", { action: "listNotices" })
      .then((res) => setNotices(res.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast({ variant: "destructive", title: "Título y mensaje requeridos" }); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("community", {
        action: "createNotice",
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        pinned: form.pinned,
      });
      toast({ title: "Aviso publicado" });
      setDialogOpen(false);
      setForm({ title: "", body: "", type: "info", pinned: false });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    if (!confirm("¿Archivar este aviso?")) return;
    try {
      await base44.functions.invoke("community", { action: "archiveNotice", notice_id: id });
      toast({ title: "Aviso archivado" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const sorted = [...notices].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Avisos</h1>
            <p className="text-sm text-muted-foreground">Comunicación del condominio</p>
          </div>
        </div>
        {canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nuevo aviso</Button>}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No hay avisos publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((n) => (
            <div key={n.id} className={`rounded-lg border bg-card p-5 ${n.pinned ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {n.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_STYLES[n.type] || ""}`}>{TYPE_LABELS[n.type] || n.type}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(n.published_at)}</span>
                  </div>
                  <h3 className="mt-2 font-semibold">{n.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Por {n.created_by_name}</p>
                </div>
                {canCreate && <Button variant="ghost" size="icon" onClick={() => archive(n.id)}><Archive className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo aviso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="nt">Título</Label><Input id="nt" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="nb">Mensaje</Label><Textarea id="nb" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
              Fijar arriba
            </label>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={create} disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}