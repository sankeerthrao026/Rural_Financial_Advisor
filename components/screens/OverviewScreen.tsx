'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
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

  // Dynamic datasets for interactive timeframe switcher
  const chartDatasets = {
    '7d': [
      { period: 'Mon', Income: Math.round(totalIncome * 0.12), Expense: Math.round(totalExpenses * 0.08), Net: Math.round(totalIncome * 0.12 - totalExpenses * 0.08) },
      { period: 'Tue', Income: Math.round(totalIncome * 0.15), Expense: Math.round(totalExpenses * 0.11), Net: Math.round(totalIncome * 0.15 - totalExpenses * 0.11) },
      { period: 'Wed', Income: Math.round(totalIncome * 0.11), Expense: Math.round(totalExpenses * 0.14), Net: Math.round(totalIncome * 0.11 - totalExpenses * 0.14) },
      { period: 'Thu', Income: Math.round(totalIncome * 0.18), Expense: Math.round(totalExpenses * 0.10), Net: Math.round(totalIncome * 0.18 - totalExpenses * 0.10) },
      { period: 'Fri', Income: Math.round(totalIncome * 0.14), Expense: Math.round(totalExpenses * 0.13), Net: Math.round(totalIncome * 0.14 - totalExpenses * 0.13) },
      { period: 'Sat', Income: Math.round(totalIncome * 0.19), Expense: Math.round(totalExpenses * 0.18), Net: Math.round(totalIncome * 0.19 - totalExpenses * 0.18) },
      { period: 'Sun', Income: Math.round(totalIncome * 0.11), Expense: Math.round(totalExpenses * 0.06), Net: Math.round(totalIncome * 0.11 - totalExpenses * 0.06) },
    ],
    '30d': [
      { period: 'Week 1', Income: Math.round(totalIncome * 0.22), Expense: Math.round(totalExpenses * 0.20), Net: Math.round(totalIncome * 0.22 - totalExpenses * 0.20) },
      { period: 'Week 2', Income: Math.round(totalIncome * 0.28), Expense: Math.round(totalExpenses * 0.25), Net: Math.round(totalIncome * 0.28 - totalExpenses * 0.25) },
      { period: 'Week 3', Income: Math.round(totalIncome * 0.24), Expense: Math.round(totalExpenses * 0.22), Net: Math.round(totalIncome * 0.24 - totalExpenses * 0.22) },
      { period: 'Week 4', Income: Math.round(totalIncome * 0.26), Expense: Math.round(totalExpenses * 0.23), Net: Math.round(totalIncome * 0.26 - totalExpenses * 0.23) },
    ],
    '3m': [
      { period: 'Jul', Income: 38000, Expense: 15500, Net: 22500 },
      { period: 'Aug', Income: 42500, Expense: 16800, Net: 25700 },
      { period: 'Sep', Income: Math.max(30000, totalIncome), Expense: Math.max(12000, totalExpenses), Net: Math.max(18000, netCashFlow) },
    ],
  };

  const activeChartData = chartDatasets[timeframe];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dynamic Financial Snapshot Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Available Margin Capital */}
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between">
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
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between">
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
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between">
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
              {finance.scheme.name.split('(')[0]}
            </p>
          </div>
        </div>

        {/* Financial Health Score */}
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTe ? 'ఆర్థిక ఆరోగ్య స్కోరు' : 'Financial Health'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="size-3.5" />
              <span>+6 pts</span>
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
              <span>{isTe ? healthScore.statusTe : healthScore.status} — {isTe ? 'మెరుగుపడుతోంది' : 'Improving this month'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Cash Flow Chart & Financial Health Factor Breakdown */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Large Interactive Cash Flow Chart */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold font-sora text-base">
                  {isTe ? 'నగదు ప్రవాహ విశ్లేషణ' : 'Cash Flow Intelligence'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Interactive
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
                className={`rounded-md px-2.5 py-1 transition-all ${
                  timeframe === '7d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeframe('30d')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  timeframe === '30d' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setTimeframe('3m')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  timeframe === '3m' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                3 Months
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
                <Bar dataKey="Income" name={isTe ? 'ఆదాయం' : 'Income'} fill="#1B2A4A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" name={isTe ? 'ఖర్చులు' : 'Expense'} fill="#E3A857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net" name={isTe ? 'నికర మిగులు' : 'Net Cash'} fill="#2F8F5B" radius={[4, 4, 0, 0]} />
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
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{isTe ? 'వివరణాత్మక నగదు ప్రవాహం' : 'Detailed Cash Flow'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* Financial Health Diagnostic Card */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift">
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
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400">
                ● {healthScore.status}
              </span>
            </div>

            {/* Score Big Display */}
            <div className="my-5 flex items-center justify-between bg-muted/30 rounded-xl p-4">
              <div>
                <p className="text-3xl font-extrabold font-sora text-primary">
                  <AnimatedNumber value={healthScore.score} />
                  <span className="text-sm font-medium text-muted-foreground ml-1">/ 100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTe ? 'సంస్థాగత రుణ మంజూరు సంసిద్ధత' : 'Institutional credit-readiness'}
                </p>
              </div>
              <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
                <TrendingUp className="size-6" />
              </div>
            </div>

            {/* 3 Transparent Factors Progress Bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'లాగ్‌బుక్ స్థిరత్వం' : 'Logging Consistency'}</span>
                  <span className="font-semibold text-foreground">80%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'లాభాల సరళి' : 'Profit Trend'}</span>
                  <span className="font-semibold text-foreground">75%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: '75%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-muted-foreground">{isTe ? 'వ్యయ నియంత్రణ' : 'Expense Control'}</span>
                  <span className="font-semibold text-foreground">85%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: '85%' }} />
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
              className="w-full text-center text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {isTe ? 'పూర్తి ఆర్థిక ప్రణాళికను చూడండి →' : 'View Full Credit & Amortization Plan →'}
            </button>
          </div>
        </section>
      </div>

      {/* 3. Contextual Risk Area & AI Business Advisor Teaser */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contextual Risk Area */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift">
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
                {detectedRisks.length > 0 ? `${detectedRisks.length} Detected` : 'All Safe'}
              </span>
            </div>

            {detectedRisks.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 mb-2">
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
                  <div key={risk.ruleCode || risk.riskType} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
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
            <span className="text-[11px] text-muted-foreground">Deterministic Guardrails</span>
            <button
              onClick={() => setActive('Risk Alerts')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{isTe ? 'అన్ని రిస్క్ నిబంధనలు చూడండి' : 'Inspect Risk Rules'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* ✦ AI Business Advisor Teaser Card */}
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-xs flex flex-col justify-between hover-lift relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
            <Sparkles className="size-28 text-primary" />
          </div>

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow-xs">
                  <Sparkles className="size-3.5" />
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

            <div className="my-4 rounded-xl border bg-background/80 p-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-foreground">{profile.category} in {profile.location || 'Telangana'}</span>
                <span className="text-emerald-700 font-bold text-[11px]">High Demand</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500" style={{ width: '84%' }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2">
                Priority-sector subsidies and local off-take aggregators present strong commercial viability for your capital tier.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setActive('Business Advisor')}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>{isTe ? 'పూర్తి మార్కెట్ సలహా చూడండి →' : 'Explore Market Opportunity & SWOT →'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* 4. Recent Activity Logbook Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="font-semibold font-sora text-base">{isTe ? 'ఇటీవలి లావాదేవీలు' : 'Recent Transaction Activity'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{isTe ? 'మీ తాజా లాగ్‌బుక్ రికార్డులు' : 'Your latest recorded sales and operating expenses'}</p>
          </div>
          <button
            onClick={() => setActive('Digital Logbook')}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
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
              className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              + {isTe ? 'లావాదేవీ నమోదు చేయండి' : 'Record Transaction'}
            </button>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.slice(0, 4).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
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
