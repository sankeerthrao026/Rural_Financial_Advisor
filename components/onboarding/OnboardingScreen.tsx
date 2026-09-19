'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils/currency';
import {
  Building2,
  MapPin,
  IndianRupee,
  Mic,
  Languages,
  Sparkles,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { isSpeechRecognitionSupported, startSpeechListening } from '@/lib/voice/speech';

export function OnboardingScreen({ onComplete }: { onComplete?: () => void }) {
  const { language, setLanguage, inputMode, setInputMode, updateProfile, loadPreset, dictionary } = useApp();
  const isTe = language === 'te';
  const t = dictionary.onboarding;

  const [step, setStep] = useState<1 | 2>(1);
  const [location, setLocation] = useState('Warangal, Telangana');
  const [category, setCategory] = useState('Dairy Farming');
  const [marginCapital, setMarginCapital] = useState('100000');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = [
    { key: 'Dairy Farming', labelEn: 'Dairy Farming (పాడి పరిశ్రమ)', labelTe: 'పాడి పరిశ్రమ (Dairy Farming)' },
    { key: 'Country / Broiler Poultry', labelEn: 'Poultry Farming (కోళ్ల పెంపకం)', labelTe: 'కోళ్ల పెంపకం (Poultry)' },
    { key: 'Rural Grocery / Kirana', labelEn: 'Rural Grocery / Kirana (కిరాణా దుకాణం)', labelTe: 'కిరాణా దుకాణం (Kirana Store)' },
    { key: 'Handloom / Weaving', labelEn: 'Handloom / Weaving (చేనేత వస్త్రాలు)', labelTe: 'చేనేత వస్త్రాలు (Handloom)' },
    { key: 'Tailoring & Boutique', labelEn: 'Tailoring & Boutique (టైలరింగ్)', labelTe: 'టైలరింగ్ (Tailoring)' },
    { key: 'Agri-Processing & Flour Mill', labelEn: 'Agri-Processing & Flour Mill (పిండి మిల్లు)', labelTe: 'పిండి మిల్లు / ప్రాసెసింగ్ (Agri-Processing)' },
  ];

  const handleVoiceInput = () => {
    if (!isSpeechRecognitionSupported()) {
      alert(dictionary.speechUnsupported);
      return;
    }

    setIsListening(true);
    startSpeechListening({
      language,
      onResult: (transcript) => {
        setIsListening(false);
        const numbers = transcript.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          const val = parseInt(numbers.join(''), 10);
          if (val >= 1000) setMarginCapital(val.toString());
        }
        if (transcript.length > 3) {
          setLocation(transcript);
        }
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false),
    });
  };

  const handleSelectPreset = (presetKey: 'dairy' | 'kirana' | 'weaving') => {
    loadPreset(presetKey);
    if (presetKey === 'dairy') {
      setLocation('Warangal, Telangana');
      setCategory('Dairy Farming');
      setMarginCapital('100000');
    } else if (presetKey === 'kirana') {
      setLocation('Karimnagar, Telangana');
      setCategory('Rural Grocery / Kirana');
      setMarginCapital('12000');
    } else if (presetKey === 'weaving') {
      setLocation('Nalgonda, Telangana');
      setCategory('Handloom / Weaving');
      setMarginCapital('30000');
    }
    setStep(2);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanMargin = parseFloat(marginCapital.replace(/[^\d]/g, '')) || 100000;

    await updateProfile({
      location,
      category,
      marginCapital: cleanMargin,
      onboardingCompleted: true,
    });

    setLoading(false);
    onComplete?.();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      {/* Top Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
        >
          <Languages className="size-3.5 text-primary" />
          <span>{language === 'en' ? 'తెలుగు (Telugu)' : 'English'}</span>
        </button>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-3">
            <span className="text-2xl font-bold font-sora">R</span>
          </div>
          <h1 className="text-2xl font-bold font-sora tracking-tight text-foreground">
            {isTe ? 'వ్యాపార ప్రారంభ నమోదు' : 'Enterprise Setup & Onboarding'}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            {isTe
              ? 'మీ ప్రాంతం మరియు పెట్టుబడి వివరాలను నమోదు చేసి వ్యక్తిగత రుణ ప్రణాళికను రూపొందించండి.'
              : 'Configure your enterprise location, trade, and available margin to unlock tailored financing & market advisory.'}
          </p>
        </div>

        {/* 1-Click Judge/Evaluator Quick Preset Card */}
        <div className="rounded-2xl border border-amber-200/80 bg-accent/40 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
            <Sparkles className="size-4 text-amber-700" />
            <span>{isTe ? 'హ్యాకథాన్ తక్షణ ప్రొఫైల్ ఎంపిక' : '1-Click Hackathon Evaluator Profiles'}</span>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleSelectPreset('dairy')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span className="font-semibold block truncate">Anita Sharma</span>
              <span className="text-[10px] opacity-75 block">Dairy • ₹1,00,000</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('kirana')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span className="font-semibold block truncate">Ramesh Kumar</span>
              <span className="text-[10px] opacity-75 block">Kirana • ₹12,000</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('weaving')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span className="font-semibold block truncate">Lakshmi Devi</span>
              <span className="text-[10px] opacity-75 block">Handloom • ₹30,000</span>
            </button>
          </div>
        </div>

        {/* Step Cards */}
        <form onSubmit={handleFinish} className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs flex flex-col gap-6">
          {/* Step 1: Language & Interaction Preference */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {isTe ? 'దశ 1: భాష & ఇన్‌పుట్ పద్ధతి' : 'Step 1: Language & Input Mode'}
              </span>
              <span className="text-xs text-muted-foreground">Preferences</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.languageSelectLabel}</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      language === 'en' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('te')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      language === 'te' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    తెలుగు
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.inputModeLabel}</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      inputMode === 'text' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {dictionary.textMode}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('voice')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      inputMode === 'voice' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <Mic className="size-3.5" />
                    {dictionary.voiceMode}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Enterprise Details */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {isTe ? 'దశ 2: వ్యాపార వివరాలు' : 'Step 2: Enterprise Profile'}
              </span>
              <span className="text-xs text-muted-foreground">Grounding Data</span>
            </div>

            {/* Voice Input Prompt if active */}
            {inputMode === 'voice' && (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mic className={`size-4 ${isListening ? 'text-rose-600 animate-pulse' : 'text-primary'}`} />
                  <span className="text-xs font-medium text-foreground">
                    {isListening ? dictionary.listening : (isTe ? 'వాయిస్ ద్వారా మాట్లాడి వివరాలు నింపండి' : 'Speak location and capital amount')}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isListening ? 'destructive' : 'outline'}
                  onClick={handleVoiceInput}
                >
                  {isListening ? 'Stop' : 'Speak'}
                </Button>
              </div>
            )}

            {/* Category selection */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Building2 className="size-3.5 text-primary" />
                {t.categoryLabel}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs text-left transition-colors ${
                      category === c.key
                        ? 'border-primary bg-primary/5 font-semibold text-primary shadow-xs'
                        : 'bg-background hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <span>{isTe ? c.labelTe : c.labelEn}</span>
                    {category === c.key && <Check className="size-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <MapPin className="size-3.5 text-primary" />
                {t.locationLabel}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Mulkanoor, Warangal, Telangana"
                className="w-full rounded-lg border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            {/* Margin Capital */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <IndianRupee className="size-3.5 text-primary" />
                  {t.marginLabel}
                </label>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {formatINR(parseFloat(marginCapital.replace(/[^\d]/g, '')) || 0)}
                </span>
              </div>
              <input
                type="text"
                value={marginCapital}
                onChange={(e) => setMarginCapital(e.target.value)}
                placeholder="e.g. 100000"
                className="w-full rounded-lg border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.marginHelp}
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={loading} className="w-full font-semibold mt-2">
            {loading ? (
              <span>{isTe ? 'ఖాతా నమోదు చేస్తున్నాము...' : 'Saving Enterprise Profile...'}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{isTe ? 'ప్రారంభించండి (Enter RuralCred)' : 'Complete Setup & Open Dashboard'}</span>
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
