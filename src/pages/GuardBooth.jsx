import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, ArrowLeft, LogIn, LogOut, Ban, Search } from "lucide-react";
import { Link } from "react-router-dom";

const EVENT_TYPE = { entry: "Ingreso", exit: "Salida", denied: "Denegado" };

function fmtDateTime(iso) { return iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—"; }

export default function GuardBooth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const loadEvents = () => {
    setLoadingEvents(true);
    base44.functions.invoke("access", { action: "listEvents" })
      .then((res) => setEvents((res.items || []).slice(0, 15)))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  };

  useEffect(() => { loadEvents(); }, []);

  const verify = async () => {
    const t = token.trim();
    if (!t) return;
    setVerifying(true);
    setResult(null);
    try {
      // Accept full URL or bare token
      const bare = t.includes("/p/") ? t.split("/p/").pop() : t;
      const res = await base44.functions.invoke("access", { action: "verifyPass", token: bare });
      setResult(res);
    } catch (e) {
      setResult({ error: e.message || "Pase no válido" });
    } finally {
      setVerifying(false);
    }
  };

  const registerEvent = async (eventType) => {
    if (!result || !result.pass) return;
    try {
      await base44.functions.invoke("access", {
        action: "registerEvent",
        event_type: eventType,
        pass_id: result.pass.id,
        unit_id: result.unit?.id || null,
        visitor_name: result.pass.visitor_name,
      });
      toast({ title: EVENT_TYPE[eventType] + " registrado" });
      setResult(null);
      setToken("");
      loadEvents();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Caseta</h1>
          <p className="text-sm text-muted-foreground">Verificación de pases y registro de acceso</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <label className="text-sm font-medium">Escanear o ingresar código del pase</label>
        <div className="mt-2 flex gap-2">
          <Input value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="Código QR o URL del pase" autoFocus />
          <Button onClick={verify} disabled={verifying || !token.trim()}><Search className="h-4 w-4" /> Verificar</Button>
        </div>

        {result && (
          <div className="mt-4">
            {result.error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {result.error}
              </div>
            ) : (
              <div className={`rounded-lg border p-4 ${result.valid ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{result.pass.visitor_name}</p>
                    {result.unit && <p className="text-sm text-muted-foreground">Unidad: {result.unit.internal_id}</p>}
                    {result.condominium && <p className="text-sm text-muted-foreground">{result.condominium.name}</p>}
                    <p className="mt-1 text-sm">Vence: {fmtDateTime(result.pass.valid_until)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${result.valid ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                    {result.valid ? "Válido" : "No válido"}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => registerEvent("entry")} disabled={!result.valid}><LogIn className="h-4 w-4" /> Registrar ingreso</Button>
                  <Button variant="outline" onClick={() => registerEvent("exit")}><LogOut className="h-4 w-4" /> Registrar salida</Button>
                  <Button variant="destructive" onClick={() => registerEvent("denied")}><Ban className="h-4 w-4" /> Denegar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-medium">Eventos recientes</h2>
      {loadingEvents ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin eventos.</p>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              {e.event_type === "entry" ? <LogIn className="h-4 w-4 text-emerald-600" /> : e.event_type === "exit" ? <LogOut className="h-4 w-4 text-blue-600" /> : <Ban className="h-4 w-4 text-red-600" />}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{e.visitor_name || "Sin nombre"}</span>
                {e.unit_label && <span className="text-sm text-muted-foreground"> · {e.unit_label}</span>}
                <p className="text-xs text-muted-foreground">{EVENT_TYPE[e.event_type]} · {e.guard_name} · {fmtDateTime(e.occurred_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}