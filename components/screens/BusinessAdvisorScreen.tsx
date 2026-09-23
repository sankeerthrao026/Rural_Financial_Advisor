'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { BusinessAdvisorOutput } from '@/lib/ai/provider';
import {
  isSpeechRecognitionSupported,
  isMediaRecordingSupported,
  startSpeechListening,
  startAudioRecordingFallback,
  stopActiveSpeechRecognition,
  SpeechController,
  getSpeechErrorMessage,
} from '@/lib/voice/speech';
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
  Calendar,
  Compass,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  data?: BusinessAdvisorOutput;
  isError?: boolean;
}

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

const DISTRICT_OPTIONS = [
  {
    state: 'Telangana',
    districts: ['Warangal', 'Karimnagar', 'Nalgonda', 'Nizamabad', 'Khammam', 'Mahabubnagar', 'Ranga Reddy'],
  },
  {
    state: 'Andhra Pradesh',
    districts: ['Guntur', 'Chittoor', 'West Godavari'],
  },
  {
    state: 'Maharashtra',
    districts: ['Kolhapur', 'Solapur', 'Nashik'],
  },
  {
    state: 'Karnataka',
    districts: ['Belagavi', 'Mandya', 'Dharwad'],
  },
  {
    state: 'Uttar Pradesh',
    districts: ['Varanasi', 'Gorakhpur', 'Lucknow'],
  },
  {
    state: 'Bihar',
    districts: ['Muzaffarpur', 'Patna Rural', 'Madhubani'],
  },
];

const CATEGORY_OPTIONS = [
  { id: 'Dairy', labelEn: 'Dairy Farming', labelTe: 'పాడి పరిశ్రమ' },
  { id: 'Poultry', labelEn: 'Poultry Broiler/Layer', labelTe: 'పౌల్ట్రీ పెంపకం' },
  { id: 'Kirana', labelEn: 'Kirana & General Store', labelTe: 'కిరాణా దుకాణం' },
  { id: 'Weaving', labelEn: 'Handloom & Weaving', labelTe: 'చేనేత వస్త్రాలు' },
  { id: 'Tailoring', labelEn: 'Tailoring & Garments', labelTe: 'టైలరింగ్' },
  { id: 'Agri Processing', labelEn: 'Agri / Flour Milling', labelTe: 'వ్యవసాయ మిల్లింగ్' },
  { id: 'Pottery', labelEn: 'Pottery & Clay Craft', labelTe: 'మట్టి పాత్రల తయారీ' },
  { id: 'Carpentry', labelEn: 'Carpentry & Woodwork', labelTe: 'వడ్రంగి పని' },
  { id: 'Fishery', labelEn: 'Fishery & Aquaculture', labelTe: 'చేపల పెంపకం' },
  { id: 'Auto Repair', labelEn: 'Auto & Tractor Repair', labelTe: 'ఆటో రిపేర్' },
  { id: 'Street Food', labelEn: 'Street Food / Canteen', labelTe: 'గ్రామీణ హోటల్' },
];

