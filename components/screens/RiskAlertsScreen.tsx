'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { DetectedRisk } from '@/lib/risk/engine';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  TrendingDown,
  Layers,
  HelpCircle,
} from 'lucide-react';

export function RiskAlertsScreen() {
  const { detectedRisks, language, profile, dictionary } = useApp();
  const t = dictionary.risk;
  const isTe = language === 'te';

  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, any>>({});

  const handleFetchAiExplanation = async (risk: DetectedRisk) => {
    setExplainingId(risk.ruleCode);
    try {
      const res = await fetch('/api/ai/risk-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risk,
          businessName: profile.businessName,
          language,
        }),
      });
      const data = await res.json();
      setAiExplanations((prev) => ({ ...prev, [risk.ruleCode]: data }));
    } catch (e) {
      console.error('Failed to get AI risk explanation:', e);
    } finally {
      setExplainingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Header */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs hover-lift transition-all">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Deterministic Financial Safeguards
              </span>
              <span className="text-xs text-muted-foreground">3 Invariant Rules Active</span>
            </div>
            <h2 className="mt-2 text-xl font-bold font-sora tracking-tight">{t.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">{t.subtitle}</p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
            <ShieldAlert className="size-5" />
          </div>
        </div>
      </div>

      {/* No Risk State */}
      {detectedRisks.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-8 text-center flex flex-col items-center hover-lift transition-all">
          <div className="grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-6" />
          </div>
          <h3 className="mt-4 text-base font-bold font-sora text-emerald-950 dark:text-emerald-200">{t.noRiskTitle}</h3>
          <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80 max-w-md">{t.noRiskDesc}</p>
          <div className="mt-5 flex gap-4 text-xs font-medium text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              {isTe ? 'సింగిల్ లోన్ కమిట్‌మెంట్' : 'Single debt profile'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              {isTe ? 'ధనాత్మక నగదు ప్రవాహం' : 'Net positive cash flow'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              {isTe ? 'స్థిరమైన లాభాల మార్జిన్' : 'Consistent operating margin'}
            </span>
          </div>
        </div>
      ) : (
        /* Detected Risk Cards */
        <div className="flex flex-col gap-4">
          {detectedRisks.map((risk, idx) => {
            const explanation = aiExplanations[risk.ruleCode];
            const isExplaining = explainingId === risk.ruleCode;

            return (
              <div
                key={risk.ruleCode}
                className={`stagger-${Math.min(idx + 1, 4)} rounded-2xl border border-rose-300/80 dark:border-rose-900/80 bg-rose-50/40 dark:bg-rose-950/20 p-6 flex flex-col gap-4 shadow-xs hover-lift transition-all`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-200 text-rose-900 px-1.5 py-0.5 text-[10px] font-bold">
                          {risk.ruleCode}
                        </span>
                        <h4 className="font-bold font-sora text-sm text-rose-950">
                          {isTe ? risk.titleTe : risk.title}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFetchAiExplanation(risk)}
                    disabled={isExplaining}
                    className="flex items-center gap-1.5 bg-card hover:bg-muted font-semibold text-xs border-rose-300"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>{isExplaining ? t.aiExplaining : (isTe ? 'AI పరిష్కారాన్ని చూడండి' : 'Explain & Generate Action Plan')}</span>
                  </Button>
                </div>

                {/* Deterministic Reason */}
                <div className="rounded-xl border border-rose-200 bg-white p-3.5 text-xs text-rose-900 leading-relaxed">
                  <p className="font-semibold">{isTe ? 'నియమాధారిత గణాంక కారణం:' : 'Deterministic Detection Reason:'}</p>
                  <p className="mt-0.5 text-rose-800">{isTe ? risk.reasonTe : risk.reason}</p>
                </div>

                {/* Localized AI Explanation Output */}
                {explanation && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Sparkles className="size-4" />
                      <span>{t.aiExplanationLabel}</span>
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px]">
                        {dictionary.aiEstimateBadge}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-foreground leading-relaxed">
                      {explanation.explanation}
                    </p>

                    {explanation.practicalActionSteps && explanation.practicalActionSteps.length > 0 && (
                      <div className="rounded-lg bg-card p-3 border">
                        <p className="text-xs font-semibold text-foreground mb-1.5">
                          {isTe ? 'ఆచరణాత్మక పరిష్కార చర్యలు:' : 'Recommended Immediate Action Steps:'}
                        </p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {explanation.practicalActionSteps.map((step: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary font-bold">•</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explanation.cashFlowPreservationTip && (
                      <div className="flex items-center gap-2 text-[11px] text-primary/90 bg-primary/10 p-2.5 rounded-lg font-medium">
                        <Lightbulb className="size-4 shrink-0 text-amber-600" />
                        <span>{explanation.cashFlowPreservationTip}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
