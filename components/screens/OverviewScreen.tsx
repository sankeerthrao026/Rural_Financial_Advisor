'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { calculateFinancialHealthScore } from '@/lib/finance/engine';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Sparkles,
  TrendingUp,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Briefcase,
  Send,
  Mic,
  ArrowRight,
  BadgePercent,
  Wallet,
  Building2,
  Sliders,
  DollarSign,
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
    dictionary,
  } = useApp();

  const isTe = language === 'te';
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '3m'>('30d');
  const [quickPrompt, setQuickPrompt] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return isTe ? 'శుభోదయం' : 'Good morning';
    if (hour < 17) return isTe ? 'శుభ మధ్యాహ్నం' : 'Good afternoon';
    return isTe ? 'శుభ సాయంత్రం' : 'Good evening';
  };

  // Real chart data bucketed from logged entries
  const chartDatasets = useMemo(() => {
    const today = startOfDayPreserving(Date.now());
    const empty = () => ({ Income: 0, Expense: 0, Net: 0 });

    const dayBuckets = Array.from({ length: 7 }, (_, i) => ({
      period: new Date(today - (6 - i) * DAY_MS).toLocaleDateString(isTe ? 'te-IN' : 'en-US', { weekday: 'short' }),
      start: today - (6 - i) * DAY_MS,
    }));

    const weekBuckets = Array.from({ length: 4 }, (_, i) => ({
      period: isTe ? `వారం ${i + 1}` : `Week ${i + 1}`,
      start: today - (3 - i) * 7 * DAY_MS - 6 * DAY_MS,
    }));

    const monthBuckets = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today);
      const monthStart = new Date(d.getFullYear(), d.getMonth() - (2 - i), 1).getTime();
      return {
        period: new Date(monthStart).toLocaleDateString(isTe ? 'te-IN' : 'en-US', { month: 'short' }),
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
  }, [entries, isTe]);

  // Real health-score delta
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

  // Quick Action Chips for the AI Advisor
  const suggestedAdvisorPrompts = [
    {
      labelEn: '📍 High-Profit Locations in Warangal',
      labelTe: '📍 వరంగల్‌లో లాభదాయకమైన ప్రాంతాలు',
      screen: 'Business Advisor',
      query: 'Suggest me places where if I establish my shop I can get great profits',
    },
    {
      labelEn: '🎯 How to reach ₹5 Lakh profit?',
      labelTe: '🎯 ₹5 లక్షల లాభం ఎలా సాధించాలి?',
      screen: 'Business Advisor',
      query: 'I want to make a profit of 5 lakh rupees how my finances should look',
    },
    {
      labelEn: '🏛️ Eligible Credit Schemes & Subsidies',
      labelTe: '🏛️ అందుబాటులో ఉన్న ప్రభుత్వ రాయితీలు',
      screen: 'Finance Advisor',
      query: 'What government credit schemes and subsidies match my enterprise profile?',
    },
    {
      labelEn: '💡 Climate control & shed investment',
      labelTe: '💡 షెడ్ వెంటిలేషన్ / కూలింగ్ పెట్టుబడి',
      screen: 'Business Advisor',
      query: 'Is investing in climate control or shade nets profitable for my unit?',
    },
  ];

  const handleQuickAsk = (targetScreen: string, queryText?: string) => {
    setActive(targetScreen);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ========================================================================= */}
      {/* 1. HERO / WELCOME BANNER (Modern Dark Fintech Card)                       */}
      {/* ========================================================================= */}
      <section className="hero-dark-card rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold tracking-wide text-white border border-white/15">
                <MapPin className="size-3 text-amber-400" />
                {profile.location || 'Warangal, Telangana'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {profile.category || 'Dairy Farming'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-sora tracking-tight text-white">
              {getGreeting()}, {profile.name || 'Anita Sharma'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {isTe
                ? 'మీ గ్రామీణ వ్యాపార ఆర్థిక స్థితి, రుణ అర్హత మరియు AI ఆధారిత వ్యాపార మార్గదర్శకత్వ సమాచారం.'
                : 'Here is your current enterprise financial position, credit-readiness status, and actionable business outlook.'}
            </p>
          </div>

          {/* Quick Context Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isTe ? 'ఈక్విటీ మూలధనం' : 'Equity Margin'}
              </p>
              <p className="text-sm font-bold font-sora text-white">
                {formatINR(profile.marginCapital)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isTe ? 'రుణ అర్హత' : 'Loan Eligible'}
              </p>
              <p className="text-sm font-bold font-sora text-emerald-300">
                {formatINR(finance.loanAmount)}
              </p>
            </div>
            <div className="space-y-0.5 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isTe ? 'క్రెడిట్ హెల్త్' : 'Credit Score'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold font-sora text-amber-300">
                  {healthScore.score}/100
                </span>
                <span className="text-[10px] font-semibold text-slate-300">
                  ({healthScore.status.split(' ')[0]})
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. KEY FINANCIAL METRIC CARDS (Clean Rounded Fintech Grid)                 */}
      {/* ========================================================================= */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Monthly Inflow / Revenue */}
        <div className="stagger-1 hover-lift hover-glow-primary rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isTe ? 'నెలవారీ రాబడి' : 'Monthly Revenue'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="size-3" />
              {entries.filter((e) => e.type === 'income').length} {isTe ? 'ఎంట్రీలు' : 'inflows'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={totalIncome || 45700} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isTe ? 'ధృవీకరించబడిన లాగ్‌బుక్ రికార్డులు' : 'Recorded enterprise income'}
            </p>
          </div>
        </div>

        {/* Card 2: Monthly Expenses */}
        <div className="stagger-2 hover-lift hover-glow-amber rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isTe ? 'నెలవారీ ఖర్చులు' : 'Monthly Expenses'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              {entries.filter((e) => e.type === 'expense').length} {isTe ? 'ఖర్చులు' : 'outflows'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={totalExpenses || 12700} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isTe ? 'నిర్వహణ మరియు ముడిసరుకు ఖర్చులు' : 'Operational & input overhead'}
            </p>
          </div>
        </div>

        {/* Card 3: Net Cash Flow Surplus */}
        <div className="stagger-3 hover-lift hover-glow-emerald rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isTe ? 'నికర మిగులు' : 'Net Cash Surplus'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              {Math.round((netCashFlow / (totalIncome || 1)) * 100)}% {isTe ? 'మార్జిన్' : 'Margin'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-emerald-700 dark:text-emerald-400">
              <AnimatedNumber value={netCashFlow || 33000} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isTe ? 'రుణ వాయిదాల చెల్లింపు సామర్థ్యం' : 'Debt servicing cash cushion'}
            </p>
          </div>
        </div>

        {/* Card 4: Institutional Loan Requirement */}
        <div className="stagger-4 hover-lift hover-glow-primary rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isTe ? 'రుణ అర్హత' : 'Loan Requirement'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              90% Credit
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-sora tracking-tight text-foreground">
              <AnimatedNumber value={finance.loanAmount} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CASH FLOW INTELLIGENCE & FINANCIAL HEALTH DIAGNOSIS                     */}
      {/* ========================================================================= */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Large Interactive Cash Flow Chart */}
        <section className="stagger-5 rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold font-sora text-base text-foreground">
                  {isTe ? 'నగదు ప్రవాహ విశ్లేషణ' : 'Cash Flow Trajectory'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {isTe ? 'ఇంటరాక్టివ్' : 'Interactive'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isTe ? 'ఆదాయం, ఖర్చులు మరియు నికర నగదు ప్రవాహం' : 'Historical inflow, operational expenses, and net surplus'}
              </p>
            </div>

            {/* Timeframe Switcher */}
            <div className="flex items-center rounded-xl border bg-muted/40 p-0.5 text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setTimeframe('7d')}
                className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                  timeframe === '7d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? '7 రోజులు' : '7 Days'}
              </button>
              <button
                onClick={() => setTimeframe('30d')}
                className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                  timeframe === '30d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? '30 రోజులు' : '30 Days'}
              </button>
              <button
                onClick={() => setTimeframe('3m')}
                className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
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
                    borderRadius: '12px',
                    border: '1px solid #E2E6EC',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
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
              <span>{isTe ? 'లావాదేవీలు' : 'Transactions'}: <strong className="text-foreground">{entries.length}</strong></span>
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
        <section className="stagger-5 rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h2 className="font-semibold font-sora text-base text-foreground">
                  {isTe ? 'ఆర్థిక ఆరోగ్య విశ్లేషణ' : 'Credit-Readiness Diagnosis'}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isTe ? 'పారదర్శక 3-పారామితుల స్కోరు' : 'Transparent deterministic scoring'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 shadow-2xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isTe ? healthScore.statusTe : healthScore.status}
              </span>
            </div>

            {/* Score Display */}
            <div className="my-5 flex items-center justify-between bg-muted/30 rounded-2xl p-4 transition-colors hover:bg-muted/40">
              <div>
                <p className="text-3xl font-extrabold font-sora text-primary">
                  <AnimatedNumber value={healthScore.score} />
                  <span className="text-sm font-medium text-muted-foreground ml-1">/ 100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTe ? 'సంస్థాగత రుణ మంజూరు సంసిద్ధత' : 'Institutional credit-readiness'}
                </p>
              </div>
              <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xs transition-transform duration-200 hover:scale-105">
                <TrendingUp className="size-6" />
              </div>
            </div>

            {/* 3 Progress Bars */}
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
              onClick={() => setActive('Credit Score')}
              className="w-full text-center text-xs font-semibold text-primary hover:underline cursor-pointer transition-transform active:scale-[0.99]"
            >
              {isTe ? 'పూర్తి క్రెడిట్ హెల్త్ నివేదిక చూడండి →' : 'View Full Credit Health Breakdown →'}
            </button>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 4. CORE EXPERIENCE: ASK RURALCRED AI ADVISOR                             */}
      {/* ========================================================================= */}
      <section className="stagger-6 rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 shadow-xs relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="size-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-sora text-foreground flex items-center gap-2">
                <span>{isTe ? 'రూరల్‌క్రెడ్ AI సలహాదారుని అడగండి' : 'Ask RuralCred AI Advisor'}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Multi-Domain Intelligence
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {isTe
                  ? 'మీ వ్యాపార గణాంకాలు మరియు జిల్లా బెంచ్‌మార్క్‌లతో కూడిన తక్షణ సలహా.'
                  : 'Grounded financial calculations, location analysis, and unit economics.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActive('Business Advisor')}
              className="px-3 py-1.5 rounded-xl border border-border/80 bg-background text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              {isTe ? 'వ్యాపార సలహాదారు' : 'Business Advisor'}
            </button>
            <button
              onClick={() => setActive('Finance Advisor')}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
            >
              {isTe ? 'ఆర్థిక సలహాదారు' : 'Finance Advisor'}
            </button>
          </div>
        </div>

        {/* Actionable Prompt Chips */}
        <div className="mt-5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {isTe ? 'సూచించిన ప్రశ్నలు' : 'Suggested Inquiries for your Enterprise'}:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {suggestedAdvisorPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAsk(item.screen, item.query)}
                className="flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-background/80 hover:bg-background hover:border-primary/40 hover:shadow-2xs text-left transition-all duration-150 cursor-pointer group"
              >
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {isTe ? item.labelTe : item.labelEn}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>

        {/* Direct Navigation Footer */}
        <div className="mt-6 pt-4 border-t border-primary/10 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            {isTe ? 'జీరో హాలూసినేషన్ • 100% నిజమైన గణాంకాలు' : 'Zero Hallucination • 100% Deterministic Math & Real Local Data'}
          </span>
          <button
            onClick={() => setActive('Business Advisor')}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{isTe ? 'పూర్తి AI సంభాషణ ప్రారంభించండి' : 'Start Full Advisor Conversation'}</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. OPPORTUNITIES & RISK ALERTS (Side-by-Side Dual Panels)                  */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Government Scheme Opportunities Card */}
        <section className="stagger-6 rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
                  <Building2 className="size-4" />
                </div>
                <h2 className="font-semibold font-sora text-base text-foreground">
                  {isTe ? 'ప్రభుత్వ పథకాల అవకాశాలు' : 'Eligible Credit Schemes'}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                {isTe ? 'టాప్ మ్యాచ్' : 'Top Match'}
              </span>
            </div>

            <div className="mt-4 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isTe ? finance.scheme.nameTe : finance.scheme.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isTe ? 'రాయితీ మరియు రుణ పరిమితి' : 'Statutory interest rate & loan facility'}
                  </p>
                </div>
                <span className="text-xs font-extrabold font-sora text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                  {finance.scheme.interestRateAnnual}% p.a.
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-emerald-500/15 pt-2.5">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">{isTe ? 'ప్రాజెక్ట్ పరిమితి' : 'Max Project Cost'}</span>
                  <p className="font-bold text-foreground">{formatINR(finance.scheme.maxProjectCost)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">{isTe ? 'మారటోరియం' : 'Moratorium'}</span>
                  <p className="font-bold text-foreground">{finance.scheme.moratoriumMonths} {isTe ? 'నెలలు' : 'months'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t mt-4 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              MUDRA • PM Vishwakarma • NBCFDC
            </span>
            <button
              onClick={() => setActive('Scheme Matching')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer transition-transform active:scale-[0.98]"
            >
              <span>{isTe ? 'అన్ని పథకాలు సరిపోల్చండి' : 'Compare All Schemes'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* Operational Risk Monitor Card */}
        <section className="stagger-6 rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between hover-lift transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`size-4 ${detectedRisks.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <h2 className="font-semibold font-sora text-base text-foreground">
                  {isTe ? 'రిస్క్ అలర్ట్స్ & సేఫ్‌గార్డ్స్' : 'Operational Risk Safeguards'}
                </h2>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
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
                  {isTe ? 'రిస్క్ హెచ్చరికలు ఏవీ లేవు' : 'Zero Operational Risks Detected'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
                  {isTe
                    ? 'రుణ భారం లేదా నగదు కొరత సూచనలు ఏవీ లేవు. మీ వ్యాపారం స్థిరంగా ఉంది.'
                    : 'Zero over-leverage or negative cash-flow pressure identified. Invariant rules pass.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
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

          <div className="pt-4 border-t mt-4 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{isTe ? 'నియమాధారిత రక్షణలు' : 'Deterministic Guardrails'}</span>
            <button
              onClick={() => setActive('Risk Alerts')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer transition-transform active:scale-[0.98]"
            >
              <span>{isTe ? 'అన్ని నిబంధనలు చూడండి' : 'Inspect Risk Safeguards'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 6. RECENT TRANSACTION ACTIVITY (Clean Ledger Table)                       */}
      {/* ========================================================================= */}
      <section className="stagger-6 rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover-lift transition-all">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="font-semibold font-sora text-base text-foreground">
              {isTe ? 'ఇటీవలి లావాదేవీల రికార్డులు' : 'Recent Transaction Activity'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isTe ? 'మీ తాజా లాగ్‌బుక్ రికార్డులు' : 'Your latest recorded sales and operating expenses'}
            </p>
          </div>
          <button
            onClick={() => setActive('Digital Logbook')}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer transition-transform active:scale-[0.98]"
          >
            {isTe ? 'డిజిటల్ లాగ్‌బుక్ తెరవండి →' : 'Open Digital Logbook →'}
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
                : 'Start by logging your daily sales or costs in the Digital Logbook.'}
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
                {entries.slice(0, 5).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 transition-colors duration-150">
                    <td className="py-3 font-medium text-foreground truncate max-w-48">{row.note}</td>
                    <td className="py-3 text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className={`py-3 text-right font-bold tabular-nums ${
                      row.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
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
