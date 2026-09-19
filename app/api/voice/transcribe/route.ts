import { NextRequest, NextResponse } from 'next/server';
import { callGeminiApi } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioBase64, mimeType = 'audio/webm', language = 'en' } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'audioBase64 is required' }, { status: 400 });
    }

    const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

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
          return NextResponse.json(data);
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
        try {
          const cleanText = geminiRes.text.replace(/```(?:json)?/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return NextResponse.json({
            success: true,
            transcript: parsed.transcript || '',
            structured: parsed.structured || null,
            provider: `Google Gemini Multimodal (${geminiRes.model})`,
          });
        } catch (parseErr) {
          return NextResponse.json({
            success: true,
            transcript: geminiRes.text.trim(),
            structured: null,
            provider: `Google Gemini Multimodal (${geminiRes.model})`,
          });
        }
      }
    }

    return NextResponse.json({
      success: false,
      transcript: '',
      error: 'Audio STT fallback requires GEMINI_API_KEY or FastAPI server running.',
    });
  } catch (error: any) {
    console.error('Error in /api/voice/transcribe:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process audio' }, { status: 500 });
  }
}
