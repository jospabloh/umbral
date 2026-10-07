import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Building2, ShieldCheck, LifeBuoy, Info, UserCog, ArrowRight } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [condo, setCondo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.data?.condominium_id) { setLoading(false); return; }
    base44.entities.Condominium.get(user.data.condominium_id)
      .then(setCondo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.data?.condominium_id]);

  if (!user?.data?.condominium_id && !loading) return <Navigate to="/onboarding" replace />;

  const roleLabels = {
    admin: "Plataforma",
    condo_admin: "Administrador del condominio",
    committee: "Mesa directiva",
    guard: "Vigilante",
    resident: "Residente",
    user: "Sin asignar",
  };

  const quickLinks = [
    { to: "/cuenta", label: "Mi cuenta", icon: UserCog, desc: "Perfil, miembros y dispositivos" },
    { to: "/soporte", label: "Soporte", icon: LifeBuoy, desc: "Reporta un problema o sugiere" },
    { to: "/acerca", label: "Acerca de", icon: Info, desc: "Manual y novedades" },
  ];
  if (user?.role === "condo_admin" || user?.role === "admin") {
    quickLinks.splice(1, 0, { to: "/permisos", label: "Permisos", icon: ShieldCheck, desc: "Ajusta el acceso por rol" });
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{condo?.data?.name || "Cargando..."}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleLabels[user?.role] || ""} · Estado: <span className="font-medium text-foreground">{condo?.data?.billing_status || "—"}</span>
            </p>
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">Accesos rápidos</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.to} to={q.to} className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary hover:shadow-sm">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-medium">{q.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{q.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">Abrir <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}