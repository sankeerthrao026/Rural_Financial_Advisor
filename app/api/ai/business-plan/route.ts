import { NextRequest, NextResponse } from 'next/server';
import { generateUnifiedBusinessPlan, BusinessPlanRequest } from '@/lib/finance/plan';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      location,
      category,
      businessName,
      entrepreneurName,
      gender,
      socialCategory,
      isNewEnterprise,
      marginCapital,
      loanAmount,
      projectCost,
      selectedSchemeId,
      monthlyRevenueEstimate,
      monthlyExpenseEstimate,
      businessAdvisorSummary,
      finance,
      advisor,
      language,
    } = body;

    const resolvedMargin = marginCapital || (finance?.marginCapital ?? 100000);
    const resolvedProjectCost = projectCost || (finance?.projectCost ?? resolvedMargin / 0.1);
    const resolvedLoanAmount = loanAmount || (finance?.loanAmount ?? resolvedProjectCost - resolvedMargin);

    const planReq: BusinessPlanRequest = {
      entrepreneurName: entrepreneurName || 'Rural Entrepreneur',
      businessName: businessName || 'Rural Micro Enterprise',
      location: location || 'Warangal, Telangana',
      category: category || 'Dairy Farming',
      gender: gender || 'female',
      socialCategory: socialCategory || 'OBC',
      isNewEnterprise: isNewEnterprise ?? true,
      marginCapital: resolvedMargin,
      loanAmount: resolvedLoanAmount,
      projectCost: resolvedProjectCost,
      selectedSchemeId: selectedSchemeId || (finance?.scheme?.id ?? undefined),
      monthlyRevenueEstimate,
      monthlyExpenseEstimate,
      businessAdvisorSummary: businessAdvisorSummary || advisor?.marketReach?.headline,
      language: language === 'te' ? 'te' : 'en',
    };

    // Try FastAPI Backend
    const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://127.0.0.1:8000';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const backendRes = await fetch(`${backendUrl}/api/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planReq),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch (backendErr) {
      console.warn('FastAPI backend /api/plan/generate unreachable, using local synthesis:', backendErr);
    }

    // Local deterministic synthesis fallback
    const localPlan = generateUnifiedBusinessPlan(planReq);
    return NextResponse.json(localPlan);
  } catch (error: any) {
    console.error('API Error /api/ai/business-plan:', error);
    return NextResponse.json(
      {
        error: 'Business plan synthesis encountered an error.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
