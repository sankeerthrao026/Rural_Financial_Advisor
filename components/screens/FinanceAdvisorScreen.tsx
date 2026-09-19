'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  Calculator,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Percent,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export function FinanceAdvisorScreen({ setActive }: { setActive?: (tab: string) => void }) {
  const { finance, healthScore, language, dictionary, profile } = useApp();
  const t = dictionary.finance;
  const isTe = language === 'te';

  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const displayedSchedule = showFullSchedule
    ? finance.amortizationSchedule
    : finance.amortizationSchedule.slice(0, 8);

  const isMicro = finance.scheme.id === 'micro-finance';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Scheme Routing Banner */}
      <div className={`rounded-2xl border p-5 sm:p-6 ${
        isMicro ? 'bg-amber-500/10 border-amber-300/80 text-amber-950' : 'bg-primary/5 border-primary/20 text-foreground'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isMicro ? 'bg-amber-600 text-white' : 'bg-primary text-primary-foreground'
              }`}>
                <ShieldCheck className="size-3.5" />
                {isMicro ? t.microFinanceBadge : t.termLoanBadge}
              </span>
              <span className="text-xs text-muted-foreground">Deterministic Scheme Routing</span>
            </div>
            <h2 className="mt-2 text-xl font-bold font-sora tracking-tight">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              {finance.scheme.agency} — {isTe ? 'అర్హత నిబంధనల ప్రకారం ప్రభుత్వం నిర్దేశించిన పథకానికి అనుసంధానం చేయబడింది.' : 'Directly mapped via deterministic capital guidelines.'}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 text-right sm:min-w-48 shadow-xs">
            <p className="text-xs text-muted-foreground">{t.quarterlyEmiLabel}</p>
            <p className="text-2xl font-bold font-sora text-primary mt-1">
              {formatINR(finance.quarterlyEmi)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isTe ? 'ప్రతి 3 నెలలకు ఒకసారి' : 'Quarterly reducing balance'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Deterministic Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Project Cost */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.projectCostLabel}</p>
            <Calculator className="size-4 text-primary opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-foreground">
            {formatINR(finance.projectCost)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>{t.projectCostFormula}</span>
          </div>
        </div>

        {/* Loan Amount */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.loanAmountLabel}</p>
            <Layers className="size-4 text-emerald-600 opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-emerald-800">
            {formatINR(finance.loanAmount)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isTe ? '90% సంస్థాగత రుణం' : '90% institutional credit'}
          </p>
        </div>

        {/* Margin Contribution */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.marginCapitalLabel}</p>
            <Percent className="size-4 text-amber-600 opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-foreground">
            {formatINR(finance.marginCapital)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isTe ? 'వ్యవస్థాపకుడి 10% వాటా' : '10% promoter own equity'}
          </p>
        </div>

        {/* Repayment Terms */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.tenureLabel}</p>
            <Clock className="size-4 text-primary opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-foreground">
            {finance.scheme.tenureYears} {isTe ? 'సంవత్సరాలు' : 'Years'}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {finance.scheme.interestRateAnnual}% p.a. • {finance.scheme.moratoriumMonths}m {isTe ? 'మారటోరియం' : 'moratorium'}
          </p>
        </div>
      </div>

      {/* Moratorium & Repayment Context Alert */}
      <div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3 text-xs">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">
            {isTe ? 'మారటోరియం గ్రేస్ పీరియడ్ నిబంధన:' : 'Moratorium Grace Period Architecture:'}
          </span>{' '}
          {isTe
            ? `మొదటి ${finance.scheme.moratoriumMonths} నెలలలో (${finance.moratoriumQuarters} త్రైమాసికం) వ్యాపారం నిలదొక్కుకునేందుకు అసలు వాయిదా ఉండదు, కేవలం వడ్డీ మాత్రమే చెల్లిస్తారు. ${finance.moratoriumQuarters + 1} వ త్రైమాసికం నుండి సాధారణ EMI ప్రారంభమవుతుంది.`
            : `During the initial ${finance.scheme.moratoriumMonths} months (${finance.moratoriumQuarters} moratorium quarters), principal repayment is deferred. You only pay quarterly accrued interest, after which standard amortized quarterly EMI commences.`}
        </div>
      </div>

      {/* Transparent Rule-Based Financial Health Score */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold font-sora text-base">{t.healthScoreTitle}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                healthScore.status === 'excellent'
                  ? 'bg-emerald-100 text-emerald-800'
                  : healthScore.status === 'steady'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isTe ? healthScore.statusTe : healthScore.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.healthScoreSubtitle}</p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-sora text-primary">{healthScore.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {healthScore.breakdown.map((item, idx) => (
            <div key={idx} className="rounded-xl border bg-background p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{isTe ? item.labelTe : item.label}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{item.weight}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Metric Score</span>
                <span className="font-semibold text-foreground">{item.score} / 100</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground italic border-t pt-3">
          {isTe ? healthScore.summaryTe : healthScore.summary}
        </p>
      </section>

      {/* Quarterly Amortization Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
          <div>
            <h3 className="font-semibold font-sora text-base">{t.amortizationTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t.amortizationSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullSchedule(!showFullSchedule)}
          >
            {showFullSchedule ? 'Show First 8 Quarters' : `Show All ${finance.totalQuarters} Quarters`}
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{t.quarter}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.startingPrincipal}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.principalPaid}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.interestPaid}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.totalPayment}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.remainingBalance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedSchedule.map((row) => (
                <tr
                  key={row.quarter}
                  className={`transition-colors hover:bg-muted/40 ${
                    row.isMoratorium ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                    <span>Q{row.quarter}</span>
                    {row.isMoratorium && (
                      <span className="rounded bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[10px] font-semibold">
                        {isTe ? 'మారటోరియం' : 'Moratorium'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatINR(row.startingPrincipal)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-800">
                    {formatINR(row.principalPaid)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatINR(row.interestPaid)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">
                    {formatINR(row.totalPayment)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-muted-foreground">
                    {formatINR(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
