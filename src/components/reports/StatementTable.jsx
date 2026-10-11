import React from "react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

export default function StatementTable({ months }) {
  if (!months.length) return <p className="text-sm text-muted-foreground">Sin movimientos en el periodo.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Mes</th>
            <th className="pb-2 pr-3 text-right font-medium">Ingresos</th>
            <th className="pb-2 pr-3 text-right font-medium">Gastos</th>
            <th className="pb-2 text-right font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3 capitalize">{m.label}</td>
              <td className="py-2.5 pr-3 text-right text-emerald-600">{mxn(m.ingresos)}</td>
              <td className="py-2.5 pr-3 text-right text-red-600">{mxn(m.gastos)}</td>
              <td className={`py-2.5 text-right font-medium ${m.resultado < 0 ? "text-red-600" : "text-foreground"}`}>
                {mxn(m.resultado)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium">
            <td className="pt-2.5 pr-3">Total</td>
            <td className="pt-2.5 pr-3 text-right text-emerald-600">{mxn(months.reduce((s, m) => s + m.ingresos, 0))}</td>
            <td className="pt-2.5 pr-3 text-right text-red-600">{mxn(months.reduce((s, m) => s + m.gastos, 0))}</td>
            <td className="pt-2.5 text-right">{mxn(months.reduce((s, m) => s + m.resultado, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}