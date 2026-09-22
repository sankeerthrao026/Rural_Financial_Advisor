'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Languages,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  VoiceLanguage,
  isSpeechRecognitionSupported,
  isMediaRecordingSupported,
  startSpeechListening,
  startAudioRecordingFallback,
  parseSpokenTransactionWithFallback,
  SpokenTransactionResult,
} from '@/lib/voice/speech';
import { en as enDict, te as teDict, hi as hiDict } from '@/lib/i18n';
import { formatINR } from '@/lib/utils/currency';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: VoiceLanguage;
  onLanguageChange?: (lang: VoiceLanguage) => void;
  onExtracted: (result: SpokenTransactionResult) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

// Maximum recording duration guard (prevents the mic running forever).
const MAX_RECORDING_SECONDS = 60;

const LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
};

export function VoiceInputModal({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  onExtracted,
}: VoiceInputModalProps) {
  const [activeLang, setActiveLang] = useState<VoiceLanguage>(language);
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [extractedResult, setExtractedResult] = useState<SpokenTransactionResult | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const activeListenerRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isClosedRef = useRef(!isOpen);
  const hasWebSpeech = isSpeechRecognitionSupported();

  const dict = activeLang === 'te' ? teDict : activeLang === 'hi' ? hiDict : enDict;
  const t = dict.voice;

  // Mirror the prop language into the modal whenever it changes externally.
  useEffect(() => {
    setActiveLang(language);
  }, [language]);

  // Reset session state whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      isClosedRef.current = false;
      setState('idle');
      setTranscript('');
      setErrorMessage('');
      setExtractedResult(null);
      setRecordingSeconds(0);
    }
  }, [isOpen]);

  // Clean up on close and on unmount. Closing must ABORT rather than gracefully
  // stop so recognition/MediaRecorder sessions are torn down immediately and
  // any pending microphone stream is released (no background mic leak).
  useEffect(() => {
    if (!isOpen) {
      isClosedRef.current = true;
      stopTimer();
      const listener = activeListenerRef.current;
      activeListenerRef.current = null;
      if (listener) {
        if (listener.abort) {
          listener.abort();
        } else {
          listener.stop();
        }
      }
      setState('idle');
      setTranscript('');
      setErrorMessage('');
      setExtractedResult(null);
      setRecordingSeconds(0);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      isClosedRef.current = true;
      stopTimer();
      const listener = activeListenerRef.current;
      activeListenerRef.current = null;
      if (listener) {
        if (listener.abort) {
          listener.abort();
        } else {
          listener.stop();
        }
      }
    };
  }, []);

  const startTimer = () => {
    setRecordingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        // Hard maximum recording duration — auto-stop so the mic can never
        // stay hot indefinitely.
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartListening = async () => {
    if (isClosedRef.current) return;
    setErrorMessage('');
    setTranscript('');
    setExtractedResult(null);
    setState('recording');
    startTimer();

    // 1. Primary: Browser Web Speech API
    if (hasWebSpeech) {
      const listener = startSpeechListening({
        language: activeLang,
        onInterim: (interim) => {
          if (isClosedRef.current) return;
          setTranscript(interim);
        },
        onResult: async (finalText) => {
          if (isClosedRef.current) return;
          stopTimer();
          setTranscript(finalText);
          setState('processing');
          try {
            const parsed = await parseSpokenTransactionWithFallback(finalText, activeLang);
            if (isClosedRef.current) return;
            setExtractedResult(parsed);
            setState('success');
          } catch (err: any) {
            if (isClosedRef.current) return;
            setErrorMessage(err?.message || 'Failed to analyze speech with AI.');
            setState('error');
          }
        },
        onError: (_code, message) => {
          if (isClosedRef.current) return;
          stopTimer();
          // Message is already fully localized via getSpeechErrorMessage.
          setErrorMessage(message);
          setState('error');
        },
        onEnd: () => {
          if (isClosedRef.current) return;
          // If ended without final result and still in recording state
          setState((prev) => (prev === 'recording' ? 'idle' : prev));
          stopTimer();
        },
      });

      activeListenerRef.current = listener;
    } else {
      // 2. Fallback: MediaRecorder sending audio to FastAPI / Gemini STT endpoint
      if (!isMediaRecordingSupported()) {
        stopTimer();
        setErrorMessage('Neither Web Speech API nor MediaRecorder is supported in this browser environment.');
        setState('error');
        return;
      }

      try {
        const fallbackRecorder = await startAudioRecordingFallback({
          language: activeLang,
          // If the modal closes while getUserMedia() is still pending, the
          // fallback tears the fresh stream down instead of recording silently.
          isCancelled: () => isClosedRef.current,
          onProcessing: () => {
            if (isClosedRef.current) return;
            setState('processing');
          },
          onResult: async (transcribedText: string, structured?: any) => {
            if (isClosedRef.current) return;
            stopTimer();
            setTranscript(transcribedText);
            setState('processing');

            if (structured && structured.amount) {
              setExtractedResult({
                amount: structured.amount,
                type: structured.type === 'expense' ? 'expense' : 'income',
                category: structured.category || 'Sales',
                note: structured.note || transcribedText,
                confidence: 0.95,
              });
              setState('success');
            } else {
              const parsed = await parseSpokenTransactionWithFallback(transcribedText, activeLang);
              if (isClosedRef.current) return;
              setExtractedResult(parsed);
              setState('success');
            }
          },
          onError: (err: any) => {
            if (isClosedRef.current) return;
            stopTimer();
            setErrorMessage(err?.message || 'Fallback audio recording failed.');
            setState('error');
          },
        });

        activeListenerRef.current = fallbackRecorder;
      } catch (err: any) {
        if (isClosedRef.current) return;
        stopTimer();
        setErrorMessage(err?.message || 'Failed to initialize microphone.');
        setState('error');
      }
    }
  };

  // Graceful stop is only used when the user intentionally finishes speaking.
  // Closing the modal always goes through the abort path (see effect above).
  const stopRecording = () => {
    stopTimer();
    if (activeListenerRef.current) {
      const listener = activeListenerRef.current;
      activeListenerRef.current = null;
      listener.stop();
    }
  };

  const handleApply = () => {
    if (extractedResult) {
      onExtracted(extractedResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mic className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">{t.title}</h3>
              <p className="text-xs text-muted-foreground">
                {hasWebSpeech
                  ? 'Web Speech API • Real-Time STT'
                  : 'Fallback Mode • Server-Side Gemini STT'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Language Selector Pills */}
        <div className="mt-4 flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/50 border">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground pl-1">
            <Languages className="size-3.5 text-primary" />
            {t.languageLabel}
          </span>
          <div className="flex items-center gap-1">
            {(Object.keys(LANGUAGE_LABELS) as VoiceLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                disabled={state === 'recording' || state === 'processing'}
                onClick={() => {
                  setActiveLang(lang);
                  onLanguageChange?.(lang);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeLang === lang
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* Central Visualizer & Recording Controls */}
        <div className="my-6 flex flex-col items-center justify-center text-center">
          {/* Visual Waveform / Pulsing Ring */}
          <div className="relative flex items-center justify-center">
            {state === 'recording' && (
              <>
                <div className="absolute size-28 rounded-full bg-rose-500/20 animate-ping" />
                <div className="absolute size-24 rounded-full bg-rose-500/30 animate-pulse" />
              </>
            )}
            {state === 'processing' && (
              <div className="absolute size-24 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            )}

            <button
              type="button"
              onClick={state === 'recording' ? stopRecording : handleStartListening}
              disabled={state === 'processing'}
              className={`relative z-10 grid size-20 place-items-center rounded-full transition-all shadow-lg cursor-pointer ${
                state === 'recording'
                  ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-300 dark:ring-rose-900/50 scale-105'
                  : state === 'processing'
                  ? 'bg-muted text-muted-foreground cursor-wait'
                  : 'bg-primary text-primary-foreground hover:scale-105 hover:bg-primary/90'
              }`}
            >
              {state === 'recording' ? (
                <Square className="size-7 fill-white" />
              ) : state === 'processing' ? (
                <RefreshCw className="size-7 animate-spin" />
              ) : (
                <Mic className="size-8" />
              )}
            </button>
          </div>

          {/* Dynamic Audio Visualizer Bars when Recording */}
          {state === 'recording' && (
            <div className="mt-4 flex items-center justify-center gap-1 h-8">
              {[40, 70, 90, 60, 100, 75, 45, 85, 65, 95, 50, 80].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-rose-500 animate-pulse"
                  style={{
                    height: `${Math.max(12, (h * (i % 2 === 0 ? 0.9 : 0.6)))}%`,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: '0.6s',
                  }}
                />
              ))}
            </div>
          )}

          {/* Status Message */}
          <div className="mt-4">
            {state === 'idle' && (
              <p className="text-sm font-medium text-muted-foreground">{t.idleStatus}</p>
            )}
            {state === 'recording' && (
              <div>
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2">
                  <span className="size-2 rounded-full bg-rose-600 animate-pulse" />
                  {t.listeningStatus}
                  <span className="text-xs font-mono font-normal opacity-80">
                    ({formatSeconds(recordingSeconds)})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t.stopHint}</p>
              </div>
            )}
            {state === 'processing' && (
              <p className="text-sm font-medium text-primary flex items-center justify-center gap-2">
                <Sparkles className="size-4 animate-spin text-amber-500" />
                {t.processingStatus}
              </p>
            )}
          </div>
        </div>

        {/* Live Transcript Display */}
        {transcript && (
          <div className="mb-4 rounded-xl border bg-muted/30 p-3 text-left">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t.transcriptLabel}
            </p>
            <p className="text-sm font-medium italic text-foreground">
              "{transcript}"
            </p>
          </div>
        )}

        {/* Error State Display */}
        {state === 'error' && errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-left">
            <AlertCircle className="size-4.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-rose-800 dark:text-rose-300">{t.errorTitle}</p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-400">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Extracted Result Preview & Apply Action */}
        {state === 'success' && extractedResult && (
          <div className="mb-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>{t.extractedTitle}</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                extractedResult.type === 'income'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
              }`}>
                {extractedResult.type === 'income' ? t.income : t.expense}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mt-3">
              <div className="rounded-lg bg-card p-2.5 border">
                <span className="text-muted-foreground">{t.amountLabel}</span>
                <p className="text-base font-bold font-sora text-foreground mt-0.5">
                  {extractedResult.amount ? formatINR(extractedResult.amount) : t.notSpecified}
                </p>
              </div>
              <div className="rounded-lg bg-card p-2.5 border">
                <span className="text-muted-foreground">{t.categoryLabel}</span>
                <p className="font-semibold text-foreground mt-0.5 truncate">
                  {extractedResult.category || t.general}
                </p>
              </div>
            </div>

            {extractedResult.parseMessage && !extractedResult.amount && (
              <p className="mt-2.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-lg p-2.5">
                {extractedResult.parseMessage}
              </p>
            )}

            {extractedResult.note && (
              <p className="mt-2.5 text-xs text-muted-foreground truncate">
                <span className="font-medium text-foreground">{t.noteLabel}</span> {extractedResult.note}
              </p>
            )}

            <button
              type="button"
              onClick={handleApply}
              className="mt-3.5 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              {t.applyBtn}
            </button>
          </div>
        )}

        {/* Suggested Examples */}
        {state === 'idle' && (
          <div className="mt-2 rounded-xl bg-muted/40 p-3 text-left">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {t.examplesLabel}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {t.examplePhrases.map((phrase, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-primary/60" />
                  <span className="italic">"{phrase}"</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}