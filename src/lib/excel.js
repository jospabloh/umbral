import * as XLSX from "xlsx";

const SHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Column widths sized from the longest value in each column.
function columnWidths(rows) {
  const widths = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      if (!widths[i] || len > widths[i]) widths[i] = len;
    });
  });
  return widths.map((n) => ({ wch: Math.min(Math.max(n + 2, 10), 46) }));
}

// sheets: [{ name, rows: [[...]] }] — the first row of each sheet is treated as the header.
export function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const rows = (sheet.rows || []).filter(Boolean);
    const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [["Sin datos"]]);
    ws["!cols"] = columnWidths(rows);
    ws["!freeze"] = { xSplit: "0", ySplit: "1" };
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name || "Hoja").slice(0, 31));
  });
  return wb;
}

export function downloadWorkbook(wb, filename) {
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], { type: SHEET_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 5000);
}

export function exportSheets(filename, sheets) {
  downloadWorkbook(buildWorkbook(sheets), filename);
}

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}