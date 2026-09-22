'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { formatDisplayDateToIso } from '@/lib/utils/date';
import { calculateFinancialHealthScore } from '@/lib/finance/engine';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  ChevronRight,
  ChevronDown,
  Sparkles,
  TrendingUp,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  ExternalLink,
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

const DAY_MS = 86400000;

function startOfDayPreserving(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function OverviewScreen({ setActive }: { setActive: (value: string) => void }) {
  const {
    profile,
    finance,
    totalIncome,
    totalExpenses,
    netCashFlow,
    healthScore,
    detectedRisks,
    entries,
    language,
  } = useApp();

  const isTe = language === 'te';
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '3m'>('30d');
  const [expandedRisk, setExpandedRisk] = useState(false);

  // Real chart data bucketed from logged entries (7d = last 7 days, 30d = last 4 weeks, 3m = last 3 calendar months)
  const chartDatasets = useMemo(() => {
    const today = startOfDayPreserving(Date.now());
    const empty = () => ({ Income: 0, Expense: 0, Net: 0 });

    const dayBuckets = Array.from({ length: 7 }, (_, i) => ({
      period: new Date(today - (6 - i) * DAY_MS).toLocaleDateString('en-US', { weekday: 'short' }),
      start: today - (6 - i) * DAY_MS,
    }));

    const weekBuckets = Array.from({ length: 4 }, (_, i) => ({
      period: `Week ${i + 1}`,
      start: today - (3 - i) * 7 * DAY_MS - 6 * DAY_MS,
    }));

    const monthBuckets = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today);
      const monthStart = new Date(d.getFullYear(), d.getMonth() - (2 - i), 1).getTime();
      return {
        period: new Date(monthStart).toLocaleDateString('en-US', { month: 'short' }),
        start: monthStart,
      };
    });

    const datasets = {
      '7d': dayBuckets.map((b) => ({ period: b.period, ...empty() })),
      '30d': weekBuckets.map((b) => ({ period: b.period, ...empty() })),
      '3m': monthBuckets.map((b) => ({ period: b.period, ...empty() })),
    };

    for (const e of entries) {
      const dayStart = startOfDayPreserving(e.timestamp || Date.now());
      const dayOffset = (today - dayStart) / DAY_MS;
      if (dayOffset >= 0 && dayOffset < 7) {
        const b = datasets['7d'][6 - Math.floor(dayOffset)];
        if (e.type === 'income') b.Income += e.amount;
        else b.Expense += e.amount;
      }
      if (dayOffset >= 0 && dayOffset < 28) {
        const weekIdx = Math.floor(dayOffset / 7);
        if (weekIdx >= 0 && weekIdx < 4) {
          const b = datasets['30d'][3 - weekIdx];
          if (e.type === 'income') b.Income += e.amount;
          else b.Expense += e.amount;
        }
      }
      const d = new Date(dayStart);
      const now = new Date(today);
      const monthIdx = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthIdx >= 0 && monthIdx < 3) {
        const b = datasets['3m'][2 - monthIdx];
        if (e.type === 'income') b.Income += e.amount;
        else b.Expense += e.amount;
      }
    }

    for (const arr of Object.values(datasets)) {
      for (const p of arr) p.Net = p.Income - p.Expense;
    }

    return datasets;
  }, [entries]);

  // Real health-score delta: recompute the rule-based score over the earlier vs later half of logged entries
  const healthDelta = useMemo(() => {
    if (entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted[sorted.length - 1].timestamp === sorted[0].timestamp) return null;
    const mid = Math.floor(sorted.length / 2);
    const scoreHalf = (group: typeof sorted) => {
      let income = 0;
      let expense = 0;
      for (const e of group) {
        if (e.type === 'income') income += e.amount;
        else expense += e.amount;
      }
      return calculateFinancialHealthScore({
        totalIncome: income,
        totalExpenses: expense,
        entryCount: group.length,
        hasDownwardTrend: income - expense < 15000 && income > 0,
      }).score;
    };
    return scoreHalf(sorted.slice(mid)) - scoreHalf(sorted.slice(0, mid));
  }, [entries]);

  const activeChartData = chartDatasets[timeframe];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dynamic Financial Snapshot Cards with Staggered Entrance */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Available Margin Capital */}
        <div className="stagger-1 hover-lift hover-glow-primary rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTe ? 'అందుబాటులో ఉన్న మూలధనం' : 'Available Capital'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              10% Margin
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={profile.marginCapital} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isTe ? 'ప్రారంభ పెట్టుబడి సామర్థ్యం' : 'Entrepreneur equity stake'}
            </p>
          </div>
        </div>

        {/* Project Cost */}
        <div className="stagger-2 hover-lift hover-glow-emerald rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTe ? 'ప్రాజెక్ట్ మొత్తం వ్యయం' : 'Project Cost'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              Deterministic
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={finance.projectCost} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Capital ÷ 0.10 standard formula
            </p>
          </div>
        </div>

        {/* Loan Requirement */}
        <div className="stagger-3 hover-lift hover-glow-primary rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTe ? 'అవసరమైన రుణం' : 'Loan Requirement'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              90% Credit
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={finance.loanAmount} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </p>
          </div>
        </div>

        {/* Financial Health Score */}
        <div className="stagger-4 hover-lift hover-glow-emerald rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTe ? 'ఆర్థిక ఆరోగ్య స్కోరు' : 'Financial Health'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="size-3.5" />
              <span>{healthDelta === null ? '—' : `${healthDelta > 0 ? '+' : ''}${healthDelta} pts`}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
                <AnimatedNumber value={healthScore.score} />
              </p>
              <span className="text-xs font-medium text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{isTe ? healthScore.statusTe : healthScore.status} — {healthDelta === null
                ? (isTe ? 'కొత్తగా' : 'New')
                : healthDelta > 0
                  ? (isTe ? 'మెరుగుపడుతోంది' : 'Improving')
                  : healthDelta < 0
                    ? (isTe ? 'క్షీణిస్తోంది' : 'Declining')
                    : (isTe ? 'స్థిరంగా ఉంది' : 'Steady')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Cash Flow Chart & Financial Health Factor Breakdown */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Large Interactive Cash Flow Chart */}
        <section className="stagger-5 rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold font-sora text-base">
                  {isTe ? 'నగదు ప్రవాహ విశ్లేషణ' : 'Cash Flow Intelligence'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {isTe ? 'ఇంటరాక్టివ్' : 'Interactive'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isTe ? 'ఆదాయం, ఖర్చులు మరియు నికర నగదు ప్రవాహం' : 'Tracking income, expenses, and operational retention'}
              </p>
            </div>

            {/* Timeframe Switcher */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setTimeframe('7d')}
                className={`rounded-md px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                  timeframe === '7d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? '7 రోజులు' : '7 Days'}
              </button>
              <button
                onClick={() => setTimeframe('30d')}
                className={`rounded-md px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                  timeframe === '30d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? '30 రోజులు' : '30 Days'}
              </button>
              <button
                onClick={() => setTimeframe('3m')}
                className={`rounded-md px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                  timeframe === '3m' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? '3 నెలలు' : '3 Months'}
              </button>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6EC" opacity={0.6} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#5C6479" />
                <YAxis tick={{ fontSize: 10 }} stroke="#5C6479" tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any, name: any) => [formatINR(Number(val)), name]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E2E6EC',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Income" name={isTe ? 'ఆదాయం' : 'Income'} fill="#1B2A4A" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="Expense" name={isTe ? 'ఖర్చులు' : 'Expense'} fill="#E3A857" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="Net" name={isTe ? 'నికర మిగులు' : 'Net Cash'} fill="#2F8F5B" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{isTe ? 'నికర లాభం' : 'Net Margin'}: <strong className="text-foreground">{Math.round((netCashFlow / (totalIncome || 1)) * 100)}%</strong></span>
              <span>{isTe ? 'రికార్డులు' : 'Transactions'}: <strong className="text-foreground">{entries.length}</strong></span>
            </div>
            <button
              onClick={() => setActive('Cash Flow')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer transition-transform active:scale-[0.98]"
            >
              <span>{isTe ? 'వివరణాత్మక నగదు ప్రవాహం' : 'Detailed Cash Flow'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* Financial Health Diagnostic Card */}
        <section className="stagger-5 rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h2 className="font-semibold font-sora text-base">
                  {isTe ? 'ఆర్థిక ఆరోగ్య విశ్లేషణ' : 'Financial Health Diagnosis'}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isTe ? '3 పారదర్శక పారామితుల ఆధారంగా' : 'Transparent 3-factor diagnostic score'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 shadow-2xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isTe ? healthScore.statusTe : healthScore.status}
              </span>
            </div>

            {/* Score Big Display */}
            <div className="my-5 flex items-center justify-between bg-muted/30 rounded-xl p-4 transition-colors hover:bg-muted/40">
              <div>
                <p className="text-3xl font-extrabold font-sora text-primary">
                  <AnimatedNumber value={healthScore.score} />
                  <span className="text-sm font-medium text-muted-foreground ml-1">/ 100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTe ? 'సంస్థాగత రుణ మంజూరు సంసిద్ధత' : 'Institutional credit-readiness'}
                </p>
              </div>
              <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform duration-200 hover:scale-105">
                <TrendingUp className="size-6" />
              </div>
            </div>

            {/* 3 Transparent Factors Progress Bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'లాగ్‌బుక్ స్థిరత్వం' : 'Logging Consistency'}</span>
                  <span className="font-semibold text-foreground">{healthScore.loggingScore}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${healthScore.loggingScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'లాభాల సరళి' : 'Profit Trend'}</span>
                  <span className="font-semibold text-foreground">{healthScore.profitTrendScore}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-600 transition-all duration-700 ease-out" style={{ width: `${healthScore.profitTrendScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'వ్యయ నియంత్రణ' : 'Expense Control'}</span>
                  <span className="font-semibold text-foreground">{healthScore.expenseRatioScore}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-out" style={{ width: `${healthScore.expenseRatioScore}%` }} />
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed italic">
              "{isTe ? healthScore.summaryTe : healthScore.summary}"
            </p>
          </div>

          <div className="pt-4 border-t mt-4">
            <button
              onClick={() => setActive('Finance Advisor')}
              className="w-full text-center text-xs font-semibold text-primary hover:underline cursor-pointer transition-transform active:scale-[0.99]"
            >
              {isTe ? 'పూర్తి ఆర్థిక ప్రణాళికను చూడండి →' : 'View Full Credit & Amortization Plan →'}
            </button>
          </div>
        </section>
      </div>

      {/* 3. Contextual Risk Area & AI Business Advisor Teaser */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contextual Risk Area */}
        <section className="stagger-6 rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`size-4 ${detectedRisks.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <h2 className="font-semibold font-sora text-base">
                  {isTe ? 'రిస్క్ హెచ్చరికలు' : 'Operational Risk Monitor'}
                </h2>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                detectedRisks.length > 0 ? 'bg-rose-500/10 text-rose-700' : 'bg-emerald-500/10 text-emerald-700'
              }`}>
                {detectedRisks.length > 0 ? (isTe ? `${detectedRisks.length} కనుగొనబడ్డాయి` : `${detectedRisks.length} Detected`) : (isTe ? 'సురక్షితం' : 'All Safe')}
              </span>
            </div>

            {detectedRisks.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 mb-2 transition-transform duration-200 hover:scale-105">
                  <ShieldCheck className="size-6" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {isTe ? 'రిస్క్ హెచ్చరికలు ఏవీ లేవు' : 'No Operational Risks Detected'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
                  {isTe
                    ? 'రుణ భారం లేదా నగదు కొరత సూచనలు ఏవీ గుర్తించబడలేదు. వ్యాపారం స్థిరంగా ఉంది.'
                    : 'Zero over-leverage or negative cash-flow pressure identified. Your business profile satisfies credit guardrails.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {detectedRisks.map((risk) => (
                  <div key={risk.ruleCode || risk.riskType} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 transition-all hover:bg-amber-500/10">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                        {isTe ? risk.titleTe : risk.title}
                      </p>
                      <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded">
                        {risk.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {isTe ? risk.reasonTe : risk.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t mt-4 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{isTe ? 'నియమాధారిత రక్షణలు' : 'Deterministic Guardrails'}</span>
            <button
              onClick={() => setActive('Risk Alerts')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer transition-transform active:scale-[0.98]"
            >
              <span>{isTe ? 'అన్ని రిస్క్ నిబంధనలు చూడండి' : 'Inspect Risk Rules'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* AI Business Advisor Teaser Card */}
        <section className="stagger-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-xs flex flex-col justify-between hover-lift hover-glow-primary relative overflow-hidden transition-all">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10 transition-transform duration-500 group-hover:scale-110">
            <Sparkles className="size-28 text-primary" />
          </div>

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow-xs">
                  <Sparkles className="size-3.5 text-amber-300" />
                </span>
                <h2 className="font-semibold font-sora text-base text-foreground">
                  {isTe ? 'AI వ్యాపార సలహాదారు' : 'AI Business Intelligence'}
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                ChromaDB + Gemini
              </span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {isTe
                ? 'మీ వ్యాపార వర్గం మరియు జిల్లా మార్కెట్ బెంచ్‌మార్క్‌ల ఆధారంగా రూపొందించిన విశ్లేషణ.'
                : 'Hyper-local business intelligence grounded in Agmarknet mandi data and district cluster benchmarks.'}
            </p>

            <div className="my-4 rounded-xl border bg-background/80 p-4 transition-colors hover:bg-background">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-foreground">{profile.category} in {profile.location || 'Telangana'}</span>
                <span className="text-emerald-700 font-bold text-[11px]">{isTe ? 'నమూనా' : 'Sample'}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-700 ease-out" style={{ width: '0%' }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2">
                {isTe
                  ? 'ఇది ఉదాహరణ సూచిక; వర్గం ఆధారిత డిమాండ్ విశ్లేషణ కోసం వ్యాపార సలహాదారుని చూడండి.'
                  : 'Sample indicator only — view the Business Advisor for a category-specific demand analysis.'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setActive('Business Advisor')}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>{isTe ? 'పూర్తి మార్కెట్ సలహా చూడండి →' : 'Explore Market Opportunity & SWOT →'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* 4. Recent Activity Logbook Table */}
      <section className="stagger-6 rounded-2xl border bg-card p-6 shadow-xs hover-lift transition-all">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="font-semibold font-sora text-base">{isTe ? 'ఇటీవలి లావాదేవీలు' : 'Recent Transaction Activity'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{isTe ? 'మీ తాజా లాగ్‌బుక్ రికార్డులు' : 'Your latest recorded sales and operating expenses'}</p>
          </div>
          <button
            onClick={() => setActive('Digital Logbook')}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer transition-transform active:scale-[0.98]"
          >
            {isTe ? 'లాగ్‌బుక్ తెరవండి →' : 'Open Digital Logbook →'}
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center">
            <p className="text-xs font-semibold text-foreground">
              {isTe ? 'ఇటీవలి లావాదేవీలు ఏవీ లేవు' : 'No Recent Transactions'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
              {isTe
                ? 'మీ రోజువారీ అమ్మకాలు లేదా ఖర్చులను రికార్డ్ చేయడానికి లాగ్‌బుక్‌ను తెరవండి.'
                : 'Start by logging your first transaction in the Digital Logbook to unlock cash-flow trends.'}
            </p>
            <button
              onClick={() => setActive('Digital Logbook')}
              className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer transition-transform active:scale-[0.98]"
            >
              + {isTe ? 'లావాదేవీ నమోదు చేయండి' : 'Record Transaction'}
            </button>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="pb-2 font-medium">{isTe ? 'వివరణ' : 'Description'}</th>
                  <th className="pb-2 font-medium">{isTe ? 'వర్గం' : 'Category'}</th>
                  <th className="pb-2 font-medium">{isTe ? 'తేదీ' : 'Date'}</th>
                  <th className="pb-2 text-right font-medium">{isTe ? 'మొత్తం' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.slice(0, 4).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 transition-colors duration-150">
                    <td className="py-3 font-medium text-foreground truncate max-w-48">{row.note}</td>
                    <td className="py-3 text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className={`py-3 text-right font-bold tabular-nums ${
                      row.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {row.type === 'income' ? `+${formatINR(row.amount)}` : `-${formatINR(row.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default OverviewScreen;
