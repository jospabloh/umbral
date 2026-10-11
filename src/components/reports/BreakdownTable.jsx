import React from "react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

export default function BreakdownTable({ rows, header, countHeader, emptyText }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">{header}</th>
            <th className="pb-2 pr-3 text-right font-medium">{countHeader}</th>
            <th className="pb-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3">{r.label}</td>
              <td className="py-2.5 pr-3 text-right text-muted-foreground">{r.count}</td>
              <td className="py-2.5 text-right font-medium">{mxn(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium">
            <td className="pt-2.5 pr-3">Total</td>
            <td />
            <td className="pt-2.5 text-right">{mxn(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}