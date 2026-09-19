import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogbookEntry } from '@/lib/firebase/logbook';
import { formatINR } from '@/lib/utils/currency';
import { formatIsoToDisplayDate } from '@/lib/utils/date';

/**
 * Exports transactions to CSV formatted for Excel with UTF-8 BOM.
 */
export function exportTransactionsToCsv(
  entries: LogbookEntry[],
  filename: string = 'RuralCred_Transaction_Statement.csv'
) {
  const headers = ['Date', 'Type', 'Category', 'Tags', 'Amount (INR)', 'Description / Note'];

  const rows = entries.map((e) => {
    const cleanNote = (e.note || '').replace(/"/g, '""');
    const tagsStr = (e.tags || []).join('; ');
    const displayDate = formatIsoToDisplayDate(e.date);
    const amountVal = e.type === 'income' ? e.amount : -e.amount;

    return [
      `"${displayDate}"`,
      `"${e.type.toUpperCase()}"`,
      `"${e.category}"`,
      `"${tagsStr}"`,
      amountVal,
      `"${cleanNote}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface PdfStatementOptions {
  enterpriseName: string;
  entrepreneurName: string;
  location: string;
  dateRangeLabel: string;
}

/**
 * Exports a Bank-Ready PDF Transaction Statement for credit appraisal & verification.
 */
export function exportTransactionsToPdf(entries: LogbookEntry[], options: PdfStatementOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const primaryColor: [number, number, number] = [15, 76, 58]; // Emerald
  const slateDark: [number, number, number] = [30, 41, 59];
  const slateMuted: [number, number, number] = [100, 116, 139];
  const cardBg: [number, number, number] = [248, 250, 252];
  const accentBorder: [number, number, number] = [226, 232, 240];

  let currentY = 16;

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, pageWidth - margin * 2, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RURALCRED ADVISOR • VERIFIED TRANSACTION STATEMENT', margin + 6, currentY + 7);

  doc.setFontSize(13);
  doc.text(options.enterpriseName.toUpperCase(), margin + 6, currentY + 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${options.dateRangeLabel}`, pageWidth - margin - 6, currentY + 7, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin - 6, currentY + 16, { align: 'right' });

  currentY += 28;

  // Applicant Card
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...accentBorder);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateDark);
  doc.text(`Proprietor: ${options.entrepreneurName}`, margin + 5, currentY + 7);
  doc.text(`Location: ${options.location}`, margin + 5, currentY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateMuted);
  doc.text(`Total Records: ${entries.length} transactions`, pageWidth - margin - 5, currentY + 7, { align: 'right' });
  doc.text(`Purpose: Institutional Loan Appraisal & Bank Verification`, pageWidth - margin - 5, currentY + 13, { align: 'right' });

  currentY += 24;

  // Financial Summary Cards
  const totalInflow = entries.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalOutflow = entries.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netSurplus = totalInflow - totalOutflow;

  const boxWidth = (pageWidth - margin * 2 - 6) / 3;
  const boxHeight = 15;

  const summaryCards = [
    { label: 'Total Inflow (Receipts)', val: `Rs. ${totalInflow.toLocaleString('en-IN')}`, color: [22, 101, 52] },
    { label: 'Total Outflow (Payments)', val: `Rs. ${totalOutflow.toLocaleString('en-IN')}`, color: [185, 28, 28] },
    { label: 'Net Cash Surplus', val: `Rs. ${netSurplus.toLocaleString('en-IN')}`, color: primaryColor },
  ];

  summaryCards.forEach((c, idx) => {
    const x = margin + idx * (boxWidth + 3);
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...accentBorder);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(c.label, x + 4, currentY + 5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, x + 4, currentY + 11.5);
  });

  currentY += boxHeight + 8;

  // Transactions Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Date', 'Classification', 'Category & Tags', 'Description', 'Inflow (+)', 'Outflow (-)']],
    body: entries.map((e) => [
      formatIsoToDisplayDate(e.date),
      e.type === 'income' ? 'RECEIPT' : 'EXPENSE',
      `${e.category}${e.tags && e.tags.length > 0 ? ' (' + e.tags.join(', ') + ')' : ''}`,
      e.note || '-',
      e.type === 'income' ? `Rs. ${e.amount.toLocaleString('en-IN')}` : '-',
      e.type === 'expense' ? `Rs. ${e.amount.toLocaleString('en-IN')}` : '-',
    ]),
    headStyles: { fillColor: primaryColor, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.2, textColor: slateDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22 },
      2: { cellWidth: 40 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    theme: 'grid',
    styles: { cellPadding: 2 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (finalY + 20 < doc.internal.pageSize.getHeight()) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(
      'This statement is digitally maintained by RuralCred Advisor and certified for commercial bank appraisal.',
      margin,
      finalY
    );
  }

  const safeName = options.enterpriseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Statement_${safeName}.pdf`);
}