const SEASON_OPTIONS = [
  { id: 'Year-Round Baseline', labelEn: 'Year-Round Baseline', labelTe: 'సాధారణ వార్షిక డిమాండ్' },
  { id: 'Festive Season (Diwali / Sankranti Peak)', labelEn: 'Festive Season Peak (Diwali / Sankranti / Dussehra)', labelTe: 'పండుగల సీజన్ (దీపావళి / సంక్రాంతి)' },
  { id: 'Post-Harvest Season (Bumper Mandi Liquidity)', labelEn: 'Post-Harvest Mandi Off-Take (Bumper Liquidity)', labelTe: 'పంట కోతల అనంతర సీజన్' },
  { id: 'Summer Lean Season (Water Scarcity & Heat Stress)', labelEn: 'Summer Lean Season (Off-Peak Period)', labelTe: 'వేసవి కాలం (తక్కువ గిరాకీ)' },
];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BusinessAdvisorScreen() {
  const { profile, language, dictionary } = useApp();
  const t = dictionary.businessAdvisor;
  const isTe = language === 'te';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BusinessAdvisorOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Hyper-local RAG parameters
  const [selectedLocation, setSelectedLocation] = useState<string>(profile.location || 'Warangal');
  const [selectedCategory, setSelectedCategory] = useState<string>(profile.category || 'Dairy');
  const [selectedSeason, setSelectedSeason] = useState<string>('Year-Round Baseline');

  // Interactive Conversation State
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});

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

  // Sync with profile initially if profile changes
  useEffect(() => {
    if (profile.location) setSelectedLocation(profile.location);
    if (profile.category) setSelectedCategory(profile.category);
  }, [profile.location, profile.category]);

  // Cycle through multi-step thinking state when initial loading
  useEffect(() => {
    if (!loading) {
      setActiveStep(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isFollowUpLoading]);

  // Dynamic suggested questions based on selected category
  const getSuggestedQuestions = () => {
    const cat = selectedCategory.toLowerCase();
    if (cat.includes('dairy') || cat.includes('పాడి')) {
      return [
        { en: 'What if I expand to the next village?', te: 'సమీప గ్రామానికి విస్తరిస్తే మార్కెట్ ఎలా ఉంటుంది?' },
        { en: 'Where can I buy feed & fodder cheaper?', te: 'దాణా & పచ్చిగడ్డి తక్కువ ధరకు ఎక్కడ లభిస్తుంది?' },
        { en: 'Which government scheme gives subsidy for cows?', te: 'పాడి పరిశ్రమకు ఏ ప్రభుత్వ పథకం సబ్సిడీ ఇస్తుంది?' },
        { en: 'How to manage milk yield during summer heat?', te: 'వేసవిలో పాల దిగుబడి తగ్గకుండా ఎలాంటి జాగ్రత్తలు తీసుకోవాలి?' },
      ];
    }
    if (cat.includes('kirana') || cat.includes('grocery') || cat.includes('కిరాణా')) {
      return [
        { en: 'What if I open another branch in the next village?', te: 'పక్క గ్రామంలో మరో బ్రాంచ్ తెరిస్తే ఎలా ఉంటుంది?' },
        { en: 'Where can I procure wholesale stock at mandi rates?', te: 'హోల్‌సేల్ సరుకులు తక్కువ ధరకు ఎక్కడ కొనుగోలు చేయవచ్చు?' },
        { en: 'How can I reduce customer credit (బాకీలు)?', te: 'కస్టమర్ల అప్పులు బాకీలు త్వరగా ఎలా వసూలు చేయాలి?' },
        { en: 'What inventory should I stock for festive season?', te: 'పండుగల సీజన్ కోసం ఏ వస్తువులు ఎక్కువ నిల్వ చేయాలి?' },
      ];
    }
    if (cat.includes('weaving') || cat.includes('handloom') || cat.includes('చేనేత')) {
      return [
        { en: 'How to supply directly to city boutiques without brokers?', te: 'దళారులు లేకుండా నగరాల్లోని షోరూమ్‌లకు ఎలా విక్రయించాలి?' },
        { en: 'Where to procure quality silk yarn and natural dyes cheaper?', te: 'పట్టు నూలు & రంగులు నాణ్యమైనవి తక్కువ ధరకు ఎక్కడ దొరుకుతాయి?' },
        { en: 'Can I get working capital under Mudra Weavers Card?', te: 'చేనేత కార్డ్ లేదా ముద్ర కింద తక్కువ వడ్డీ రుణం లభిస్తుందా?' },
        { en: 'What designs have the highest demand this wedding season?', te: 'పెళ్లిళ్ల సీజన్‌లో ఎలాంటి డిజైన్లకు ఎక్కువ గిరాకీ ఉంటుంది?' },
      ];
    }
    return [
      { en: 'What if I expand to the next village?', te: 'సమీప గ్రామానికి విస్తరిస్తే మార్కెట్ ఎలా ఉంటుంది?' },
      { en: 'Where can I buy raw materials cheaper?', te: 'ముడిసరుకు తక్కువ ధరకు ఎక్కడ లభిస్తుంది?' },
      { en: 'What government scheme supports my business expansion?', te: 'నా వ్యాపార విస్తరణకు ఏ ప్రభుత్వ పథకం మద్దతు ఇస్తుంది?' },
      { en: 'How to maintain high profit margins during off-season?', te: 'ఆఫ్-సీజన్‌లో లాభాలను ఎలా కాపాడుకోవాలి?' },
    ];
  };

  // Primary initial analysis
  const runAnalysis = async (
    loc = selectedLocation,
    cat = selectedCategory,
    season = selectedSeason,
    resetChat = true
  ) => {
    setLoading(true);
    setError(null);
    setActiveStep(0);
    try {
      const res = await fetch('/api/ai/business-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: loc,
          category: cat,
          marginCapital: profile.marginCapital || 100000,
          language,
          userQuery: season !== 'Year-Round Baseline' ? season : undefined,
          history: [],
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch business advisory');
      }

      const result: BusinessAdvisorOutput = await res.json();
      setData(result);

      if (resetChat) {
        const initialUserMsg: AdvisorMessage = {
          id: `init-user-${Date.now()}`,
          role: 'user',
          content: isTe
            ? `${loc} పరిధిలో ₹${(profile.marginCapital || 100000).toLocaleString('en-IN')} పెట్టుబడితో ${cat} వ్యాపార సాధ్యాసాధ్యాల విశ్లేషణ (${season !== 'Year-Round Baseline' ? season : 'వార్షిక గిరాకీ'}).`
            : `Business viability evaluation for ${cat} in ${loc} with ₹${(profile.marginCapital || 100000).toLocaleString('en-IN')} margin capital (${season !== 'Year-Round Baseline' ? season : 'Year-Round'}).`,
          timestamp: formatTime(Date.now()),
        };

        const initialAiMsg: AdvisorMessage = {
          id: `init-ai-${Date.now()}`,
          role: 'assistant',
          content: result.reply || `${result.marketReach.headline}. ${result.marketReach.details}`,
          timestamp: formatTime(Date.now()),
          data: result,
        };

        setMessages([initialUserMsg, initialAiMsg]);
      }
    } catch (err: any) {
      console.error('Advisor error:', err);
      setError(err?.message || 'Error running advisory');
    } finally {
      setLoading(false);
    }
  };

  // Send a follow-up conversational question
  const handleSendFollowUp = async (questionText: string) => {
    const cleanText = questionText.trim();
    if (!cleanText || isFollowUpLoading) return;

    setInputText('');

    const userMessage: AdvisorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: formatTime(Date.now()),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsFollowUpLoading(true);

    try {
      // Build conversation history array
      const historyPayload = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/business-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedLocation,
          category: selectedCategory,
          marginCapital: profile.marginCapital || 100000,
          language,
          userQuery: cleanText,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to retrieve follow-up answer');
      }

      const result: BusinessAdvisorOutput = await res.json();
      setData(result); // Update diagnostics with latest response

      const aiMessage: AdvisorMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.reply || `${result.marketReach.headline}. ${result.marketReach.details}`,
        timestamp: formatTime(Date.now()),
        data: result,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Follow-up error:', err);
      const errorMessage: AdvisorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isTe
          ? 'సలహాదారు సమాధానం పొందడంలో సమస్య ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
          : 'Unable to retrieve answer. Please check your network and try again.',
        isError: true,
        timestamp: formatTime(Date.now()),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  // Retry the last user question if an error occurred
  const handleRetry = (errIndex: number) => {
    // Find the user query that preceded this error
    let userQuery = '';
    for (let i = errIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        break;
      }
    }

    if (!userQuery) return;

    // Remove the error message and re-send
    setMessages((prev) => prev.filter((_, idx) => idx !== errIndex));
    handleSendFollowUp(userQuery);
  };

  // Voice Input handler
  const handleToggleVoice = async () => {
    if (isListening) {
      voiceControllerRef.current?.stop();
      voiceControllerRef.current = null;
      setIsListening(false);
      return;
    }

    if (isSpeechRecognitionSupported()) {
      setIsListening(true);
      voiceControllerRef.current = startSpeechListening({
        language,
        onInterim: (interim) => {
          if (interim) setInputText(interim);
        },
        onResult: (transcript, isFinal) => {
          if (transcript) setInputText(transcript);
          if (isFinal) {
            setIsListening(false);
            voiceControllerRef.current = null;
            inputRef.current?.focus();
          }
        },
        onError: (_code, _msg) => {
          setIsListening(false);
          voiceControllerRef.current = null;
        },
        onEnd: () => {
          setIsListening(false);
          voiceControllerRef.current = null;
        },
      });
      return;
    }

    // Secondary Fallback: MediaRecorder audio streaming via /api/voice/transcribe
    if (isMediaRecordingSupported()) {
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
          onError: () => {
            setIsListening(false);
            voiceControllerRef.current = null;
          },
        });
        voiceControllerRef.current = fallbackRecorder;
      } catch (e) {
        setIsListening(false);
        voiceControllerRef.current = null;
      }
      return;
    }

    setIsListening(false);
  };

  // Run automatically on first load if not loaded yet
  useEffect(() => {
    if (!data && !loading) {
      runAnalysis(selectedLocation, selectedCategory, selectedSeason, true);
    }
  }, [language]);

  return (
    <div className="flex flex-col gap-6">
      {/* Grounding Source Attribution Banner */}
      <div className="rounded-2xl border bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-300 shrink-0">
            <Database className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                {isTe
                  ? 'ChromaDB వెక్టార్ స్టోర్ ఆధారిత హైపర్-లోకల్ ఇంటరాక్టివ్ విశ్లేషణ'
                  : 'Hyper-Local RAG Intelligence (ChromaDB + Gemini)'}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live ChromaDB Vector Store
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
              {isTe
                ? 'తెలంగాణ, ఆంధ్రప్రదేశ్, మహారాష్ట్ర, కర్ణాటక, ఉత్తరప్రదేశ్, బీహార్ జిల్లాల మండి ధరలు, కాలానుగుణ మార్పులు మరియు సంభాషణాత్మక RAG శోధన.'
                : 'Indexed across 22+ districts in TS, AP, MH, KA, UP & Bihar. Runs real-time vector retrieval on every follow-up question.'}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => runAnalysis(selectedLocation, selectedCategory, selectedSeason, true)}
          disabled={loading || isFollowUpLoading}
          className="flex items-center gap-1.5 shrink-0 bg-card font-semibold text-xs border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? t.analyzingText : isTe ? 'కొత్త విశ్లేషణ' : 'New Analysis'}</span>
        </Button>
      </div>

      {/* Hyper-Local District, Category & Seasonality Explorer */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-sora">
              {isTe ? 'హైపర్-లోకల్ పరిశోధన పారామితులు' : 'Hyper-Local RAG Query Parameters'}
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {isTe ? 'పరిశీలించడానికి మార్చండి' : 'Select district, category & season to re-query RAG'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* District Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3 text-primary" />
              {isTe ? 'జిల్లా & రాష్ట్రం' : 'District & State'}
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedLocation(val);
                runAnalysis(val, selectedCategory, selectedSeason, true);
              }}
              disabled={loading || isFollowUpLoading}
              className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DISTRICT_OPTIONS.map((group) => (
                <optgroup key={group.state} label={group.state}>
                  {group.districts.map((d) => (
                    <option key={d} value={d}>
                      {d} ({group.state})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Category Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="size-3 text-primary" />
              {isTe ? 'వ్యాపార విభాగం' : 'Business Category'}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val);
                runAnalysis(selectedLocation, val, selectedSeason, true);
              }}
              disabled={loading || isFollowUpLoading}
              className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {isTe ? c.labelTe : c.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Seasonality / Mandi Trend Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3 text-primary" />
              {isTe ? 'కాలానుగుణ మండి స్థితి' : 'Seasonality & Mandi Context'}
            </label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSeason(val);
                runAnalysis(selectedLocation, selectedCategory, val, true);
              }}
              disabled={loading || isFollowUpLoading}
              className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SEASON_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {isTe ? s.labelTe : s.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Step AI Thinking State (Initial Load) */}
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

      {/* Initial Error Banner */}
      {!loading && error && messages.length === 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button size="sm" onClick={() => runAnalysis()} className="mt-2">
            <RefreshCw className="size-3.5 mr-1.5" />
            {isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry Advisory'}
          </Button>
        </div>
      )}

      {/* CORE FEATURE: Interactive Business Advisory Chat Thread */}
      {!loading && messages.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden flex flex-col page-enter">
          {/* Chat Header */}
          <div className="p-4 sm:px-6 sm:py-4 border-b bg-muted/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold font-sora text-foreground">
                    {isTe ? 'ఇంటరాక్టివ్ వ్యాపార సలహాదారు (సంభాషణ)' : 'Interactive Advisory Conversation'}
                  </h3>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="size-2.5" />
                    Multi-Turn Context
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isTe
                    ? `${selectedLocation} • ${selectedCategory} కోసం నిరంతర RAG సంభాషణ`
                    : `Active advisory dialogue for ${selectedCategory} in ${selectedLocation}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAnalysis(selectedLocation, selectedCategory, selectedSeason, true)}
                title={isTe ? 'సంభాషణను రీసెట్ చేయండి' : 'Clear and reset conversation'}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">{isTe ? 'రీసెట్' : 'Reset'}</span>
              </button>
            </div>
          </div>

          {/* Chat Message Stream */}
          <div className="p-4 sm:p-6 flex flex-col gap-4 max-h-[540px] overflow-y-auto bg-background/50">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const turnData = msg.data;
              const isExpanded = Boolean(expandedTurns[msg.id]);

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end items-end gap-2.5 max-w-[85%] self-end message-enter">
                    <div className="flex flex-col items-end">
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-xs px-4 py-2.5 text-xs sm:text-sm font-medium shadow-xs leading-relaxed">
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs shrink-0 mb-4">
                      <User className="size-3.5" />
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex items-start gap-2.5 max-w-[92%] self-start message-enter">
                  <div className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary shrink-0 mt-1">
                    <Sparkles className="size-4" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div
                      className={`rounded-2xl rounded-tl-xs p-4 sm:p-5 border shadow-xs leading-relaxed text-xs sm:text-sm ${
                        msg.isError
                          ? 'border-destructive/40 bg-destructive/5 text-destructive'
                          : 'bg-card text-foreground border-border/80'
                      }`}
                    >
                      {/* Top metadata tags */}
                      {!msg.isError && (
                        <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-border/40">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            RuralCred Advisor
                          </span>
                          {turnData?.providerUsed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              <Cpu className="size-2.5" />
                              {turnData.providerUsed}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {msg.timestamp}
                          </span>
                        </div>
                      )}

                      {/* Main Message Text */}
                      <p className="font-normal text-foreground whitespace-pre-line leading-relaxed">
                        {msg.content}
                      </p>

                      {/* Error state with retry action */}
                      {msg.isError && (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRetry(idx)}
                            className="h-8 text-xs cursor-pointer gap-1.5"
                          >
                            <RefreshCw className="size-3.5" />
                            {isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry Query'}
                          </Button>
                        </div>
                      )}

                      {/* Grounded Key Metrics Mini-Bar */}
                      {!msg.isError && turnData && (
                        <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg">
                            <Tag className="size-3 text-primary shrink-0" />
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-bold text-foreground truncate">
                              {turnData.pricingSuggestion.recommendedBand}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg">
                            <TrendingUp className="size-3 text-emerald-600 shrink-0" />
                            <span className="text-muted-foreground">Target Margin:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              {turnData.pricingSuggestion.marginTarget}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg">
                            <Users className="size-3 text-amber-600 shrink-0" />
                            <span className="text-muted-foreground">Density:</span>
                            <span className="font-bold text-foreground">
                              {turnData.competitorDensity.densityLevel}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Expandable SWOT / Diagnostics for this turn */}
                      {!msg.isError && turnData && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTurns((prev) => ({ ...prev, [msg.id]: !isExpanded }))
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            <span>
                              {isExpanded
                                ? isTe
                                  ? 'వివరణాత్మక SWOT దాచండి'
                                  : 'Hide Turn Diagnostics'
                                : isTe
                                ? 'ఈ ప్రశ్నకు సంబంధించిన SWOT & వ్యూహం చూడండి'
                                : 'View Turn SWOT & Strategic Moat'}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-2 page-enter">
                              <p className="font-semibold text-foreground">
                                {isTe ? 'అవకాశ విశ్లేషణ:' : 'Opportunity Analysis:'}{' '}
                                <span className="font-normal text-muted-foreground">
                                  {turnData.opportunityAnalysis.overview}
                                </span>
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/40">
                                <div>
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">
                                    {isTe ? 'బలాలు (Strengths):' : 'Key Strengths:'}
                                  </span>
                                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                                    {turnData.swot.strengths.slice(0, 2).map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <span className="font-semibold text-amber-700 dark:text-amber-300 block mb-1">
                                    {isTe ? 'వ్యూహాత్మక రక్షణ (Moat):' : 'Mitigation Strategy:'}
                                  </span>
                                  <p className="text-muted-foreground text-[11px]">
                                    {turnData.competitorDensity.mitigationStrategy}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Retrieved Sources Badge */}
                    {!msg.isError && turnData?.sourcesUsed && turnData.sourcesUsed.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Database className="size-2.5 text-primary" />
                          RAG:
                        </span>
                        {turnData.sourcesUsed.slice(0, 2).map((src, i) => (
                          <span
                            key={i}
                            className="text-[9px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Follow-up Typing / Loading Indicator */}
            {isFollowUpLoading && (
              <div className="flex items-start gap-2.5 self-start page-enter">
                <div className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary shrink-0 mt-1 animate-pulse">
                  <Sparkles className="size-4" />
                </div>
                <div className="rounded-2xl rounded-tl-xs p-4 border border-primary/30 bg-primary/5 shadow-xs flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-2 rounded-full bg-primary animate-bounce" />
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {isTe
                      ? `${selectedLocation} మండి డేటాను మరియు RAG నాలెడ్జ్ బేస్‌ను శోధిస్తున్నాము...`
                      : `Querying ChromaDB records & generating hyper-local context for ${selectedLocation}...`}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Suggested Follow-up Question Chips */}
          <div className="px-4 py-3 border-t bg-muted/10">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-2">
              <Sparkles className="size-3 text-primary" />
              <span>{isTe ? 'సూచించిన తదుపరి ప్రశ్నలు (1-క్లిక్):' : 'Suggested follow-up questions:'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {getSuggestedQuestions().map((q, idx) => {
                const text = isTe ? q.te : q.en;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isFollowUpLoading}
                    onClick={() => handleSendFollowUp(text)}
                    className="rounded-lg border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-2xs cursor-pointer text-left disabled:opacity-50"
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Input Bar with Text and Voice Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendFollowUp(inputText);
            }}
            className="p-3 sm:p-4 border-t bg-card flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isListening ? (isTe ? 'వాయిస్ నిలిపివేయండి' : 'Stop listening') : (isTe ? 'వాయిస్ ఇన్‌పుట్' : 'Voice input (Telugu / English)')}
              className={`grid size-10 place-items-center rounded-xl border transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse ring-4 ring-rose-500/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border-border/80'
              }`}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>

            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListening
                    ? isTe
                      ? 'వింటున్నాము... మాట్లాడండి...'
                      : 'Listening... speak your question...'
                    : isTe
                    ? 'ఉదా: "మరో గ్రామానికి విస్తరిస్తే మార్కెట్ ఎలా ఉంటుంది?"'
                    : 'Ask a follow-up (e.g., "What if I expand to the next village?")...'
                }
                disabled={isFollowUpLoading}
                className="w-full rounded-xl border bg-background px-4 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <Button
              type="submit"
              disabled={isFollowUpLoading || !inputText.trim()}
              className="h-10 px-4 rounded-xl font-semibold gap-1.5 cursor-pointer shrink-0"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">{isTe ? 'పంపండి' : 'Send'}</span>
            </Button>
          </form>
        </div>
      )}

      {/* Structured Viability & Diagnostics Breakdown for Active Turn */}
      {!loading && data && (
        <div className="flex flex-col gap-6 page-enter mt-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-sora">
                {isTe ? 'తాజా విశ్లేషణ సమగ్ర వివరాలు' : 'Active Market Diagnostics & SWOT'}
              </h3>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {selectedLocation} • {selectedCategory}
            </span>
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
                <span className="font-bold">
                  {isTe ? 'కాలానుగుణ & మండి ధరల ట్రెండ్:' : 'Seasonality & Mandi Price Trend:'}
                </span>{' '}
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

export default BusinessAdvisorScreen;
