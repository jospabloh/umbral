import React from "react";
import { Building2 } from "lucide-react";

export default function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <div className="hidden w-1/2 lg:flex lg:flex-col lg:justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Building2 className="h-6 w-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Umbral</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Administración clara<br />para condominios y fraccionamientos.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Cuentas, accesos, cuotas y avisos en un solo lugar. Hecho con ♥ para quienes administran y habitan condominios.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">ACACIA · México</p>
      </div>
    </div>
  );
}