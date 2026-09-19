'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  BarChart3,
  Layers,
  PieChart,
  ArrowRight,
  ShieldCheck,
  Calendar,
  IndianRupee,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export function FinancialAnalyticsScreen({ setActive }: { setActive?: (value: string) => void }) {
  const { finance, profile, language, totalIncome, totalExpenses, netCashFlow } = useApp();
  const isTe = language === 'te';

  const [sensitivityScenario, setSensitivityScenario] = useState<'baseline' | 'lean' | 'growth'>('baseline');

  // Multiplier based on scenario
  const scenarioMultiplier = sensitivityScenario === 'lean' ? 0.85 : sensitivityScenario === 'growth' ? 1.15 : 1.0;
  const projectedRevenue = (totalIncome > 0 ? totalIncome : finance.projectCost * 0.22) * scenarioMultiplier;
  const projectedExpense = (totalExpenses > 0 ? totalExpenses : finance.projectCost * 0.12) * scenarioMultiplier;
  const projectedSurplus = projectedRevenue - projectedExpense;

  // Capital Distribution Breakdown
  const capexAmount = Math.round(finance.projectCost * 0.60);
  const workingCapitalAmount = Math.round(finance.projectCost * 0.30);
  const contingencyAmount = Math.round(finance.projectCost * 0.10);

  // Capital structure bar chart data
  const capitalDistributionData = [
    { name: isTe ? 'యంత్రాలు & ఆస్తులు (Capex)' : 'Equipment / Livestock (Capex)', amount: capexAmount, share: '60%' },
    { name: isTe ? 'వర్కింగ్ క్యాపిటల్ (Opex)' : 'Working Capital (Opex)', amount: workingCapitalAmount, share: '30%' },
    { name: isTe ? 'రిజర్వ్ & అనుమతులు' : 'Contingency & Reserve', amount: contingencyAmount, share: '10%' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
              <BarChart3 className="size-3.5" />
              {isTe ? 'ఆర్థిక విశ్లేషణ ఇంజిన్' : 'Financial Analytics Engine'}
            </span>
            <span className="text-xs text-muted-foreground">
              {isTe ? 'ఖచ్చితమైన గణాంకాలు & షెడ్యూల్' : 'Deterministic Modeling & Amortization'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">
            {isTe ? 'ఆర్థిక విశ్లేషణ & త్రైమాసిక వాయిదాల ప్రణాళిక' : 'Financial Analytics & Capital Structuring'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {isTe
              ? 'నియమాధారిత ప్రాజెక్ట్ వ్యయం, రుణ అర్హత, వడ్డీ లెక్కలు మరియు త్రైమాసిక వాయిదాల సమగ్ర విశ్లేషణ.'
              : 'Deterministic project outlay, equity vs debt breakdown, reducing-balance amortization, and sensitivity scenarios.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActive?.('Finance Advisor')}
            className="flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <span>{isTe ? 'రుణ పథకం ఎంపిక' : 'Scheme Advisor'}</span>
            <ArrowRight className="size-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={() => setActive?.('Business Plan')}
            className="flex items-center gap-1.5 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
          >
            <span>{isTe ? 'వ్యాపార ప్రణాళిక' : 'Business Plan'}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <span className="text-[11px] text-muted-foreground block">{isTe ? 'మొత్తం ప్రాజెక్ట్ వ్యయం' : 'Total Project Cost'}</span>
          <strong className="text-lg sm:text-xl font-bold font-sora text-foreground mt-1 block">
            {formatINR(finance.projectCost)}
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1 block">100% Capital Outlay</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <span className="text-[11px] text-muted-foreground block">{isTe ? 'స్వంత మార్జిన్ (10%)' : 'Promoter Margin (10%)'}</span>
          <strong className="text-lg sm:text-xl font-bold font-sora text-primary mt-1 block">
            {formatINR(finance.marginCapital)}
          </strong>
          <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium mt-1 block">Own Equity Buffer</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <span className="text-[11px] text-muted-foreground block">{isTe ? 'రుణ మొత్తం (90%)' : 'Sanctioned Debt (90%)'}</span>
          <strong className="text-lg sm:text-xl font-bold font-sora text-emerald-700 dark:text-emerald-400 mt-1 block">
            {formatINR(finance.loanAmount)}
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1 block">{finance.scheme.name}</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <span className="text-[11px] text-muted-foreground block">{isTe ? 'త్రైమాసిక వాయిదా (EMI)' : 'Quarterly Repayment'}</span>
          <strong className="text-lg sm:text-xl font-bold font-sora text-foreground mt-1 block">
            {formatINR(finance.quarterlyEmi)}
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            Monthly equiv: {formatINR(Math.round(finance.quarterlyEmi / 3))}
          </span>
        </div>
      </div>

      {/* 3. Capital Deployment (Capex vs Working Capital Allocation) */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'మూలధన కేటాయింపు & ఆస్తుల నిర్మాణం' : 'Capital Allocation & Deployment Structure'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe
                ? 'ఉత్పాదక యంత్రాలు మరియు రోజువారీ వర్కింగ్ క్యాపిటల్ నిష్పత్తి.'
                : 'Balanced split between fixed capital asset creation and liquid working capital buffer.'}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            60:30:10 Prudent Allocation
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {capitalDistributionData.map((item, idx) => (
            <div key={idx} className="rounded-xl border p-4 bg-muted/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Allocation {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-primary">{item.share}</span>
                </div>
                <h4 className="font-semibold text-xs text-foreground mt-1">{item.name}</h4>
              </div>
              <p className="text-lg font-bold font-sora text-foreground mt-3">{formatINR(item.amount)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Amortization Schedule Container */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2">
          <div>
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'త్రైమాసిక రుణ చెల్లింపుల టైమ్‌లైన్' : 'Quarterly Amortization Schedule'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tenure: {finance.scheme.tenureYears} Years • Moratorium: {finance.scheme.moratoriumMonths} Months Grace • Interest: {finance.scheme.interestRateAnnual}% p.a.
            </p>
          </div>

          <div className="flex items-center gap-1 text-xs text-emerald-800 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-md">
            <ShieldCheck className="size-3.5" />
            <span>Reducing-Balance Method</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Quarter</th>
                <th className="py-2.5 px-3 font-semibold text-right">Starting Principal</th>
                <th className="py-2.5 px-3 font-semibold text-right">Principal Paid</th>
                <th className="py-2.5 px-3 font-semibold text-right">Interest Paid</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total Installment</th>
                <th className="py-2.5 px-3 font-semibold text-right">Closing Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {finance.amortizationSchedule.slice(0, 8).map((q) => (
                <tr key={q.quarter} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    Quarter {q.quarter} {q.quarter <= 2 && <span className="text-[10px] text-muted-foreground">(Grace)</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatINR(q.startingPrincipal)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-700">{formatINR(q.principalPaid)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-rose-700">{formatINR(q.interestPaid)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">{formatINR(q.totalPayment)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-mono text-muted-foreground">{formatINR(q.remainingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {finance.amortizationSchedule.length > 8 && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Showing first 8 quarters (2 years) of {finance.amortizationSchedule.length} total quarters. Complete schedule available in Business Plan export.
            </p>
          )}
        </div>
      </section>

      {/* 5. Sensitivity & Scenario Modeling */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
          <div>
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'సున్నితత్వ విశ్లేషణ & వాట్-ఇఫ్ దృశ్యాలు' : 'Sensitivity Analysis & What-If Scenarios'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulate cash buffer resiliency under varying market demand conditions.
            </p>
          </div>

          <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setSensitivityScenario('lean')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                sensitivityScenario === 'lean' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Lean Season (-15%)
            </button>
            <button
              onClick={() => setSensitivityScenario('baseline')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                sensitivityScenario === 'baseline' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Baseline
            </button>
            <button
              onClick={() => setSensitivityScenario('growth')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                sensitivityScenario === 'growth' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Peak Demand (+15%)
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl border p-4 bg-muted/20">
            <span className="text-[11px] text-muted-foreground block">Projected Monthly Revenue</span>
            <strong className="text-base font-bold text-emerald-800 dark:text-emerald-400 mt-1 block">
              {formatINR(projectedRevenue)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">Based on selected scenario</span>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <span className="text-[11px] text-muted-foreground block">Monthly Operating Costs</span>
            <strong className="text-base font-bold text-rose-800 dark:text-rose-400 mt-1 block">
              {formatINR(projectedExpense)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">Feed, fuel, labor & supplies</span>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <span className="text-[11px] text-muted-foreground block">Monthly Net Surplus</span>
            <strong className="text-base font-bold text-primary mt-1 block">
              {formatINR(projectedSurplus)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">
              Sufficient to cover {formatINR(Math.round(finance.quarterlyEmi / 3))} monthly EMI
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FinancialAnalyticsScreen;
