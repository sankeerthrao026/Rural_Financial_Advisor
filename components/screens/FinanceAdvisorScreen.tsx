'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
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
  ArrowRight,
  BadgePercent,
  Wallet,
  RefreshCw,
} from 'lucide-react';

export function FinanceAdvisorScreen({ setActive }: { setActive?: (tab: string) => void }) {
  const { finance, healthScore, language, dictionary, profile, backendMode, backendLoading } = useApp();
  const t = dictionary.finance;
  const isTe = language === 'te';

  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const displayedSchedule = showFullSchedule
    ? finance.amortizationSchedule
    : finance.amortizationSchedule.slice(0, 8);

  const isMicro = finance.scheme.id === 'micro-finance';

  // Calculate total interest across the schedule
  const totalInterest = finance.amortizationSchedule.reduce((sum, item) => sum + item.interestPaid, 0);
  const totalRepayment = finance.loanAmount + totalInterest;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Interactive Visual Financial Journey Stepper */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover-lift">
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <div>
            <h2 className="font-semibold font-sora text-sm text-foreground">
              {t.capitalWorkflow}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t.workflowSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {backendLoading && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RefreshCw className="size-2.5 animate-spin text-primary" />
                <span className="hidden sm:inline">Syncing...</span>
              </span>
            )}
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              {backendMode === 'backend'
                ? (isTe ? 'ఫాస్ట్‌ఏపీఐ ఇంజిన్' : 'FastAPI Source of Truth')
                : (isTe ? 'లోకల్ ఇంజిన్' : 'Local Engine')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Step 1: Capital */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepCapital}</span>
              <span className="text-primary font-bold">10%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-foreground">
              <AnimatedNumber value={finance.marginCapital} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'ప్రమోటర్ సొంత వాటా' : 'Promoter equity stake'}</p>
          </div>

          {/* Step 2: Project Cost */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepProject}</span>
              <span className="text-emerald-700 font-bold">100%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-foreground">
              <AnimatedNumber value={finance.projectCost} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'మూలధనం ÷ 0.10 సూత్రం' : 'Capital ÷ 0.10 formula'}</p>
          </div>

          {/* Step 3: Loan Requirement */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepLoan}</span>
              <span className="text-amber-700 font-bold">90%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-emerald-800 dark:text-emerald-400">
              <AnimatedNumber value={finance.loanAmount} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'బ్యాంకు రుణం (90%)' : 'Institutional credit'}</p>
          </div>

          {/* Step 4: Scheme Routing */}
          <div className="rounded-xl border bg-primary/5 border-primary/20 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
              <span>{t.stepScheme}</span>
              <span className="font-bold">{isMicro ? (isTe ? 'మైక్రో' : 'Micro') : (isTe ? 'టర్మ్' : 'Term')}</span>
            </div>
            <p className="mt-2 text-sm font-bold font-sora text-primary truncate">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{finance.scheme.agency}</p>
          </div>

          {/* Step 5: Quarterly Payment */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepEmi}</span>
              <span className="text-primary font-bold">{isTe ? 'త్రైమాసికం' : 'Q-Cycle'}</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-primary">
              <AnimatedNumber value={finance.quarterlyEmi} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'తగ్గుతున్న అసలుపై వడ్డీ' : 'Reducing balance'}</p>
          </div>
        </div>
      </section>

      {/* 2. Top Scheme Routing Banner */}
      <div className={`rounded-2xl border p-5 sm:p-6 hover-lift ${
        isMicro ? 'bg-amber-500/10 border-amber-300/80 text-amber-950 dark:text-amber-200' : 'bg-primary/5 border-primary/20 text-foreground'
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
              <span className="text-xs text-muted-foreground">{isTe ? 'స్వయంచాలక పథక కేటాయింపు' : 'Automatic Eligibility Tiering'}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold font-sora tracking-tight">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              {finance.scheme.agency} — {isTe ? 'అర్హత నిబంధనల ప్రకారం ప్రభుత్వం నిర్దేశించిన పథకానికి అనుసంధానం చేయబడింది.' : 'Directly mapped via deterministic capital guidelines.'}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 text-right sm:min-w-52 shadow-xs">
            <p className="text-xs text-muted-foreground">{t.quarterlyEmiLabel}</p>
            <p className="text-2xl font-bold font-sora text-primary mt-1">
              <AnimatedNumber value={finance.quarterlyEmi} formatter={formatINR} />
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isTe ? 'ప్రతి 3 నెలలకు ఒకసారి' : 'Quarterly reducing balance'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Repayment Breakdown Visualization */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b mb-4">
          <div>
            <h3 className="font-semibold font-sora text-base">
              {isTe ? 'తిరిగి చెల్లింపుల నిష్పత్తి' : 'Repayment Proportion & Total Outlay'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe ? 'అసలు మరియు వడ్డీ చెల్లింపుల పరిమాణం' : 'Principal vs. total accrued interest across complete tenure'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">{isTe ? 'మొత్తం తిరిగి చెల్లింపు: ' : 'Total Outlay: '}</span>
            <strong className="text-sm font-sora text-foreground">{formatINR(totalRepayment)}</strong>
          </div>
        </div>

        {/* Proportion Bar */}
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${Math.round((finance.loanAmount / totalRepayment) * 100)}%` }}
              title={`Principal: ${formatINR(finance.loanAmount)}`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-700"
              style={{ width: `${Math.round((totalInterest / totalRepayment) * 100)}%` }}
              title={`Interest: ${formatINR(totalInterest)}`}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" />
              <span>{isTe ? 'అసలు: ' : 'Principal: '}<strong>{formatINR(finance.loanAmount)}</strong> ({Math.round((finance.loanAmount / totalRepayment) * 100)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span>{isTe ? 'వడ్డీ: ' : 'Interest: '}<strong>{formatINR(totalInterest)}</strong> ({Math.round((totalInterest / totalRepayment) * 100)}%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Moratorium & Repayment Context Alert */}
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

      {/* 5. Quarterly Amortization Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
          <div>
            <h3 className="font-semibold font-sora text-base">{t.amortizationTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t.amortizationSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullSchedule(!showFullSchedule)}
            className="cursor-pointer font-semibold text-xs"
          >
            {showFullSchedule
              ? (isTe ? 'మొదటి 8 త్రైమాసికాలు చూపించు' : 'Show First 8 Quarters')
              : (isTe ? `అన్ని ${finance.totalQuarters} త్రైమాసికాలు చూపించు` : `Show All ${finance.totalQuarters} Quarters`)}
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
                      <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        {isTe ? 'మారటోరియం' : 'Moratorium'}
                      </span>
                    )}
                    {row.remainingBalance === 0 && (
                      <span className="rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        {isTe ? 'పూర్తయింది' : 'Paid Off'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatINR(row.startingPrincipal)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-800 dark:text-emerald-400">
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

export default FinanceAdvisorScreen;
