import React, { useState, useMemo } from "react";
import { APP_VERSION, RELEASE_DATE, CHANGELOG, MANUAL_SECTIONS } from "@/lib/appConfig";
import { Search, ChevronDown, BookOpen, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function About() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});
  const [showHistory, setShowHistory] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return MANUAL_SECTIONS;
    const q = query.toLowerCase();
    return MANUAL_SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
    );
  }, [query]);

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Acerca de Umbral</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versión {APP_VERSION} · {RELEASE_DATE}</p>

      {/* Novedades */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Novedades de esta versión</h2>
        </div>
        <ul className="mt-3 space-y-1.5">
          {CHANGELOG[0].items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary">•</span> {item}
            </li>
          ))}
        </ul>
        <button onClick={() => setShowHistory((v) => !v)} className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {showHistory ? "Ocultar historial" : "Ver historial completo"}
          <ChevronDown className={`h-4 w-4 transition ${showHistory ? "rotate-180" : ""}`} />
        </button>
        {showHistory && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {CHANGELOG.map((c) => (
              <div key={c.version}>
                <p className="text-sm font-medium">v{c.version} · {c.date} — {c.title}</p>
                <ul className="mt-1 space-y-0.5">
                  {c.items.map((item, i) => <li key={i} className="text-xs text-muted-foreground">— {item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Manual de uso</h2>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en el manual..." className="pl-10" />
        </div>
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados.</p>}
          {filtered.map((s) => (
            <div key={s.id} className="rounded-lg border border-border">
              <button onClick={() => toggle(s.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="font-medium">{s.title}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open[s.id] ? "rotate-180" : ""}`} />
              </button>
              {open[s.id] && <p className="px-4 pb-4 text-sm text-muted-foreground">{s.body}</p>}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Hecho con ♥ para quienes administran y habitan condominios · ACACIA
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        <a href="https://acaciaco.com.mx/legal/terminos" target="_blank" rel="noopener noreferrer" className="hover:underline">Términos</a>
        {" · "}
        <a href="https://acaciaco.com.mx/legal/privacidad" target="_blank" rel="noopener noreferrer" className="hover:underline">Aviso de Privacidad</a>
        {" · "}
        <a href="mailto:contacto@acaciaco.com.mx" className="hover:underline">contacto@acaciaco.com.mx</a>
      </p>
    </div>
  );
}