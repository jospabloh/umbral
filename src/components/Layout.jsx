import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ThemeControl from "@/components/ThemeControl";
import SessionTimeout from "@/components/SessionTimeout";
import { useAuth } from "@/lib/AuthContext";
import { useSessionHeartbeat } from "@/lib/session";
import { base44 } from "@/api/base44Client";

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [condo, setCondo] = useState(null);
  const [legalNeeded, setLegalNeeded] = useState(false);
  useSessionHeartbeat();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.data?.condominium_id) return;
      try {
        const res = await base44.entities.Condominium.get(user.data.condominium_id);
        if (!cancelled) setCondo(res);
      } catch (e) {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [user?.data?.condominium_id]);

  useEffect(() => {
    if (user?.role !== "condo_admin" && user?.role !== "admin") return;
    if (!user?.data?.condominium_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("legal", { action: "status" });
        if (!cancelled) setLegalNeeded(!!res.data?.needs_decision);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [user?.role, user?.data?.condominium_id, location.pathname]);

  const degraded = condo?.data?.billing_status === "view_only" || condo?.data?.billing_status === "suspended";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold">Umbral</span>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block lg:sticky lg:top-0 lg:h-screen">
          <Sidebar />
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={() => logout(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 bg-card shadow-xl">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 rounded-lg p-2 hover:bg-accent"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-border px-4 py-3">
                <button
                  onClick={() => logout(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1">
          {degraded && (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              Este condominio está en modo de solo lectura. Puedes consultar tu información, pero no hacer cambios.
            </div>
          )}
          {legalNeeded && (
            <div className="border-b border-primary/30 bg-primary/5 px-4 py-2.5 text-center text-sm">
              <span className="text-foreground">Hay una nueva versión de términos pendiente de aceptar. </span>
              <button onClick={() => navigate("/terminos")} className="font-medium text-primary hover:underline">Revisar ahora</button>
            </div>
          )}
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <ThemeControl />
      <SessionTimeout />
    </div>
  );
}