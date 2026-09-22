'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { UnifiedBusinessPlan, generateUnifiedBusinessPlan, BusinessPlanRequest } from '@/lib/finance/plan';
import { exportPlanToPdf } from '@/lib/export/pdf';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { calculateAllEligibleSchemes, SchemeCalculationResult } from '@/lib/finance/schemes';
import {
  FileText,
  Printer,
  Sparkles,
  Download,
  Building2,
  CheckCircle2,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Clock,
  Briefcase,
  UserCheck,
  CheckSquare,
  Square,
  BadgePercent,
  FileCheck,
  HelpCircle,
} from 'lucide-react';

export function BusinessPlanScreen() {
  const { profile, finance, language, dictionary, entries, totalIncome, totalExpenses } = useApp();
  const t = dictionary.businessPlan;
  const isTe = language === 'te';

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<UnifiedBusinessPlan | null>(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});

  // Compute all available schemes for selection
  const availableSchemes: SchemeCalculationResult[] = useMemo(() => {
    return calculateAllEligibleSchemes({
      loanAmount: finance.loanAmount || 900000,
      category: profile.category || 'Dairy Farming',
      gender: profile.gender || 'female',
      socialCategory: profile.socialCategory || 'OBC',
      locationType: 'rural',
      isNewEnterprise: true,
    });
  }, [finance.loanAmount, profile.category, profile.gender, profile.socialCategory]);

  const activeScheme = useMemo(() => {
    if (selectedSchemeId) {
      const found = availableSchemes.find((s) => s.schemeId === selectedSchemeId);
      if (found) return found;
    }
    const eligible = availableSchemes.filter((s) => s.isEligible);
    return eligible[0] || availableSchemes[0];
  }, [availableSchemes, selectedSchemeId]);

  // Generate or regenerate plan
  const generatePlan = async (targetSchemeId?: string) => {
    setLoading(true);
    const schemeToUse = targetSchemeId || selectedSchemeId || activeScheme?.schemeId;

    // Monthly estimates from logbook if available
    const monthlyRev = totalIncome > 0 ? totalIncome : undefined;
    const monthlyExp = totalExpenses > 0 ? totalExpenses : undefined;

    const payload: BusinessPlanRequest = {
      entrepreneurName: profile.name,
      businessName: profile.businessName,
      location: profile.location,
      category: profile.category,
      gender: profile.gender || 'female',
      socialCategory: profile.socialCategory || 'OBC',
      isNewEnterprise: true,
      marginCapital: finance.marginCapital || 100000,
      loanAmount: finance.loanAmount || 900000,
      projectCost: finance.projectCost || 1000000,
      selectedSchemeId: schemeToUse,
      monthlyRevenueEstimate: monthlyRev,
      monthlyExpenseEstimate: monthlyExp,
      language: isTe ? 'te' : 'en',
    };

    try {
      const res = await fetch('/api/ai/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: UnifiedBusinessPlan = await res.json();
        setPlan(data);
        if (data.selectedSchemeId) setSelectedSchemeId(data.selectedSchemeId);
      } else {
        // Local fallback
        const fallback = generateUnifiedBusinessPlan(payload);
        setPlan(fallback);
      }
    } catch (e) {
      console.warn('Network call failed, using client-side plan generator:', e);
      const fallback = generateUnifiedBusinessPlan(payload);
      setPlan(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Initial generation on screen mount if not yet generated
  useEffect(() => {
    if (!plan && !loading) {
      generatePlan();
    }
  }, []);

  const handleSchemeChange = (newSchemeId: string) => {
    setSelectedSchemeId(newSchemeId);
    generatePlan(newSchemeId);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!plan) return;
    exportPlanToPdf(plan, isTe);
  };

  const toggleDocCheck = (id: string) => {
    setCheckedDocs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden hover-lift transition-all">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
              <FileCheck className="size-3.5" />
              {isTe ? 'బ్యాంక్ రుణ నివేదిక' : 'Bank-Ready Credit Package'}
            </span>
            <span className="text-xs text-muted-foreground">
              {isTe ? '1-క్లిక్ సమగ్ర వ్యాపార ప్రణాళిక' : 'Unified Business & Financial Plan'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">{t.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {isTe
              ? 'మీ వ్యాపార వివరాలు, మార్కెట్ గిరాకీ, 12 నెలల నగదు ప్రవాహం, మరియు DSCR నిష్పత్తితో కూడిన అధికారిక బ్యాంక్ దరఖాస్తు పత్రం.'
              : 'Synthesized with profile metrics, grounded local demand, 12-month cash flow forecast, DSCR coverage, and sovereign collateral-free guarantees.'}
          </p>

          {/* Scheme Quick Selector Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium mr-1">{isTe ? 'పథకం ఎంచుకోండి:' : 'Scheme Baseline:'}</span>
            {availableSchemes.map((s) => (
              <button
                key={s.schemeId}
                onClick={() => handleSchemeChange(s.schemeId)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                  (plan ? plan.selectedSchemeId : activeScheme?.schemeId) === s.schemeId
                    ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                {isTe && s.schemeNameTe ? s.schemeNameTe.split(' ')[0] : s.schemeName.split(' ')[0]}
                {s.isTopMatch && ' ★'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {plan && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Printer className="size-4" />
                <span>{isTe ? 'ప్రింట్ / సేవ్' : 'Print / Save'}</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs"
              >
                <Download className="size-4" />
                <span>{isTe ? 'PDF డౌన్‌లోడ్' : 'Download Lender PDF'}</span>
              </Button>
            </>
          )}

          <Button
            onClick={() => generatePlan()}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 font-medium cursor-pointer"
          >
            <Sparkles className={`size-4 text-primary ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? t.generatingText : isTe ? 'తిరిగి లెక్కించు' : 'Regenerate Plan'}</span>
          </Button>
        </div>
      </div>

      {/* Plan Document Preview */}
      {plan ? (
        <div className="rounded-2xl border bg-card p-6 sm:p-10 shadow-sm flex flex-col gap-8 print:border-none print:shadow-none print:p-0 print:m-0 text-foreground">
          {/* Header Banner with Bank Memorandum Style */}
          <div className="border-b pb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  PROJECT APPRAISAL MEMORANDUM
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">Ref: RC-2026-{plan.selectedSchemeId.slice(0, 6).toUpperCase()}</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold font-sora tracking-tight text-foreground">
                {plan.enterpriseName}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-semibold text-foreground">{plan.entrepreneurName}</span>
                <span>•</span>
                <span>{plan.category}</span>
                <span>•</span>
                <span>{plan.location}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold shadow-xs">
                {isTe && plan.selectedSchemeNameTe ? plan.selectedSchemeNameTe : plan.selectedSchemeName}
              </span>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>{isTe ? 'నివేదిక తేదీ: ' : 'Appraisal Date: '}</strong>
                {plan.generatedDate}
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-400 font-semibold mt-0.5">
                {plan.guaranteeInfo.guaranteeAgency}
              </p>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2">
              <span>{isTe ? '1. ప్రాజెక్ట్ సారాంశం' : '1. Executive Summary & Project Proposal'}</span>
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed bg-muted/20 rounded-xl p-4 border">
              {isTe && plan.executiveSummaryTe ? plan.executiveSummaryTe : plan.executiveSummary}
            </p>
          </div>

          {/* Section 2: Market Opportunity & Demand (from Business Advisor) */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2">
              <TrendingUp className="size-4" />
              <span>{isTe ? '2. మార్కెట్ అవకాశాలు & స్థానిక గిరాకీ' : '2. Market Opportunity & Demand Analysis'}</span>
            </h3>
            <div className="mt-2.5 rounded-xl border bg-card p-4 text-xs space-y-3">
              <p className="font-medium text-foreground leading-relaxed">
                {isTe && plan.marketOpportunitySummaryTe ? plan.marketOpportunitySummaryTe : plan.marketOpportunitySummary}
              </p>
              <div className="grid sm:grid-cols-3 gap-2 pt-1">
                {plan.localDemandDrivers.map((driver, idx) => (
                  <div key={idx} className="rounded-lg bg-muted/40 p-2.5 border text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-1">
                      {idx === 0 ? (isTe ? 'స్థానిక గిరాకీ:' : 'Local Demand:') : idx === 1 ? (isTe ? 'రవాణా & సరఫరా:' : 'Logistics Linkage:') : (isTe ? 'వినియోగదారుల మద్దతు:' : 'Consumer Base:')}
                    </span>
                    {driver}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic border-t pt-2">
                <strong>{isTe ? 'సీజనల్ సలహా: ' : 'Seasonality & Gestation: '}</strong>
                {plan.seasonalAdvice}
              </p>
            </div>
          </div>

          {/* Section 3: Financing Structure & Scheme Terms */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
              <Layers className="size-4" />
              <span>{isTe ? '3. మొత్తం ప్రాజెక్ట్ వ్యయం & రుణ నిర్మాణం' : '3. Total Capital Outlay & Financing Structure'}</span>
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border p-3.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'మొత్తం ప్రాజెక్ట్ వ్యయం' : 'Total Project Cost'}</span>
                <strong className="text-lg font-bold font-sora text-foreground mt-0.5 block">
                  {formatINR(plan.totalProjectCost)}
                </strong>
              </div>

              <div className="rounded-xl border p-3.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">
                  {isTe ? `స్వంత పెట్టుబడి (${plan.promoterMarginPercent}%)` : `Promoter Margin (${plan.promoterMarginPercent}%)`}
                </span>
                <strong className="text-lg font-bold font-sora text-primary mt-0.5 block">
                  {formatINR(plan.promoterMargin)}
                </strong>
              </div>

              <div className="rounded-xl border p-3.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">
                  {isTe ? `ప్రభుత్వ పథకం రుణం (${100 - plan.promoterMarginPercent}%)` : `Sanctioned Scheme Loan (${100 - plan.promoterMarginPercent}%)`}
                </span>
                <strong className="text-lg font-bold font-sora text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                  {formatINR(plan.requestedLoanAmount)}
                </strong>
              </div>

              <div className="rounded-xl border p-3.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'వడ్డీ రేటు (వార్షిక)' : 'Interest Rate p.a.'}</span>
                <strong className="text-lg font-bold font-sora text-foreground mt-0.5 block">
                  {plan.interestRateAnnual.toFixed(1)}% p.a.
                </strong>
              </div>
            </div>

            {/* Subsidies and Repayment Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="rounded-xl border p-3 bg-card">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'ప్రభుత్వ సబ్సిడీ' : 'Capital Subsidy'}</span>
                <strong className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mt-0.5 block">
                  {plan.subsidyAmount && plan.subsidyPercent
                    ? `${plan.subsidyPercent}% (${formatINR(plan.subsidyAmount)})`
                    : isTe ? 'రాయితీ రుణం' : 'Concessional Loan'}
                </strong>
              </div>

              <div className="rounded-xl border p-3 bg-card">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'కాలపరిమితి / మారటోరియం' : 'Tenure / Grace'}</span>
                <strong className="text-sm font-bold text-foreground mt-0.5 block">
                  {plan.tenureYears} Yrs ({plan.moratoriumMonths}m Grace)
                </strong>
              </div>

              <div className="rounded-xl border p-3 bg-card">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'నెలవారీ EMI' : 'Monthly EMI'}</span>
                <strong className="text-sm font-bold text-primary mt-0.5 block">
                  {formatINR(plan.monthlyEmi)}
                </strong>
              </div>

              <div className="rounded-xl border p-3 bg-card">
                <span className="text-[11px] text-muted-foreground block">{isTe ? 'త్రైమాసిక EMI' : 'Quarterly EMI'}</span>
                <strong className="text-sm font-bold text-primary mt-0.5 block">
                  {formatINR(plan.quarterlyEmi)}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 4: Capital Deployment Breakdown (Capex vs Opex) */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2 mb-2.5">
              <span>{isTe ? '4. మూలధన కేటాయింపు (Capex vs Working Capital)' : '4. Capital Outlay & Asset Deployment Allocation'}</span>
            </h3>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3.5 font-semibold">{isTe ? 'ఆస్తి / వ్యయ విభాగం' : 'Asset / Expenditure Item'}</th>
                    <th className="py-2.5 px-3.5 font-semibold">{isTe ? 'రకం' : 'Classification'}</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">{isTe ? 'కేటాయింపు (₹)' : 'Allocation (₹)'}</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">{isTe ? 'వాటా (%)' : 'Share (%)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.capitalAllocations.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3.5 text-foreground font-medium">
                        {isTe && item.itemTe ? item.itemTe : item.item}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.category === 'capex'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                            : item.category === 'working_capital'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.category === 'capex' ? 'Capex' : item.category === 'working_capital' ? 'Working Capital' : 'Contingency'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-foreground">
                        {formatINR(item.amount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-muted-foreground">{item.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: 12-Month Cash Flow Forecast */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2">
                <Calendar className="size-4" />
                <span>{isTe ? '5. 12-నెలల నగదు ప్రవాహ అంచనా' : '5. 12-Month Projected Cash Flow & Debt Servicing'}</span>
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {isTe ? 'గమనిక: మొదటి 3 నెలలు మారటోరియం (వాయిదా లేదు)' : 'Note: Initial grace period shields early cash flows'}
              </span>
            </div>

            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead className="bg-muted/50 border-b text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">{isTe ? 'నెల' : 'Month'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'ఆదాయం (₹)' : 'Gross Rev (₹)'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'ఖర్చులు (₹)' : 'Opex (₹)'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'నికర నిర్వహణ లాభం' : 'Net Op. Income'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'రుణ వాయిదా (EMI)' : 'Debt Service (EMI)'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'నికర మిగులు' : 'Net Cash Flow'}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'ముగింపు నిల్వ' : 'Closing Cash'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.cashFlowForecast.map((m) => (
                    <tr key={m.month} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">
                        {m.monthName}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-foreground">{formatINR(m.projectedRevenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatINR(m.projectedExpense)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-foreground">{formatINR(m.netOperatingIncome)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {m.debtService > 0 ? (
                          <span className="text-rose-800 dark:text-rose-400 font-medium">-{formatINR(m.debtService)}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted">
                            {isTe ? 'గ్రేస్ కాలం' : '0 (Grace)'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-800 dark:text-emerald-400">
                        {formatINR(m.netCashFlow)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono text-primary font-bold">
                        {formatINR(m.closingCashBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: DSCR Calculation & Sovereign Collateral-Free Guarantee (Dual Highlight Cards) */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* DSCR Card */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-emerald-900 dark:text-emerald-300 uppercase flex items-center gap-1.5">
                  <BadgePercent className="size-4 text-emerald-800 dark:text-emerald-400" />
                  {isTe ? 'రుణ చెల్లింపు కవరేజ్ నిష్పత్తి' : 'Debt Service Coverage Ratio (DSCR)'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  {plan.dscr.isHealthy ? (isTe ? 'అనుకూలం' : 'Healthy') : (isTe ? 'సమీక్ష అవసరం' : 'Tight')}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-sora text-emerald-900 dark:text-emerald-300">
                  {plan.dscr.dscrValue.toFixed(2)}x
                </span>
                <span className="text-xs text-emerald-900/80 dark:text-emerald-300/80">
                  (Benchmark: {plan.dscr.benchmark})
                </span>
              </div>

              <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                <p>{isTe && plan.dscr.interpretationTe ? plan.dscr.interpretationTe : plan.dscr.interpretation}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-500/20 text-[11px] text-muted-foreground flex justify-between">
                <span>
                  {isTe ? 'వార్షిక నికర నిర్వహణ లాభం:' : 'Annual Net Operating Income:'} <strong>{formatINR(plan.dscr.annualNetOperatingIncome)}</strong>
                </span>
                <span>
                  {isTe ? 'వార్షిక రుణ వాయిదా:' : 'Annual Debt Service:'} <strong>{formatINR(plan.dscr.annualDebtService)}</strong>
                </span>
              </div>
            </div>

            {/* Sovereign Guarantee Card */}
            <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-blue-900 dark:text-blue-300 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-blue-800 dark:text-blue-400" />
                  {isTe ? 'తాకట్టు లేని ప్రభుత్వ పూచీకత్తు' : 'Sovereign Collateral-Free Guarantee'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-900 dark:text-blue-300 text-xs font-bold">
                  {plan.guaranteeInfo.coveragePercent}% {isTe ? 'కవరేజ్' : 'Coverage'}
                </span>
              </div>

              <div className="mt-3">
                <span className="text-base font-bold font-sora text-blue-950 dark:text-blue-300">
                  {plan.guaranteeInfo.guaranteeAgency}
                </span>
                <p className="text-[11px] text-blue-900/70 dark:text-blue-300/70 mt-0.5">
                  {plan.guaranteeInfo.statutoryBacking}
                </p>
              </div>

              <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                {isTe && plan.guaranteeInfo.plainLanguageExplanationTe
                  ? plan.guaranteeInfo.plainLanguageExplanationTe
                  : plan.guaranteeInfo.plainLanguageExplanation}
              </p>

              <div className="mt-3 pt-3 border-t border-blue-500/20 text-[11px] text-blue-900 dark:text-blue-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-blue-800 dark:text-blue-400" />
                <span>
                  {isTe
                    ? 'వ్యవసాయ భూమి లేదా నివాస ఆస్తులను తాకట్టు పెట్టవలసిన అవసరం లేదు.'
                    : 'Zero personal tangible collateral or third-party guarantor mandated under RBI guidelines.'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 7: Bank Appraisal Checklist & Mandatory Documentation */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2 mb-2.5">
              <FileCheck className="size-4" />
              <span>{isTe ? '7. బ్యాంకు రుణ దరఖాస్తుకు అవసరమైన పత్రాలు' : '7. Bank Appraisal & Mandatory Documentation Checklist'}</span>
            </h3>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3.5 font-semibold w-10">{isTe ? 'స్థితి' : 'Status'}</th>
                    <th className="py-2.5 px-3.5 font-semibold">{isTe ? 'పత్రం పేరు' : 'Document Name'}</th>
                    <th className="py-2.5 px-3.5 font-semibold">{isTe ? 'ప్రాముఖ్యత' : 'Importance'}</th>
                    <th className="py-2.5 px-3.5 font-semibold">{isTe ? 'వివరణ & ప్రయోజనం' : 'Purpose / Verification Objective'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.documentChecklist.map((doc) => {
                    const isChecked = checkedDocs[doc.id] ?? false;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => toggleDocCheck(doc.id)}
                        className="hover:bg-muted/20 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3.5">
                          {isChecked ? (
                            <CheckSquare className="size-4 text-emerald-800 dark:text-emerald-400" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-foreground">
                          {isTe && doc.nameTe ? doc.nameTe : doc.name}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            doc.importance === 'Mandatory'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {doc.importance}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-muted-foreground">
                          {isTe && doc.descriptionTe ? doc.descriptionTe : doc.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 8: Risk Containment & Operational Safeguards */}
          <div>
            <h3 className="text-sm font-bold font-sora uppercase tracking-wider text-primary flex items-center gap-2 mb-2.5">
              <ShieldCheck className="size-4" />
              <span>{isTe ? '8. రిస్క్ నియంత్రణ రక్షణలు' : '8. Risk Containment & Operational Safeguards'}</span>
            </h3>
            <ul className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              {(isTe && plan.riskMitigationsTe ? plan.riskMitigationsTe : plan.riskMitigations).map((m, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-muted/20 p-2.5 rounded-lg border">
                  <CheckCircle2 className="size-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 9: Formal Declaration & Signatures Block */}
          <div className="border-t pt-6 flex flex-col gap-6">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">
                {isTe ? 'దరఖాస్తుదారుడి డిక్లరేషన్:' : 'Applicant Declaration & Banking Commitment:'}
              </p>
              <p>
                {isTe
                  ? 'ఈ ప్రాజెక్ట్ ప్రతిపాదనలో తెలిపిన వివరాలన్నీ సత్యమైనవి. ప్రభుత్వం అందించే రాయితీ మరియు పథకం నిబంధనల ప్రకారం రుణం వినియోగించి సమయానికి వాయిదాలు చెల్లిస్తానని హామీ ఇస్తున్నాను.'
                  : 'I hereby declare that all particulars furnished in this business plan proposal are true and accurate to the best of my knowledge. The sanctioned credit will be deployed strictly towards specified capital equipment and working capital with prompt installment compliance.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="text-left">
                <div className="border-b border-foreground/30 w-48 mb-2"></div>
                <p className="text-xs font-bold text-foreground">{plan.entrepreneurName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isTe ? 'దరఖాస్తుదారుని సంతకం' : 'Applicant Signature & Date'}
                </p>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="border-b border-foreground/30 w-48 mb-2"></div>
                <p className="text-xs font-bold text-foreground">
                  {isTe ? 'బ్యాంక్ బ్రాంచ్ మేనేజర్ / క్రెడిట్ ఆఫీసర్' : 'Branch Credit Manager / Field Appraisal Officer'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isTe ? 'పరిశీలన సంతకం & అధికారిక ముద్ర' : 'Verification Signature & Bank Seal'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <section className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-card p-8 text-center shadow-xs">
          <div className="max-w-md">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary">
              <FileText className="size-6" />
            </div>
            <h3 className="mt-4 font-bold font-sora text-base">{t.title}</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {isTe
                ? 'మీ వ్యాపార ప్రొఫైల్, మార్కెట్ అవకాశాలు, మరియు 12-నెలల నగదు ప్రవాహాన్ని కలిపి బ్యాంకుకు సమర్పించగల సమగ్ర నివేదికను రూపొందించండి.'
                : 'Synthesize your entrepreneur profile, grounded market intelligence, 12-month cash flow forecast, DSCR appraisal, and sovereign guarantee into a bank-ready proposal.'}
            </p>
            <Button onClick={() => generatePlan()} disabled={loading} className="mt-5 font-semibold cursor-pointer">
              <Sparkles className="size-4 mr-2" />
              {t.generateBtn}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
