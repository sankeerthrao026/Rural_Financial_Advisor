'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
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
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function MetricCard({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div
          className={`flex items-center gap-1 text-xs font-semibold ${
            positive ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {detail}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold font-sora tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">vs. last month</p>
    </div>
  );
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

  // Dynamic bar chart data
  const revenueChartData = [
    { month: 'Apr', Revenue: 28000, Expenses: 12000 },
    { month: 'May', Revenue: 34000, Expenses: 14500 },
    { month: 'Jun', Revenue: 31000, Expenses: 13000 },
    { month: 'Jul', Revenue: 39000, Expenses: 16000 },
    { month: 'Aug', Revenue: 42000, Expenses: 15500 },
    { month: 'Sep', Revenue: Math.max(25000, totalIncome), Expenses: Math.max(12000, totalExpenses) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={isTe ? 'మొత్తం ఆదాయం' : 'Total revenue'}
          value={formatINR(totalIncome)}
          detail="+12.4%"
          positive
        />
        <MetricCard
          label={isTe ? 'నికర నగదు ప్రవాహం' : 'Net cash flow'}
          value={formatINR(netCashFlow)}
          detail={netCashFlow >= 0 ? '+8.2%' : '-15.4%'}
          positive={netCashFlow >= 0}
        />
        <MetricCard
          label={isTe ? 'ఆర్థిక ఆరోగ్య స్కోరు' : 'Financial health score'}
          value={`${healthScore.score} / 100`}
          detail={healthScore.status}
          positive={healthScore.score >= 60}
        />
        <MetricCard
          label={isTe ? 'రిస్క్ హెచ్చరికలు' : 'Open risk alerts'}
          value={detectedRisks.length > 0 ? `0${detectedRisks.length}` : '00'}
          detail={detectedRisks.length > 0 ? `${detectedRisks.length} active` : 'All safe'}
          positive={detectedRisks.length === 0}
        />
      </div>

      {/* Main Grid: Revenue Overview Chart & Upcoming Actions */}
      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        {/* Recharts Chart Section */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold font-sora text-base">{isTe ? 'ఆదాయం & వ్యయాల అవలోకనం' : 'Revenue overview'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{isTe ? 'నెలవారీ ఆదాయం మరియు నిర్వహణ ఖర్చులు' : 'Monthly revenue and operating expenses'}</p>
            </div>
            <span className="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
              Last 6 months
            </span>
          </div>

          <div className="mt-6 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6EC" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#5C6479" />
                <YAxis tick={{ fontSize: 10 }} stroke="#5C6479" tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val)), '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E6EC', fontSize: '12px' }}
                />
                <Bar dataKey="Revenue" fill="#1B2A4A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#E3A857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex gap-5 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-2">
              <i className="size-2.5 rounded-full bg-primary" />
              {isTe ? 'ఆదాయం (Revenue)' : 'Revenue'}
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2.5 rounded-full bg-amber-500" />
              {isTe ? 'ఖర్చులు (Expenses)' : 'Expenses'}
            </span>
          </div>
        </section>

        {/* Upcoming Actions */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold font-sora text-base">{isTe ? 'తదుపరి చర్యలు' : 'Upcoming actions'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{isTe ? 'వ్యాపారాన్ని ముందుకు నడిపించే సూచనలు' : 'Keep your enterprise resilient and ready'}</p>
            </div>
            <button
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setActive('Risk Alerts')}
            >
              View all
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {[
              {
                title: isTe ? 'లాగ్‌బుక్ రికార్డులు నమోదు చేయండి' : 'Update ledger records',
                sub: 'Digital Logbook',
                icon: BookOpen,
              },
              {
                title: isTe ? 'రుణ వాయిదా లెక్కించండి' : 'Review scheme EMI structure',
                sub: 'Finance Advisor',
                icon: Calculator,
              },
              {
                title: isTe ? 'స్థానిక మార్కెట్ సలహా పొందండి' : 'Run local market AI advisory',
                sub: 'Business Advisor',
                icon: Sparkles,
              },
              {
                title: isTe ? 'ప్రభుత్వ పథకాలను పరిశీలించండి' : 'Explore NBCFDC & Mudra schemes',
                sub: 'Scheme Matching',
                icon: FileText,
              },
            ].map(({ title, sub, icon: Icon }) => (
              <button
                key={title}
                onClick={() => setActive(sub)}
                className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Grid: Recent Logbook Activity & Business Health Score Banner */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Table */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h2 className="font-semibold font-sora text-base">{isTe ? 'ఇటీవలి లావాదేవీలు' : 'Recent activity'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{isTe ? 'మీ తాజా లాగ్‌బుక్ రికార్డులు' : 'Your latest recorded transactions'}</p>
            </div>
            <button
              onClick={() => setActive('Digital Logbook')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open logbook
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.slice(0, 4).map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 font-medium text-foreground truncate max-w-44">{row.note}</td>
                    <td className="py-2.5 text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className={`py-2.5 text-right font-bold tabular-nums ${
                      row.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {row.type === 'income' ? `+${formatINR(row.amount)}` : `-${formatINR(row.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Financial Health Banner */}
        <section className="rounded-2xl border bg-primary p-6 text-primary-foreground flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-semibold">
                {isTe ? 'వ్యాపార ఆరోగ్య స్థితి' : 'Enterprise Health Status'}
              </p>
              <h2 className="mt-2 text-2xl font-bold font-sora">
                {isTe ? healthScore.statusTe : healthScore.status.toUpperCase()}
              </h2>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-white/10">
              <TrendingUp className="size-5 text-primary-foreground" />
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-primary-foreground/85 max-w-sm">
            {isTe ? healthScore.summaryTe : healthScore.summary}
          </p>

          <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between">
            <span className="text-xs text-primary-foreground/80 font-medium">
              Health Score: {healthScore.score} / 100
            </span>
            <button
              onClick={() => setActive('Finance Advisor')}
              className="flex items-center gap-1.5 text-xs font-bold underline underline-offset-4 hover:opacity-80"
            >
              <span>{isTe ? 'ఆర్థిక విశ్లేషణ చూడండి' : 'Inspect Financial Health'}</span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
