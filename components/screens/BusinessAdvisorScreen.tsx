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
  Layers,
  ArrowRight,
  Database,
  Cpu,
} from 'lucide-react';

const AI_PIPELINE_STEPS = [
  {
    step: 1,
    icon: Database,
    titleEn: 'Querying district mandi pricing & regional enterprise benchmarks',
    titleTe: 'జిల్లా మండి ధరలు మరియు ప్రాంతీయ వ్యాపార బెంచ్‌మార్క్‌లను శోధిస్తున్నాము',
    detailEn: 'ChromaDB vector store • APMC & NBCFDC localized indices',
    detailTe: 'ChromaDB నాలెడ్జ్ బేస్ • APMC మార్కెట్ డేటా',
  },
  {
    step: 2,
    icon: Cpu,
    titleEn: 'Evaluating enterprise viability & unit economics with Gemini 2.5 Flash',
    titleTe: 'జెమినీ 2.5 ఫ్లాష్ ద్వారా యూనిట్ ఎకనామిక్స్ మరియు రిస్క్ పారామితుల విశ్లేషణ',
    detailEn: 'Evaluating margin capital, target demand, competitor density',
    detailTe: 'పెట్టుబడి మూలధనం, కేటగిరీ గిరాకీ, కాలానుగుణ మార్పులు',
  },
  {
    step: 3,
    icon: Sparkles,
    titleEn: 'Synthesizing strategic SWOT matrix & localized pricing guidance',
    titleTe: 'SWOT మ్యాట్రిక్స్ మరియు స్థానిక ధరల శ్రేణిని క్రోడీకరిస్తున్నాము',
    detailEn: 'Generating actionable differentiation and competitive moat',
    detailTe: 'పోటీదారుల విశ్లేషణ మరియు లాభదాయక వ్యాపార వ్యూహం',
  },
];

