/**
 * RuralCred Advisor — Unified Multilingual Web Speech API Engine (STT & TTS).
 * Supports English (en-IN), Telugu (te-IN), and Hindi (hi-IN).
 * 
 * Features:
 * 1. Safe runtime detection of browser Web Speech API (SpeechRecognition & webkitSpeechRecognition).
 * 2. Active singleton instance tracker preventing double-start and InvalidStateError.
 * 3. Standardized error mapping for permission denials, no-speech, and network issues.
 * 4. High-accuracy bilingual/multilingual natural language transaction parser.
 * 5. MediaRecorder audio fallback for unsupported browsers (Safari / Firefox).
 * 6. Speech synthesis (TTS) in en-IN, te-IN, and hi-IN.
 */

export type VoiceLanguage = 'en' | 'te' | 'hi';

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isMediaRecordingSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const hasGetUserMedia = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
  return hasGetUserMedia && hasMediaRecorder;
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
  const isHi = language === 'hi';
  switch (errorCode) {
    case 'not-allowed':
    case 'permission-denied':
      return isTe
        ? 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో మైక్రోఫోన్‌ను అనుమతించండి.'
        : isHi
        ? 'माइक्रोफ़ोन अनुमति अस्वीकार कर दी गई। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें।'
        : 'Microphone permission was denied. Please allow microphone access in browser settings.';
    case 'no-speech':
      return isTe
        ? 'ఎటువంటి స్వరం గుర్తించబడలేదు. దయచేసి మళ్ళీ మాట్లాడండి.'
        : isHi
        ? 'कोई आवाज़ नहीं पहचानी गई। कृपया पुनः बोलें।'
        : 'No speech detected. Please try speaking again.';
    case 'audio-capture':
      return isTe
        ? 'మైక్రోఫోన్ కనుగొనబడలేదు. పరికరాన్ని తనిఖీ చేయండి.'
        : isHi
        ? 'माइक्रोफ़ोन नहीं मिला। कृपया अपना ऑडियो उपकरण जांचें।'
        : 'No microphone was detected. Please check your audio input device.';
    case 'network':
      return isTe
        ? 'వాయిస్ గుర్తింపు కోసం నెట్‌వర్క్ కనెక్షన్ లోపం ఏర్పడింది.'
        : isHi
        ? 'ध्वनि पहचान के दौरान नेटवर्क त्रुटि हुई।'
        : 'Network error occurred during speech recognition.';
    case 'aborted':
      return isTe
        ? 'వాయిస్ రికార్డింగ్ ఆపివేయబడింది.'
        : isHi
        ? 'वॉइस रिकॉर्डिंग रोक दी गई।'
        : 'Voice input was stopped.';
    case 'service-not-allowed':
      return isTe
        ? 'ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు సేవ అందుబాటులో లేదు.'
        : isHi
        ? 'इस ब्राउज़र में ध्वनि पहचान सेवा की अनुमति नहीं है।'
        : 'Voice recognition service is not allowed by the browser.';
    case 'unsupported':
      return isTe
        ? 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge బ్రౌజర్‌ని ఉపయోగించండి.'
        : isHi
        ? 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।'
        : 'Voice input is not supported in this browser. Please use Chrome or Edge.';
    default:
      return isTe
        ? 'వాయిస్ ఇన్‌పుట్ ప్రారంభించడంలో సమస్య ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
        : isHi
        ? 'वॉइस इनपुट प्रारंभ करने में त्रुटि हुई। कृपया पुनः प्रयास करें।'
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

export async function startAudioRecordingFallback(options: {
  language: VoiceLanguage;
  onProcessing?: () => void;
  onResult: (transcribedText: string, structured?: any) => void;
  onError: (err: any) => void;
}): Promise<{ stop: () => void }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone media recording is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks: Blob[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    options.onProcessing?.();
    stream.getTracks().forEach((track) => track.stop());

    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'speech.webm');
    formData.append('language', options.language);

    try {
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Server voice transcription failed');
      }

      const data = await response.json();
      options.onResult(data.transcript || '', data.structured);
    } catch (err) {
      options.onError(err);
    }
  };

  mediaRecorder.start();

  return {
    stop: () => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    },
  };
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
  confidence?: number;
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
    'మందులు', 'అద్దె', 'వ్యయం',
    'खर्च', 'खरीदा', 'चारा', 'खाद', 'बीज', 'डीजल', 'किराया', 'मजदूरी', 'दवाई'
  ];

  const hasExpenseKeyword = expenseKeywords.some((kw) => lower.includes(kw));
  if (hasExpenseKeyword) {
    type = 'expense';
    if (lower.includes('feed') || lower.includes('fertilizer') || lower.includes('దాణా') || lower.includes('ఎరువులు') || lower.includes('चारा') || lower.includes('खाद')) {
      category = 'Feed / Supplies';
    } else if (lower.includes('seeds') || lower.includes('material') || lower.includes('విత్తనాలు') || lower.includes('ముడిసరుకు') || lower.includes('बीज')) {
      category = 'Raw Material';
    } else if (lower.includes('vet') || lower.includes('medicine') || lower.includes('మందులు') || lower.includes('दवाई')) {
      category = 'Veterinary';
    } else if (lower.includes('labor') || lower.includes('wage') || lower.includes('కూలీ') || lower.includes('मजदूरी')) {
      category = 'Wages';
    } else if (lower.includes('transport') || lower.includes('diesel') || lower.includes('రవాణా') || lower.includes('డీజిల్') || lower.includes('किराया')) {
      category = 'Transport';
    } else if (lower.includes('rent') || lower.includes('power') || lower.includes('అద్దె') || lower.includes('కరెంట్')) {
      category = 'Rent & Power';
    } else {
      category = 'Feed / Supplies';
    }
  } else {
    type = 'income';
    if (lower.includes('cooperative') || lower.includes('dairy') || lower.includes('సహకార') || lower.includes('డైరీ') || lower.includes('डेयरी')) {
      category = 'Cooperative Payout';
    } else if (lower.includes('subsidy') || lower.includes('సబ్సిడీ') || lower.includes('सब्सिडी')) {
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
    confidence: amount ? 0.95 : 0.75,
  };
}

export async function parseSpokenTransactionWithFallback(
  transcript: string,
  language: VoiceLanguage
): Promise<SpokenTransactionResult> {
  const localParsed = parseSpokenTransaction(transcript);
  if (localParsed.amount) {
    return localParsed;
  }

  try {
    const response = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, language }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.amount) {
        return {
          amount: data.amount,
          type: data.type === 'expense' ? 'expense' : 'income',
          category: data.category || localParsed.category || 'Sales',
          note: data.note || transcript,
          confidence: 0.9,
        };
      }
    }
  } catch (e) {}

  return localParsed;
}
