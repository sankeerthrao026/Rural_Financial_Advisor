import { NextRequest, NextResponse } from 'next/server';
import { generateBusinessAnalysis } from '@/lib/ai/provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, category, marginCapital, language, userQuery, history } = body;

    if (!location || !category) {
      return NextResponse.json(
        { error: 'Location and Category are required' },
        { status: 400 }
      );
    }

    const result = await generateBusinessAnalysis({
      location,
      category,
      marginCapital: Number(marginCapital) || 100000,
      language: language === 'te' ? 'te' : 'en',
      userQuery: typeof userQuery === 'string' ? userQuery : undefined,
      history: Array.isArray(history) ? history : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error /api/ai/business-advisor:', error);
    return NextResponse.json(
      {
        error: 'AI advisory is temporarily unavailable. Financial calculations remain available.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
