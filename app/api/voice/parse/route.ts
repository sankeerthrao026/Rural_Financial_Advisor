import { NextRequest, NextResponse } from 'next/server';
import { callGeminiApi } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, language } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript string is required' }, { status: 400 });
    }

    const langName = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English';

    const systemPrompt = `You are the RuralCred Advisor multilingual data extractor.
The user spoke a sentence in ${langName} (or a mixture of Indian English, Telugu, or Hindi) to record a transaction in their business digital logbook.
Extract the transaction details into clean JSON.
Follow these rules:
1. "amount": integer or float (e.g. "five hundred" -> 500, "రెండు వేలు" -> 2000, "पाँच सौ" -> 500, "1500" -> 1500). If no amount is mentioned, set to null.
2. "type": "income" if money is earned, received, or products/produce sold. "expense" if money is paid, spent, feed/material purchased, rent, wages, or supplies.
3. "category": a standard business category (e.g. "Sales", "Cooperative Payout", "Feed / Supplies", "Raw Material", "Transport", "Wages", "Rent & Power", "Other").
4. "note": concise, clean description of the item or action (e.g. "Sold 20L milk to dairy", "Purchased cattle feed", "Paid shop electricity").
5. Output ONLY valid JSON:
{
  "amount": number | null,
  "type": "income" | "expense",
  "category": string,
  "note": string,
  "confidence": number (between 0 and 1)
}`;

    const userPrompt = `Spoken transcript: "${transcript}"`;

    if (process.env.GEMINI_API_KEY) {
      const geminiRes = await callGeminiApi({
        systemInstruction: systemPrompt,
        userPrompt,
        responseMimeType: 'application/json',
        temperature: 0.1,
      });

      if (geminiRes.success && geminiRes.text) {
        try {
          const cleanText = geminiRes.text.replace(/```(?:json)?/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return NextResponse.json({
            success: true,
            extracted: parsed,
            source: `Gemini (${geminiRes.model})`,
          });
        } catch (parseErr) {
          console.warn('[Voice AI Parser] Failed to parse Gemini response as JSON:', parseErr);
        }
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Gemini extraction unavailable; check GEMINI_API_KEY.',
    });
  } catch (error: any) {
    console.error('Error in /api/voice/parse:', error);
    return NextResponse.json({ error: error?.message || 'Failed to parse voice transcript' }, { status: 500 });
  }
}
