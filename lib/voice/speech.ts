/**
 * RuralCred Advisor — Unified Multilingual Web Speech API Engine (STT & TTS).
 * Supports English (en-IN), Telugu (te-IN), and Hindi (hi-IN).
 * 
 * Features:
 * 1. Safe runtime detection of browser Web Speech API (SpeechRecognition & webkitSpeechRecognition).
 * 2. Active singleton instance tracker preventing double-start and InvalidStateError.
 * 3. Standardized error mapping for permission denials, no-speech, and network issues.
 * 4. High-accuracy bilingual/multilingual natural language transaction parser.
 * 5. Speech synthesis (TTS) in en-IN, te-IN, and hi-IN.
 */

export type VoiceLanguage = 'en' | 'te' | 'hi';

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function getLanguageCode(lang: VoiceLanguage | string): string {
  switch (lang) {
    case 'te':
      return 'te-IN';
    case 'hi':
      return 'hi-IN';
    case 'en':
    default:
      return 'en-IN';
  }
}

export function getSpeechErrorMessage(errorCode: string, language: VoiceLanguage | string): string {
  const isTe = language === 'te';
  switch (errorCode) {
    case 'not-allowed':
    case 'permission-denied':
      return isTe
        ? 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో మైక్రోఫోన్‌ను అనుమతించండి.'
        : 'Microphone permission was denied. Please allow microphone access in browser settings.';
    case 'no-speech':
      return isTe
        ? 'ఎటువంటి స్వరం గుర్తించబడలేదు. దయచేసి మళ్ళీ మాట్లాడండి.'
        : 'No speech detected. Please try speaking again.';
    case 'audio-capture':
      return isTe
        ? 'మైక్రోఫోన్ కనుగొనబడలేదు. పరికరాన్ని తనిఖీ చేయండి.'
        : 'No microphone was detected. Please check your audio input device.';
    case 'network':
      return isTe
        ? 'వాయిస్ గుర్తింపు కోసం నెట్‌వర్క్ కనెక్షన్ లోపం ఏర్పడింది.'
        : 'Network error occurred during speech recognition.';
    case 'aborted':
      return isTe
        ? 'వాయిస్ రికార్డింగ్ ఆపివేయబడింది.'
        : 'Voice input was stopped.';
    case 'service-not-allowed':
      return isTe
        ? 'ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు సేవ అందుబాటులో లేదు.'
        : 'Voice recognition service is not allowed by the browser.';
    case 'unsupported':
      return isTe
        ? 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge బ్రౌజర్‌ని ఉపయోగించండి.'
        : 'Voice input is not supported in this browser. Please use Chrome or Edge.';
    default:
      return isTe
        ? 'వాయిస్ ఇన్‌పుట్ ప్రారంభించడంలో సమస్య ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
        : 'Voice input could not be started. Please try again.';
  }
}

export interface SpeechListenerOptions {
  language: VoiceLanguage | string;
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string, rawError?: any) => void;
  onEnd?: () => void;
  onInterim?: (interim: string) => void;
}

export interface SpeechController {
  stop: () => void;
  abort: () => void;
}

// Active singleton instance tracker to prevent multiple simultaneous instances
let activeRecognitionInstance: any = null;

export function startSpeechListening(options: SpeechListenerOptions): SpeechController | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError?.(getSpeechErrorMessage('unsupported', options.language));
    return null;
  }

  // Stop any active previous instance first safely
  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.abort();
    } catch (e) {}
    activeRecognitionInstance = null;
  }

  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    options.onError?.(getSpeechErrorMessage('unsupported', options.language));
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  activeRecognitionInstance = recognition;

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = getLanguageCode(options.language);
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    const currentText = finalTranscript || interimTranscript;
    if (currentText) {
      options.onResult(currentText.trim(), Boolean(finalTranscript));
      if (interimTranscript && options.onInterim) {
        options.onInterim(interimTranscript.trim());
      }
    }
  };

  recognition.onerror = (event: any) => {
    const code = event?.error || 'unknown';
    // 'aborted' is normal when user cancels or restarts
    if (code === 'aborted') {
      return;
    }
    const message = getSpeechErrorMessage(code, options.language);
    options.onError?.(message, event);
  };

  recognition.onend = () => {
    if (activeRecognitionInstance === recognition) {
      activeRecognitionInstance = null;
    }
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (err: any) {
    activeRecognitionInstance = null;
    options.onError?.(getSpeechErrorMessage(err?.name || 'unknown', options.language), err);
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch (e) {}
    },
    abort: () => {
      try {
        recognition.abort();
      } catch (e) {}
    },
  };
}

