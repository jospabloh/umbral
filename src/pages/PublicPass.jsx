import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import QrCode from "@/components/qr/QrCode";
import { ShieldCheck, Building2, Clock, CheckCircle2, XCircle } from "lucide-react";

const PASS_TYPE = { single: "Una vez", recurring: "Recurrente", resident: "Residente" };
const STATUS = { active: "Activo", used: "Usado", expired: "Expirado", revoked: "Revocado" };

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
}

export default function PublicPass() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.functions.invoke("access", { action: "verifyPass", token })
      .then((res) => {
        const d = res.data;
        if (d?.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message || "Pase no encontrado"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-semibold">Umbral</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Verificando pase...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/50">
            <XCircle className="mx-auto h-10 w-10 text-red-600" />
            <p className="mt-3 font-medium text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {data.valid ? (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Pase válido
                </span>
              ) : (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  <XCircle className="h-4 w-4" /> Pase no válido
                </span>
              )}

              <QrCode value={window.location.href} size={200} />

              <h1 className="mt-4 text-xl font-semibold">{data.pass.visitor_name}</h1>
              {data.unit && <p className="text-sm text-muted-foreground">Unidad: {data.unit.internal_id}</p>}
              {data.condominium && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {data.condominium.name}
                </p>
              )}

              <div className="mt-4 w-full space-y-1.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{PASS_TYPE[data.pass.pass_type] || data.pass.pass_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><span>{STATUS[data.pass.status] || data.pass.status}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Vence</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtDateTime(data.pass.valid_until)}</span></div>
                {data.pass.note && <div className="mt-2 rounded-lg bg-muted p-2 text-left text-sm">{data.pass.note}</div>}
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">Umbral · ACACIA</p>
      </div>
    </div>
  );
}