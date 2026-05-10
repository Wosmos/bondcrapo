"use client";

import type { WalletSnapshot } from "./types";

/**
 * Exports of the person's own data. Both libraries are dynamic imports (PLAN section 7).
 * Spreadsheet headers follow the page language; the PDF uses English headings because the
 * built-in PDF fonts cannot shape Urdu script.
 */

export interface ExportLabels {
  bondsSheet: string;
  winsSheet: string;
  number: string;
  denomination: string;
  label: string;
  added: string;
  drawDate: string;
  drawNumber: string;
  prize: string;
  amount: string;
}

const tierName = (tier: number) => (tier === 1 ? "1st" : tier === 2 ? "2nd" : "3rd");
const stamp = () => new Date().toISOString().slice(0, 10);

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportXlsx(snapshot: WalletSnapshot, l: ExportLabels, tier: (n: number) => string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const bonds = XLSX.utils.aoa_to_sheet([
    [l.number, l.denomination, l.label, l.added],
    ...snapshot.bonds.map((b) => [b.bondNumber, b.denominationCode, b.label ?? "", b.addedAt.slice(0, 10)]),
  ]);
  const wins = XLSX.utils.aoa_to_sheet([
    [l.drawDate, l.drawNumber, l.denomination, l.number, l.prize, l.amount],
    ...snapshot.matches.map((m) => [m.drawDate, m.drawNumber ?? "", m.denominationCode, m.bondNumber, tier(m.tier), m.amountPkr]),
  ]);
  // Keep bond numbers as text so leading zeros survive.
  bonds["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 12 }];
  wins["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, bonds, l.bondsSheet.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, wins, l.winsSheet.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  save(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `bondcheck-wallet-${stamp()}.xlsx`);
}

export async function exportPdf(snapshot: WalletSnapshot): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const total = snapshot.matches.reduce((n, m) => n + m.amountPkr, 0);
  doc.setFontSize(16);
  doc.text("BondCheck wallet", 40, 50);
  doc.setFontSize(10);
  doc.text(
    `${snapshot.bonds.length} bonds, ${snapshot.matches.length} wins, Rs ${total.toLocaleString("en-PK")} won (before tax). Exported ${stamp()}.`,
    40,
    68,
  );
  autoTable(doc, {
    startY: 86,
    head: [["Bond number", "Denomination", "Label", "Added"]],
    body: snapshot.bonds.map((b) => [b.bondNumber, `Rs ${b.denominationCode}`, b.label ?? "", b.addedAt.slice(0, 10)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
  });
  if (snapshot.matches.length) {
    autoTable(doc, {
      head: [["Draw date", "Denomination", "Bond number", "Prize", "Amount (Rs)"]],
      body: snapshot.matches.map((m) => [m.drawDate, `Rs ${m.denominationCode}`, m.bondNumber, tierName(m.tier), m.amountPkr.toLocaleString("en-PK")]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [4, 120, 87] },
    });
  }
  save(doc.output("blob"), `bondcheck-wallet-${stamp()}.pdf`);
}
