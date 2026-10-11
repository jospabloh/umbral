import React from "react";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

export default function CollectionsTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sin unidades registradas.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Unidad</th>
            <th className="pb-2 pr-3 font-medium">Residente</th>
            <th className="pb-2 pr-3 text-right font-medium">Cuotas</th>
            <th className="pb-2 pr-3 text-right font-medium">Pagado</th>
            <th className="pb-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.internal_id} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3 font-medium">{r.internal_id}</td>
              <td className="py-2.5 pr-3 text-muted-foreground">{r.resident_name || "—"}</td>
              <td className="py-2.5 pr-3 text-right">{mxn(r.total_fees)}</td>
              <td className="py-2.5 pr-3 text-right text-emerald-600">{mxn(r.total_payments)}</td>
              <td className={`py-2.5 text-right font-medium ${r.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {mxn(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium">
            <td className="pt-2.5 pr-3">Total</td>
            <td />
            <td className="pt-2.5 pr-3 text-right">{mxn(rows.reduce((s, r) => s + r.total_fees, 0))}</td>
            <td className="pt-2.5 pr-3 text-right text-emerald-600">{mxn(rows.reduce((s, r) => s + r.total_payments, 0))}</td>
            <td className="pt-2.5 text-right">{mxn(rows.reduce((s, r) => s + r.balance, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}