export function BusinessAdvisorScreen() {
  const { profile, language, dictionary } = useApp();
  const t = dictionary.businessAdvisor;
  const isTe = language === 'te';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BusinessAdvisorOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Cycle through multi-step thinking state when loading
  useEffect(() => {
    if (!loading) {
      setActiveStep(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setActiveStep(0);
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
      <div className="rounded-2xl border bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-300 shrink-0">
            <Info className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                {isTe
                  ? 'జిల్లా స్థాయి ధృవీకరించిన నమూనా డేటా ఆధారిత విశ్లేషణ'
                  : 'Locally Grounded District Intelligence'}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                Live Context
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
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
          className="flex items-center gap-1.5 shrink-0 bg-card font-semibold text-xs border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? t.analyzingText : t.runAnalysisBtn}</span>
        </Button>
      </div>

      {/* Dynamic Multi-Step AI Thinking State */}
      {loading && (
        <div className="rounded-2xl border bg-card p-8 sm:p-10 shadow-xs flex flex-col items-center justify-center min-h-[380px] page-enter">
          <div className="relative flex items-center justify-center mb-4">
            <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="size-7 text-primary absolute animate-pulse" />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>Multi-Agent Synthesis</span>
            </div>
            <h3 className="text-lg font-bold font-sora text-foreground">
              {t.analyzingText}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              {isTe
                ? 'మీ ప్రాంతపు జనాభా గిరాకీ, పోటీదారుల సంఖ్య మరియు ధరల బెంచ్‌మార్క్‌లను క్రోడీకరిస్తున్నాము...'
                : 'Cross-referencing rural consumer density, competitor presence, and typical margin thresholds...'}
            </p>
          </div>

          {/* Interactive Step Visualizer */}
          <div className="w-full max-w-lg space-y-3 bg-muted/30 rounded-xl p-4 border border-border/50">
            {AI_PIPELINE_STEPS.map((step, idx) => {
              const isCompleted = activeStep > idx;
              const isCurrent = activeStep === idx;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.step}
                  className={`flex items-start gap-3 p-2.5 rounded-lg transition-all duration-300 ${
                    isCurrent
                      ? 'bg-primary/10 border border-primary/30 shadow-xs'
                      : isCompleted
                      ? 'opacity-80 bg-background/50'
                      : 'opacity-40'
                  }`}
                >
                  <div
                    className={`size-7 rounded-lg grid place-items-center text-xs font-bold shrink-0 mt-0.5 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground animate-pulse'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="size-4" /> : <StepIcon className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                      {isTe ? step.titleTe : step.titleEn}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isTe ? step.detailTe : step.detailEn}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-primary animate-pulse shrink-0">
                      Processing...
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {!loading && error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button size="sm" onClick={runAnalysis} className="mt-2">
            <RefreshCw className="size-3.5 mr-1.5" />
            {isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry Advisory'}
          </Button>
        </div>
      )}

      {/* Structured Advisor Results */}
      {!loading && data && (
        <div className="flex flex-col gap-6 page-enter">
          {/* Top Summary Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col lg:flex-row justify-between gap-6 hover-lift">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                  {dictionary.aiEstimateBadge}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full font-medium">
                  <MapPin className="size-3 text-primary" />
                  {profile.category} • {profile.location}
                </span>
              </div>
              <h2 className="mt-3 text-xl sm:text-2xl font-bold font-sora tracking-tight text-foreground">
                {data.marketReach.headline}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                {data.marketReach.details}
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 lg:min-w-64 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {t.pricingSuggestion}
                  </p>
                  <Tag className="size-4 text-primary" />
                </div>
                <p className="text-2xl font-bold font-sora text-primary mt-2">
                  {data.pricingSuggestion.recommendedBand}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-primary/20 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Target Net Margin</span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                  {data.pricingSuggestion.marginTarget}
                </span>
              </div>
            </div>
          </div>

          {/* Grid: Opportunity & Competitor Density */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Opportunity Analysis */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift">
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
                    <div key={idx} className="flex items-start gap-2 text-xs text-foreground bg-muted/30 p-2 rounded-lg">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{driver}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-950 dark:text-amber-200">
                <span className="font-bold">{isTe ? 'కాలానుగుణ గిరాకీ:' : 'Seasonality Dynamic:'}</span>{' '}
                {data.opportunityAnalysis.seasonalOpportunity}
              </div>
            </section>

            {/* Competitor Density */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between hover-lift">
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <h3 className="font-semibold font-sora text-sm">{t.competitorDensity}</h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      data.competitorDensity.densityLevel === 'High'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    }`}
                  >
                    {data.competitorDensity.densityLevel} Density
                  </span>
                </div>
                <p className="mt-3 text-xs text-foreground leading-relaxed">
                  {data.competitorDensity.description}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  {isTe ? 'విజయవంతమైన వ్యాపార వ్యూహం (Mitigation Strategy):' : 'Moat & Differentiation Strategy:'}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed font-medium">
                  {data.competitorDensity.mitigationStrategy}
                </p>
              </div>
            </section>
          </div>

          {/* SWOT Grid */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold font-sora text-base">{t.swotAnalysis}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTe
                    ? 'వ్యాపార బలాలు, బలహీనతలు, అవకాశాలు మరియు సవాళ్ల సమగ్ర విశ్లేషణ'
                    : 'Balanced diagnostic across internal capabilities and external market dynamics'}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {dictionary.aiEstimateBadge}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Strengths */}
              <div className="rounded-xl border border-emerald-300/80 bg-emerald-500/5 p-4 hover-lift">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-sora text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    {t.strengths}
                  </p>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-foreground">
                  {data.swot.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="rounded-xl border border-amber-300/80 bg-amber-500/5 p-4 hover-lift">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-sora text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    {t.weaknesses}
                  </p>
                  <span className="size-2 rounded-full bg-amber-500" />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-foreground">
                  {data.swot.weaknesses.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div className="rounded-xl border border-blue-300/80 bg-blue-500/5 p-4 hover-lift">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-sora text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    {t.opportunities}
                  </p>
                  <span className="size-2 rounded-full bg-blue-500" />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-foreground">
                  {data.swot.opportunities.map((o, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold shrink-0">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Threats */}
              <div className="rounded-xl border border-rose-300/80 bg-rose-500/5 p-4 hover-lift">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-sora text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    {t.threats}
                  </p>
                  <span className="size-2 rounded-full bg-rose-500" />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-foreground">
                  {data.swot.threats.map((th, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold shrink-0">•</span>
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
              <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
                <h3 className="font-semibold font-sora text-sm pb-2 border-b">
                  {isTe ? 'స్థానిక సగటు వ్యయాల విభజన (Benchmark OPEX)' : 'District Benchmark Cost Breakdown'}
                </h3>
                <div className="mt-4 space-y-3.5">
                  {data.groundedFacts.benchmarkOpex.map((cost, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-foreground">{cost.item}</span>
                        <span className="font-bold text-primary">{cost.percentage}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                          style={{ width: `${cost.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Assumptions & Disclaimers */}
            <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
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
