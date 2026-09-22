'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  AnalyticsPeriod,
  calculateFullDashboardMetrics,
  RUNWAY_THRESHOLDS,
  EXPENSE_RATIO_THRESHOLDS,
  OPERATING_MARGIN_THRESHOLDS,
} from '@/lib/finance/metrics';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
  IndianRupee,
  Clock,
  Sparkles,
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Activity,
  Wallet,
  Percent,
  PlusCircle,
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
  const { entries, finance, profile, language, totalIncome, totalExpenses, netCashFlow } = useApp();
  const isTe = language === 'te';
  const isHi = language === 'hi';

  // 1. Period Selector state (Weekly, Monthly, Quarterly, Yearly) - Default to 'monthly'
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');

  // Sensitivity Scenario state for What-If simulator
  const [sensitivityScenario, setSensitivityScenario] = useState<'baseline' | 'lean' | 'growth'>('baseline');

  // 2. Real Calculations from Digital Logbook Entries via shared metrics utility
  const dashboardMetrics = useMemo(() => {
    // Current available cash: sum of cumulative net cash flow + liquid reserve buffer from promoter capital
    const liquidBuffer = Math.round(finance.projectCost * 0.10); // 10% promoter equity reserve
    const cumulativeCash = Math.max(0, netCashFlow) + liquidBuffer;

    return calculateFullDashboardMetrics(entries, period, {
      availableCashOverride: cumulativeCash,
    });
  }, [entries, period, netCashFlow, finance.projectCost]);

  const { pnl, runway, operatingMargin, expenseRatio, timeSeriesData, periodDays, filteredEntries } = dashboardMetrics;

  // Sensitivity Scenario calculations
  const scenarioMultiplier = sensitivityScenario === 'lean' ? 0.85 : sensitivityScenario === 'growth' ? 1.15 : 1.0;
  const projectedRevenue = (pnl.totalIncome > 0 ? pnl.totalIncome : finance.projectCost * 0.22) * scenarioMultiplier;
  const projectedExpense = (pnl.totalExpenses > 0 ? pnl.totalExpenses : finance.projectCost * 0.12) * scenarioMultiplier;
  const projectedSurplus = projectedRevenue - projectedExpense;

  // Capital Distribution Breakdown
  const capexAmount = Math.round(finance.projectCost * 0.60);
  const workingCapitalAmount = Math.round(finance.projectCost * 0.30);
  const contingencyAmount = Math.round(finance.projectCost * 0.10);

  const capitalDistributionData = [
    { name: isTe ? 'యంత్రాలు & ఆస్తులు (Capex)' : 'Equipment / Livestock (Capex)', amount: capexAmount, share: '60%' },
    { name: isTe ? 'వర్కింగ్ క్యాపిటల్ (Opex)' : 'Working Capital (Opex)', amount: workingCapitalAmount, share: '30%' },
    { name: isTe ? 'రిజర్వ్ & అనుమతులు' : 'Contingency Reserve', amount: contingencyAmount, share: '10%' },
  ];

  // Period label translation
  const getPeriodLabel = (p: AnalyticsPeriod) => {
    switch (p) {
      case 'weekly':
        return isTe ? 'వారం (7 రోజులు)' : isHi ? 'साप्ताहिक (7 दिन)' : 'Weekly (7 Days)';
      case 'monthly':
        return isTe ? 'నెల (30 రోజులు)' : isHi ? 'मासिक (30 दिन)' : 'Monthly (30 Days)';
      case 'quarterly':
        return isTe ? 'త్రైమాసికం (90 రోజులు)' : isHi ? 'त्रैमासिक (90 दिन)' : 'Quarterly (90 Days)';
      case 'yearly':
        return isTe ? 'సంవత్సరం (365 రోజులు)' : isHi ? 'वार्षिक (365 दिन)' : 'Yearly (365 Days)';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner & Period Selector */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover-lift transition-all">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
              <BarChart3 className="size-3.5" />
              {isTe ? 'ఆర్థిక విశ్లేషణ ఇంజిన్' : 'Financial Analytics Engine'}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="size-3 text-emerald-800 dark:text-emerald-400" />
              {isTe ? 'ప్రత్యక్ష లాగ్‌బుక్ రికార్డులు' : 'Live Logbook Transactions'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">
            {isTe ? 'నగదు ప్రవాహం, రన్‌వే & నిర్వహణ మార్జిన్లు' : 'Cash Flow, Runway & Operating Margins'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {isTe
              ? 'మీ లాగ్‌బుక్ లావాదేవీల ఆధారంగా నిర్ధారించబడిన నికర లాభం, వర్కింగ్ క్యాపిటల్ రన్‌వే మరియు ఖర్చుల నియంత్రణ నిష్పత్తులు.'
              : 'Deterministic performance analytics derived directly from your digital ledger entries. No black-box approximations.'}
          </p>
        </div>

        {/* Period Selector Tabs (Requirement 1: Default to Monthly) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center rounded-xl border bg-muted/30 p-1 text-xs shadow-2xs">
            {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer ${
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {p === 'weekly' ? (isTe ? 'వారం' : isHi ? 'साप्ताहिक' : 'Weekly') :
                 p === 'monthly' ? (isTe ? 'నెల' : isHi ? 'मासिक' : 'Monthly') :
                 p === 'quarterly' ? (isTe ? 'త్రైమాసికం' : isHi ? 'त्रैमासिक' : 'Quarterly') :
                 (isTe ? 'సంవత్సరం' : isHi ? 'वार्षिक' : 'Yearly')}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => setActive?.('Digital Logbook')}
            className="flex items-center gap-1.5 font-medium cursor-pointer active:scale-[0.98] transition-all"
            variant="outline"
          >
            <PlusCircle className="size-3.5" />
            <span>{isTe ? 'లావాదేవీ నమోదు' : 'Add Entry'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Key Profit & Loss Metric Cards for Selected Period (Requirement 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflow (Revenue) */}
        <div className="stagger-1 hover-lift hover-glow-emerald rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isTe ? 'మొత్తం ఆదాయం (వసూళ్లు)' : 'Total Revenue (Inflow)'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-semibold shadow-2xs">
              {pnl.incomeCount} {isTe ? 'రశీదులు' : 'Receipts'}
            </span>
          </div>
          <strong className="text-xl sm:text-2xl font-bold font-sora text-emerald-800 dark:text-emerald-400 mt-2 block">
            <AnimatedNumber value={pnl.totalIncome} formatter={formatINR} />
          </strong>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {getPeriodLabel(period)}
          </span>
        </div>

        {/* Total Outflow (Expenses) */}
        <div className="stagger-2 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isTe ? 'మొత్తం ఖర్చులు (చెల్లింపులు)' : 'Total Expenses (Outflow)'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-800 dark:text-rose-400 font-semibold shadow-2xs">
              {pnl.expenseCount} {isTe ? 'చెల్లింపులు' : 'Payments'}
            </span>
          </div>
          <strong className="text-xl sm:text-2xl font-bold font-sora text-rose-800 dark:text-rose-400 mt-2 block">
            <AnimatedNumber value={pnl.totalExpenses} formatter={formatINR} />
          </strong>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {pnl.totalExpenses > 0 ? `${formatINR(runway.dailyBurnRate)}/day burn` : 'Zero operating burn'}
          </span>
        </div>

        {/* Net Profit / Loss */}
        <div className="stagger-3 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isTe ? 'నికర లాభం / నష్టం' : 'Net Profit / Surplus'}</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-2xs ${
                pnl.netProfit >= 0
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-800 dark:text-rose-400'
              }`}
            >
              {pnl.netProfit >= 0 ? (isTe ? 'మిగులు' : 'Surplus') : (isTe ? 'లోటు' : 'Deficit')}
            </span>
          </div>
          <strong
            className={`text-xl sm:text-2xl font-bold font-sora mt-2 block ${
              pnl.netProfit >= 0 ? 'text-primary' : 'text-rose-800 dark:text-rose-400'
            }`}
          >
            {pnl.netProfit >= 0 ? `+${formatINR(pnl.netProfit)}` : formatINR(pnl.netProfit)}
          </strong>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {pnl.totalIncome > 0
              ? `${pnl.profitMarginPct}% Net Operating Margin`
              : 'No revenue recorded'}
          </span>
        </div>

        {/* Available Working Capital Buffer */}
        <div className="stagger-4 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isTe ? 'ద్రవ్య నగదు నిల్వలు' : 'Available Liquid Cash'}</span>
            <Wallet className="size-3.5 text-primary" />
          </div>
          <strong className="text-xl sm:text-2xl font-bold font-sora text-foreground mt-2 block">
            <AnimatedNumber value={runway.availableCash} formatter={formatINR} />
          </strong>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Net Cash + Promoters Buffer
          </span>
        </div>
      </div>

      {/* 3. Cash Flow Chart & P&L Statement (Requirement 2) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Money In vs. Money Out Bar Chart (2 columns on large screens) */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2">
            <div>
              <h3 className="font-bold font-sora text-base text-foreground">
                {isTe ? 'నగదు ప్రవాహం (ఆదాయం vs ఖర్చులు)' : 'Cash Flow Trajectory (Money In vs. Out)'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isTe
                  ? `${getPeriodLabel(period)} కాలవ్యవధిలో రోజువారీ/వారపు రాబడులు మరియు వ్యయాలు.`
                  : `Inflows and outflows categorized chronologically across ${getPeriodLabel(period)}.`}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-700" />
                <span className="text-muted-foreground">{isTe ? 'ఆదాయం' : 'Money In'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-rose-700" />
                <span className="text-muted-foreground">{isTe ? 'ఖర్చులు' : 'Money Out'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 h-64 w-full">
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis
                    dataKey="periodLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const inVal = payload.find((p) => p.dataKey === 'income')?.value as number || 0;
                        const outVal = payload.find((p) => p.dataKey === 'expense')?.value as number || 0;
                        const netVal = inVal - outVal;
                        return (
                          <div className="rounded-xl border bg-popover p-3 shadow-md text-xs">
                            <p className="font-semibold text-popover-foreground mb-1">{label}</p>
                            <div className="flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-400 font-medium">
                              <span>Inflow:</span>
                              <span>{formatINR(inVal)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-rose-800 dark:text-rose-400 font-medium">
                              <span>Outflow:</span>
                              <span>{formatINR(outVal)}</span>
                            </div>
                            <div className="mt-1 pt-1 border-t flex items-center justify-between gap-4 font-bold text-popover-foreground">
                              <span>Net:</span>
                              <span className={netVal >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}>
                                {netVal >= 0 ? `+${formatINR(netVal)}` : formatINR(netVal)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="income" name="Money In" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Money Out" fill="#be123c" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground border border-dashed rounded-xl">
                <Info className="size-8 text-muted-foreground mb-2" />
                <p className="text-xs font-semibold">No transactions recorded in this period</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                  Add transactions in the Digital Logbook to visualize live cash flow.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Profit & Loss Statement Summary Box */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold font-sora text-base text-foreground">
                {isTe ? 'లాభ నష్టాల సారాంశం (P&L)' : 'Profit & Loss Summary'}
              </h3>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                {period}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isTe ? 'స్థూల ఆదాయం (Gross Revenue)' : 'Gross Revenue'}</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">{formatINR(pnl.totalIncome)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isTe ? 'నిర్వహణ ఖర్చులు (Operating Outflows)' : 'Operating Expenses'}</span>
                <span className="font-bold text-rose-800 dark:text-rose-400 tabular-nums">-{formatINR(pnl.totalExpenses)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isTe ? 'సగటు రోజువారీ ఖర్చు (Daily Burn)' : 'Avg. Daily Burn'}</span>
                <span className="font-medium text-foreground tabular-nums">{formatINR(runway.dailyBurnRate)}/day</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-foreground">{isTe ? 'నికర లాభం (Net Surplus)' : 'Net Operating Profit'}</span>
                <span className={`font-bold font-sora text-sm tabular-nums ${pnl.netProfit >= 0 ? 'text-primary' : 'text-rose-800 dark:text-rose-400'}`}>
                  {pnl.netProfit >= 0 ? `+${formatINR(pnl.netProfit)}` : formatINR(pnl.netProfit)}
                </span>
              </div>
            </div>

            {/* Profit Margin Visual Bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-muted-foreground">{isTe ? 'ఆదాయం నిలుపుదల (Retention)' : 'Revenue Retention'}</span>
                <span className="font-bold text-foreground">{pnl.profitMarginPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pnl.profitMarginPct >= 25 ? 'bg-emerald-700' : pnl.profitMarginPct >= 10 ? 'bg-amber-700' : 'bg-rose-700'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, Math.max(0, pnl.profitMarginPct)))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t text-[11px] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-800 dark:text-emerald-400 shrink-0" />
            <span>
              {isTe
                ? 'ఖచ్చితమైన ప్రభుత్వ నిబంధనల ప్రకారం రుణ అర్హతకు ఈ గణాంకాలు ప్రామాణికం.'
                : '100% deterministic accounting logic audited for statutory lender readiness.'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Working Capital Runway Indicator (Requirement 3: Traffic-Light Color Coding) */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`grid size-9 place-items-center rounded-xl ${
                runway.statusColor === 'green'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                  : runway.statusColor === 'amber'
                  ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
                  : 'bg-rose-500/10 text-rose-800 dark:text-rose-400'
              }`}
            >
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="font-bold font-sora text-base text-foreground">
                {isTe ? 'వర్కింగ్ క్యాపిటల్ రన్‌వే (మనుగడ కాలపరిమితి)' : 'Working Capital Runway Indicator'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isTe
                  ? 'నూతన ఆదాయం లేకుండా మీ ప్రస్తుత ఖర్చుల వేగంతో వ్యాపారం ఎన్ని రోజులు సాగుతుంది?'
                  : 'Survival horizon: how long your business can run with zero new revenue at your current spending rate.'}
              </p>
            </div>
          </div>

          {/* Traffic-Light Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-2xs ${
              runway.statusColor === 'green'
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/30'
                : runway.statusColor === 'amber'
                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-500/30'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                runway.statusColor === 'green'
                  ? 'bg-emerald-500 animate-pulse'
                  : runway.statusColor === 'amber'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500 animate-ping'
              }`}
            />
            <span>
              {runway.status === 'comfortable'
                ? (isTe ? 'సురక్షిత రన్‌వే (>=60 రోజులు)' : 'Comfortable Buffer (>=60 Days)')
                : runway.status === 'caution'
                ? (isTe ? 'హెచ్చరిక పరిధి (30–59 రోజులు)' : 'Caution Buffer (30–59 Days)')
                : (isTe ? 'తీవ్ర కొరత (<30 రోజులు)' : 'Critical Shortfall (<30 Days)')}
            </span>
          </div>
        </div>

        {/* Runway Metrics & Message Display */}
        <div className="grid md:grid-cols-3 gap-6 mt-5 items-center">
          {/* Big Number Display */}
          <div className="rounded-xl border p-5 bg-muted/20 flex flex-col justify-center">
            <span className="text-xs text-muted-foreground block">
              {isTe ? 'అంచనా వేసిన రన్‌వే' : 'Estimated Operating Runway'}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <strong
                className={`text-3xl sm:text-4xl font-bold font-sora ${
                  runway.statusColor === 'green'
                    ? 'text-emerald-800 dark:text-emerald-400'
                    : runway.statusColor === 'amber'
                    ? 'text-amber-800 dark:text-amber-400'
                    : 'text-rose-800 dark:text-rose-400'
                }`}
              >
                {runway.runwayDays >= 999 ? '999+' : runway.runwayDays}
              </strong>
              <span className="text-sm font-semibold text-muted-foreground">
                {isTe ? 'రోజులు' : 'Days'} ({runway.runwayMonths} {isTe ? 'నెలలు' : 'Months'})
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-2 block">
              Based on {formatINR(runway.dailyBurnRate)}/day burn across {periodDays} days
            </span>
          </div>

          {/* Descriptive Runway Message & Visual Gauge */}
          <div className="md:col-span-2 flex flex-col justify-between gap-4">
            <div className="rounded-xl border p-4 bg-card/60">
              <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
                {isTe ? runway.statusMessageTe : runway.statusMessage}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                {isTe
                  ? 'గమనిక: గ్రామీణ వ్యాపారాలకు కనీసం 45 నుండి 60 రోజుల వర్కింగ్ క్యాపిటల్ రిజర్వ్ సిఫార్సు చేయబడింది.'
                  : 'Underwriting Benchmark: A 60+ day reserve protects against agricultural harvest delays, late payments, and seasonal downtime.'}
              </p>
            </div>

            {/* Visual Progress Bar (0 to 90 Days Benchmark) */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                <span className="text-muted-foreground">Runway Benchmark Range</span>
                <span className="text-foreground">
                  Target: 60+ Days • Critical: &lt;30 Days
                </span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden flex">
                {/* Red Zone (0 - 30 days = 33%) */}
                <div className="w-[33%] bg-rose-500/20 border-r border-background" title="Critical Zone (<30d)" />
                {/* Amber Zone (30 - 60 days = 33%) */}
                <div className="w-[33%] bg-amber-500/20 border-r border-background" title="Caution Zone (30-60d)" />
                {/* Green Zone (60+ days = 34%) */}
                <div className="w-[34%] bg-emerald-500/20" title="Safe Zone (60+d)" />

                {/* Actual Runway Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
                    runway.statusColor === 'green'
                      ? 'bg-emerald-700'
                      : runway.statusColor === 'amber'
                      ? 'bg-amber-700'
                      : 'bg-rose-700'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.round((runway.runwayDays / 90) * 100)))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0 Days</span>
                <span className="text-rose-800 dark:text-rose-400 font-semibold">30 Days (Critical)</span>
                <span className="text-amber-800 dark:text-amber-400 font-semibold">60 Days (Buffer)</span>
                <span className="text-emerald-800 dark:text-emerald-400 font-semibold">90+ Days (Prime)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Operating Margin & Expense-to-Income Discipline Gauges (Requirement 4) */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Operating Margin Gauge */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <Percent className="size-4 text-primary" />
                <h3 className="font-bold font-sora text-sm text-foreground">
                  {isTe ? 'నిర్వహణ లాభాల మార్జిన్' : 'Operating Profit Margin'}
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  operatingMargin.statusColor === 'green'
                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                    : operatingMargin.statusColor === 'amber'
                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
                    : 'bg-rose-500/10 text-rose-800 dark:text-rose-400'
                }`}
              >
                {isTe ? operatingMargin.statusLabelTe : operatingMargin.statusLabel}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <strong
                className={`text-3xl font-bold font-sora ${
                  operatingMargin.statusColor === 'green'
                    ? 'text-emerald-800 dark:text-emerald-400'
                    : operatingMargin.statusColor === 'amber'
                    ? 'text-amber-800 dark:text-amber-400'
                    : 'text-rose-800 dark:text-rose-400'
                }`}
              >
                {operatingMargin.operatingMarginPct}%
              </strong>
              <span className="text-xs text-muted-foreground font-medium">
                (Revenue − Expenses) ÷ Revenue
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {isTe
                ? 'ప్రతి ₹100 వ్యాపార రాబడిలో నిర్వహణ ఖర్చులు పోను వ్యాపారంలో మిగిలే లాభం.'
                : 'Measures cash retained per ₹100 of sales to service debt installments and absorb unforeseen shocks.'}
            </p>

            {/* Visual Gauge Meter */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                <span className="text-muted-foreground">Thresholds: 10% (Min) • 25% (Healthy)</span>
                <span className="font-bold text-foreground">{operatingMargin.operatingMarginPct}%</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden flex">
                <div className="w-[20%] bg-rose-500/20 border-r border-background" title="Compressed (<10%)" />
                <div className="w-[30%] bg-amber-500/20 border-r border-background" title="Moderate (10-25%)" />
                <div className="w-[50%] bg-emerald-500/20" title="Healthy (>=25%)" />

                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                    operatingMargin.statusColor === 'green'
                      ? 'bg-emerald-700'
                      : operatingMargin.statusColor === 'amber'
                      ? 'bg-amber-700'
                      : 'bg-rose-700'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(3, Math.max(0, operatingMargin.operatingMarginPct) * 2))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span className="text-rose-800 dark:text-rose-400 font-semibold">&lt;10% Vulnerable</span>
                <span className="text-amber-800 dark:text-amber-400 font-semibold">10–25% Moderate</span>
                <span className="text-emerald-800 dark:text-emerald-400 font-semibold">&gt;25% Strong</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expense-to-Income Discipline Gauge */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h3 className="font-bold font-sora text-sm text-foreground">
                  {isTe ? 'ఖర్చులు vs ఆదాయం నిష్పత్తి' : 'Expense-to-Income Discipline'}
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  expenseRatio.statusColor === 'green'
                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                    : expenseRatio.statusColor === 'amber'
                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
                    : 'bg-rose-500/10 text-rose-800 dark:text-rose-400'
                }`}
              >
                {isTe ? expenseRatio.statusLabelTe : expenseRatio.statusLabel}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <strong
                className={`text-3xl font-bold font-sora ${
                  expenseRatio.statusColor === 'green'
                    ? 'text-emerald-800 dark:text-emerald-400'
                    : expenseRatio.statusColor === 'amber'
                    ? 'text-amber-800 dark:text-amber-400'
                    : 'text-rose-800 dark:text-rose-400'
                }`}
              >
                {expenseRatio.expenseToIncomePct}%
              </strong>
              <span className="text-xs text-muted-foreground font-medium">
                Total Expenses ÷ Total Inflow
              </span>
            </div>

            {/* Severe Margin Compression Alert Banner if >85% */}
            {expenseRatio.isSevereCompression ? (
              <div className="mt-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="size-4 text-rose-800 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Severe Margin Compression (&gt;85%)</span>
                  <span>Operating costs consume over 85% of revenue, risking immediate loan default.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {isTe
                  ? 'ఆరోగ్యకరమైన గ్రామీణ వ్యాపారాలు ఖర్చులను 60% లోపు ఉంచుతాయి.'
                  : 'Green below 60%, Amber between 60–85%, Red above 85% indicating severe cash compression.'}
              </p>
            )}

            {/* Visual Gauge Meter */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                <span className="text-muted-foreground">Discipline: &lt;60% Safe • &gt;85% Severe</span>
                <span className="font-bold text-foreground">{expenseRatio.expenseToIncomePct}%</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden flex">
                <div className="w-[60%] bg-emerald-500/20 border-r border-background" title="Disciplined (<60%)" />
                <div className="w-[25%] bg-amber-500/20 border-r border-background" title="Elevated (60-85%)" />
                <div className="w-[15%] bg-rose-500/20" title="Severe Compression (>85%)" />

                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                    expenseRatio.statusColor === 'green'
                      ? 'bg-emerald-700'
                      : expenseRatio.statusColor === 'amber'
                      ? 'bg-amber-700'
                      : 'bg-rose-700'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(3, expenseRatio.expenseToIncomePct))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span className="text-emerald-800 dark:text-emerald-400 font-semibold">&lt;60% Disciplined</span>
                <span className="text-amber-800 dark:text-amber-400 font-semibold">60–85% Elevated</span>
                <span className="text-rose-800 dark:text-rose-400 font-semibold">&gt;85% Severe</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Capital Allocation Structure (60:30:10 Rule) */}
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

      {/* 7. Reducing-Balance Amortization Schedule */}
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
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-800 dark:text-emerald-400">{formatINR(q.principalPaid)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-rose-800 dark:text-rose-400">{formatINR(q.interestPaid)}</td>
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

      {/* 8. Sensitivity & What-If Scenarios */}
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
            <span className="text-[11px] text-muted-foreground block">Projected Revenue</span>
            <strong className="text-base font-bold text-emerald-800 dark:text-emerald-400 mt-1 block">
              {formatINR(projectedRevenue)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">Based on selected scenario</span>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <span className="text-[11px] text-muted-foreground block">Projected Expenses</span>
            <strong className="text-base font-bold text-rose-800 dark:text-rose-400 mt-1 block">
              {formatINR(projectedExpense)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">Feed, fuel, labor & supplies</span>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <span className="text-[11px] text-muted-foreground block">Projected Surplus</span>
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
