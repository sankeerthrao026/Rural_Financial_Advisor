import { NextRequest, NextResponse } from 'next/server';
import { callGeminiApi } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ocrText, imageBase64, mimeType = 'image/jpeg', language = 'en' } = body;

    if (!ocrText && !imageBase64) {
      return NextResponse.json({ error: 'ocrText or imageBase64 is required' }, { status: 400 });
    }

    const langDesc = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English / Indian languages';

    const systemPrompt = `You are the RuralCred Advisor intelligent receipt and ledger parser.
Your job is to parse raw OCR text or receipt images from rural Indian enterprises (shops, dairy farmers, weavers, farmers, poultry units).
The text may be in English, Telugu, or Hindi, or a mixture of scripts and numerals.

Determine if this is:
1. "single_slip": A single invoice, receipt, mandi slip, milk collection slip, or bill.
2. "multi_entry_ledger": A handwritten or printed paper ledger page containing multiple transaction rows (e.g. Date | Particulars | Debit/Credit | Balance).

STRICT EXTRACTION RULES:
- Never pick a phone number (10 digits starting with 6, 7, 8, 9), GSTIN, or PIN code as the total amount.
- Look for keywords like "Total", "Grand Total", "Amount", "మొత్తం", "ఖర్చు", "బిల్లు", "कुल", "योग", "राशि".
- Dates should be converted to YYYY-MM-DD. If year is missing, assume current year (2026).
- For type, mark as "income" if money is received, sold, credited, or cooperative payout. Mark as "expense" if purchased, paid, debited, or bill.
- Assign standard categories: "Sales", "Cooperative Payout", "Feed / Supplies", "Raw Material", "Veterinary", "Wages", "Transport", "Rent & Power", "Other".

Output strictly valid JSON with this structure:
{
  "mode": "single_slip" or "multi_entry_ledger",
  "singleSlip": {
    "vendor": "string (shop or entity name)",
    "date": "YYYY-MM-DD",
    "totalAmount": number or null,
    "type": "income" or "expense",
    "category": "string",
    "note": "string summary",
    "lineItems": [
      { "description": "string", "amount": number }
    ]
  },
  "ledgerRows": [
    {
      "date": "YYYY-MM-DD",
      "note": "string description",
      "amount": number,
      "type": "income" or "expense",
      "category": "string"
    }
  ],
  "confidence": number between 0 and 1
}`;

    const userPrompt = `Language hint: ${langDesc}.
RAW OCR TEXT:
"""
${ocrText || '(See attached image)'}
"""`;

    if (process.env.GEMINI_API_KEY) {
      const geminiParams: any = {
        systemInstruction: systemPrompt,
        userPrompt,
        responseMimeType: 'application/json',
        temperature: 0.1,
      };

      if (imageBase64) {
        geminiParams.audioInline = undefined;
        // If imageBase64 is provided, pass via parts in callGeminiApi
        let cleanB64 = imageBase64;
        if (cleanB64.includes(',')) {
          cleanB64 = cleanB64.split(',')[1];
        }
        geminiParams.audioInline = {
          mimeType,
          dataBase64: cleanB64,
        };
      }

      const res = await callGeminiApi(geminiParams);

      if (res.success && res.text) {
        try {
          const cleanJson = res.text.replace(/```(?:json)?/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return NextResponse.json({
            success: true,
            data: parsed,
            source: `Gemini (${res.model})`,
          });
        } catch (parseErr) {
          console.warn('[OCR AI Parser] Failed to parse Gemini response as JSON:', parseErr);
        }
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Gemini extraction unavailable; check GEMINI_API_KEY.',
    });
  } catch (error: any) {
    console.error('Error in /api/ai/ocr-parse:', error);
    return NextResponse.json({ error: error?.message || 'Failed to parse OCR text' }, { status: 500 });
  }
}
