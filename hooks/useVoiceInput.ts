'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import {
  isSpeechRecognitionSupported,
  startSpeechListening,
  stopActiveSpeechRecognition,
  SpeechController,
  VoiceLanguage,
} from '@/lib/voice/speech';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export interface UseVoiceInputOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  targetLanguage?: VoiceLanguage;
}

export function useVoiceInput(options?: UseVoiceInputOptions) {
  const { language: appLanguage } = useApp();
  const currentLanguage = (options?.targetLanguage || appLanguage || 'en') as VoiceLanguage;

  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<SpeechController | null>(null);
  const optionsRef = useRef(options);
  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  optionsRef.current = options;

  const clearStatusResetTimer = useCallback(() => {
    if (statusResetTimerRef.current) {
      clearTimeout(statusResetTimerRef.current);
      statusResetTimerRef.current = null;
    }
  }, []);

  // Safe client-side check for SSR compatibility
  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      clearStatusResetTimer();
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      stopActiveSpeechRecognition();
    };
  }, [clearStatusResetTimer]);

  const stopListening = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
    } else {
      stopActiveSpeechRecognition();
    }
    setStatus((prev) => (prev === 'listening' ? 'processing' : prev));

    // Safety net: never allow a stuck "processing" state if recognition.onEnd
    // never fires after a manual stop.
    clearStatusResetTimer();
    statusResetTimerRef.current = setTimeout(() => {
      setStatus((prev) => (prev === 'processing' ? 'idle' : prev));
      statusResetTimerRef.current = null;
    }, 5000);
  }, [clearStatusResetTimer]);

  const reset = useCallback(() => {
    clearStatusResetTimer();
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    stopActiveSpeechRecognition();
    setStatus('idle');
    setTranscript('');
    setIsFinal(false);
    setError(null);
  }, [clearStatusResetTimer]);

  const startListening = useCallback(() => {
    clearStatusResetTimer();
    setError(null);
    setTranscript('');
    setIsFinal(false);

    if (!isSpeechRecognitionSupported()) {
      const unsupportedMsg =
        currentLanguage === 'te'
          ? 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge ఉపయోగించండి.'
          : currentLanguage === 'hi'
          ? 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।'
          : 'Voice input is not supported in this browser. Please use Chrome or Edge.';
      setError(unsupportedMsg);
      setStatus('error');
      optionsRef.current?.onError?.(unsupportedMsg);
      return;
    }

    setStatus('listening');

    const controller = startSpeechListening({
      language: currentLanguage,
      onStart: () => {
        setStatus('listening');
        setError(null);
      },
      onResult: (text, final) => {
        setTranscript(text);
        setIsFinal(final);
        if (final) {
          setStatus('success');
          clearStatusResetTimer();
          statusResetTimerRef.current = setTimeout(() => {
            setStatus('idle');
            statusResetTimerRef.current = null;
          }, 1500);
        }
        optionsRef.current?.onResult?.(text, final);
      },
      onError: (_code, errMsg) => {
        setError(errMsg);
        setStatus('error');
        controllerRef.current = null;
        optionsRef.current?.onError?.(errMsg);
      },
      onEnd: () => {
        controllerRef.current = null;
        // Recover to "idle" whether the session ended from "listening" (error /
        // silence) or from a manual stop that left us in "processing" with no
        // final result yet.
        setStatus((prev) => (prev === 'listening' || prev === 'processing' ? 'idle' : prev));
        optionsRef.current?.onEnd?.();
      },
    });

    controllerRef.current = controller;
  }, [currentLanguage, clearStatusResetTimer]);

  return {
    isListening: status === 'listening',
    isSupported,
    status,
    transcript,
    isFinal,
    error,
    startListening,
    stopListening,
    reset,
  };
}