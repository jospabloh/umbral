import React, { useEffect } from "react";
import { useSessionTimeout } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function SessionTimeout() {
  const { warning, remaining, dismiss } = useSessionTimeout();
  if (!warning) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">¿Sigues ahí?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cerraremos tu sesión por inactividad en{" "}
          <span className="font-mono font-medium text-foreground">
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
          .
        </p>
        <Button className="mt-5 w-full" onClick={dismiss}>
          Seguir conectado
        </Button>
      </div>
    </div>
  );
}