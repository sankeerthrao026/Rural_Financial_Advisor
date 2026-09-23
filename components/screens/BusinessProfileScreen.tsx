'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check, Sparkles, Building2, MapPin, IndianRupee, ShieldCheck } from 'lucide-react';
import { formatINR } from '@/lib/utils/currency';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceButton } from '@/components/ui/voice-button';
import { parseSpokenTransaction } from '@/lib/voice/speech';

export function BusinessProfileScreen({ onSaved }: { onSaved?: () => void }) {
  const { profile, updateProfile, language, setLanguage, inputMode, setInputMode, loadPreset, dictionary } = useApp();
  const t = dictionary.onboarding;
  const isTe = language === 'te';

  const [location, setLocation] = useState(profile.location);
  const [category, setCategory] = useState(profile.category);
  const [marginCapital, setMarginCapital] = useState(profile.marginCapital.toString());
  const [hasActiveLoan, setHasActiveLoan] = useState(profile.hasActiveLoan);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const categories = [
    { key: 'Dairy Farming', label: isTe ? dictionary.categories.dairy : 'Dairy Farming' },
    { key: 'Country / Broiler Poultry', label: isTe ? dictionary.categories.poultry : 'Poultry Farming' },
    { key: 'Rural Grocery / Kirana', label: isTe ? dictionary.categories.kirana : 'Rural Grocery / Kirana' },
    { key: 'Handloom / Weaving', label: isTe ? dictionary.categories.handloom : 'Handloom / Weaving' },
    { key: 'Tailoring & Boutique', label: isTe ? dictionary.categories.tailoring : 'Tailoring & Boutique' },
    { key: 'Agri-Processing & Flour Mill', label: isTe ? dictionary.categories.flourMill : 'Agri-Processing & Flour Mill' },
  ];

  const voiceInput = useVoiceInput({
    targetLanguage: language,
    onResult: (transcript, isFinal) => {
      // Only final transcripts should update the form — interim results would
      // otherwise flicker partial text into the fields.
      if (!isFinal) return;

      const parsedTx = parseSpokenTransaction(transcript);
      const cleanStr = transcript.replace(/₹/g, '').replace(/,/g, '');
      const numbers = cleanStr.match(/\d+/g);
      if (parsedTx.amount && parsedTx.amount >= 1000) {
        setMarginCapital(parsedTx.amount.toString());
      } else if (numbers && numbers.length > 0) {
        const detectedCapital = parseInt(numbers.join(''), 10);
        if (detectedCapital >= 1000) {
          setMarginCapital(detectedCapital.toString());
        }
      }

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

  const handleToggleVoice = () => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
    } else {
      voiceInput.startListening();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMargin = parseFloat(marginCapital.replace(/[^\d]/g, '')) || 100000;
    updateProfile({
      location,
      category,
      marginCapital: cleanMargin,
      hasActiveLoan,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onSaved?.();
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Quick Persona Presets for Evaluators */}
      <div className="rounded-2xl border bg-accent/40 p-4 sm:p-5 border-amber-200/60 hover-lift transition-all">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
          <Sparkles className="size-4 text-amber-700" />
          <span>{t.loadPresetLabel}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              loadPreset('dairy');
              setLocation('Warangal, Telangana');
              setCategory('Dairy Farming');
              setMarginCapital('100000');
              setHasActiveLoan(false);
            }}
            className="rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer active:scale-95"
          >
            {t.presets.dairy}
          </button>
          <button
            type="button"
            onClick={() => {
              loadPreset('kirana');
              setLocation('Karimnagar, Telangana');
              setCategory('Rural Grocery / Kirana');
              setMarginCapital('12000');
              setHasActiveLoan(false);
            }}
            className="rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer active:scale-95"
          >
            {t.presets.kirana}
          </button>
          <button
            type="button"
            onClick={() => {
              loadPreset('weaving');
              setLocation('Nalgonda, Telangana');
              setCategory('Handloom / Weaving');
              setMarginCapital('30000');
              setHasActiveLoan(false);
            }}
            className="rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer active:scale-95"
          >
            {t.presets.weaving}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border bg-card p-6 sm:p-8 flex flex-col gap-6 shadow-xs hover-lift transition-all">
        {/* Language & Input Mode Toggles */}
        <div className="grid gap-4 sm:grid-cols-2 pb-6 border-b">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t.languageSelectLabel}</label>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors cursor-pointer ${
                  language === 'en' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('te')}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors cursor-pointer ${
                  language === 'te' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
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
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors cursor-pointer ${
                  inputMode === 'text' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                {dictionary.textMode}
              </button>
              <button
                type="button"
                onClick={() => setInputMode('voice')}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  inputMode === 'voice' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                <Mic className="size-3.5" />
                {dictionary.voiceMode}
              </button>
            </div>
          </div>
        </div>

        {/* Voice Assistant Trigger Banner */}
        {inputMode === 'voice' && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                <p className="text-xs font-semibold">{voiceInput.isListening ? dictionary.listening : dictionary.voicePrompt}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {voiceInput.transcript ? (
                    <span className="text-primary font-medium">"{voiceInput.transcript}"</span>
                  ) : language === 'te' ? (
                    'మాట్లాడితే లొకేషన్ మరియు పెట్టుబడి వివరాలు నమోదు అవుతాయి'
                  ) : (
                    'Spoken location and numbers will auto-populate the form'
                  )}
                </p>
              </div>
            </div>
            <VoiceButton
              status={voiceInput.status}
              onToggle={handleToggleVoice}
              errorMessage={voiceInput.error}
              onRetry={voiceInput.startListening}
              label={isTe ? 'మాట్లాడండి' : 'Speak Now'}
              listeningLabel={isTe ? 'ఆపండి' : 'Stop'}
            />
          </div>
        )}

        {/* Enterprise Category */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4 text-primary" />
            {t.categoryLabel}
          </label>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 text-xs transition-colors ${
                  category === c.key ? 'border-primary bg-primary/5 font-semibold text-primary' : 'hover:bg-muted/50'
                }`}
              >
                <span>{c.label}</span>
                {category === c.key && <Check className="size-4 text-primary" />}
              </label>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="size-4 text-primary" />
            {t.locationLabel}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t.locationPlaceholder}
            className="mt-2 w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        {/* Margin Capital */}
        <div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium">
              <IndianRupee className="size-4 text-primary" />
              {t.marginLabel}
            </label>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {formatINR(parseFloat(marginCapital.replace(/[^\d]/g, '')) || 0)}
            </span>
          </div>
          <input
            type="text"
            value={marginCapital}
            onChange={(e) => setMarginCapital(e.target.value)}
            placeholder={t.marginPlaceholder}
            className="mt-2 w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t.marginHelp}</p>
        </div>

        {/* Active Loan Checkbox (Simulates Rule 1) */}
        <div className="rounded-xl border p-4 bg-muted/20 flex items-start gap-3">
          <input
            type="checkbox"
            id="activeLoanCheckbox"
            checked={hasActiveLoan}
            onChange={(e) => setHasActiveLoan(e.target.checked)}
            className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="activeLoanCheckbox" className="cursor-pointer text-xs leading-5">
            <span className="font-semibold text-foreground">
              {language === 'te' ? 'ప్రస్తుతం అమలులో ఉన్న రుణం ఉంది' : 'User currently has an active institutional or SHG loan'}
            </span>
            <p className="text-muted-foreground mt-0.5">
              {language === 'te'
                ? 'దీన్ని ఎంచుకుంటే అధిక అప్పుల రిస్క్ నిబంధన (రూల్ 1) మరియు AI పరిష్కారం పరీక్షించబడుతుంది.'
                : 'Check this to simulate Rule 1 over-leverage risk detection and trigger localized AI coaching.'}
            </p>
          </label>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          {saveSuccess ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <Check className="size-4" />
              {language === 'te' ? 'వివరాలు భద్రపరచబడ్డాయి!' : 'Profile updated successfully!'}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>{dictionary.offlineSimulationStatus}</span>
            </div>
          )}
          <Button type="submit" size="lg" className="px-6 font-semibold">
            {t.saveProfileBtn}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default BusinessProfileScreen;
