import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeControl() {
  const [pref, setPref] = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const options = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];
  const Current = options.find((o) => o.value === pref)?.icon || Monitor;

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-2 w-40 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {options.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.value}
                onClick={() => {
                  setPref(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors ${
                  pref === o.value ? "text-primary font-medium" : "text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar tema"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:shadow-lg transition-shadow text-foreground"
      >
        <Current className="w-5 h-5" />
      </button>
    </div>
  );
}