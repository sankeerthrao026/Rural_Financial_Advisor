'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PieChart as PieIcon,
  PlusCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export function CashFlowScreen({ setActive }: { setActive?: (tab: string) => void }) {
  const { entries, totalIncome, totalExpenses, netCashFlow, language, dictionary } = useApp();
  const isTe = language === 'te';

  // Dynamic calculations from real user logbook entries
  const { categoryBreakdown, dynamicTrendData, expenseRatio, burnRateStatus } = useMemo(() => {
    // 1. Category aggregation
    const catMap: Record<string, number> = {};
    for (const e of entries) {
      if (e.type === 'expense') {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
      }
    }
    const catList = Object.entries(catMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    // 2. Dynamic chronological buckets
    let trendData: { period: string; Income: number; Expense: number; Net: number }[] = [];
    if (entries.length >= 4) {
      const sorted = [...entries].reverse();
      const chunkSize = Math.max(1, Math.floor(sorted.length / 4));
      trendData = [0, 1, 2, 3].map((i) => {
        const slice = i === 3 ? sorted.slice(i * chunkSize) : sorted.slice(i * chunkSize, (i + 1) * chunkSize);
        const inc = slice.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const exp = slice.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
        return {
          period: `Cycle ${i + 1}`,
          Income: inc,
          Expense: exp,
          Net: inc - exp,
        };
      });
    } else if (entries.length > 0) {
      trendData = entries.map((e, idx) => ({
        period: e.date.split(' ').slice(0, 2).join(' ') || `Entry ${idx + 1}`,
        Income: e.type === 'income' ? e.amount : 0,
        Expense: e.type === 'expense' ? e.amount : 0,
        Net: e.type === 'income' ? e.amount : -e.amount,
      }));
    } else {
      trendData = [];
    }

    // 3. Ratio & Status
    const ratio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
    const status = netCashFlow >= 0 ? 'Surplus' : 'Deficit';

    return {
      categoryBreakdown: catList,
      dynamicTrendData: trendData,
      expenseRatio: ratio,
      burnRateStatus: status,
    };
  }, [entries, totalIncome, totalExpenses, netCashFlow]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top 4 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Inflow */}
        <div className="stagger-1 hover-lift hover-glow-emerald rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {isTe ? 'మొత్తం ఆదాయం (Inflow)' : 'Total Inflow (Receipts)'}
            </p>
            <div className="flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
              <ArrowUpRight className="size-3" />
              {isTe ? 'రాబడి' : 'Inflow'}
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-emerald-800 dark:text-emerald-300">
            <AnimatedNumber value={totalIncome} formatter={formatINR} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.filter((e) => e.type === 'income').length} {isTe ? 'లావాదేవీలు' : 'recorded sales'}
          </p>
        </div>

        {/* Total Outflow */}
        <div className="stagger-2 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {isTe ? 'మొత్తం ఖర్చులు (Outflow)' : 'Total Outflow (OPEX)'}
            </p>
            <div className="flex items-center gap-1 rounded bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300 shadow-2xs">
              <ArrowDownRight className="size-3" />
              {isTe ? 'వ్యయం' : 'Outflow'}
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-rose-800 dark:text-rose-300">
            <AnimatedNumber value={totalExpenses} formatter={formatINR} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.filter((e) => e.type === 'expense').length} {isTe ? 'ఖర్చు రికార్డులు' : 'recorded payments'}
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="stagger-3 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {isTe ? 'నికర నగదు ప్రవాహం' : 'Net Cash Flow'}
            </p>
            <div className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold shadow-2xs ${
              netCashFlow >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}>
              {netCashFlow >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {isTe ? (netCashFlow >= 0 ? 'మిగులు' : 'లోటు') : burnRateStatus}
            </div>
          </div>
          <p className={`mt-3 text-2xl font-bold font-sora ${netCashFlow >= 0 ? 'text-foreground' : 'text-rose-700 dark:text-rose-400'}`}>
            <AnimatedNumber value={netCashFlow} formatter={formatINR} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalIncome > 0 ? `${Math.round(((netCashFlow) / totalIncome) * 100)}% net margin` : '0% margin'}
          </p>
        </div>

        {/* Operating Retention Ratio */}
        <div className="stagger-4 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {isTe ? 'వ్యయ నిష్పత్తి' : 'Expense-to-Income'}
            </p>
            <Activity className="size-4 text-primary opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-foreground">
            <AnimatedNumber value={expenseRatio} suffix="%" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {expenseRatio <= 60 ? (isTe ? 'సురక్షిత స్థాయి' : 'Healthy operating band') : (isTe ? 'హెచ్చరిక స్థాయి' : 'High expense pressure')}
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center shadow-xs flex flex-col items-center">
          <div className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
            <Wallet className="size-6" />
          </div>
          <h3 className="mt-4 text-base font-bold font-sora text-foreground">
            {isTe ? 'లాగ్‌బుక్ రికార్డులు ఏవీ నమోదు కాలేదు' : 'No Transactions Recorded Yet'}
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
            {isTe
              ? 'నగదు ప్రవాహ విశ్లేషణ మరియు చార్టులు చూడటానికి డిజిటల్ లాగ్‌బుక్‌లో మొదటి లావాదేవీని నమోదు చేయండి.'
              : 'Add your first sales receipt or operational expense in the Digital Logbook to unlock dynamic cash-flow analytics.'}
          </p>
          <Button
            onClick={() => setActive?.('Digital Logbook')}
            className="mt-5 font-semibold text-xs flex items-center gap-2"
          >
            <PlusCircle className="size-4" />
            <span>{isTe ? 'లాగ్‌బుక్‌లో నమోదు చేయండి' : 'Open Digital Logbook'}</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {/* Dynamic Inflow vs Outflow Bar Chart */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between pb-3 border-b">
              <div>
                <h3 className="font-semibold font-sora text-base">
                  {isTe ? 'నగదు రాబడి & ఖర్చుల ధోరణి' : 'Dynamic Operational Cash Flow'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isTe
                    ? 'మీ వాస్తవ లాగ్‌బుక్ లావాదేవీల నుండి లెక్కించబడిన ప్రత్యక్ష చార్ట్'
                    : 'Real-time aggregation calculated directly from active ledger entries'}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {entries.length} records
              </span>
            </div>

            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6EC" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#5C6479" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#5C6479" tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatINR(Number(val)), '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E6EC', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Income" fill="#2F8F5B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="#E3A857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex gap-5 text-xs text-muted-foreground border-t pt-3">
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-emerald-600" />
                {isTe ? 'రాబడి' : 'Inflow'}
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-amber-500" />
                {isTe ? 'ఖర్చులు' : 'Outflow'}
              </span>
            </div>
          </section>

          {/* Category-Wise Expense Allocation */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-semibold font-sora text-base">
                  {isTe ? 'ఖర్చుల విభజన' : 'Cost Breakdown by Category'}
                </h3>
                <span className="text-xs text-muted-foreground font-semibold">
                  {formatINR(totalExpenses)}
                </span>
              </div>

              {categoryBreakdown.length === 0 ? (
                <p className="mt-8 text-xs text-muted-foreground text-center">
                  {isTe ? 'ఖర్చు రికార్డులు ఏవీ లేవు' : 'No expense entries recorded.'}
                </p>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {categoryBreakdown.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-semibold">{formatINR(item.amount)}</span>
                          <span className="font-bold text-primary text-[11px]">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-primary">
                {isTe ? 'నగదు నిర్వహణ సలహా:' : 'Working Capital Advisory:'}
              </span>{' '}
              {netCashFlow >= 0
                ? (isTe
                    ? 'మీ నికర మిగులు సానుకూలంగా ఉంది. త్రైమాసిక రుణ వాయిదాల కోసం కనీసం 2 నెలల మొత్తాన్ని రిజర్వ్ ఖాతాలో ఉంచండి.'
                    : 'Operational receipts exceed payments. Maintain a rolling 30-day liquidity reserve for quarterly loan repayments.')
                : (isTe
                    ? 'ఖర్చులు రాబడి కంటే ఎక్కువగా ఉన్నాయి. తక్షణమే అత్యవసరం కాని కొనుగోళ్లను వాయిదా వేసి కస్టమర్ల బకాయిలను వసూలు చేయండి.'
                    : 'Operating expenses exceed receipts. Defer non-essential capital purchases and accelerate receivables collection.')}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
