import { NextRequest, NextResponse } from 'next/server';
import { generateBusinessPlan } from '@/lib/ai/provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, category, businessName, finance, advisor, language } = body;

    if (!location || !finance) {
      return NextResponse.json({ error: 'Finance and location details required' }, { status: 400 });
    }

    const plan = await generateBusinessPlan({
      location,
      category,
      businessName: businessName || 'Rural Micro Enterprise',
      finance,
      advisor,
      language: language === 'te' ? 'te' : 'en',
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('API Error /api/ai/business-plan:', error);
    return NextResponse.json(
      {
        error: 'Business plan synthesis is temporarily unavailable.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
