import { NextRequest, NextResponse } from 'next/server';
import { callGeminiApi } from '@/lib/ai/gemini';

async function transcribeWithBase64(audioBase64: string, mimeType: string, language: string) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api$/, '') || 'http://127.0.0.1:8000';

  // 1. Try FastAPI STT Backend first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const backendRes = await fetch(`${backendBaseUrl}/api/voice/transcribe-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.success) {
        return { success: true, ...data };
      }
    }
  } catch (backendErr) {
    console.warn('[Voice STT] FastAPI STT endpoint unreachable, using Next.js direct Gemini transcription:', backendErr);
  }

  // 2. Fallback: Direct Next.js Gemini Multimodal Audio Transcription
  if (process.env.GEMINI_API_KEY) {
    const langName = language === 'te' ? 'Telugu (తెలుగు)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'Indian English';
    const prompt = `Transcribe the speech in this audio accurately. The speaker is speaking in ${langName} (or a mix of Indian languages).
Extract any business transaction mentioned.
Return JSON:
{
  "transcript": "exact spoken words",
  "structured": {
    "amount": number or null,
    "type": "income" or "expense",
    "category": "string",
    "note": "string"
  }
}`;

    const geminiRes = await callGeminiApi({
      userPrompt: prompt,
      audioInline: {
        mimeType,
        dataBase64: audioBase64,
      },
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    if (geminiRes.success && geminiRes.text) {
      const rawText = geminiRes.text.trim();
      try {
        const cleanText = rawText.replace(/```(?:json)?/g, '').trim();
        const parsed = JSON.parse(cleanText);
        return {
          success: true,
          transcript: parsed.transcript || '',
          structured: parsed.structured || null,
          provider: `Google Gemini Multimodal (${geminiRes.model})`,
        };
      } catch (parseErr) {
        return {
          success: true,
          transcript: rawText,
          structured: null,
          provider: `Google Gemini Multimodal (${geminiRes.model})`,
        };
      }
    }
  }

  return {
    success: false,
    transcript: '',
    error: 'Audio STT fallback requires GEMINI_API_KEY or FastAPI server running.',
  };
}

/**
 * Accepts both:
 *  - multipart/form-data  →  audio blob + language  (used by the browser MediaRecorder fallback)
 *  - application/json     →  { audioBase64, mimeType, language }
 * Both paths normalize to base64 and share a single transcription pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const audioFile = formData.get('audio');
      const language = (formData.get('language') as string) || 'en';

      if (!audioFile || typeof audioFile === 'string') {
        return NextResponse.json({ error: 'audio blob is required in form-data' }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const mimeType = audioFile.type || 'audio/webm';
      const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

      const result = await transcribeWithBase64(audioBase64, mimeType, language);
      return NextResponse.json(result);
    }

    const body = await request.json();
    const { audioBase64, mimeType = 'audio/webm', language = 'en' } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'audioBase64 is required' }, { status: 400 });
    }

    const result = await transcribeWithBase64(audioBase64, mimeType, language);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/voice/transcribe:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process audio' }, { status: 500 });
  }
}