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
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceButton } from '@/components/ui/voice-button';

export function OnboardingScreen({ onComplete }: { onComplete?: () => void }) {
  const { language, setLanguage, inputMode, setInputMode, updateProfile, loadPreset, dictionary } = useApp();
  const isTe = language === 'te';
  const t = dictionary.onboarding;

  const [step, setStep] = useState<1 | 2>(1);
  const [location, setLocation] = useState('Warangal, Telangana');
  const [category, setCategory] = useState('Dairy Farming');
  const [marginCapital, setMarginCapital] = useState('100000');
  const [loading, setLoading] = useState(false);

  const voiceInput = useVoiceInput({
    targetLanguage: language,
    onResult: (transcript, isFinal) => {
      // Only final transcripts should update the form — interim results would
      // otherwise flicker partial text into the fields.
      if (!isFinal) return;

      // Numbers extraction for margin capital
      const cleanStr = transcript.replace(/₹/g, '').replace(/,/g, '');
      const numbers = cleanStr.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const val = parseInt(numbers.join(''), 10);
        if (val >= 1000) setMarginCapital(val.toString());
      }

      // Location detection
      const lower = transcript.toLowerCase();
      if (
        lower.includes('warangal') || lower.includes('వరంగల్') ||
        lower.includes('karimnagar') || lower.includes('కరీంనగర్') ||
        lower.includes('nalgonda') || lower.includes('నల్గొండ') ||
        lower.includes('nizamabad') || lower.includes('నిజామాబాద్') ||
        lower.includes('khammam') || lower.includes('ఖమ్మం') ||
        lower.includes('telangana') || lower.includes('తెలంగాణ') ||
        lower.includes('village') || lower.includes('గ్రామం')
      ) {
        setLocation(transcript);
      } else if (transcript.length > 3 && (!numbers || numbers.length === 0)) {
        setLocation(transcript);
      }

      // Category detection
      if (lower.includes('dairy') || lower.includes('milk') || lower.includes('పాల') || lower.includes('పాడి')) {
        setCategory('Dairy Farming');
      } else if (lower.includes('poultry') || lower.includes('chicken') || lower.includes('కోళ్ల') || lower.includes('కోడి')) {
        setCategory('Country / Broiler Poultry');
      } else if (lower.includes('kirana') || lower.includes('grocery') || lower.includes('కిరాణా') || lower.includes('షాపు')) {
        setCategory('Rural Grocery / Kirana');
      } else if (lower.includes('handloom') || lower.includes('weaving') || lower.includes('చేనేత') || lower.includes('మగ్గం')) {
        setCategory('Handloom / Weaving');
      } else if (lower.includes('tailor') || lower.includes('boutique') || lower.includes('కుట్టు') || lower.includes('టైలరింగ్')) {
        setCategory('Tailoring & Boutique');
      } else if (lower.includes('mill') || lower.includes('flour') || lower.includes('మిల్లు') || lower.includes('పిండి')) {
        setCategory('Agri-Processing & Flour Mill');
      }
    },
  });

  const categories = [
    { key: 'Dairy Farming', label: isTe ? dictionary.categories.dairy : 'Dairy Farming' },
    { key: 'Country / Broiler Poultry', label: isTe ? dictionary.categories.poultry : 'Poultry Farming' },
    { key: 'Rural Grocery / Kirana', label: isTe ? dictionary.categories.kirana : 'Rural Grocery / Kirana' },
    { key: 'Handloom / Weaving', label: isTe ? dictionary.categories.handloom : 'Handloom / Weaving' },
    { key: 'Tailoring & Boutique', label: isTe ? dictionary.categories.tailoring : 'Tailoring & Boutique' },
    { key: 'Agri-Processing & Flour Mill', label: isTe ? dictionary.categories.flourMill : 'Agri-Processing & Flour Mill' },
  ];

  const handleToggleVoice = () => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
    } else {
      voiceInput.startListening();
    }
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
      {/* Top Language Selector */}
      <div className="absolute top-6 right-6 flex items-center rounded-lg border bg-card p-0.5 text-xs font-semibold shadow-xs">
        {(['en', 'te'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLanguage(l)}
            className={`px-2 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
              language === l
                ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={l === 'en' ? 'English' : 'Telugu'}
          >
            {l === 'en' ? 'EN' : 'తె'}
          </button>
        ))}
      </div>

      <div className="w-full max-w-xl flex flex-col gap-6 page-enter">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-3 transition-transform hover:scale-105 duration-200">
            <span className="text-2xl font-bold font-sora">R</span>
          </div>
          <h1 className="text-2xl font-bold font-sora tracking-tight text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            {t.subtitle}
          </p>
        </div>

        {/* 1-Click Judge/Evaluator Quick Preset Card */}
        <div className="rounded-2xl border border-amber-200/80 bg-accent/40 p-4 shadow-xs card-lift">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
            <Sparkles className="size-4 text-amber-700" />
            <span>{t.evaluatorPresetTitle}</span>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleSelectPreset('dairy')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs cursor-pointer"
            >
              <span className="font-semibold block truncate">Anita Sharma</span>
              <span className="text-[10px] opacity-75 block">{isTe ? 'పాడి • ₹1,00,000' : 'Dairy • ₹1,00,000'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('kirana')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs cursor-pointer"
            >
              <span className="font-semibold block truncate">Ramesh Kumar</span>
              <span className="text-[10px] opacity-75 block">{isTe ? 'కిరాణా • ₹12,000' : 'Kirana • ₹12,000'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('weaving')}
              className="rounded-lg border bg-card p-2.5 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs cursor-pointer"
            >
              <span className="font-semibold block truncate">Lakshmi Devi</span>
              <span className="text-[10px] opacity-75 block">{isTe ? 'చేనేత • ₹30,000' : 'Handloom • ₹30,000'}</span>
            </button>
          </div>
        </div>

        {/* Step Cards */}
        <form onSubmit={handleFinish} className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs flex flex-col gap-6">
          {/* Step 1: Language & Interaction Preference */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {t.step1}
              </span>
              <span className="text-xs text-muted-foreground">{t.preferences}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.languageSelectLabel}</label>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      language === 'en' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('te')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors cursor-pointer ${
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
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      inputMode === 'text' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {dictionary.textMode}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('voice')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
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
                {t.step2}
              </span>
              <span className="text-xs text-muted-foreground">{t.groundingData}</span>
            </div>

            {/* Voice Input Prompt if active */}
            {inputMode === 'voice' && (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`grid size-10 place-items-center rounded-xl transition-all ${
                      voiceInput.isListening
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    <Mic className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {voiceInput.isListening ? dictionary.listening : t.speakPrompt}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {voiceInput.transcript ? (
                        <span className="text-primary font-medium">"{voiceInput.transcript}"</span>
                      ) : isTe ? (
                        'లొకేషన్ లేదా పెట్టుబడి వివరాలు మాట్లాడండి'
                      ) : (
                        'Speak your location or investment amount'
                      )}
                    </p>
                  </div>
                </div>

                <VoiceButton
                  status={voiceInput.status}
                  onToggle={handleToggleVoice}
                  errorMessage={voiceInput.error}
                  onRetry={voiceInput.startListening}
                />
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
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs text-left transition-colors cursor-pointer ${
                      category === c.key
                        ? 'border-primary bg-primary/5 font-semibold text-primary shadow-xs'
                        : 'bg-background hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <span>{c.label}</span>
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
                placeholder={t.locationPlaceholder}
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
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200">
                  {formatINR(parseFloat(marginCapital.replace(/[^\d]/g, '')) || 0)}
                </span>
              </div>
              <input
                type="text"
                value={marginCapital}
                onChange={(e) => setMarginCapital(e.target.value)}
                placeholder={t.marginPlaceholder}
                className="w-full rounded-lg border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.marginHelp}
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={loading} className="w-full font-semibold mt-2 cursor-pointer">
            {loading ? (
              <span>{t.savingText}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{t.enterBtn}</span>
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default OnboardingScreen;
