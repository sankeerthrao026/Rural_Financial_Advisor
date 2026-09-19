'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ArrowRight,
  LogIn,
  Languages,
  ShieldCheck,
  Building2,
  Coins,
  Store,
  Scissors,
} from 'lucide-react';

export function WelcomeScreen({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { continueAsDemo, loginAsDemoUser } = useAuth();
  const { language, setLanguage, updateProfile } = useApp();
  const isTe = language === 'te';

  const handleStartFreshDemo = () => {
    const demoUser = continueAsDemo();
    // Setup empty profile for fresh demo onboarding
    updateProfile({
      name: 'Demo Entrepreneur',
      businessName: '',
      location: '',
      category: 'Dairy Farming',
      marginCapital: 100000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: false,
    });
  };

  const handlePresetDemo = async (persona: 'dairy' | 'kirana' | 'weaving') => {
    await loginAsDemoUser(persona);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Top Bar: Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
        >
          <Languages className="size-3.5 text-primary" />
          <span>{language === 'en' ? 'తెలుగు (Telugu)' : 'English'}</span>
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3">
            <span className="text-2xl font-bold font-sora">R</span>
          </div>
          <h1 className="text-2xl font-bold font-sora tracking-tight text-foreground">
            RuralCred Advisor
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
            {isTe
              ? 'గ్రామీణ వ్యాపార సలహా మరియు అధికారిక ఆర్థిక నిర్మాణ వేదిక'
              : 'Your Rural Business Intelligence & Financial Structuring Assistant'}
          </p>
        </div>

        {/* Primary Action Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-sora text-foreground">
                {isTe ? 'తక్షణ డెమో అనుభవం' : 'Instant Demo Experience'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {isTe
                  ? 'ఖాతా నమోదు లేకుండా నేరుగా అప్లికేషన్‌ను అన్వేషించండి'
                  : 'Explore all credit and advisory features immediately without sign-up'}
              </p>
            </div>
          </div>

          {/* Primary Action: Continue as Demo User */}
          <Button
            onClick={handleStartFreshDemo}
            className="w-full h-11 text-sm font-semibold gap-2 shadow-xs cursor-pointer"
          >
            <span>{isTe ? 'డెమో వినియోగదారుగా కొనసాగండి' : 'Continue as Demo User'}</span>
            <ArrowRight className="size-4" />
          </Button>

          {/* Secondary Action: Sign In (Optional) */}
          <Button
            variant="outline"
            onClick={onOpenAuth}
            className="w-full h-10 text-xs font-medium gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <LogIn className="size-3.5" />
            <span>{isTe ? 'ఖాతాలోకి ప్రవేశించండి (ఐచ్ఛికం)' : 'Sign In with Account (Optional)'}</span>
          </Button>
        </div>

        {/* Quick Evaluator Personas */}
        <div className="rounded-2xl border bg-card/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Building2 className="size-3.5 text-primary" />
              <span>{isTe ? '1-క్లిక్ మూల్యాంకన ప్రొఫైల్స్' : '1-Click Evaluator Personas'}</span>
            </div>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              Hackathon Ready
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePresetDemo('dairy')}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-background/80 hover:bg-primary/5 hover:border-primary/40 transition-all text-center group cursor-pointer"
            >
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Coins className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">Anita S.</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Dairy (₹1.5L)</p>
              </div>
            </button>

            <button
              onClick={() => handlePresetDemo('kirana')}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-background/80 hover:bg-primary/5 hover:border-primary/40 transition-all text-center group cursor-pointer"
            >
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Store className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">Ramesh K.</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Kirana (₹50k)</p>
              </div>
            </button>

            <button
              onClick={() => handlePresetDemo('weaving')}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-background/80 hover:bg-primary/5 hover:border-primary/40 transition-all text-center group cursor-pointer"
            >
              <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Scissors className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">Lakshmi D.</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Handloom (₹30k)</p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Deterministic Financial Engine • Offline Resilient • SIH 26091</span>
        </div>
      </div>
    </div>
  );
}
