'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { BusinessAdvisorOutput } from '@/lib/ai/provider';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  MapPin,
  CheckCircle2,
  Tag,
  Users,
  Target,
  RefreshCw,
  Info,
} from 'lucide-react';

export function BusinessAdvisorScreen() {
  const { profile, language, dictionary } = useApp();
  const t = dictionary.businessAdvisor;
  const isTe = language === 'te';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BusinessAdvisorOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/business-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: profile.location,
          category: profile.category,
          marginCapital: profile.marginCapital,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch business advisory');
      }

      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('Advisor error:', err);
      setError(err?.message || 'Error running advisory');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first load if not loaded yet
  useEffect(() => {
    if (!data && !loading) {
      runAnalysis();
    }
  }, [profile.location, profile.category, language]);

  return (
    <div className="flex flex-col gap-6">
      {/* Grounding Source Attribution Banner */}
      <div className="rounded-2xl border bg-accent/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-200/70">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-amber-500/20 text-amber-900">
            <Info className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-950">
              {isTe
                ? 'జిల్లా స్థాయి ధృవీకరించిన నమూనా డేటా ఆధారిత విశ్లేషణ'
                : 'Locally Grounded District Intelligence'}
            </p>
            <p className="text-[11px] text-amber-900/80 mt-0.5">
              {isTe
                ? 'వరంగల్, కరీంనగర్ మరియు నల్గొండ ప్రాంతాల అగ్మార్క్‌నెట్ మరియు NBCFDC మార్కెట్ బెంచ్‌మార్క్‌ల ఆధారంగా రూపొందించబడింది. (Sample Data — Live API integration is future work)'
                : 'Derived from regional mandi data, rural population clusters, and NBCFDC benchmarks. (Sample Data — Live integration is future work)'}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 shrink-0 bg-card font-semibold text-xs border-amber-300 hover:bg-amber-100"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? t.analyzingText : t.runAnalysisBtn}</span>
        </Button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border bg-card p-10 text-center flex flex-col items-center justify-center min-h-80 shadow-xs">
          <div className="relative flex items-center justify-center">
            <div className="size-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="size-6 text-primary absolute" />
          </div>
          <h3 className="mt-5 text-base font-bold font-sora text-foreground">
            {t.analyzingText}
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
            {isTe
              ? 'మీ ప్రాంతపు జనాభా గిరాకీ, పోటీదారుల సంఖ్య మరియు ధరల బెంచ్‌మార్క్‌లను విశ్లేషిస్తున్నాము...'
              : 'Cross-referencing rural consumer density, competitor presence, and typical margin thresholds...'}
          </p>
        </div>
      )}

      {/* Structured Advisor Results */}
      {!loading && data && (
        <div className="flex flex-col gap-6">
          {/* Top Summary Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
                  {dictionary.aiEstimateBadge}
                </span>
                <span className="text-xs text-muted-foreground">
                  Grounded for {profile.category} in {profile.location}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">
                {data.marketReach.headline}
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                {data.marketReach.details}
              </p>
            </div>

            <div className="rounded-xl border bg-background p-4 sm:min-w-48 text-right shadow-xs">
              <p className="text-[11px] text-muted-foreground font-medium">{t.pricingSuggestion}</p>
              <p className="text-lg font-bold font-sora text-primary mt-1">
                {data.pricingSuggestion.recommendedBand}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                {data.pricingSuggestion.marginTarget}
              </p>
            </div>
          </div>

          {/* Grid: Opportunity & Competitor Density */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Opportunity Analysis */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <h3 className="font-semibold font-sora text-sm">{t.opportunityAnalysis}</h3>
                  </div>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {dictionary.aiEstimateBadge}
                  </span>
                </div>
                <p className="mt-3 text-xs text-foreground leading-relaxed">
                  {data.opportunityAnalysis.overview}
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isTe ? 'ప్రధాన అవకాశ కారకాలు' : 'Core Value Drivers'}
                  </p>
                  {data.opportunityAnalysis.primaryDrivers.map((driver, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{driver}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{isTe ? 'కాలానుగుణ గిరాకీ:' : 'Seasonality:'}</span>{' '}
                {data.opportunityAnalysis.seasonalOpportunity}
              </div>
            </section>

            {/* Competitor Density */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <h3 className="font-semibold font-sora text-sm">{t.competitorDensity}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    data.competitorDensity.densityLevel === 'High'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {data.competitorDensity.densityLevel} Density
                  </span>
                </div>
                <p className="mt-3 text-xs text-foreground leading-relaxed">
                  {data.competitorDensity.description}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <p className="text-xs font-semibold text-primary">
                  {isTe ? 'విజయవంతమైన వ్యాపార వ్యూహం (Mitigation Strategy):' : 'Moat & Differentiation Strategy:'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {data.competitorDensity.mitigationStrategy}
                </p>
              </div>
            </section>
          </div>

          {/* SWOT Grid */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold font-sora text-base">{t.swotAnalysis}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTe ? 'వ్యాపార బలాలు, బలహీనతలు, అవకాశాలు మరియు సవాళ్ల సమగ్ర విశ్లేషణ' : 'Balanced diagnostic across internal capabilities and external market dynamics'}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {dictionary.aiEstimateBadge}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Strengths */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-xs font-bold font-sora text-emerald-950 uppercase tracking-wider">
                  {t.strengths}
                </p>
                <ul className="mt-2.5 space-y-2 text-xs text-emerald-900">
                  {data.swot.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-xs font-bold font-sora text-amber-950 uppercase tracking-wider">
                  {t.weaknesses}
                </p>
                <ul className="mt-2.5 space-y-2 text-xs text-amber-900">
                  {data.swot.weaknesses.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <p className="text-xs font-bold font-sora text-blue-950 uppercase tracking-wider">
                  {t.opportunities}
                </p>
                <ul className="mt-2.5 space-y-2 text-xs text-blue-900">
                  {data.swot.opportunities.map((o, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Threats */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                <p className="text-xs font-bold font-sora text-rose-950 uppercase tracking-wider">
                  {t.threats}
                </p>
                <ul className="mt-2.5 space-y-2 text-xs text-rose-900">
                  {data.swot.threats.map((th, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">•</span>
                      <span>{th}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Benchmark Cost Allocation & Assumptions */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Benchmark OPEX Breakdown */}
            {data.groundedFacts?.benchmarkOpex && (
              <section className="rounded-2xl border bg-card p-6 shadow-xs">
                <h3 className="font-semibold font-sora text-sm pb-2 border-b">
                  {isTe ? 'స్థానిక సగటు వ్యయాల విభజన (Benchmark OPEX)' : 'District Benchmark Cost Breakdown'}
                </h3>
                <div className="mt-4 space-y-3">
                  {data.groundedFacts.benchmarkOpex.map((cost, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{cost.item}</span>
                        <span className="font-bold text-foreground">{cost.percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${cost.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Assumptions & Disclaimers */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h3 className="font-semibold font-sora text-sm pb-2 border-b">
                {isTe ? 'విశ్లేషణ నిబంధనలు మరియు అంచనాలు' : 'Modeling Assumptions & Legal Notice'}
              </h3>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                {data.assumptions.map((asm, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{asm}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-muted-foreground italic border-t pt-3">
                {dictionary.aiEstimateDisclaimer}
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
