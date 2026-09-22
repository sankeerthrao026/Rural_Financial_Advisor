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

/**
 * Hindi speech recognition is only reliably available on Android Chrome.
 * Desktop Chrome/Firefox/Safari and desktop browsers generally do not ship
 * the hi-IN recognition model.
 */
export function isLikelyHindiOSupportedPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
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
    case 'hindi-unsupported-desktop':
      return isTe
        ? 'హిందీ వాయిస్ ఇన్‌పుట్ ప్రస్తుతం ఆండ్రాయిడ్ క్రోమ్‌లో మాత్రమే అందుబాటులో ఉంది. దయచేసి ఇంగ్లీష్ లేదా తెలుగు ప్రయత్నించండి, లేదా మీ వివరాలను మాన్యువల్‌గా టైప్ చేయండి.'
        : isHi
        ? 'हिंदी वॉइस इनपुट फिलहाल केवल एंड्रॉइड क्रोम पर उपलब्ध है। कृपया अंग्रेज़ी या तेलुगु आज़माएं, या अपनी जानकारी मैन्युअली टाइप करें।'
        : 'Hindi voice input is currently only supported on Android Chrome. Try English or Telugu, or type your entry manually.';
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
  onError?: (errorCode: string, errorMessage: string, rawError?: any) => void;
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
    options.onError?.('unsupported', getSpeechErrorMessage('unsupported', options.language));
    return null;
  }

  // Stop any active previous instance first safely
  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.abort();
    } catch (e) {}
    activeRecognitionInstance = null;
  }

  // Proactive guard: Hindi speech recognition is not reliably available on
  // desktop browsers — fail fast with a helpful message instead of a vague
  // generic error after an inevitable failed attempt.
  if (options.language === 'hi' && !isLikelyHindiOSupportedPlatform()) {
    const code = 'hindi-unsupported-desktop';
    options.onError?.(code, getSpeechErrorMessage(code, options.language));
    return null;
  }

  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    options.onError?.('unsupported', getSpeechErrorMessage('unsupported', options.language));
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

    const finalText = finalTranscript.trim();
    if (finalText) {
      options.onResult(finalText, true);
    }
    const interimText = interimTranscript.trim();
    if (interimText) {
      options.onResult(interimText, false);
      options.onInterim?.(interimText);
    }
  };

  recognition.onerror = (event: any) => {
    const code = event?.error || 'unknown';
    // 'aborted' is normal when user cancels or restarts
    if (code === 'aborted') {
      return;
    }
    const message = getSpeechErrorMessage(code, options.language);
    options.onError?.(code, message, event);
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
    const code = err?.name || 'unknown';
    options.onError?.(code, getSpeechErrorMessage(code, options.language), err);
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
  /**
   * Called after getUserMedia resolves. If it returns true the caller has
   * closed/discarded the session — stop every stream track immediately and
   * never start a MediaRecorder (prevents a background microphone leak).
   */
  isCancelled?: () => boolean;
}): Promise<{ stop: () => void }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone media recording is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  if (options.isCancelled?.()) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('Recording cancelled');
  }

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
  /** True when multiple credible amount candidates were found (e.g. more
   * than one number near a currency keyword). Used to decide whether the
   * Gemini-based parser should be consulted instead of guessing locally. */
  isAmbiguous?: boolean;
  /** A user-facing note when the amount could not be confidently extracted. */
  parseMessage?: string;
}

// ---------------------------------------------------------------------------
// Multilingual natural-language transaction parser
// ---------------------------------------------------------------------------

// Minimal English / Hindi / Telugu number-word maps covering everyday
// transaction amounts (roughly ₹1 to a few lakh).
const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000, thousands: 1000, lakh: 100000, lakhs: 100000,
  // Hindi
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9,
  दस: 10, ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, सोलह: 16, सत्रह: 17,
  अठारह: 18, उन्नीस: 19, बीस: 20, तीस: 30, चालीस: 40, पचास: 50, साठ: 60, सत्तर: 70,
  अस्सी: 80, नब्बे: 90, सौ: 100, हज़ार: 1000, हजार: 1000, लाख: 100000,
  // Telugu
  ఒక: 1, ఒకటి: 1, రెండు: 2, మూడు: 3, నాలుగు: 4, ఐదు: 5, ఆరు: 6, ఏడు: 7, ఎనిమిది: 8, తొమ్మిది: 9,
  పది: 10, పదకొండు: 11, పన్నెండు: 12, పదమూడు: 13, పద్నాలుగు: 14, పదిహేను: 15, పదహారు: 16,
  పదిహేడు: 17, పద్దెనిమిది: 18, పంతొమ్మిది: 19, ఇరవై: 20, ముప్పై: 30, నలభై: 40, యాభై: 50,
  అరవై: 60, డెబ్బై: 70, ఎనభై: 80, తొంభై: 90,
  వంద: 100, వందలు: 100, వేలు: 1000, వేయి: 1000, లక్ష: 100000,
};

