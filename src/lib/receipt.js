import { jsPDF } from "jspdf";

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const METHOD_LABELS = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };

// Genera un recibo de pago de mantenimiento en PDF (no es un CFDI).
export function downloadPaymentReceipt({ payment, condominium }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 56;
  let y = 72;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RECIBO DE PAGO", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("Comprobante interno. No es un CFDI.", left, y + 14);
  doc.setTextColor(0);

  y += 44;
  doc.setDrawColor(210);
  doc.line(left, y, 556, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(condominium?.name || "Condominio", left, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (condominium?.legal_name) { doc.text(condominium.legal_name, left, y); y += 13; }
  if (condominium?.address) { doc.text(condominium.address, left, y); y += 13; }
  doc.setTextColor(0);

  const folio = `REC-${String(payment.id || "").slice(-6).toUpperCase()}`;
  const fecha = payment.occurred_at
    ? new Date(payment.occurred_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });

  y += 18;
  const rows = [
    ["Folio", folio],
    ["Fecha", fecha],
    ["Unidad", payment.unit_label || "—"],
    ["Concepto", "Cuota de mantenimiento"],
    ["Método de pago", METHOD_LABELS[payment.method] || payment.method || "—"],
    ["Referencia", payment.reference || "—"],
  ];

  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setTextColor(120);
    doc.text(label, left, y);
    doc.setTextColor(0);
    doc.text(String(value), left + 150, y);
    y += 20;
  });

  y += 10;
  doc.setDrawColor(210);
  doc.line(left, y, 556, y);
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total pagado", left, y);
  doc.setFontSize(18);
  doc.text(mxn(payment.amount), 556, y, { align: "right" });

  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const nota = doc.splitTextToSize(
    "Este recibo ampara el pago recibido por la administración del condominio y no sustituye a un comprobante fiscal digital (CFDI). Si necesitas factura fiscal, solicítala desde la plataforma indicando tus datos de facturación.",
    500
  );
  doc.text(nota, left, y);

  doc.save(`${folio}.pdf`);
}