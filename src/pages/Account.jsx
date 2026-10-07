import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, Trash2, Download, ArrowRightLeft, AlertTriangle, Check, X, Clock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ROLES = ["condo_admin", "committee", "guard", "resident"];
const ROLE_LABELS = { condo_admin: "Administrador", committee: "Mesa directiva", guard: "Vigilante", resident: "Residente", user: "Sin asignar", admin: "Plataforma" };

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

export default function Account() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "" });
  const [members, setMembers] = useState([]);
  const [condo, setCondo] = useState(null);
  const [pending, setPending] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [legalHistory, setLegalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const isCondoAdmin = user?.role === "condo_admin" || user?.role === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const [mem, sess, leg] = await Promise.all([
        base44.functions.invoke("account", { action: "listMembers" }),
        base44.functions.invoke("account", { action: "listSessions" }),
        base44.functions.invoke("legal", { action: "history" }),
      ]);
      setMembers(mem.data?.members || []);
      setCondo(mem.data?.condominium || null);
      setSessions(sess.data?.sessions || []);
      setLegalHistory(leg.data?.items || []);
      if (isCondoAdmin) {
        const pend = await base44.functions.invoke("account", { action: "listPending" });
        setPending(pend.data?.requests || []);
      }
      if (user) setProfile({ full_name: user.data?.full_name || "", phone: user.data?.phone || "" });
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("account", { action: "updateProfile", ...profile });
      toast({ title: "Perfil actualizado" });
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await base44.functions.invoke("account", { action: "changeRole", user_id: userId, role });
      toast({ title: "Rol actualizado" });
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const removeMember = async (userId) => {
    try {
      await base44.functions.invoke("account", { action: "removeMember", user_id: userId });
      toast({ title: "Miembro removido" });
      setConfirm(null);
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const approveMember = async (requestId, role) => {
    try {
      await base44.functions.invoke("onboarding", { action: "approveMember", request_id: requestId, role });
      toast({ title: "Miembro aprobado" });
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const rejectMember = async (requestId) => {
    try {
      await base44.functions.invoke("onboarding", { action: "rejectMember", request_id: requestId });
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const delegate = async (userId) => {
    try {
      await base44.functions.invoke("account", { action: "delegateCondominium", user_id: userId });
      toast({ title: "Condominio delegado" });
      setConfirm(null);
      window.location.href = "/";
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      await base44.functions.invoke("account", { action: "revokeSession", session_id: sessionId });
      load();
    } catch (e) {}
  };

  const exportData = async () => {
    try {
      const res = await base44.functions.invoke("account", { action: "exportData" });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "umbral-datos.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  const requestDeletion = async () => {
    try {
      await base44.functions.invoke("account", { action: "requestDeletion" });
      toast({ title: "Solicitud enviada", description: "Nuestro equipo te contactará." });
      setConfirm(null);
    } catch (e) {}
  };

  const deleteAccount = async () => {
    try {
      await base44.functions.invoke("account", { action: "deleteAccount" });
      logout(true);
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Cuenta</h1>

      {/* Perfil */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Perfil</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fn">Nombre</Label>
            <Input id="fn" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Teléfono</Label>
            <Input id="ph" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </div>
        </div>
        <Button className="mt-4" onClick={saveProfile} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar</Button>
      </section>

      {/* Condominio */}
      {condo && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Condominio</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Nombre</dt><dd>{condo.name}</dd></div>
            <div><dt className="text-muted-foreground">Razón social</dt><dd>{condo.legal_name}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Domicilio</dt><dd>{condo.address}</dd></div>
            <div><dt className="text-muted-foreground">Correo de privacidad</dt><dd>{condo.privacy_contact_email}</dd></div>
            <div><dt className="text-muted-foreground">Estado del plan</dt><dd className="capitalize">{condo.billing_status}</dd></div>
            <div><dt className="text-muted-foreground">Código de invitación</dt><dd className="font-mono">{condo.join_code}</dd></div>
          </dl>
        </section>
      )}

      {/* Solicitudes pendientes */}
      {isCondoAdmin && pending.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Solicitudes de ingreso</h2>
          <div className="mt-4 space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{r.user_name || r.user_email}</p>
                  <p className="text-sm text-muted-foreground">Solicita: {ROLE_LABELS[r.requested_role] || r.requested_role}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMember(r.id, r.requested_role)}><Check className="mr-1 h-4 w-4" />Aprobar</Button>
                  <Button size="sm" variant="outline" onClick={() => rejectMember(r.id)}><X className="mr-1 h-4 w-4" />Rechazar</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Miembros */}
      {isCondoAdmin && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Miembros</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2 font-medium">Nombre</th><th className="pb-2 font-medium">Correo</th><th className="pb-2 font-medium">Rol</th><th className="pb-2 font-medium text-right">Acciones</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-3">{m.full_name || "—"}</td>
                    <td className="py-3 text-muted-foreground">{m.email}</td>
                    <td className="py-3">
                      <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} disabled={m.role === "admin"} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      {m.role !== "admin" && m.id !== user?.id && (
                        <button onClick={() => setConfirm({ type: "remove", user: m })} className="text-sm text-destructive hover:underline">Quitar</button>
                      )}
                      {m.role !== "admin" && m.role !== "condo_admin" && (
                        <button onClick={() => setConfirm({ type: "delegate", user: m })} className="ml-3 text-sm text-primary hover:underline">Delegar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Dispositivos */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Dispositivos con sesión</h2>
        <div className="mt-4 space-y-2">
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">Sin sesiones registradas.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{s.device_label}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.status === "active" ? "Activo" : s.status === "passive" ? "En segundo plano" : "Revocada"} · {timeAgo(s.last_seen)}
                  </p>
                </div>
              </div>
              {s.status !== "revoked" && <button onClick={() => revokeSession(s.id)} className="text-sm text-destructive hover:underline">Revocar</button>}
            </div>
          ))}
        </div>
      </section>

      {/* Historial de términos */}
      {isCondoAdmin && legalHistory.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Historial de términos</h2>
          <div className="mt-4 space-y-2">
            {legalHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">v{h.version} · {h.decision === "accepted" ? "Aceptado" : "Rechazado"}</p>
                  <p className="text-xs text-muted-foreground">{h.decided_by_name || h.decided_by_email} · {new Date(h.decided_at).toLocaleDateString("es-MX")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Zona de riesgo */}
      {isCondoAdmin && (
        <section className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-5 w-5" /> Zona de riesgo</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={exportData} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50">
              <Download className="h-5 w-5 text-primary" /><div><p className="font-medium">Exportar datos</p><p className="text-xs text-muted-foreground">Descarga tu información</p></div>
            </button>
            <button onClick={() => setConfirm({ type: "delegate-list" })} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50">
              <ArrowRightLeft className="h-5 w-5 text-primary" /><div><p className="font-medium">Delegar condominio</p><p className="text-xs text-muted-foreground">Transfiere la administración</p></div>
            </button>
            <button onClick={() => setConfirm({ type: "delete-condo" })} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-destructive/50">
              <Trash2 className="h-5 w-5 text-destructive" /><div><p className="font-medium">Solicitar borrado del condominio</p><p className="text-xs text-muted-foreground">Abre un ticket con ACACIA</p></div>
            </button>
            <button onClick={() => setConfirm({ type: "delete-account" })} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-destructive/50">
              <Trash2 className="h-5 w-5 text-destructive" /><div><p className="font-medium">Borrar mi cuenta</p><p className="text-xs text-muted-foreground">Elimina tu acceso</p></div>
            </button>
          </div>
        </section>
      )}

      {/* Confirmación */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-semibold">
              {confirm.type === "remove" ? "Quitar miembro" : confirm.type === "delete-condo" ? "Solicitar borrado" : confirm.type === "delete-account" ? "Borrar mi cuenta" : "Delegar condominio"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirm.type === "remove" && `¿Quitar a ${confirm.user.full_name || confirm.user.email} del condominio?`}
              {confirm.type === "delete-condo" && "Se abrirá un ticket de soporte. ACACIA contactará para confirmar el borrado."}
              {confirm.type === "delete-account" && "Tu cuenta se eliminará. Si eres el único administrador, delega primero."}
              {confirm.type === "delegate-list" && "Elige a quién delegar la administración. Tu rol pasará a mesa directiva."}
            </p>
            {confirm.type === "delegate-list" && (
              <div className="mt-4 space-y-2">
                {members.filter((m) => m.role !== "admin" && m.role !== "condo_admin" && m.id !== user?.id).map((m) => (
                  <button key={m.id} onClick={() => delegate(m.id)} className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:border-primary">
                    <span className="text-sm">{m.full_name || m.email}</span><ArrowRightLeft className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
              {confirm.type === "remove" && <Button variant="destructive" onClick={() => removeMember(confirm.user.id)}>Quitar</Button>}
              {confirm.type === "delete-condo" && <Button variant="destructive" onClick={requestDeletion}>Solicitar</Button>}
              {confirm.type === "delete-account" && <Button variant="destructive" onClick={deleteAccount}>Borrar cuenta</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}