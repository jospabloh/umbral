import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function LegalAcceptance() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("legal", { action: "status" });
      setStatus(res.data);
    } catch (e) {} finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const decide = async (decision) => {
    setBusy(true);
    try {
      await base44.functions.invoke("legal", { action: "decide", decision });
      toast({ title: decision === "accepted" ? "Términos aceptados" : "Términos rechazados" });
      navigate("/");
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.error, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!status?.needs_decision || !status?.can_decide) {
    navigate("/");
    return null;
  }

  const condoName = "tu condominio";

  if (confirmReject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <h1 className="text-xl font-semibold">¿Seguro que quieres rechazar los términos?</h1>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Si los rechazas: la cuenta de {condoName} sigue funcionando hasta el fin del periodo ya pagado o de la prueba gratuita. ACACIA cancela la renovación de la suscripción. Al terminar ese periodo el servicio se suspende y tienes 30 días para pedir tu información. Después ACACIA cierra la cuenta y elimina los datos del condominio. Puedes cambiar de opinión y aceptar en cualquier momento antes del cierre.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmReject(false)}>Volver y revisar</Button>
            <Button variant="destructive" onClick={() => decide("rejected")} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Sí, rechazar</Button>
          </div>
        </div>
      </div>
    );
  }

  const graceActive = status.grace_remaining_days == null || status.grace_remaining_days > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Términos y condiciones para el manejo de datos</h1>

        {status.changes_es && (
          <div className="mt-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Qué cambió</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">{status.changes_es}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-4">
          <a href={status.terms_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Términos y Condiciones <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={status.privacy_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Aviso de Privacidad <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
          <span className="text-muted-foreground">
            Leí el Aviso de Privacidad y acepto los Términos y Condiciones, incluidas las condiciones para el tratamiento de datos personales, en nombre de {condoName}. Declaro que tengo facultades para hacerlo.
          </span>
        </label>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => decide("accepted")} disabled={!accept || busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Aceptar
          </Button>
          <Button variant="outline" onClick={() => setConfirmReject(true)} disabled={busy} className="flex-1">Rechazar</Button>
          {graceActive && (
            <Button variant="ghost" onClick={() => navigate("/")} disabled={busy} className="flex-1">Recordármelo después</Button>
          )}
        </div>
        {status.grace_remaining_days != null && graceActive && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Quedan {status.grace_remaining_days} días para decidir.</p>
        )}
      </div>
    </div>
  );
}