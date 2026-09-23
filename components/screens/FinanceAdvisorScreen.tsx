'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  FinanceAdviceResponse,
  TailoredSchemeRecommendation,
  WorkingCapitalBreakdown,
  SeasonalMoratoriumAdvice,
} from '@/lib/api/client';
import { calculateAllEligibleSchemes, SchemeCalculationResult } from '@/lib/finance/schemes';
import {
  isSpeechRecognitionSupported,
  isMediaRecordingSupported,
  startSpeechListening,
  startAudioRecordingFallback,
  stopActiveSpeechRecognition,
  SpeechController,
} from '@/lib/voice/speech';
import {
  Calculator,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Percent,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Wallet,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Sliders,
  Briefcase,
  Award,
  HelpCircle,
  Check,
  Star,
  ExternalLink,
} from 'lucide-react';

export interface AdvisorChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

export function FinanceAdvisorScreen({ setActive }: { setActive?: (tab: string) => void }) {
  const { finance, language, dictionary, profile, updateProfile, backendMode, backendLoading } = useApp();
  const t = dictionary.finance;
  const isTe = language === 'te';

  // Demographic state (synced with profile or interactive selector)
  const [selectedGender, setSelectedGender] = useState<string>(
    profile.gender || (profile.name.toLowerCase().includes('anita') || profile.name.toLowerCase().includes('lakshmi') ? 'female' : 'male')
  );
  const [selectedSocialCategory, setSelectedSocialCategory] = useState<string>(
    profile.socialCategory || 'OBC'
  );

  // Working capital ratio slider (null = use category baseline default)
  const [customWcRatio, setCustomWcRatio] = useState<number | null>(null);

  // Pure deterministic multi-scheme calculations for MUDRA, PM Vishwakarma, Stand-Up India, PMEGP, NBCFDC
  const allCalculatedSchemes = useMemo<SchemeCalculationResult[]>(() => {
    return calculateAllEligibleSchemes({
      loanAmount: finance.loanAmount,
      category: profile.category,
      gender: selectedGender,
      socialCategory: selectedSocialCategory,
      locationType: 'rural',
      isNewEnterprise: true,
    });
  }, [finance.loanAmount, profile.category, selectedGender, selectedSocialCategory]);

  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');

  useEffect(() => {
    if (!selectedSchemeId || !allCalculatedSchemes.some((s) => s.schemeId === selectedSchemeId)) {
      const topMatch = allCalculatedSchemes.find((s) => s.isTopMatch) || allCalculatedSchemes[0];
      if (topMatch) setSelectedSchemeId(topMatch.schemeId);
    }
  }, [allCalculatedSchemes, selectedSchemeId]);

  const activeScheme = allCalculatedSchemes.find((s) => s.schemeId === selectedSchemeId) || allCalculatedSchemes[0];

  // Advisory API state
  const [adviceData, setAdviceData] = useState<FinanceAdviceResponse | null>(null);
  const [isAdviceLoading, setIsAdviceLoading] = useState<boolean>(false);

  // Chat conversation state
  const [messages, setMessages] = useState<AdvisorChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceControllerRef = useRef<SpeechController | null>(null);

  // Abort any active voice session when the screen unmounts so the microphone
  // is never left running in the background.
  useEffect(() => {
    return () => {
      if (voiceControllerRef.current) {
        voiceControllerRef.current.abort();
        voiceControllerRef.current = null;
      }
      stopActiveSpeechRecognition();
    };
  }, []);

  // Schedule table toggle
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const formatTime = (date: Date = new Date()) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Fetch initial or updated advice whenever numbers or demographic selections change
  const fetchAdvice = async (queryText?: string) => {
    setIsAdviceLoading(true);
    try {
      const res = await fetch('/api/ai/finance-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginCapital: finance.marginCapital,
          loanAmount: finance.loanAmount,
          projectCost: finance.projectCost,
          quarterlyEmi: finance.quarterlyEmi,
          category: profile.category,
          gender: selectedGender,
          socialCategory: selectedSocialCategory,
          location: profile.location,
          workingCapitalRatio: customWcRatio !== null ? customWcRatio : undefined,
          userQuery: queryText,
          language,
        }),
      });

      if (res.ok) {
        const data: FinanceAdviceResponse = await res.json();
        setAdviceData(data);

        // If this is the initial greeting load, initialize message list
        if (!queryText && messages.length === 0) {
          setMessages([
            {
              id: `init-advisor-${Date.now()}`,
              role: 'assistant',
              content: data.reply,
              timestamp: formatTime(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load finance advice:', err);
    } finally {
      setIsAdviceLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, [
    finance.loanAmount,
    finance.marginCapital,
    profile.category,
    selectedGender,
    selectedSocialCategory,
    customWcRatio,
    language,
  ]);

  // Scroll chat into view on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Handle sending follow-up questions
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isChatLoading) return;

    setInputText('');

    const userMsg: AdvisorChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: formatTime(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setIsChatLoading(true);

    try {
      const historyPayload = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/finance-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginCapital: finance.marginCapital,
          loanAmount: finance.loanAmount,
          projectCost: finance.projectCost,
          quarterlyEmi: finance.quarterlyEmi,
          category: profile.category,
          gender: selectedGender,
          socialCategory: selectedSocialCategory,
          location: profile.location,
          workingCapitalRatio: customWcRatio !== null ? customWcRatio : undefined,
          userQuery: query,
          history: historyPayload,
          language,
        }),
      });

      if (!res.ok) throw new Error('Advisor request failed');

      const data: FinanceAdviceResponse = await res.json();
      setAdviceData(data);

      const aiMsg: AdvisorChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Follow-up error:', err);
      const errMsg: AdvisorChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isTe
          ? 'సలహాదారు సమాధానం పొందడంలో సమస్య ఏర్పడింది. దయచేసి నెట్‌వర్క్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.'
          : 'Unable to retrieve answer. Please check your network and retry.',
        timestamp: formatTime(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Voice STT input handler
  const handleVoiceInput = async () => {
    setVoiceError(null);

    // If already listening, stop recording
    if (isListening) {
      if (voiceControllerRef.current) {
        voiceControllerRef.current.stop();
        voiceControllerRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // Secondary fallback starter
    const startFallback = async () => {
      if (!isMediaRecordingSupported()) {
        setIsListening(false);
        setVoiceError(
          isTe
            ? 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge ఉపయోగించండి.'
            : 'Voice input is not supported in this browser. Please use Chrome or Edge.'
        );
        return;
      }

      try {
        setIsListening(true);
        const fallbackRecorder = await startAudioRecordingFallback({
          language: language as 'en' | 'te',
          onResult: (transcribedText) => {
            setIsListening(false);
            voiceControllerRef.current = null;
            if (transcribedText) {
              setInputText(transcribedText);
              inputRef.current?.focus();
            }
          },
          onError: (err) => {
            setIsListening(false);
            voiceControllerRef.current = null;
            const errMsg = err?.message || (isTe ? 'వాయిస్ రికార్డింగ్‌లో సమస్య ఏర్పడింది.' : 'Voice recording failed.');
            setVoiceError(errMsg);
          },
        });
        voiceControllerRef.current = fallbackRecorder;
      } catch (e: any) {
        setIsListening(false);
        voiceControllerRef.current = null;
        setVoiceError(e?.message || (isTe ? 'మైక్రోఫోన్ అనుమతించబడలేదు.' : 'Microphone access denied.'));
      }
    };

    // 1. Try Web Speech API first
    if (isSpeechRecognitionSupported()) {
      let hasReceivedAnyResult = false;

      setIsListening(true);
      const controller = startSpeechListening({
        language,
        onInterim: (interim) => {
          if (interim) {
            hasReceivedAnyResult = true;
            setInputText(interim);
          }
        },
        onResult: (transcript: string) => {
          if (transcript) {
            hasReceivedAnyResult = true;
            setInputText(transcript);
          }
        },
        onEnd: () => {
          setIsListening(false);
          voiceControllerRef.current = null;
          inputRef.current?.focus();
        },
        onError: (_code, message) => {
          if (!hasReceivedAnyResult && isMediaRecordingSupported()) {
            startFallback();
          } else {
            setIsListening(false);
            voiceControllerRef.current = null;
            setVoiceError(message);
          }
        },
      });

      if (controller) {
        voiceControllerRef.current = controller;
        return;
      }
    }

    // 2. Direct fallback if Web Speech API is not supported or returned null
    await startFallback();
  };

  // Suggested follow-up prompt pills
  const SUGGESTED_QUESTIONS = isTe
    ? [
        'ఈ పథకం నాకు ఎందుకు ఉత్తమమైనది?',
        'పాడి పరిశ్రమకు వేసవి మారటోరియం ఎలా లభిస్తుంది?',
        'వర్కింగ్ క్యాపిటల్ మరియు మిషన్ల ఖర్చుల విభజన ఏమిటి?',
        'బ్యాంకు రుణం కోసం ఏ డాక్యుమెంట్లు అవసరం?',
      ]
    : [
        'Why is Stand-Up India / PMEGP recommended for me?',
        'Can I get a seasonal moratorium during lean months?',
        'Why do lenders care about working capital vs. capex split?',
        'What documents will the bank require for approval?',
      ];

  const displayedSchedule = showFullSchedule
    ? finance.amortizationSchedule
    : finance.amortizationSchedule.slice(0, 8);

  const isMicro = finance.scheme.id === 'micro-finance';
  const totalInterest = finance.amortizationSchedule.reduce((sum, item) => sum + item.interestPaid, 0);
  const totalRepayment = finance.loanAmount + totalInterest;

  // Active working capital breakdown
  const wcBreakdown = adviceData?.workingCapitalBreakdown || {
    workingCapitalPercent: profile.category.toLowerCase().includes('kirana') ? 75 : 35,
    capexPercent: profile.category.toLowerCase().includes('kirana') ? 25 : 65,
    workingCapitalAmount: Math.round(finance.loanAmount * (profile.category.toLowerCase().includes('kirana') ? 0.75 : 0.35)),
    capexAmount: Math.round(finance.loanAmount * (profile.category.toLowerCase().includes('kirana') ? 0.25 : 0.65)),
    workingCapitalUses: [
      'Day-to-day operational stock and consumable supplies',
      'Short-term operational cash buffer & wages',
    ],
    capexUses: [
      'Commercial production machinery and durable fixtures',
      'Premises infrastructure and equipment acquisition',
    ],
  };

  // Active seasonal moratorium advice
  const seasonalAdvice = adviceData?.seasonalMoratoriumAdvice;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Entrepreneur Demographic Profile Bar */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover-lift">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
                {isTe ? 'AI లోన్ & ఫైనాన్స్ అడ్వైజర్' : 'AI Loan & Finance Advisor'}
              </span>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                {backendMode === 'backend'
                  ? (isTe ? 'ఫాస్ట్‌ఏపీఐ బ్యాంకింగ్ ఇంజిన్' : 'FastAPI Banking Engine')
                  : (isTe ? 'లోకల్ ఇంజిన్' : 'Deterministic Engine')}
              </span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold font-sora tracking-tight text-foreground">
              {isTe ? 'వ్యక్తిగతీకరించిన రుణ సలహాదారు' : 'Tailored Institutional Credit Advisory'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              {isTe
                ? 'ఖచ్చితమైన గణితం, జనాభా వివరాల ఆధారిత ప్రభుత్వ పథకాలు, వర్కింగ్ క్యాపిటల్ విశ్లేషణ మరియు కాలానుగుణ మారటోరియం సలహా.'
                : '100% deterministic banking math wrapped in an interactive conversational advisor tailored to your demographic profile and business seasonality.'}
            </p>
          </div>

          {/* Demographic Persona Selectors */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-xl border">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
              <User className="size-3.5" />
              <span>{isTe ? 'ప్రొఫైల్:' : 'Profile:'}</span>
            </div>

            {/* Gender Toggle */}
            <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedGender('female')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedGender === 'female'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? 'మహిళ' : 'Woman'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedGender('male')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedGender === 'male'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isTe ? 'పురుషుడు' : 'General/Male'}
              </button>
            </div>

            {/* Social Category Toggle */}
            <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
              {(['OBC', 'SC', 'ST', 'General'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedSocialCategory(cat)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${
                    selectedSocialCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Deterministic Financial Journey Stepper */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Step 1: Capital */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepCapital}</span>
              <span className="text-primary font-bold">10%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-foreground">
              <AnimatedNumber value={finance.marginCapital} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'ప్రమోటర్ సొంత వాటా' : 'Promoter equity stake'}</p>
          </div>

          {/* Step 2: Project Cost */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepProject}</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">100%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-foreground">
              <AnimatedNumber value={finance.projectCost} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'మొత్తం ప్రాజెక్ట్ వ్యయం' : 'Capital ÷ 0.10 formula'}</p>
          </div>

          {/* Step 3: Loan Requirement */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepLoan}</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">90%</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-emerald-800 dark:text-emerald-400">
              <AnimatedNumber value={finance.loanAmount} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'బ్యాంకు రుణం (90%)' : 'Institutional credit'}</p>
          </div>

          {/* Step 4: Scheme Routing */}
          <div className="rounded-xl border bg-primary/5 border-primary/20 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
              <span>{t.stepScheme}</span>
              <span className="font-bold">{isMicro ? (isTe ? 'మైక్రో' : 'Micro') : (isTe ? 'టర్మ్' : 'Term')}</span>
            </div>
            <p className="mt-2 text-sm font-bold font-sora text-primary truncate">
              {isTe ? finance.scheme.nameTe : finance.scheme.name}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground truncate">{finance.scheme.agency}</p>
          </div>

          {/* Step 5: Quarterly Payment */}
          <div className="rounded-xl border bg-background p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{t.stepEmi}</span>
              <span className="text-primary font-bold">{isTe ? 'త్రైమాసికం' : 'Q-Cycle'}</span>
            </div>
            <p className="mt-2 text-base font-bold font-sora text-primary">
              <AnimatedNumber value={finance.quarterlyEmi} formatter={formatINR} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{isTe ? 'తగ్గుతున్న అసలుపై వడ్డీ' : 'Reducing balance'}</p>
          </div>
        </div>
      </section>

      {/* 3. Working Capital vs. Capital Expenditure (Capex) Breakdown */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-500/10 text-teal-800 dark:text-teal-300">
                <Sliders className="size-3" />
                {isTe ? 'రుణ విభజన విశ్లేషణ' : 'Working Capital vs. Capex Breakdown'}
              </span>
              <span className="text-xs text-muted-foreground">
                {isTe ? 'బ్యాంకర్ల కోసం స్పష్టమైన కేటాయింపు' : 'Crucial distinction for institutional lenders'}
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold font-sora">
              {isTe ? 'నిర్వహణ మూలధనం మరియు స్థిర ఆస్తుల నిష్పత్తి' : 'Operational Liquidity vs. Fixed Asset Acquisition'}
            </h3>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground hidden sm:inline mr-1">{isTe ? 'ప్రిసెట్‌లు:' : 'Presets:'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomWcRatio(null)}
              className={`h-7 text-[11px] px-2.5 ${customWcRatio === null ? 'border-primary text-primary font-bold' : ''}`}
            >
              {isTe ? 'సిఫార్సు చేసినది' : 'Recommended'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomWcRatio(0.5)}
              className={`h-7 text-[11px] px-2.5 ${customWcRatio === 0.5 ? 'border-primary text-primary font-bold' : ''}`}
            >
              50 / 50
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomWcRatio(0.7)}
              className={`h-7 text-[11px] px-2.5 ${customWcRatio === 0.7 ? 'border-primary text-primary font-bold' : ''}`}
            >
              70% WC
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomWcRatio(0.3)}
              className={`h-7 text-[11px] px-2.5 ${customWcRatio === 0.3 ? 'border-primary text-primary font-bold' : ''}`}
            >
              70% Capex
            </Button>
          </div>
        </div>

        {/* Visual Split Bar */}
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-teal-600 transition-all duration-700 flex items-center justify-center text-[10px] text-white font-bold"
              style={{ width: `${wcBreakdown.workingCapitalPercent}%` }}
              title={`Working Capital: ${formatINR(wcBreakdown.workingCapitalAmount)}`}
            >
              {wcBreakdown.workingCapitalPercent >= 20 ? `${wcBreakdown.workingCapitalPercent}%` : ''}
            </div>
            <div
              className="h-full bg-violet-600 transition-all duration-700 flex items-center justify-center text-[10px] text-white font-bold"
              style={{ width: `${wcBreakdown.capexPercent}%` }}
              title={`Capex: ${formatINR(wcBreakdown.capexAmount)}`}
            >
              {wcBreakdown.capexPercent >= 20 ? `${wcBreakdown.capexPercent}%` : ''}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-teal-600" />
              <span>
                {isTe ? 'వర్కింగ్ క్యాపిటల్ (రోజువారీ నిర్వహణ): ' : 'Working Capital (Operating): '}
                <strong className="text-foreground">{formatINR(wcBreakdown.workingCapitalAmount)}</strong> ({wcBreakdown.workingCapitalPercent}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-violet-600" />
              <span>
                {isTe ? 'కేపెక్స్ (యంత్రాలు / పరికరాలు): ' : 'Capex (Equipment/Assets): '}
                <strong className="text-foreground">{formatINR(wcBreakdown.capexAmount)}</strong> ({wcBreakdown.capexPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Slider control */}
        <div className="mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-muted-foreground shrink-0 font-medium">
              {isTe ? 'నిష్పత్తి సర్దుబాటు:' : 'Adjust Allocation:'}
            </span>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={wcBreakdown.workingCapitalPercent}
              onChange={(e) => setCustomWcRatio(Number(e.target.value) / 100)}
              className="w-full max-w-xs accent-primary cursor-pointer"
            />
            <span className="font-mono font-bold text-foreground shrink-0">
              {wcBreakdown.workingCapitalPercent}% WC / {wcBreakdown.capexPercent}% Capex
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full font-medium">
            <CheckCircle2 className="size-3.5" />
            <span>
              {formatINR(wcBreakdown.workingCapitalAmount)} + {formatINR(wcBreakdown.capexAmount)} = {formatINR(finance.loanAmount)} (100%)
            </span>
          </div>
        </div>

        {/* Itemized usage cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Working Capital Card */}
          <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <Wallet className="size-3.5" />
                {isTe ? 'వర్కింగ్ క్యాపిటల్ దేనికి ఉపయోగపడుతుంది?' : 'What Working Capital Funds'}
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300">
                {formatINR(wcBreakdown.workingCapitalAmount)}
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
              {wcBreakdown.workingCapitalUses.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-teal-800 dark:text-teal-300 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Capex Card */}
          <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                <Briefcase className="size-3.5" />
                {isTe ? 'కేపెక్స్ మూలధనం దేనికి ఉపయోగపడుతుంది?' : 'What Capital Expenditure Funds'}
              </span>
              <span className="text-xs font-mono font-bold text-violet-700 dark:text-violet-300">
                {formatINR(wcBreakdown.capexAmount)}
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
              {wcBreakdown.capexUses.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-violet-700 dark:text-violet-300 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Seasonal Repayment Moratorium Advisory */}
      {seasonalAdvice && seasonalAdvice.isSeasonal && (
        <section className="rounded-2xl border border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20 p-5 sm:p-6 shadow-xs hover-lift">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-500 text-white">
                    {isTe ? 'కాలానుగుణ మారటోరియం సిఫార్సు' : 'Seasonal Moratorium Strategy'}
                  </span>
                  <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                    {seasonalAdvice.businessType}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold font-sora text-foreground">
                  {isTe ? 'తక్కువ రాబడి సీజన్‌లో చెల్లింపుల వెసులుబాటు' : 'Protection During Low-Income Lean Season'}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  {isTe && seasonalAdvice.guidanceTe ? seasonalAdvice.guidanceTe : seasonalAdvice.guidance}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200 font-medium">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span>{isTe ? 'తక్కువ రాబడి కాలం: ' : 'Lean Season: '}<strong>{seasonalAdvice.leanSeasonMonths}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
                    <span className="size-2 rounded-full bg-emerald-700 dark:text-emerald-400" />
                    <span>{isTe ? 'గరిష్ట రాబడి కాలం: ' : 'Flush / Peak Season: '}<strong>{seasonalAdvice.peakSeasonMonths}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-primary font-medium">
                    <Clock className="size-3.5" />
                    <span>
                      {isTe ? 'సిఫార్సు మారటోరియం: ' : 'Recommended Moratorium: '}
                      <strong>{seasonalAdvice.moratoriumQuartersRecommended * 3} {isTe ? 'నెలలు (వడ్డీ మాత్రమే)' : 'Months (Interest-Only)'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3 text-right shrink-0 shadow-xs sm:min-w-44">
              <p className="text-[11px] text-muted-foreground">{isTe ? 'మారటోరియం సమయంలో చెల్లింపు' : 'Moratorium Payment'}</p>
              <p className="text-lg font-bold font-sora text-amber-700 dark:text-amber-300 mt-0.5">
                {formatINR(Math.round(finance.amortizationSchedule[0]?.interestPaid || 0))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{isTe ? 'కేవలం వడ్డీ మాత్రమే' : 'Quarterly interest only'}</p>
            </div>
          </div>
        </section>
      )}

      {/* 5. Pure Deterministic Multi-Scheme Calculation & Side-by-Side Comparison Engine */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                <Award className="size-3.5" />
                {isTe ? 'జాతీయ రుణ పథకాల పోలిక మ్యాట్రిక్స్' : 'National Scheme Calculation & Comparison Engine'}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedGender === 'female' ? (isTe ? 'మహిళా ప్రాధాన్యత' : 'Women Priority') : ''} • {selectedSocialCategory}
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold font-sora">
              {isTe ? 'అన్ని అర్హత కలిగిన ప్రభుత్వ పథకాల పోలిక' : 'Side-by-Side Comparison Across All 5 National Schemes'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe
                ? 'MUDRA, PM విశ్వకర్మ, స్టాండ్-అప్ ఇండియా, PMEGP మరియు NBCFDC లెక్కింపులు ఒకే చోట.'
                : 'Deterministic calculations for MUDRA (auto-tiered), PM Vishwakarma, Stand-Up India, PMEGP, and NBCFDC.'}
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {allCalculatedSchemes.filter((s) => s.isEligible).length} of {allCalculatedSchemes.length} {isTe ? 'పథకాలకు అర్హత ఉంది' : 'Eligible Schemes'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCalculatedSchemes.map((scheme) => {
            const isSelected = scheme.schemeId === selectedSchemeId;
            return (
              <div
                key={scheme.schemeId}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-all relative ${
                  isSelected
                    ? 'bg-primary/5 border-primary shadow-sm ring-2 ring-primary/30'
                    : scheme.isTopMatch
                    ? 'bg-background border-primary/40 shadow-xs'
                    : scheme.isEligible
                    ? 'bg-background hover:bg-muted/20 border-border'
                    : 'bg-muted/30 border-dashed border-muted-foreground/30 opacity-75'
                }`}
              >
                <div>
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {scheme.isTopMatch && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-primary text-primary-foreground shadow-xs">
                          <ShieldCheck className="size-3" />
                          {isTe ? 'టాప్ ఛాయిస్' : 'Top Match'}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {scheme.category}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-muted-foreground">
                      Max: {formatINR(scheme.maxEligibleLoan)}
                    </span>
                  </div>

                  <h4 className="mt-2.5 font-bold font-sora text-sm text-foreground flex items-center gap-1.5">
                    <span>{isTe && scheme.schemeNameTe ? scheme.schemeNameTe : scheme.schemeName}</span>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{scheme.agency}</p>

                  {/* Financial Metrics Grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2 bg-muted/40 rounded-lg p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'వడ్డీ రేటు:' : 'Interest Rate:'}</span>
                      <strong className="font-mono text-foreground">{scheme.interestRateAnnual.toFixed(1)}% p.a.</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'ప్రభుత్వ సబ్సిడీ:' : 'Capital Subsidy:'}</span>
                      {scheme.subsidyAmount && scheme.subsidyPercent ? (
                        <strong className="font-mono text-emerald-800 dark:text-emerald-400">
                          {scheme.subsidyPercent}% ({formatINR(scheme.subsidyAmount)})
                        </strong>
                      ) : (
                        <span className="text-muted-foreground">{isTe ? 'రుణం మాత్రమే' : 'None (Direct loan)'}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'నెలవారీ EMI:' : 'Monthly EMI:'}</span>
                      <strong className="font-mono text-primary">{formatINR(scheme.monthlyEmi)}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'త్రైమాసిక EMI:' : 'Quarterly EMI:'}</span>
                      <strong className="font-mono text-primary">{formatINR(scheme.quarterlyEmi)}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'స్వంత మార్జిన్:' : 'Promoter Margin:'}</span>
                      <span className="font-mono text-muted-foreground">
                        {scheme.promoterContributionPercent}% ({formatINR(scheme.promoterContribution)})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isTe ? 'కాలపరిమితి / గ్రేస్:' : 'Tenure / Grace:'}</span>
                      <span className="font-mono text-muted-foreground">
                        {scheme.tenureYears} Yrs ({scheme.moratoriumMonths}m grace)
                      </span>
                    </div>
                  </div>

                  {/* Guarantee Coverage Badge */}
                  <div className="mt-2.5 rounded-md bg-background/80 border p-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">{scheme.guaranteeCoverage}</span>
                  </div>

                  {/* Benefits */}
                  <ul className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                    {(isTe && scheme.benefitsTe ? scheme.benefitsTe : scheme.benefits).slice(0, 2).map((b: string, bIdx: number) => (
                      <li key={bIdx} className="flex items-start gap-1.5 text-[11px]">
                        <Check className="size-3 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Ineligibility notice if not eligible */}
                  {!scheme.isEligible && scheme.ineligibilityReason && (
                    <div className="mt-2.5 rounded-md bg-amber-500/10 border border-amber-300/80 p-2 text-[11px] text-amber-950 dark:text-amber-200">
                      <strong>{isTe ? 'అర్హత నిబంధన: ' : 'Condition: '}</strong>
                      {scheme.ineligibilityReason}
                    </div>
                  )}
                </div>

                {/* Action footer */}
                <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {scheme.isEligible ? (
                      <span className="text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        {isTe ? 'అర్హత ఉంది' : '100% Eligible'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{isTe ? 'ప్రత్యేక అర్హత అవసరం' : 'Criteria Required'}</span>
                    )}
                  </span>

                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={!scheme.isEligible}
                    onClick={() => setSelectedSchemeId(scheme.schemeId)}
                    className="h-7 text-xs px-2.5 cursor-pointer font-medium"
                  >
                    {isSelected
                      ? (isTe ? 'ఎంచుకోబడింది' : 'Selected Active')
                      : (isTe ? 'ఈ పథకం ఎంచుకోండి' : 'Select Baseline')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Conversational AI Loan Advisor Chat Interface */}
      <section className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold font-sora text-sm sm:text-base text-foreground">
                  {isTe ? 'ఇంటరాక్టివ్ AI లోన్ అడ్వైజర్ సంభాషణ' : 'Interactive AI Loan Advisor'}
                </h3>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {adviceData?.providerUsed || 'Gemini 2.5 Flash'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isTe
                  ? 'మీ రుణ గణాంకాలు, వర్కింగ్ క్యాపిటల్ లేదా దరఖాస్తు విధానం గురించి ఏవైనా సందేహాలు అడగండి.'
                  : 'Ask follow-up questions about your loan numbers, interest rates, seasonal grace, or bank paperwork.'}
              </p>
            </div>
          </div>

          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            <span>{messages.length} {isTe ? 'సందేశాలు' : 'Turns'}</span>
          </span>
        </div>

        {/* Chat message thread */}
        <div className="p-4 sm:p-5 max-h-96 min-h-64 overflow-y-auto space-y-3.5 bg-background">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed message-enter ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-4" />
                </div>
              )}

              <div
                className={`max-w-xl rounded-2xl p-3.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground font-medium rounded-tr-xs'
                    : msg.isError
                    ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-xs'
                    : 'bg-muted/40 border text-foreground rounded-tl-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-[10px] mt-1.5 text-right ${
                    msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>

              {msg.role === 'user' && (
                <div className="size-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}

          {isChatLoading && (
            <div className="flex gap-3 text-xs justify-start">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl rounded-tl-xs p-3.5 bg-muted/40 border text-muted-foreground flex items-center gap-2">
                <RefreshCw className="size-3.5 animate-spin text-primary" />
                <span>{isTe ? 'రుణ సలహాదారు విశ్లేషిస్తున్నారు...' : 'Advisor is analyzing your loan figures...'}</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Quick Question Pills */}
        <div className="px-4 py-2.5 bg-muted/20 border-t flex flex-wrap gap-1.5 text-xs">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mr-1">
            <HelpCircle className="size-3" />
            {isTe ? 'సూచనలు:' : 'Suggestions:'}
          </span>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              disabled={isChatLoading}
              className="px-2.5 py-1 rounded-full border bg-background text-[11px] text-muted-foreground hover:text-primary hover:border-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Voice Error Notification */}
        {voiceError && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              {voiceError}
            </span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="text-xs underline font-semibold ml-2 cursor-pointer shrink-0"
            >
              {isTe ? 'మూసివేయి' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t bg-card flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleVoiceInput}
            title={isListening ? (isTe ? 'వాయిస్ నిలిపివేయండి' : 'Stop listening') : (isTe ? 'వాయిస్ ద్వారా అడగండి' : 'Speak your question')}
            className={`cursor-pointer shrink-0 transition-all ${
              isListening ? 'bg-destructive text-destructive-foreground animate-pulse ring-2 ring-destructive/40' : ''
            }`}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4 text-primary" />}
          </Button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isListening
                ? (isTe ? 'వింటున్నాము... మాట్లాడండి...' : 'Listening... speak your question...')
                : (isTe
                    ? 'రుణ వివరాలు, వడ్డీ లేదా బ్యాంక్ నిబంధనల గురించి అడగండి...'
                    : 'Ask anything about your loan numbers, interest rates, or schemes...')
            }
            disabled={isChatLoading}
            className="flex-1 rounded-xl border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />

          <Button
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isChatLoading}
            className="cursor-pointer shrink-0 gap-1.5 text-xs"
          >
            <Send className="size-3.5" />
            <span className="hidden sm:inline">{isTe ? 'పంపు' : 'Send'}</span>
          </Button>
        </div>
      </section>

      {/* 7. Repayment Proportion & Total Outlay Visualization */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b mb-4">
          <div>
            <h3 className="font-semibold font-sora text-base">
              {isTe ? 'తిరిగి చెల్లింపుల నిష్పత్తి' : 'Repayment Proportion & Total Outlay'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe ? 'అసలు మరియు వడ్డీ చెల్లింపుల పరిమాణం' : 'Principal vs. total accrued interest across complete tenure'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">{isTe ? 'మొత్తం తిరిగి చెల్లింపు: ' : 'Total Outlay: '}</span>
            <strong className="text-sm font-sora text-foreground">{formatINR(totalRepayment)}</strong>
          </div>
        </div>

        {/* Proportion Bar */}
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${Math.round((finance.loanAmount / totalRepayment) * 100)}%` }}
              title={`Principal: ${formatINR(finance.loanAmount)}`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-700"
              style={{ width: `${Math.round((totalInterest / totalRepayment) * 100)}%` }}
              title={`Interest: ${formatINR(totalInterest)}`}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" />
              <span>
                {isTe ? 'అసలు: ' : 'Principal: '}
                <strong>{formatINR(finance.loanAmount)}</strong> ({Math.round((finance.loanAmount / totalRepayment) * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span>
                {isTe ? 'వడ్డీ: ' : 'Interest: '}
                <strong>{formatINR(totalInterest)}</strong> ({Math.round((totalInterest / totalRepayment) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Quarterly Amortization Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
          <div>
            <h3 className="font-semibold font-sora text-base">{t.amortizationTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t.amortizationSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullSchedule(!showFullSchedule)}
            className="cursor-pointer font-semibold text-xs"
          >
            {showFullSchedule
              ? (isTe ? 'మొదటి 8 త్రైమాసికాలు చూపించు' : 'Show First 8 Quarters')
              : (isTe ? `అన్ని ${finance.totalQuarters} త్రైమాసికాలు చూపించు` : `Show All ${finance.totalQuarters} Quarters`)}
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{t.quarter}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.startingPrincipal}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.principalPaid}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.interestPaid}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.totalPayment}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.remainingBalance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedSchedule.map((row) => (
                <tr
                  key={row.quarter}
                  className={`transition-colors hover:bg-muted/40 ${
                    row.isMoratorium ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                    <span>Q{row.quarter}</span>
                    {row.isMoratorium && (
                      <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        {isTe ? 'మారటోరియం' : 'Moratorium'}
                      </span>
                    )}
                    {row.remainingBalance === 0 && (
                      <span className="rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        {isTe ? 'పూర్తయింది' : 'Paid Off'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatINR(row.startingPrincipal)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-800 dark:text-emerald-400">
                    {formatINR(row.principalPaid)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatINR(row.interestPaid)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">
                    {formatINR(row.totalPayment)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-muted-foreground">
                    {formatINR(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default FinanceAdvisorScreen;
