import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Support() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("soporte");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!subject.trim() || !message.trim()) {
      setError("Completa el asunto y el mensaje.");
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke("support", { action: "create", type: tab, subject, message });
      toast({ title: "Enviado", description: "Tu mensaje llegó a nuestro equipo." });
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err.response?.data?.error || "No pudimos enviar tu mensaje.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cuéntanos qué necesitas. Para datos personales usa la opción ARCO.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button onClick={() => setTab("soporte")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${tab === "soporte" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}>
          <LifeBuoy className="h-5 w-5 text-primary" />
          <div><p className="font-medium">Soporte</p><p className="text-xs text-muted-foreground">Reporta un problema</p></div>
        </button>
        <button onClick={() => setTab("mejora")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${tab === "mejora" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}>
          <Lightbulb className="h-5 w-5 text-primary" />
          <div><p className="font-medium">Sugerir una mejora</p><p className="text-xs text-muted-foreground">Compártenos tu idea</p></div>
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="subject">Asunto</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Describe brevemente" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Mensaje</Label>
          <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Detalla tu solicitud" />
        </div>
        <Button className="w-full sm:w-auto" onClick={submit} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar"}
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        ¿Necesitas ejercicio de tus derechos de privacidad (ARCO)? Escribe a{" "}
        <a href="mailto:contacto@acaciaco.com.mx" className="text-primary hover:underline">contacto@acaciaco.com.mx</a>.
      </p>
    </div>
  );
}