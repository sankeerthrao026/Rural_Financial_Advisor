import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';
import { calculateAllEligibleSchemes, SchemeEligibilityInput } from '@/lib/finance/schemes';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SchemeEligibilityInput;

    // 1. Try FastAPI backend
    const apiRes = await apiClient.calculateSchemes(body);
    if (apiRes.success && apiRes.data && apiRes.data.length > 0) {
      return NextResponse.json(apiRes.data);
    }

    // 2. Fallback to pure local deterministic calculation engine
    const localSchemes = calculateAllEligibleSchemes({
      loanAmount: Number(body.loanAmount) || 100000,
      category: body.category || 'Dairy Farming',
      gender: body.gender || 'female',
      socialCategory: body.socialCategory || 'General',
      locationType: body.locationType || 'rural',
      isNewEnterprise: body.isNewEnterprise ?? true,
      isArtisanTrade: body.isArtisanTrade,
    });

    return NextResponse.json(localSchemes);
  } catch (error: any) {
    console.error('Error in /api/finance/schemes:', error);
    return NextResponse.json(
      { error: 'Scheme calculation error', details: error?.message },
      { status: 500 }
    );
  }
}