const SCALE_WORDS = [
  'hundred', 'thousand', 'thousands', 'lakh', 'lakhs',
  'सौ', 'हज़ार', 'हजार', 'लाख',
  'వంద', 'వందలు', 'వేలు', 'వేయి', 'లక్ష',
];

// Words that strongly indicate an adjacent number is the transaction amount.
const CURRENCY_KEYWORDS = [
  'rupees', 'rupee', 'rs', 'total', 'for', 'spent', 'paid', 'cost', 'bill', 'price', 'profit', 'income', 'expense',
  'రూపాయలు', 'రూపాయి', 'రూ', 'మొత్తం', 'ఖర్చు', 'ఖరీదు', 'చెల్లించిన', 'వచ్చింది', 'ఆదాయం',
  'रुपये', 'रुपया', 'रु', 'कुल', 'खर्च', 'कीमत', 'दिए', 'दिया', 'आमदनी', 'मिले', 'पैसे',
];

const UNIT_WORDS = [
  'litre', 'litres', 'liter', 'liters', 'kg', 'kgs', 'kilogram', 'kilograms', 'bag', 'bags',
  'bundle', 'bundles', 'piece', 'pieces', 'quintal', 'quintals', 'dozen', 'dozens',
];

/** Converts a contiguous run of number words (e.g. "two thousand five hundred")
 * into a number, or null if no real number words are present. */
function wordsToNum(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawAny = false;

  for (const w of words) {
    const v = NUMBER_WORDS[w.toLowerCase()];
    if (v === undefined) continue;
    sawAny = true;
    if (v < 100) {
      current += v;
    } else if (v === 100) {
      current = (current === 0 ? 1 : current) * v;
    } else {
      current = (current === 0 ? 1 : current) * v;
      total += current;
      current = 0;
    }
  }

  return sawAny ? total + current : null;
}

interface AmountCandidate {
  value: number;
  start: number;
  end: number;
  before?: string;
  after?: string;
}

/** Detect an explicit "price per unit" pattern ("60 rupees per litre") combined
 * with a separate quantity ("sold 20 litres") and return price × quantity.
 * This covers cases like "60 rupees per litre, sold 20 litres" → 1200. */
function tryComputeUnitPrice(lower: string): number | null {
  const unitList = UNIT_WORDS.join('|');
  const currency = '(?:rupees|rupee|rs|రూపాయలు|రూపాయి|రూ|रुपये|रुपया|रु)?';
  const per = '(?:per|ప్రతి|प्रति)';
  const perMatch = lower.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${currency}\\s*${per}\\s*(${unitList})`)
  );
  if (!perMatch) return null;

  const price = parseFloat(perMatch[1]);
  const unitWord = perMatch[2];

  // Find a separate quantity near the same unit word elsewhere in the text.
  const unitRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitWord}`, 'g');
  let mm: RegExpExecArray | null;
  const quantities: number[] = [];
  while ((mm = unitRegex.exec(lower)) !== null) {
    const qty = parseFloat(mm[1]);
    if (qty !== price) quantities.push(qty);
  }

  if (quantities.length === 1) {
    const product = price * quantities[0];
    if (product > 0 && Number.isFinite(product)) return product;
  }
  return null;
}

interface ResolvedAmount {
  amount?: number;
  isAmbiguous: boolean;
}

/**
 * Extracts the transaction amount from a spoken/typed transcript:
 * 1. Prefers numbers adjacent to currency/total keywords.
 * 2. Handles spoken number words ("five hundred", "पाँच सौ", "రెండు వేలు").
 * 3. Handles "price per unit" sentences ("60 rupees per litre, sold 20 litres").
 * 4. Falls back to the largest number when nothing better is available.
 */
