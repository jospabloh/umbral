import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Onboarding() {
  const navigate = useNavigate();
  const [path, setPath] = useState(null);

  // create condominium state
  const [form, setForm] = useState({ name: "", legal_name: "", address: "", privacy_contact_email: "" });
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // join code state
  const [code, setCode] = useState("");
  const [requestedRole, setRequestedRole] = useState("resident");
  const [joinMsg, setJoinMsg] = useState("");

  const handleCreate = async () => {
    setError("");
    if (!form.name || !form.legal_name || !form.address || !form.privacy_contact_email) {
      setError("Completa todos los datos del condominio.");
      return;
    }
    if (!accept) {
      setError("Debes aceptar los términos para crear el condominio.");
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke("onboarding", { action: "createCondominium", ...form, accept_terms: true });
      toast({ title: "Condominio creado", description: "Tu prueba gratuita dura 30 días." });
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No pudimos crear el condominio.");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    setError("");
    setJoinMsg("");
    if (!code.trim()) {
      setError("Escribe el código de invitación.");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("onboarding", {
        action: "redeemJoinCode", join_code: code.trim().toUpperCase(), requested_role: requestedRole,
      });
      setJoinMsg(`Solicitud enviada a "${res.data?.condominium_name || "el condominio"}". El administrador la revisará.`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Código no válido.");
    } finally {
      setLoading(false);
    }
  };

  if (!path) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Umbral</h1>
            <p className="mt-2 text-sm text-muted-foreground">Elige cómo quieres empezar.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <button onClick={() => setPath("register")} className="group rounded-2xl border border-border bg-card p-6 text-left transition hover:border-primary hover:shadow-md">
              <Building2 className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Registrar mi condominio</h2>
              <p className="mt-1 text-sm text-muted-foreground">Crea el condominio y queda como administrador. Prueba gratuita de 30 días.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Empezar <ArrowRight className="h-4 w-4" /></span>
            </button>
            <button onClick={() => setPath("join")} className="group rounded-2xl border border-border bg-card p-6 text-left transition hover:border-primary hover:shadow-md">
              <KeyRound className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Tengo un código de invitación</h2>
              <p className="mt-1 text-sm text-muted-foreground">Únete a un condominio existente. El administrador aprueba tu ingreso.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Usar código <ArrowRight className="h-4 w-4" /></span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <button onClick={() => setPath(null)} className="mb-6 text-sm text-muted-foreground hover:underline">← Volver</button>
        {path === "register" ? (
          <div className="rounded-2xl border border-border bg-card p-8">
            <h1 className="text-xl font-semibold">Datos del condominio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Estos datos identifican a tu condominio.</p>
            {error && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del condominio</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Residencial Las Palmas" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Razón social</Label>
                <Input id="legal_name" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} placeholder="Condominio Las Palmas S.A. de C.V." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Domicilio completo</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, número, colonia, CP, ciudad" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privacy_email">Correo de contacto de privacidad</Label>
                <Input id="privacy_email" type="email" value={form.privacy_contact_email} onChange={(e) => setForm({ ...form, privacy_contact_email: e.target.value })} placeholder="privacidad@condominio.com" />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
                <span className="text-muted-foreground">
                  Leí el <a href="https://acaciaco.com.mx/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Aviso de Privacidad</a> y acepto los <a href="https://acaciaco.com.mx/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Términos y Condiciones</a>, incluidas las condiciones para el tratamiento de datos personales, en nombre de {form.name || "mi condominio"}. Declaro que tengo facultades para hacerlo.
                </span>
              </label>
              <Button className="w-full" onClick={handleCreate} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : "Crear condominio"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8">
            <h1 className="text-xl font-semibold">Unirme a un condominio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escribe el código que te dio el administrador.</p>
            {error && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {joinMsg && <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{joinMsg}</div>}
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de invitación</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD1234" className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Solicito el rol</Label>
                <select id="role" value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)} className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="resident">Residente</option>
                  <option value="committee">Mesa directiva</option>
                  <option value="guard">Vigilante</option>
                </select>
              </div>
              <Button className="w-full" onClick={handleRedeem} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar solicitud"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}