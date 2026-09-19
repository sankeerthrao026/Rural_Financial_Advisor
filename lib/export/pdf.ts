import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UnifiedBusinessPlan } from '@/lib/finance/plan';

export function exportPlanToPdf(plan: UnifiedBusinessPlan, isTelugu: boolean = false) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors
  const primaryColor: [number, number, number] = [15, 76, 58]; // Deep Forest Emerald
  const slateDark: [number, number, number] = [30, 41, 59];
  const slateMuted: [number, number, number] = [100, 116, 139];
  const cardBg: [number, number, number] = [248, 250, 252];
  const accentBorder: [number, number, number] = [226, 232, 240];

  let currentY = 16;

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, pageWidth - margin * 2, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RURALCRED ADVISOR • BANK-READY CREDIT APPRAISAL MEMORANDUM', margin + 6, currentY + 7);

  doc.setFontSize(14);
  doc.text(plan.enterpriseName.toUpperCase(), margin + 6, currentY + 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${plan.generatedDate} • Confidential Banking Proposal`, pageWidth - margin - 6, currentY + 7, { align: 'right' });
  doc.text(`Scheme: ${plan.selectedSchemeName}`, pageWidth - margin - 6, currentY + 16, { align: 'right' });

  currentY += 30;

  // Section 1: Entrepreneur & Enterprise Profile Card
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...accentBorder);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(...slateDark);
  doc.setFont('helvetica', 'bold');
  doc.text('1. APPLICANT & ENTERPRISE PROFILE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const col1X = margin + 4;
  const col2X = margin + 65;
  const col3X = margin + 125;

  doc.text(`Applicant Name: ${plan.entrepreneurName}`, col1X, currentY + 13);
  doc.text(`Enterprise Type: ${plan.category}`, col1X, currentY + 20);

  doc.text(`District / Location: ${plan.location}`, col2X, currentY + 13);
  doc.text(`Social Category: ${plan.socialCategory} (${plan.gender})`, col2X, currentY + 20);

  doc.text(`Enterprise Stage: ${plan.isNewEnterprise ? 'New Greenfield Unit' : 'Expansion / Modernization'}`, col3X, currentY + 13);
  doc.text(`Statutory Status: Udyam MSME Registered`, col3X, currentY + 20);

  currentY += 34;

  // Section 2: Executive Summary
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('2. PROJECT EXECUTIVE SUMMARY', margin, currentY);
  currentY += 4;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateDark);

  const splitSummary = doc.splitTextToSize(plan.executiveSummary, pageWidth - margin * 2);
  doc.text(splitSummary, margin, currentY);
  currentY += splitSummary.length * 3.8 + 4;

  // Section 3: Financing Structure & Scheme Terms (Side-by-side metric boxes)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('3. FINANCING STRUCTURE & REPAYMENT TERMS', margin, currentY);
  currentY += 4;

  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  const boxHeight = 16;

  const finMetrics = [
    { label: 'Total Project Cost', val: `Rs. ${plan.totalProjectCost.toLocaleString('en-IN')}` },
    { label: `Promoter Margin (${plan.promoterMarginPercent}%)`, val: `Rs. ${plan.promoterMargin.toLocaleString('en-IN')}` },
    { label: 'Sanctioned Loan', val: `Rs. ${plan.requestedLoanAmount.toLocaleString('en-IN')}` },
    { label: 'Interest Rate p.a.', val: `${plan.interestRateAnnual.toFixed(1)}% p.a.` },
  ];

  finMetrics.forEach((m, idx) => {
    const x = margin + idx * (boxWidth + 3);
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...accentBorder);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(m.label, x + 3, currentY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(m.val, x + 3, currentY + 12);
  });

  currentY += boxHeight + 4;

  // Secondary Terms Row
  const termMetrics = [
    { label: 'Govt Capital Subsidy', val: plan.subsidyAmount ? `${plan.subsidyPercent}% (Rs. ${plan.subsidyAmount.toLocaleString('en-IN')})` : 'Direct Credit Refinance' },
    { label: 'Tenure & Grace', val: `${plan.tenureYears} Years (${plan.moratoriumMonths}m grace)` },
    { label: 'Monthly EMI', val: `Rs. ${plan.monthlyEmi.toLocaleString('en-IN')}` },
    { label: 'Quarterly EMI', val: `Rs. ${plan.quarterlyEmi.toLocaleString('en-IN')}` },
  ];

  termMetrics.forEach((m, idx) => {
    const x = margin + idx * (boxWidth + 3);
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...accentBorder);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(m.label, x + 3, currentY + 5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(m.val, x + 3, currentY + 12);
  });

  currentY += boxHeight + 6;

  // Section 4: Capital Deployment Breakdown Table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('4. CAPITAL OUTLAY ALLOCATION (CAPEX vs WORKING CAPITAL)', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Asset / Expenditure Allocation Item', 'Category', 'Amount (Rs.)', 'Share (%)']],
    body: plan.capitalAllocations.map((item) => [
      item.item,
      item.category === 'capex' ? 'Capital Assets (Capex)' : item.category === 'working_capital' ? 'Working Capital (Opex)' : 'Contingency / Licensing',
      `Rs. ${item.amount.toLocaleString('en-IN')}`,
      `${item.percentage}%`,
    ]),
    headStyles: { fillColor: primaryColor, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: slateDark },
    theme: 'grid',
    styles: { cellPadding: 2 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Section 5: DSCR & Sovereign Guarantee Callout (Side-by-side cards)
  const dscrBoxWidth = (pageWidth - margin * 2 - 4) / 2;

  // DSCR Card
  doc.setFillColor(240, 253, 244); // Light emerald
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, currentY, dscrBoxWidth, 26, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`5. DEBT SERVICE COVERAGE (DSCR): ${plan.dscr.dscrValue.toFixed(2)}x`, margin + 4, currentY + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateDark);
  const dscrText = doc.splitTextToSize(
    `Benchmark: ${plan.dscr.benchmark}. Projected Annual Net Operating Income is Rs. ${plan.dscr.annualNetOperatingIncome.toLocaleString('en-IN')} against Rs. ${plan.dscr.annualDebtService.toLocaleString('en-IN')} annual debt service. ${plan.dscr.interpretation.slice(0, 140)}...`,
    dscrBoxWidth - 8
  );
  doc.text(dscrText, margin + 4, currentY + 11);

  // Guarantee Card
  const gX = margin + dscrBoxWidth + 4;
  doc.setFillColor(239, 246, 255); // Light blue
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(gX, currentY, dscrBoxWidth, 26, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`6. SOVEREIGN COLLATERAL-FREE GUARANTEE`, gX + 4, currentY + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateDark);
  const gText = doc.splitTextToSize(
    `Covered under ${plan.guaranteeInfo.guaranteeAgency} (${plan.guaranteeInfo.coveragePercent}% cover). Under RBI Master Directions, lending banks are strictly exempted from requiring personal collateral or third-party guarantee.`,
    dscrBoxWidth - 8
  );
  doc.text(gText, gX + 4, currentY + 11);

  currentY += 32;

  // ---------------- Page 2: Cash Flow Statement & Documents ----------------
  doc.addPage();
  currentY = 16;

  // Page 2 Header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateMuted);
  doc.text(`${plan.enterpriseName.toUpperCase()} • CREDIT APPRAISAL ANNEXURES`, margin, currentY);
  doc.text(`Page 2 of 2`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;

  // Section 7: 12-Month Projected Cash Flow Statement
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('7. 12-MONTH PROJECTED CASH FLOW & DEBT SERVICING STATEMENT', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Month', 'Gross Revenue (Rs.)', 'Operating Exp (Rs.)', 'Net Operating Income', 'Debt Service (EMI)', 'Net Surplus', 'Cumulative Cash']],
    body: plan.cashFlowForecast.map((m) => [
      m.monthName.split(' ')[0],
      `Rs. ${m.projectedRevenue.toLocaleString('en-IN')}`,
      `Rs. ${m.projectedExpense.toLocaleString('en-IN')}`,
      `Rs. ${m.netOperatingIncome.toLocaleString('en-IN')}`,
      m.debtService > 0 ? `Rs. ${m.debtService.toLocaleString('en-IN')}` : '0 (Grace)',
      `Rs. ${m.netCashFlow.toLocaleString('en-IN')}`,
      `Rs. ${m.closingCashBalance.toLocaleString('en-IN')}`,
    ]),
    headStyles: { fillColor: primaryColor, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.8, textColor: slateDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'grid',
    styles: { cellPadding: 1.5 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 8: Supporting Document Checklist Table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('8. MANDATORY BANK APPRAISAL & COMPLIANCE CHECKLIST', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Document / Statutory Requirement', 'Compliance Status', 'Verification Objective']],
    body: plan.documentChecklist.map((d) => [
      d.name,
      d.importance.toUpperCase(),
      d.description,
    ]),
    headStyles: { fillColor: slateDark, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: slateDark },
    theme: 'grid',
    styles: { cellPadding: 1.8 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Section 9: Formal Declaration & Signatures Block
  if (currentY + 36 > pageHeight) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(...cardBg);
  doc.setDrawColor(...accentBorder);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateDark);
  doc.text('9. DECLARATION & BANK APPRAISAL ENDORSEMENT', margin + 4, currentY + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateMuted);
  doc.text(
    'I hereby declare that all particulars furnished in this project proposal are true and accurate to the best of my knowledge.',
    margin + 4,
    currentY + 11
  );

  const sigCol1 = margin + 10;
  const sigCol2 = margin + 110;

  doc.line(sigCol1, currentY + 24, sigCol1 + 60, currentY + 24);
  doc.text(`Applicant Signature: ${plan.entrepreneurName}`, sigCol1, currentY + 28);

  doc.line(sigCol2, currentY + 24, sigCol2 + 60, currentY + 24);
  doc.text('Branch Credit Manager Appraisal & Stamp', sigCol2, currentY + 28);

  // Save PDF
  const filenameSafe = plan.enterpriseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Business_Plan_${filenameSafe}.pdf`);
}