function resolveAmount(transcript: string): ResolvedAmount {
  const lower = transcript.toLowerCase().trim();
  if (!lower) return { isAmbiguous: false };

  const tokenPattern = /\d+(?:\.\d+)?|[^\s.,₹-]+/g;
  const tokens: { text: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(lower)) !== null) {
    tokens.push({ text: m[0], start: m.index });
  }
  if (tokens.length === 0) return { isAmbiguous: false };

  const candidates: AmountCandidate[] = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (/^\d+(?:\.\d+)?$/.test(tok.text)) {
      const value = parseFloat(tok.text);
      let amount = value;
      let endIdx = i;
      // "20 thousand" → 20000
      if (i + 1 < tokens.length && SCALE_WORDS.includes(tokens[i + 1].text)) {
        amount = value * NUMBER_WORDS[tokens[i + 1].text];
        endIdx = i + 1;
      }
      candidates.push({
        value: amount,
        start: tok.start,
        end: tokens[endIdx].start + tokens[endIdx].text.length,
        before: i > 0 ? tokens[i - 1].text : undefined,
        after: endIdx + 1 < tokens.length ? tokens[endIdx + 1].text : undefined,
      });
      i = endIdx + 1;
      continue;
    }

    const isNumberWord = NUMBER_WORDS[tok.text] !== undefined;
    if (isNumberWord) {
      let j = i;
      while (j < tokens.length && NUMBER_WORDS[tokens[j].text] !== undefined) j++;
      const phrase = tokens.slice(i, j).map((t) => t.text);
      const num = wordsToNum(phrase);
      if (num !== null && num > 0) {
        candidates.push({
          value: num,
          start: tok.start,
          end: tokens[j - 1].start + tokens[j - 1].text.length,
          before: i > 0 ? tokens[i - 1].text : undefined,
          after: j < tokens.length ? tokens[j].text : undefined,
        });
      }
      i = j;
      continue;
    }

    i++;
  }

  if (candidates.length === 0) return { isAmbiguous: false };

  // Most specific rule first: an explicit "price per unit" sentence.
  const unitPrice = tryComputeUnitPrice(lower);
  if (unitPrice !== null) {
    return { amount: unitPrice, isAmbiguous: false };
  }

  const isQualified = (c: AmountCandidate) =>
    (c.before !== undefined && CURRENCY_KEYWORDS.includes(c.before)) ||
    (c.after !== undefined && CURRENCY_KEYWORDS.includes(c.after));

  const qualified = candidates.filter((c) => isQualified(c));

  if (qualified.length === 1) {
    return { amount: Math.max(0, qualified[0].value), isAmbiguous: false };
  }
  if (qualified.length > 1) {
    // Genuinely ambiguous (e.g. "spent 400 on feed, 600 on transport") — flag
    // it so the Gemini-based parser is consulted before trusting the max.
    return { amount: Math.max(0, ...qualified.map((c) => c.value)), isAmbiguous: true };
  }

  return { amount: Math.max(0, ...candidates.map((c) => c.value)), isAmbiguous: false };
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
    'paid', 'bill', 'electricity', 'power',
    'ఖర్చు', 'కొనుగోలు', 'దాణా', 'ఎరువులు', 'విత్తనాలు', 'డీజిల్', 'రవాణా', 'కూలీ',
    'మందులు', 'అద్దె', 'వ్యయం', 'కరెంట్', 'బిల్లు', 'చెల్లించిన',
    'खर्च', 'खरीदा', 'चारा', 'खाद', 'बीज', 'डीजल', 'किराया', 'मजदूरी', 'दवाई',
    'दिया', 'दिए', 'बिजली', 'बिल',
  ];

  const hasExpenseKeyword = expenseKeywords.some((kw) => lower.includes(kw));
  if (hasExpenseKeyword) {
    type = 'expense';
    // Most specific categories are checked first so a sentence that mentions
    // several things doesn't always collapse to the generic "Feed / Supplies".
    if (
      lower.includes('vet') || lower.includes('medicine') ||
      lower.includes('మందులు') || lower.includes('दवाई')
    ) {
      category = 'Veterinary';
    } else if (
      lower.includes('seeds') || lower.includes('material') ||
      lower.includes('విత్తనాలు') || lower.includes('ముడిసరుకు') || lower.includes('बीज')
    ) {
      category = 'Raw Material';
    } else if (
      lower.includes('labor') || lower.includes('wage') ||
      lower.includes('కూలీ') || lower.includes('मजदूरी')
    ) {
      category = 'Wages';
    } else if (
      lower.includes('transport') || lower.includes('diesel') || lower.includes('petrol') ||
      lower.includes('రవాణా') || lower.includes('డీజిల్') || lower.includes('किराया')
    ) {
      category = 'Transport';
    } else if (
      lower.includes('rent') || lower.includes('power') || lower.includes('electricity') ||
      lower.includes('అద్దె') || lower.includes('కరెంట్') || lower.includes('बिजली')
    ) {
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

  const resolved = resolveAmount(transcript);

  return {
    amount: resolved.amount,
    type,
    category,
    note: transcript,
    isAmbiguous: resolved.isAmbiguous,
    confidence: resolved.amount ? 0.95 : 0.75,
    parseMessage: !resolved.amount
      ? "Couldn't quite catch that — please try again or enter it manually."
      : undefined,
  };
}

export async function parseSpokenTransactionWithFallback(
  transcript: string,
  language: VoiceLanguage
): Promise<SpokenTransactionResult> {
  const localParsed = parseSpokenTransaction(transcript);

  // Consult the AI parser when the local parser found nothing at all, or when
  // its answer is genuinely ambiguous (multiple candidates near keywords).
  if (localParsed.amount && !localParsed.isAmbiguous) {
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
      const extracted = data?.extracted;
      if (data && extracted && extracted.amount) {
        return {
          amount: extracted.amount,
          type: extracted.type === 'expense' ? 'expense' : 'income',
          category: extracted.category || localParsed.category || 'Sales',
          note: extracted.note || transcript,
          confidence: 0.9,
          parseMessage: undefined,
        };
      }
    }
  } catch (e) {
    console.warn('[Voice Parser] Gemini parse fallback failed:', e);
  }

  return localParsed;
}