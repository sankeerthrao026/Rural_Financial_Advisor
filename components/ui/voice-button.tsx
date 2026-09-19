'use client';

import React from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { VoiceStatus } from '@/hooks/useVoiceInput';

export interface VoiceButtonProps {
  status: VoiceStatus;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'icon';
  label?: string;
  listeningLabel?: string;
  className?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export function VoiceButton({
  status,
  onToggle,
  size = 'md',
  label,
  listeningLabel,
  className = '',
  disabled = false,
  errorMessage,
  onRetry,
}: VoiceButtonProps) {
  const { language } = useApp();
  const isTe = language === 'te';

  const defaultIdleLabel = label || (isTe ? 'వాయిస్ ఇన్‌పుట్' : 'Voice Input');
  const defaultListeningLabel = listeningLabel || (isTe ? 'వింటున్నాము...' : 'Listening...');
  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Base sizing
  const sizeClasses =
    size === 'icon'
      ? 'p-2 rounded-xl'
      : size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-lg'
      : 'px-3.5 py-2 text-xs rounded-xl';

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        title={
          isListening
            ? isTe ? 'వాయిస్ రికార్డింగ్ ఆపండి' : 'Click to stop listening'
            : isTe ? 'వాయిస్ ద్వారా మాట్లాడండి' : 'Click to speak'
        }
        className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-all shadow-xs cursor-pointer select-none ${sizeClasses} ${
          isListening
            ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/50 shadow-md animate-pulse'
            : isProcessing
            ? 'bg-amber-600 text-white'
            : isSuccess
            ? 'bg-emerald-600 text-white'
            : isError
            ? 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20'
            : 'bg-card hover:bg-muted text-foreground border border-border hover:border-primary/40'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      >
        {isListening ? (
          <>
            <Mic className="size-3.5 animate-bounce text-white shrink-0" />
            {size !== 'icon' && <span>{defaultListeningLabel}</span>}
          </>
        ) : isProcessing ? (
          <>
            <RefreshCw className="size-3.5 animate-spin text-white shrink-0" />
            {size !== 'icon' && <span>{isTe ? 'ప్రాసెస్ చేస్తున్నాము...' : 'Processing...'}</span>}
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 className="size-3.5 text-white shrink-0" />
            {size !== 'icon' && <span>{isTe ? 'నమోదైంది' : 'Captured'}</span>}
          </>
        ) : isError ? (
          <>
            <AlertCircle className="size-3.5 shrink-0" />
            {size !== 'icon' && <span>{isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Try Again'}</span>}
          </>
        ) : (
          <>
            <Mic className="size-3.5 text-primary shrink-0" />
            {size !== 'icon' && <span>{defaultIdleLabel}</span>}
          </>
        )}
      </button>

      {/* Render clear inline error message if speech error occurred */}
      {isError && errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded-md max-w-xs animate-in fade-in">
          <AlertCircle className="size-3 shrink-0" />
          <span className="leading-tight">{errorMessage}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 underline font-semibold cursor-pointer shrink-0"
            >
              {isTe ? 'మళ్ళీ' : 'Retry'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
