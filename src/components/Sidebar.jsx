import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Home, UserCog, ShieldCheck, Info, LifeBuoy, Building2, QrCode, Wallet, Megaphone, ScanLine, LayoutDashboard, Truck, Users } from "lucide-react";

const SCROLL_KEY = "umbral-sidebar-scroll";

function navItems(role) {
  const items = [
    { to: "/", label: "Inicio", icon: Home, end: true, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
    { to: "/panel", label: "Panel", icon: LayoutDashboard, roles: ["admin", "condo_admin", "committee"] },
    { to: "/unidades", label: "Unidades", icon: Building2, roles: ["admin", "condo_admin", "committee"] },
    { to: "/accesos", label: "Accesos", icon: QrCode, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
    { to: "/cuotas", label: "Cuotas", icon: Wallet, roles: ["admin", "condo_admin", "committee", "resident"] },
    { to: "/avisos", label: "Avisos", icon: Megaphone, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
    { to: "/caseta", label: "Caseta", icon: ScanLine, roles: ["admin", "condo_admin", "committee", "guard"] },
    { to: "/proveedores", label: "Proveedores", icon: Truck, roles: ["admin", "condo_admin", "committee"] },
    { to: "/personal", label: "Personal", icon: Users, roles: ["admin", "condo_admin", "committee"] },
    { to: "/cuenta", label: "Cuenta", icon: UserCog, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
    { to: "/permisos", label: "Permisos", icon: ShieldCheck, roles: ["admin", "condo_admin"] },
    { to: "/soporte", label: "Soporte", icon: LifeBuoy, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
    { to: "/acerca", label: "Acerca de", icon: Info, roles: ["admin", "condo_admin", "committee", "guard", "resident"] },
  ];
  return items.filter((i) => i.roles.includes(role));
}

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "user";
  const items = navItems(role);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved && scrollRef.current) scrollRef.current.scrollTop = parseInt(saved, 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Umbral</p>
          <p className="text-[11px] text-muted-foreground">Administración de condominios</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  aria-current={location.pathname === item.to ? "page" : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}