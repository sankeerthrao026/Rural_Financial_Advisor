'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  calculateCreditReadiness,
  generateCreditReadinessCertificatePdf,
  CreditReadinessResult,
} from '@/lib/finance/credit-score';
import {
  ShieldCheck,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock,
  ArrowRight,
  Sparkles,
  BookOpen,
  Calendar,
  Percent,
  Activity,
  FileCheck,
  PlusCircle,
  Zap,
  Info,
} from 'lucide-react';

export function CreditScoreScreen({ setActive }: { setActive?: (value: string) => void }) {
  const { entries, profile, finance, netCashFlow, language } = useApp();
  const isTe = language === 'te';
  const isHi = language === 'hi';

  const [downloading, setDownloading] = useState(false);

  // Calculate deterministic 30/40/30 alternative credit readiness from real logbook data
  const creditResult: CreditReadinessResult = useMemo(() => {
    const liquidBuffer = Math.round(finance.projectCost * 0.10);
    const availableCash = Math.max(0, netCashFlow) + liquidBuffer;

    return calculateCreditReadiness(entries, {
      availableCashOverride: availableCash,
      userName: profile.name,
      businessName: profile.businessName,
    });
  }, [entries, netCashFlow, finance.projectCost, profile.name, profile.businessName]);

  const { overallScore, cibilEquivalent, grade, gradeTe, summary, summaryTe, components, suggestions } = creditResult;

  // Handle PDF Certificate download
  const handleDownloadCertificate = () => {
    setDownloading(true);
    try {
      generateCreditReadinessCertificatePdf(creditResult, {
        name: profile.name,
        businessName: profile.businessName,
        category: profile.category,
        location: profile.location,
      });
    } catch (err) {
      console.error('Failed to generate credit certificate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner & Certificate Download Button */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
              <Award className="size-3.5" />
              {isTe ? 'ప్రత్యామ్నాయ క్రెడిట్ స్కోరింగ్' : 'Alternative Credit Underwriting'}
            </span>
            <span className="text-xs text-muted-foreground">
              {isTe ? 'పారదర్శక 30/40/30 సూత్రం' : 'Transparent 30/40/30 Formula (Zero Black-Box)'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">
            {isTe ? 'ప్రత్యామ్నాయ క్రెడిట్ స్కోరు & నివేదిక కార్డు' : 'Alternative Credit Score & Report Card'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {isTe
              ? 'సిబిల్ హిస్టరీ లేని గ్రామీణ వ్యవస్థాపకుల కోసం మీ రోజువారీ లాగ్‌బుక్ రికార్డులు మరియు నికర లాభాల ఆధారంగా రూపొందించిన స్కోరు.'
              : 'Empowers rural entrepreneurs without traditional CIBIL histories by transforming cash-flow consistency and operating margins into verifiable creditworthiness.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleDownloadCertificate}
            disabled={downloading}
            className="flex items-center gap-1.5 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>{isTe ? 'క్రెడిట్ సర్టిఫికేట్ డౌన్‌లోడ్' : 'Download Certificate (PDF)'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Prominent Overall Score Card (Requirement 2) */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs">
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {/* Radial Score Badge */}
          <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r">
            <div className="relative grid size-36 place-items-center rounded-full bg-primary/5 border-4 border-primary/20 shadow-inner">
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-extrabold font-sora tracking-tight text-primary">
                  {overallScore}
                </span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  out of 100
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30">
                {isTe ? gradeTe : grade}
              </span>
              <span className="text-[11px] text-muted-foreground">
                CIBIL Equivalent: <strong className="text-foreground font-sora">~{cibilEquivalent} / 900</strong>
              </span>
            </div>
          </div>

          {/* Assessment Summary & Value Proposition */}
          <div className="md:col-span-2 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-800 dark:text-emerald-400 shrink-0" />
                <h3 className="text-base font-bold font-sora text-foreground">
                  {overallScore >= 75
                    ? (isTe ? 'రుణ అర్హత ధ్రువీకరించబడింది (Credit Ready)' : 'Statutory Credit Ready — Prime Tier')
                    : (isTe ? 'స్థిరమైన క్రెడిట్ పునాది' : 'Active Credit Readiness in Progress')}
                </h3>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-foreground/85 leading-relaxed">
                {isTe ? summaryTe : summary}
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {isTe
                  ? 'ఈ స్కోరు బ్యాంకులు మరియు ఎన్‌బిఎఫ్‌సిలకు తక్షణమే ఆమోదయోగ్యమైనది. ఇది మీ నిజమైన రోజువారీ వ్యాపార క్రమశిక్షణను ప్రతిబింబిస్తుంది.'
                  : 'Unlike opaque black-box credit models, this score is 100% auditable. Lenders evaluate your actual cash retention and logbook discipline to approve formal micro-finance.'}
              </p>
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t text-center">
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Active Log Days</span>
                <strong className="text-xs sm:text-sm font-bold text-foreground mt-0.5 block">
                  {components.daysLoggedCount} Days
                </strong>
              </div>
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Net Surplus</span>
                <strong className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-400 mt-0.5 block">
                  {formatINR(components.netProfit)}
                </strong>
              </div>
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Expense Ratio</span>
                <strong className="text-xs sm:text-sm font-bold text-primary mt-0.5 block">
                  {components.expenseRatioPct}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Transparent 30/40/30 Component Breakdown (Requirement 1 & 2) */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2">
          <div>
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'పారదర్శక స్కోరు విశ్లేషణ (30 / 40 / 30 సూత్రం)' : 'Transparent 30/40/30 Formula Breakdown'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe
                ? 'మీ మొత్తం స్కోరు ఎలా లెక్కించబడిందో క్రింది మూడు భాగాల ద్వారా స్పష్టంగా చూడవచ్చు.'
                : 'See exactly how each component contributes weighted points to your final score with zero hidden penalties.'}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary self-start sm:self-auto">
            100% Transparent Rule Engine
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {/* Component 1: 30% Logging Habit & Discipline */}
          <div className="rounded-xl border p-5 bg-muted/15 transition-colors hover:bg-muted/25">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold font-sora text-sm text-foreground">
                      {isTe ? 'లాగ్‌బుక్ నిర్వహణ క్రమశిక్షణ' : 'Logging Habit & Discipline'}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                      Weight: 30%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isTe
                      ? 'రోజువారీ వ్యాపార ఆదాయం మరియు ఖర్చులను నమోదు చేసే క్రమబద్ధత.'
                      : 'Consistency of transaction recording, frequency per week, and absence of long record gaps.'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="flex items-baseline sm:justify-end gap-1.5">
                  <strong className="text-lg font-bold font-sora text-foreground">
                    {components.loggingScore}
                  </strong>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                  <span className="text-xs font-bold text-primary ml-2">
                    (+{components.loggingWeightedPoints} pts)
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Contributes 30% to total score
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${components.loggingScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-foreground/80 leading-relaxed">
                {isTe ? components.loggingSummaryTe : components.loggingSummary}
              </p>
            </div>
          </div>

          {/* Component 2: 40% Operating Profit Stability & Consistency */}
          <div className="rounded-xl border p-5 bg-muted/15 transition-colors hover:bg-muted/25">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-400">
                  <TrendingUp className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold font-sora text-sm text-foreground">
                      {isTe ? 'నికర లాభాల స్థిరత్వం & మార్జిన్' : 'Operating Profit Consistency & Stability'}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-bold">
                      Weight: 40%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isTe
                      ? 'ఖర్చులు పోను వ్యాపారంలో మిగిలే స్థిరమైన నికర లాభం మరియు మార్జిన్.'
                      : 'Consistency of net positive profit margin and absence of severe month-to-month volatility.'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="flex items-baseline sm:justify-end gap-1.5">
                  <strong className="text-lg font-bold font-sora text-emerald-800 dark:text-emerald-400">
                    {components.profitScore}
                  </strong>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 ml-2">
                    (+{components.profitWeightedPoints} pts)
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Contributes 40% to total score
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-500"
                  style={{ width: `${components.profitScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-foreground/80 leading-relaxed">
                {isTe ? components.profitSummaryTe : components.profitSummary}
              </p>
            </div>
          </div>

          {/* Component 3: 30% Expense-to-Income Discipline & Cash Buffer */}
          <div className="rounded-xl border p-5 bg-muted/15 transition-colors hover:bg-muted/25">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                  <Activity className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold font-sora text-sm text-foreground">
                      {isTe ? 'ఖర్చుల నియంత్రణ & నగదు నిల్వలు (రన్‌వే)' : 'Expense Discipline & Cash Buffer'}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold">
                      Weight: 30%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isTe
                      ? 'ఆదాయంలో ఖర్చుల పరిమితి మరియు అత్యవసర సమయాల్లో ఆదుకునే వర్కింగ్ క్యాపిటల్ రన్‌వే.'
                      : 'Maintaining expenses below 60% of revenue and holding a multi-week liquid cash buffer.'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="flex items-baseline sm:justify-end gap-1.5">
                  <strong className="text-lg font-bold font-sora text-indigo-700 dark:text-indigo-400">
                    {components.expenseDisciplineScore}
                  </strong>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 ml-2">
                    (+{components.expenseDisciplineWeightedPoints} pts)
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Contributes 30% to total score
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${components.expenseDisciplineScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-foreground/80 leading-relaxed">
                {isTe ? components.expenseSummaryTe : components.expenseSummary}
              </p>
            </div>
          </div>
        </div>

        {/* Exact Additive Sum Summary Row */}
        <div className="mt-6 p-4 rounded-xl border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-800 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-foreground">
              {isTe ? 'పారదర్శక సమీకరణ ధ్రువీకరణ:' : 'Additive Formula Verification:'}
            </span>
            <span className="text-muted-foreground font-mono">
              {components.loggingWeightedPoints} (Logging) + {components.profitWeightedPoints} (Profit) + {components.expenseDisciplineWeightedPoints} (Discipline) =
            </span>
          </div>
          <strong className="text-base font-bold font-sora text-primary">
            {overallScore} / 100 Total Score
          </strong>
        </div>
      </section>

      {/* 4. Actionable Suggestions with Simulated Point Impact (Requirement 3) */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'స్కోరును పెంచుకోవడానికి స్పష్టమైన చర్యలు' : 'Actionable Steps to Elevate Your Score'}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {isTe ? 'గణితీయ అంచనా' : 'Mathematically Simulated Point Impact'}
          </span>
        </div>

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          {suggestions.map((sugg) => (
            <div
              key={sugg.id}
              className="rounded-xl border p-5 bg-card flex flex-col justify-between shadow-2xs hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {isTe ? sugg.titleTe : sugg.title}
                  </span>
                  {sugg.estimatedPointsGain > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                      <Zap className="size-3" />
                      +{sugg.estimatedPointsGain} Points
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Prime Tier
                    </span>
                  )}
                </div>

                <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                  {isTe ? sugg.actionTextTe : sugg.actionText}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Projected Score: <strong className="text-foreground">{sugg.simulatedScore}/100</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActive?.(sugg.component === 'logging' ? 'Digital Logbook' : 'Financial Analytics')}
                  className="h-7 px-2 text-xs text-primary hover:text-primary/90 font-medium cursor-pointer"
                >
                  <span>{isTe ? 'చర్య తీసుకోండి' : 'Take Action'}</span>
                  <ArrowRight className="size-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Underwriting Standards & MFI Benchmark Criteria */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? 'బ్యాంకులు & మైక్రోఫైనాన్స్ సంస్థల ప్రమాణాలు' : 'Institutional Underwriting Benchmarks'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Criteria used by NBFCs and state corporations (e.g. NBCFDC) to sanction priority sector loans.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Grade A+ (80–100)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400">
                Prime Fast-Track
              </span>
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Lowest statutory interest rates (6.0%–6.5%), expedited sanctioning with minimum promoter guarantee.
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Grade A (70–79)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Standard Sanction
              </span>
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Standard NBCFDC / MUDRA eligibility. Standard 90% debt sanction with regular quarterly repayment.
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Grade B (60–69)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400">
                Marginal Collateral
              </span>
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Eligible for micro-finance credit tickets with enhanced margin equity or self-help group cosigners.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CreditScoreScreen;
