import { NextRequest, NextResponse } from 'next/server';
import { generateRiskExplanation } from '@/lib/ai/provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { risk, businessName, language } = body;

    if (!risk) {
      return NextResponse.json({ error: 'Risk object is required' }, { status: 400 });
    }

    const explanation = await generateRiskExplanation({
      risk,
      businessName,
      language: language === 'te' ? 'te' : 'en',
    });

    return NextResponse.json(explanation);
  } catch (error: any) {
    console.error('API Error /api/ai/risk-explanation:', error);
    return NextResponse.json(
      {
        error: 'Risk explanation is temporarily unavailable.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
