'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BusinessPlanOutput } from '@/lib/ai/provider';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

export function BusinessPlanScreen() {
  const { profile, finance, language, dictionary } = useApp();
  const t = dictionary.businessPlan;
  const isTe = language === 'te';

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<BusinessPlanOutput | null>(null);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: profile.location,
          category: profile.category,
          businessName: profile.businessName,
          finance,
          advisor: {
            marketReach: { headline: 'Strong local demand within village cluster' },
          },
          language,
        }),
      });

      const data = await res.json();
      setPlan(data);
    } catch (e) {
      console.error('Plan synthesis error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
              Bank-Ready Credit Package
            </span>
            <span className="text-xs text-muted-foreground">1-Click Unified Synthesis</span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">{t.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {plan && (
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-1.5 font-medium">
              <Printer className="size-4" />
              <span>{t.downloadPdf}</span>
            </Button>
          )}
          <Button onClick={generatePlan} disabled={loading} size="sm" className="flex items-center gap-2 font-semibold">
            <Sparkles className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? t.generatingText : t.generateBtn}</span>
          </Button>
        </div>
      </div>

      {/* Plan Document Preview */}
      {plan ? (
        <div className="rounded-2xl border bg-card p-8 shadow-sm flex flex-col gap-6 print:border-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b pb-6 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                PROJECT PROPOSAL & CREDIT APPRAISAL MEMORANDUM
              </p>
              <h1 className="mt-1 text-2xl font-bold font-sora text-foreground">{profile.businessName}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {profile.category} • {profile.location}
              </p>
            </div>
            <div className="text-right">
              <span className="rounded bg-primary text-primary-foreground px-2 py-1 text-xs font-semibold">
                {finance.scheme.name}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">Date: 19 Sep 2026</p>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h3 className="font-semibold font-sora text-sm text-foreground">1. Executive Summary</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{plan.executiveSummary}</p>
          </div>

          {/* Capital Outlay Table */}
          <div>
            <h3 className="font-semibold font-sora text-sm text-foreground mb-3">
              2. Total Capital Outlay & Financing Structure
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div className="rounded-xl border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Total Project Cost</p>
                <p className="text-lg font-bold font-sora text-foreground mt-0.5">
                  {formatINR(finance.projectCost)}
                </p>
              </div>
              <div className="rounded-xl border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Promoter Margin (10%)</p>
                <p className="text-lg font-bold font-sora text-primary mt-0.5">
                  {formatINR(finance.marginCapital)}
                </p>
              </div>
              <div className="rounded-xl border p-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Term Scheme Loan (90%)</p>
                <p className="text-lg font-bold font-sora text-emerald-700 mt-0.5">
                  {formatINR(finance.loanAmount)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Asset / Expenditure Item</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Allocation (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.capitalDeploymentPlan.allocationBreakdown.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-foreground font-medium">{item.item}</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-foreground">
                        {formatINR(item.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{item.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Ramp-Up */}
          <div>
            <h3 className="font-semibold font-sora text-sm text-foreground">3. Operational Schedule & Moratorium</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{plan.operationalPlan}</p>
          </div>

          {/* Financial Feasibility */}
          <div>
            <h3 className="font-semibold font-sora text-sm text-foreground mb-3">4. Financial Feasibility Projections</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Projected Monthly Revenue</p>
                <p className="text-sm font-bold font-sora text-emerald-800 mt-1">
                  {plan.financialProjections.expectedMonthlyRevenue}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Operating Expenses</p>
                <p className="text-sm font-bold font-sora text-rose-800 mt-1">
                  {plan.financialProjections.expectedMonthlyExpense}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Expected Net Surplus</p>
                <p className="text-sm font-bold font-sora text-primary mt-1">
                  {plan.financialProjections.netMonthlySurplus}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Debt Service Coverage</p>
                <p className="text-sm font-bold font-sora text-emerald-700 mt-1">
                  {plan.financialProjections.quarterlyEmiCoverageRatio}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Mitigation */}
          <div>
            <h3 className="font-semibold font-sora text-sm text-foreground mb-2">5. Risk Containment Safeguards</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {plan.riskMitigation.map((m, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
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
                ? 'మీ వ్యాపార ఆర్థిక గణాంకాలు మరియు మార్కెట్ సమాచారాన్ని కలిపి బ్యాంకు రుణ దరఖాస్తుకు సరిపోయే సమగ్ర నివేదికను రూపొందించండి.'
                : 'Merge your deterministic project cost, scheme terms, and grounded local market intelligence into a bank-ready business proposal.'}
            </p>
            <Button onClick={generatePlan} disabled={loading} className="mt-5 font-semibold">
              <Sparkles className="size-4 mr-2" />
              {t.generateBtn}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