export function stopActiveSpeechRecognition() {
  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.abort();
    } catch (e) {}
    activeRecognitionInstance = null;
  }
}

export function speakText(text: string, language: VoiceLanguage | string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageCode(language);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('TTS playback error:', e);
  }
}

export interface SpokenTransactionResult {
  amount?: number;
  type: 'income' | 'expense';
  category?: string;
  note: string;
}

/**
 * Intelligent parser to extract amount, type, category, and note from spoken English or Telugu phrases.
 * Example: "Sold milk for 1500 rupees" -> amount: 1500, type: 'income', category: 'Sales'
 * Example: "ఖర్చు 500 దాణా కోసం" -> amount: 500, type: 'expense', category: 'Feed / Supplies'
 */
export function parseSpokenTransaction(transcript: string): SpokenTransactionResult {
  const lower = transcript.toLowerCase();

  // Determine Type & Category
  let type: 'income' | 'expense' = 'income';
  let category = 'Sales';

  const expenseKeywords = [
    'expense', 'spent', 'bought', 'purchase', 'feed', 'fertilizer', 'diesel', 'petrol',
    'seeds', 'transport', 'rent', 'labor', 'wages', 'medicine', 'vet', 'cost',
    'ఖర్చు', 'కొనుగోలు', 'దాణా', 'ఎరువులు', 'విత్తనాలు', 'డీజిల్', 'రవాణా', 'కూలీ',
    'మందులు', 'అద్దె', 'వ్యయం'
  ];

  const hasExpenseKeyword = expenseKeywords.some((kw) => lower.includes(kw));
  if (hasExpenseKeyword) {
    type = 'expense';
    if (lower.includes('feed') || lower.includes('fertilizer') || lower.includes('దాణా') || lower.includes('ఎరువులు')) {
      category = 'Feed / Supplies';
    } else if (lower.includes('seeds') || lower.includes('material') || lower.includes('విత్తనాలు') || lower.includes('ముడిసరుకు')) {
      category = 'Raw Material';
    } else if (lower.includes('vet') || lower.includes('medicine') || lower.includes('మందులు')) {
      category = 'Veterinary';
    } else if (lower.includes('labor') || lower.includes('wage') || lower.includes('కూలీ')) {
      category = 'Wages';
    } else if (lower.includes('transport') || lower.includes('diesel') || lower.includes('రవాణా') || lower.includes('డీజిల్')) {
      category = 'Transport';
    } else if (lower.includes('rent') || lower.includes('power') || lower.includes('అద్దె') || lower.includes('కరెంట్')) {
      category = 'Rent & Power';
    } else {
      category = 'Feed / Supplies';
    }
  } else {
    type = 'income';
    if (lower.includes('cooperative') || lower.includes('dairy') || lower.includes('సహకార') || lower.includes('డైరీ')) {
      category = 'Cooperative Payout';
    } else if (lower.includes('subsidy') || lower.includes('సబ్సిడీ')) {
      category = 'Subsidy';
    } else {
      category = 'Sales';
    }
  }

  // Extract Numbers
  const cleanStr = transcript.replace(/₹/g, '').replace(/,/g, '');
  const match = cleanStr.match(/\d+(\.\d+)?/g);
  let amount: number | undefined;
  if (match && match.length > 0) {
    const nums = match.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (nums.length > 0) {
      amount = Math.max(...nums);
    }
  }

  return {
    amount,
    type,
    category,
    note: transcript,
  };
}
