'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import {
  isSpeechRecognitionSupported,
  startSpeechListening,
  stopActiveSpeechRecognition,
  SpeechController,
} from '@/lib/voice/speech';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export interface UseVoiceInputOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  targetLanguage?: 'en' | 'te';
}

export function useVoiceInput(options?: UseVoiceInputOptions) {
  const { language: appLanguage } = useApp();
  const currentLanguage = options?.targetLanguage || appLanguage || 'en';

  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<SpeechController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Safe client-side check for SSR compatibility
  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      stopActiveSpeechRecognition();
    };
  }, []);

  const stopListening = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
    } else {
      stopActiveSpeechRecognition();
    }
    setStatus((prev) => (prev === 'listening' ? 'processing' : prev));
  }, []);

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    stopActiveSpeechRecognition();
    setStatus('idle');
    setTranscript('');
    setIsFinal(false);
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    setIsFinal(false);

    if (!isSpeechRecognitionSupported()) {
      const unsupportedMsg =
        currentLanguage === 'te'
          ? 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge ఉపయోగించండి.'
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
          setTimeout(() => {
            setStatus('idle');
          }, 1500);
        }
        optionsRef.current?.onResult?.(text, final);
      },
      onError: (errMsg) => {
        setError(errMsg);
        setStatus('error');
        controllerRef.current = null;
        optionsRef.current?.onError?.(errMsg);
      },
      onEnd: () => {
        controllerRef.current = null;
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        optionsRef.current?.onEnd?.();
      },
    });

    controllerRef.current = controller;
  }, [currentLanguage]);

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
