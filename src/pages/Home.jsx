import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Building2, ShieldCheck, LifeBuoy, Info, UserCog, ArrowRight, QrCode, Wallet, Megaphone, ScanLine, LayoutDashboard, Truck, Users } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [condo, setCondo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.data?.condominium_id) { setLoading(false); return; }
    base44.functions.invoke("account", { action: "getCondominium" })
      .then((res) => setCondo(res.data?.condominium || null))
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

  const quickLinks = [];
  const r = user?.role;
  if (r === "condo_admin" || r === "admin" || r === "committee") {
    quickLinks.push({ to: "/unidades", label: "Unidades", icon: Building2, desc: "Viviendas y residentes" });
  }
  quickLinks.push({ to: "/accesos", label: "Accesos", icon: QrCode, desc: "Pases QR y eventos" });
  if (r === "condo_admin" || r === "admin" || r === "committee" || r === "resident") {
    quickLinks.push({ to: "/cuotas", label: r === "resident" ? "Estado de cuenta" : "Cuotas y pagos", icon: Wallet, desc: r === "resident" ? "Tu saldo y movimientos" : "Cuotas, pagos y saldos" });
  }
  quickLinks.push({ to: "/avisos", label: "Avisos", icon: Megaphone, desc: "Comunicación del condominio" });
  if (r === "guard" || r === "condo_admin" || r === "admin" || r === "committee") {
    quickLinks.push({ to: "/caseta", label: "Caseta", icon: ScanLine, desc: "Verificar pases y acceso" });
  }
  if (r === "condo_admin" || r === "admin" || r === "committee") {
    quickLinks.unshift({ to: "/panel", label: "Panel", icon: LayoutDashboard, desc: "Pendientes, saldos y control" });
    quickLinks.push({ to: "/proveedores", label: "Proveedores", icon: Truck, desc: "Pagos a proveedores" });
    quickLinks.push({ to: "/personal", label: "Personal", icon: Users, desc: "Vacaciones, ausencias y permisos" });
  }
  quickLinks.push({ to: "/cuenta", label: "Mi cuenta", icon: UserCog, desc: "Perfil, miembros y dispositivos" });
  if (r === "condo_admin" || r === "admin") {
    quickLinks.push({ to: "/permisos", label: "Permisos", icon: ShieldCheck, desc: "Ajusta el acceso por rol" });
  }
  quickLinks.push({ to: "/soporte", label: "Soporte", icon: LifeBuoy, desc: "Reporta un problema o sugiere" });
  quickLinks.push({ to: "/acerca", label: "Acerca de", icon: Info, desc: "Manual y novedades" });

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{condo?.name || "Cargando..."}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleLabels[user?.role] || ""} · Estado: <span className="font-medium text-foreground">{condo?.billing_status || "—"}</span>
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