/**
 * RuralCred Advisor — Unified Multilingual Voice Engine (STT & TTS).
 * Supports English (en-IN), Telugu (te-IN), and Hindi (hi-IN).
 * 
 * Features:
 * 1. Runtime detection of browser Web Speech API.
 * 2. Resilient fallback recording (MediaRecorder) sending audio to /api/voice/transcribe (Gemini / Whisper) for unsupported browsers (Safari, Firefox).
 * 3. Flexible local natural language transaction parser supporting spoken word numbers in all 3 languages.
 * 4. Gemini AI fallback pipeline to reliably parse complex natural speech phrases.
 * 5. Speech synthesis (TTS) in en-IN, te-IN, and hi-IN.
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

/**
 * Returns BCP-47 language tag for speech recognition and synthesis.
 */
export function getLanguageCode(lang: VoiceLanguage): string {
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
 * Web Speech API live listener.
 */
export function startSpeechListening(options: {
  language: VoiceLanguage;
  onResult: (transcript: string) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
  onInterim?: (interim: string) => void;
}): { stop: () => void; abort: () => void } | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError?.(new Error('Speech recognition not supported in this browser'));
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = false;
  recognition.interimResults = Boolean(options.onInterim);
  recognition.lang = getLanguageCode(options.language);

  recognition.onresult = (event: any) => {
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const transcript = event.results[i][0].transcript || '';
        options.onResult(transcript);
      } else {
        interimText += event.results[i][0].transcript;
      }
    }
    if (interimText && options.onInterim) {
      options.onInterim(interimText);
    }
  };

  recognition.onerror = (event: any) => {
    options.onError?.(event.error || event);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    options.onError?.(err);
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

/**
 * Fallback audio recorder for browsers without Web Speech API.
 * Uses MediaRecorder to capture audio and sends it to the /api/voice/transcribe endpoint.
 */
export async function startAudioRecordingFallback(options: {
  language: VoiceLanguage;
  onProcessing?: () => void;
  onResult: (transcript: string, structured?: any) => void;
  onError: (error: any) => void;
}): Promise<{ stop: () => void }> {
  if (!isMediaRecordingSupported()) {
    options.onError(new Error('Microphone audio recording is not supported in this browser.'));
    return { stop: () => {} };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: any) {
    options.onError(new Error(err.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Unable to access microphone.'));
    return { stop: () => {} };
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : 'audio/webm';

  const mediaRecorder = new MediaRecorder(stream, { mimeType });
  const audioChunks: Blob[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    // Release mic stream tracks
    stream.getTracks().forEach((track) => track.stop());
    options.onProcessing?.();

    try {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType,
              language: options.language,
            }),
          });

          if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
          }

          const data = await res.json();
          if (data.success && data.transcript) {
            options.onResult(data.transcript, data.structured);
          } else {
            options.onError(new Error(data.error || 'Audio transcription returned no text.'));
          }
        } catch (postErr: any) {
          options.onError(new Error(`Failed to transcribe audio: ${postErr?.message || postErr}`));
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (err: any) {
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

/**
 * Text to speech playback in en-IN, te-IN, or hi-IN.
 */
export function speakText(text: string, language: VoiceLanguage) {
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

/**
 * Spoken number words mapping in English, Telugu, and Hindi.
 */
const SPOKEN_NUMBERS: Record<string, number> = {
  // English
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lac': 100000, 'crore': 10000000,

  // Telugu
  'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'ఇరవై': 20, 'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50,
  'అరవై': 60, 'డెబ్బై': 70, 'ఎనభై': 80, 'తొంభై': 90,
  'వంద': 100, 'వందలు': 100, 'వెయ్యి': 1000, 'వేలు': 1000, 'లక్ష': 100000,

  // Hindi
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15,
  'सोलह': 16, 'सत्रह': 17, 'अट्ठारह': 18, 'उन्नीस': 19,
  'बीस': 20, 'पच्चीस': 25, 'तीस': 30, 'पैंतीस': 35, 'चालीस': 40,
  'पचास': 50, 'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
  'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 100000, 'करोड़': 10000000,
};

/**
 * Extracts number from natural speech including spoken words and digits.
 * e.g. "five hundred" -> 500, "2 thousand" -> 2000, "1500 రూపాయలు" -> 1500
 */
export function extractSpokenAmount(text: string): number | undefined {
  if (!text) return undefined;
  const clean = text.toLowerCase();

  // 1. First priority: Numbers explicitly accompanied by currency markers (rupees, ₹, rs, inr, రూపాయలు, रुपये, etc.)
  const currencyPattern = /(?:(?:₹|rs\.?|inr|for|price|rate|ధర|రూ\.?|రూపాయలు|ఖర్చు|వచ్చింది|रुपये|रुपया|दाम|मूल्य)\s*(\d+(?:[,\.]\d+)?)\s*(?:k|thousand|వేలు|हज़ार|हजार|lakh|లక్ష|लाख)?)|(?:(\d+(?:[,\.]\d+)?)\s*(?:k|thousand|వేలు|हज़ार|हजार|lakh|లక్ష|लाख)?\s*(?:₹|rs\.?|inr|rupees?|రూపాయలు|రూపాయి|రూ|रुपये|रुपया))/gi;
  let currencyMatch = currencyPattern.exec(clean);
  if (currencyMatch) {
    const rawVal = currencyMatch[1] || currencyMatch[2];
    if (rawVal) {
      let val = parseFloat(rawVal.replace(/,/g, ''));
      const fullSegment = currencyMatch[0].toLowerCase();
      if (fullSegment.includes('k') || fullSegment.includes('thousand') || fullSegment.includes('వేలు') || fullSegment.includes('हज़ार') || fullSegment.includes('हजार')) {
        val *= 1000;
      } else if (fullSegment.includes('lakh') || fullSegment.includes('లక్ష') || fullSegment.includes('लाख')) {
        val *= 100000;
      }
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // 2. Second priority: Digits that are NOT quantity measurements (ignore "20 litres", "2 bags", "5 kg")
  const nonQuantityMatches = [];
  const digitRegex = /(\d+(?:[,\.]\d+)?)\s*([a-zA-Z\u0C00-\u0C7F\u0900-\u097F]*)/g;
  let m;
  while ((m = digitRegex.exec(clean)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase().trim();
    const isQuantityUnit = /^(litres?|liters?|ltrs?|l|kg|kilos?|grams?|bags?|packets?|boxes?|లీటర్లు|కిలోలు|బస్తాలు|लीटर|किलो|बोरी)$/.test(unit);
    if (!isQuantityUnit && !isNaN(val) && val > 0) {
      nonQuantityMatches.push(val);
    }
  }
  if (nonQuantityMatches.length > 0) {
    // Return the last or largest monetary amount
    return nonQuantityMatches[nonQuantityMatches.length - 1];
  }

  // 3. Third priority: Multi-word compound spoken numbers: "five hundred", "paanch sau", "rendu vela", etc.
  const words = clean.split(/[\s,]+/);
  let total = 0;
  let currentGroup = 0;
  let foundAny = false;

  for (const w of words) {
    const num = SPOKEN_NUMBERS[w];
    if (num !== undefined) {
      foundAny = true;
      if (num === 100) {
        currentGroup = (currentGroup || 1) * 100;
      } else if (num === 1000 || num === 100000 || num === 10000000) {
        currentGroup = (currentGroup || 1) * num;
        total += currentGroup;
        currentGroup = 0;
      } else {
        currentGroup += num;
      }
    }
  }
  total += currentGroup;

  if (foundAny && total > 0) {
    return total;
  }

  return undefined;
}

export interface SpokenTransactionResult {
  amount?: number;
  type: 'income' | 'expense';
  category?: string;
  note: string;
  confidence: number;
}

/**
 * Fast structured rule-based parser that handles natural speech variations.
 */
export function parseSpokenTransaction(transcript: string): SpokenTransactionResult {
  const lower = transcript.toLowerCase();

  // 1. Extract Amount
  const amount = extractSpokenAmount(transcript);

  // 2. Flexible Type Determination
  const expenseKeywords = [
    'expense', 'spent', 'bought', 'buy', 'purchase', 'purchased', 'paid', 'cost',
    'feed', 'fertilizer', 'diesel', 'petrol', 'rent', 'salary', 'wages', 'electricity', 'bill',
    'ఖర్చు', 'కొన్నాను', 'కొనుగోలు', 'చెల్లించాను', 'దాణా', 'ఎరువులు', 'జీతం', 'అద్దె', 'కరెంట్',
    'खर्चा', 'खर्च', 'खरीदा', 'खरीद', 'दिया', 'चारा', 'खाद', 'वेतन', 'किराया', 'डीजल', 'बिजली', 'मजदूरी'
  ];

  const incomeKeywords = [
    'sold', 'sell', 'sale', 'income', 'received', 'got', 'earned', 'collection', 'payout', 'profit',
    'అమ్మకం', 'వచ్చింది', 'ఆదాయం', 'అమ్మాను', 'సేల్', 'లాభం', 'వసూలు',
    'बेचा', 'बिक्री', 'आया', 'कमाई', 'मिला', 'इनकम', 'प्राप्त', 'बिक्री से'
  ];

  let isExpense = expenseKeywords.some(k => lower.includes(k));
  let isIncome = incomeKeywords.some(k => lower.includes(k));

  let type: 'income' | 'expense' = 'income';
  if (isExpense && !isIncome) {
    type = 'expense';
  } else if (!isExpense && isIncome) {
    type = 'income';
  } else if (isExpense && isIncome) {
    // Both found: check which keyword appears first
    const firstExp = Math.min(...expenseKeywords.map(k => lower.indexOf(k)).filter(i => i !== -1));
    const firstInc = Math.min(...incomeKeywords.map(k => lower.indexOf(k)).filter(i => i !== -1));
    type = firstExp < firstInc ? 'expense' : 'income';
  }

  // 3. Category Inference
  let category: string | undefined;
  if (lower.includes('feed') || lower.includes('దాణా') || lower.includes('चारा')) {
    category = 'Feed / Supplies';
  } else if (lower.includes('fertilizer') || lower.includes('seeds') || lower.includes('raw') || lower.includes('ఎరువులు') || lower.includes('खाद')) {
    category = 'Raw Material';
  } else if (lower.includes('wage') || lower.includes('labor') || lower.includes('కూలీ') || lower.includes('मजदूरी')) {
    category = 'Wages';
  } else if (lower.includes('diesel') || lower.includes('transport') || lower.includes('రవాణా') || lower.includes('किराया')) {
    category = 'Transport';
  } else if (lower.includes('milk') || lower.includes('cow') || lower.includes('పాల') || lower.includes('दूध')) {
    category = type === 'income' ? 'Sales' : 'Feed / Supplies';
  } else if (type === 'income') {
    category = 'Sales';
  } else {
    category = 'Feed / Supplies';
  }

  // Calculate confidence
  let confidence = 0.5;
  if (amount) confidence += 0.3;
  if (isExpense || isIncome) confidence += 0.2;

  return {
    amount,
    type,
    category,
    note: transcript,
    confidence,
  };
}

/**
 * Intelligent transaction parser that first tries flexible local parsing,
 * and if uncertain (no amount extracted or confidence < 0.7), delegates to Gemini AI extraction.
 */
export async function parseSpokenTransactionWithFallback(
  transcript: string,
  language: VoiceLanguage = 'en'
): Promise<SpokenTransactionResult> {
  const localResult = parseSpokenTransaction(transcript);

  // If local parsing successfully found amount and determined type with high confidence, use it
  if (localResult.amount && localResult.confidence >= 0.75) {
    return localResult;
  }

  // Fallback to Gemini AI pipeline for natural variations, dialect nuances, and unstructured queries
  try {
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, language }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.extracted) {
        const ext = data.extracted;
        return {
          amount: ext.amount ?? localResult.amount,
          type: ext.type === 'expense' ? 'expense' : 'income',
          category: ext.category || localResult.category,
          note: ext.note || transcript,
          confidence: ext.confidence ?? 0.9,
        };
      }
    }
  } catch (aiErr) {
    console.warn('[Voice Pipeline] AI fallback parsing failed, using local rule result:', aiErr);
  }

  return localResult;
}
