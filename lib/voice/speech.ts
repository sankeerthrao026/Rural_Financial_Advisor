/**
 * Web Speech API Abstraction for RuralCred Advisor.
 * Supports SpeechRecognition (STT) and SpeechSynthesis (TTS) in English (en-IN) and Telugu (te-IN).
 */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function startSpeechListening(options: {
  language: 'en' | 'te';
  onResult: (transcript: string) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
}): { stop: () => void } | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError?.(new Error('Speech recognition not supported in this browser'));
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = options.language === 'te' ? 'te-IN' : 'en-IN';

  recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    options.onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    options.onError?.(event.error);
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
  };
}

export function speakText(text: string, language: 'en' | 'te') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('TTS playback error:', e);
  }
}

/**
 * Intelligent parser to extract amount, type, and note from spoken English or Telugu phrases.
 * Example: "Sold milk for 1500 rupees" -> amount: 1500, type: 'income', note: 'Sold milk'
 * Example: "ఖర్చు 500 దాణా కోసం" -> amount: 500, type: 'expense', note: 'దాణా కోసం'
 */
export function parseSpokenTransaction(transcript: string): {
  amount?: number;
  type: 'income' | 'expense';
  note: string;
} {
  const lower = transcript.toLowerCase();

  // Determine Type
  let type: 'income' | 'expense' = 'income';
  if (
    lower.includes('expense') ||
    lower.includes('spent') ||
    lower.includes('bought') ||
    lower.includes('purchase') ||
    lower.includes('feed') ||
    lower.includes('fertilizer') ||
    lower.includes('ఖర్చు') ||
    lower.includes('కొనుగోలు')
  ) {
    type = 'expense';
  }

  // Extract numbers
  const match = transcript.match(/\d+([,\.]\d+)?/g);
  let amount: number | undefined;
  if (match && match.length > 0) {
    amount = parseFloat(match[0].replace(/,/g, ''));
  }

  return {
    amount,
    type,
    note: transcript,
  };
}
