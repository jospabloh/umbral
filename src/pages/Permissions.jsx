import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { PERMISSION_SECTIONS, PERMISSION_ACTIONS, can } from "@/lib/permissionRegistry";
import { Loader2, Pencil, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EDITABLE_ROLES = ["committee", "guard", "resident"];
const ROLE_LABELS = { condo_admin: "Administrador", committee: "Mesa directiva", guard: "Vigilante", resident: "Residente" };
const ACTION_LABELS = { ver: "Ver", crear: "Crear", modificar: "Modificar", eliminar: "Eliminar" };

export default function Permissions() {
  const { user } = useAuth();
  const [role, setRole] = useState("committee");
  const [defaults, setDefaults] = useState({});
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("permissions", { action: "get" });
        setDefaults(res.data?.defaults || {});
        setOverrides(res.data?.overrides || {});
      } catch (e) {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (section, action) => {
    const key = `${section}:${action}`;
    const current = can(role, key, overrides);
    const next = !current;
    setSaving(key);
    try {
      await base44.functions.invoke("permissions", { action: "set", role, permission_key: key, allowed: next });
      setOverrides({ ...overrides, [`${role}:${key}`]: next });
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (user?.role !== "condo_admin" && user?.role !== "admin") {
    return <p className="text-sm text-muted-foreground">No tienes acceso a esta sección.</p>;
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Permisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ajusta qué puede hacer cada rol.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {EDITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button onClick={() => setEditing((v) => !v)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${editing ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-accent"}`}>
            {editing ? <><Check className="h-4 w-4" /> Editando</> : <><Pencil className="h-4 w-4" /> Editar</>}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Sección</th>
              {PERMISSION_ACTIONS.map((a) => <th key={a} className="px-4 py-3 text-center font-medium">{ACTION_LABELS[a]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_SECTIONS.map((section) => (
              <tr key={section} className="border-b border-border/50">
                <td className="px-4 py-3 font-medium">{section}</td>
                {PERMISSION_ACTIONS.map((action) => {
                  const key = `${section}:${action}`;
                  const allowed = can(role, key, overrides);
                  return (
                    <td key={action} className="px-4 py-3 text-center">
                      <button
                        disabled={!editing || saving === key}
                        onClick={() => toggle(section, action)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${allowed ? "bg-primary" : "bg-muted"} ${!editing ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${allowed ? "translate-x-6" : "translate-x-1"}`} />
                        {saving === key && <Loader2 className="absolute -right-6 h-4 w-4 animate-spin text-muted-foreground" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">El administrador del condominio y la plataforma siempre tienen acceso completo.</p>
    </div>
  );
}