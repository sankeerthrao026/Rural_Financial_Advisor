import { NextRequest, NextResponse } from 'next/server';
import { apiClient, FinanceAdviceRequest, FinanceAdviceResponse } from '@/lib/api/client';
import { callGeminiApi } from '@/lib/ai/gemini';
import {
  buildNormalizedFinancialContext,
  classifyFinancialQueryIntent,
  performQuestionSpecificCalculations,
  buildDynamicAdvisorPrompt,
} from '@/lib/finance/advisor-pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinanceAdviceRequest;
    const {
      marginCapital,
      loanAmount,
      projectCost,
      quarterlyEmi,
      category,
      gender,
      socialCategory,
      location,
      workingCapitalRatio,
      userQuery,
      history,
      language,
      profile: userProfile,
      logbookEntries,
      khataEntries,
      aggregates,
    } = body;

    const lang: 'en' | 'te' = language === 'te' ? 'te' : 'en';
    const isTe = lang === 'te';

    // 1. Attempt call to FastAPI backend /finance/advisor-chat
    try {
      const apiResult = await apiClient.consultFinanceAdvisor({
        marginCapital: Number(marginCapital) || (userProfile?.marginCapital ? Number(userProfile.marginCapital) : 100000),
        loanAmount: Number(loanAmount) || 900000,
        projectCost: Number(projectCost) || 1000000,
        quarterlyEmi: Number(quarterlyEmi) || 42000,
        category: category || userProfile?.category || 'Dairy Farming',
        gender: gender || userProfile?.gender || 'female',
        socialCategory: socialCategory || userProfile?.socialCategory || 'OBC',
        location: location || userProfile?.location || 'Warangal, Telangana',
        workingCapitalRatio: typeof workingCapitalRatio === 'number' ? workingCapitalRatio : undefined,
        userQuery: typeof userQuery === 'string' ? userQuery : undefined,
        history: Array.isArray(history) ? history : undefined,
        language: lang,
        profile: userProfile,
        logbookEntries,
        khataEntries,
        aggregates,
      });

      if (apiResult.success && apiResult.data) {
        return NextResponse.json(apiResult.data);
      }
    } catch (apiErr) {
      console.warn('[FinanceAdvisor Route] FastAPI backend unreachable, using Next.js Gemini/Grounded pipeline:', apiErr);
    }

    // 2. Build Structured Normalized User Financial Context
    const context = buildNormalizedFinancialContext({
      profile: {
        name: userProfile?.name || 'Anita Sharma',
        businessName: userProfile?.businessName,
        location: location || userProfile?.location,
        category: category || userProfile?.category,
        marginCapital: Number(marginCapital) || userProfile?.marginCapital,
        gender: gender || userProfile?.gender,
        socialCategory: socialCategory || userProfile?.socialCategory,
        hasActiveLoan: userProfile?.hasActiveLoan,
        simulatingSecondLoan: userProfile?.simulatingSecondLoan,
      },
      loanState: {
        marginCapital: Number(marginCapital) || 100000,
        loanAmount: Number(loanAmount) || 900000,
        projectCost: Number(projectCost) || 1000000,
        quarterlyEmi: Number(quarterlyEmi) || 42000,
        workingCapitalRatio: typeof workingCapitalRatio === 'number' ? workingCapitalRatio : undefined,
      },
      logbookEntries,
      khataEntries,
      aggregates,
      userQuery,
      history,
      language: lang,
    });

    let replyText = '';
    let providerUsed = 'Grounded Financial Calculation Engine';

    // 3. Question / Intent Understanding & Calculations
    if (userQuery && userQuery.trim()) {
      const intentResult = classifyFinancialQueryIntent(userQuery);
      const calcResult = performQuestionSpecificCalculations(context, intentResult);

      if (process.env.GEMINI_API_KEY) {
        const { systemPrompt, userPrompt } = buildDynamicAdvisorPrompt(
          context,
          intentResult,
          calcResult,
          lang,
          history
        );

        try {
          const geminiResult = await callGeminiApi({
            systemInstruction: systemPrompt,
            userPrompt,
            temperature: 0.2,
          });

          if (geminiResult.success && geminiResult.text?.trim()) {
            replyText = geminiResult.text.trim();
            providerUsed = `Google Gemini (${geminiResult.model})`;
          }
        } catch (geminiErr) {
          console.warn('[FinanceAdvisor Route] Gemini call failed, falling back to verified calculations synthesizer:', geminiErr);
        }
      }

      // 4. Grounded Contextual Fallback (using exact computed user values)
      if (!replyText) {
        replyText = isTe ? calcResult.summaryTe : calcResult.summary;
      }
    } else {
      // Default Welcome Overview for this specific user
      replyText = isTe
        ? `నమస్కారం ${context.profile.name} గారు! మీ ${context.profile.businessType} వ్యాపారం కోసం వ్యక్తిగతీకరించిన ఆర్థిక విశ్లేషణ సిద్ధంగా ఉంది. మీ ₹${context.profile.availableCapital.toLocaleString('en-IN')} పెట్టుబడికి ₹${context.loan.loanAmount.toLocaleString('en-IN')} రుణ సదుపాయం (త్రైమాసిక వాయిదా: ₹${context.loan.quarterlyEmi.toLocaleString('en-IN')}) కేటాయించబడింది. మీ నెలవారీ నికర మిగులు ₹${context.calculations.monthlyProfit.toLocaleString('en-IN')} ఆధారంగా మీరు రుణాన్ని సురక్షితంగా నిర్వహించవచ్చు. ప్రభుత్వ పథకాలు, సబ్సిడీలు లేదా పొదుపు ప్రణాళిక గురించి ఏదైనా అడగండి.`
        : `Welcome ${context.profile.name}! Your personalized financial plan for ${context.profile.businessType} in ${context.profile.location} is ready. With ₹${context.profile.availableCapital.toLocaleString('en-IN')} promoter equity, your structured institutional credit is ₹${context.loan.loanAmount.toLocaleString('en-IN')} with quarterly repayments of ₹${context.loan.quarterlyEmi.toLocaleString('en-IN')}. Supported by your ₹${context.calculations.monthlyProfit.toLocaleString('en-IN')} monthly net cash surplus, your debt-service coverage ratio is a healthy ${context.calculations.debtServiceCoverageRatio}x. Ask about government subsidies, loan affordability, unit targets, or savings.`;
    }

    // Format legacy schema properties for UI cards
    const legacySchemes = context.schemes.slice(0, 3).map((s) => ({
      id: s.schemeId,
      name: s.schemeName,
      nameTe: s.schemeNameTe,
      agency: s.agency,
      maxAmount: s.maxEligibleLoan,
      subsidyOrConcession: s.benefits.join(', '),
      subsidyOrConcessionTe: s.benefitsTe.join(', '),
      whyRecommended: s.isEligible ? s.guaranteeCoverage : (s.ineligibilityReason || ''),
      whyRecommendedTe: s.isEligible ? s.guaranteeCoverageTe : (s.ineligibilityReason || ''),
      isTopMatch: Boolean(s.isTopMatch),
    }));

    const loanExplanation = isTe
      ? `మొత్తం ప్రాజెక్ట్ వ్యయం ₹${context.loan.projectCost.toLocaleString('en-IN')}. మీ పెట్టుబడి ₹${context.profile.availableCapital.toLocaleString('en-IN')} (10%) కాగా బ్యాంక్ రుణం ₹${context.loan.loanAmount.toLocaleString('en-IN')} (90%). త్రైమాసిక వాయిదా ₹${context.loan.quarterlyEmi.toLocaleString('en-IN')}.`
      : `Total project outlay is ₹${context.loan.projectCost.toLocaleString('en-IN')}, with ₹${context.profile.availableCapital.toLocaleString('en-IN')} promoter equity and ₹${context.loan.loanAmount.toLocaleString('en-IN')} bank loan. Scheduled quarterly repayment is ₹${context.loan.quarterlyEmi.toLocaleString('en-IN')}.`;

    const responsePayload: FinanceAdviceResponse = {
      reply: replyText,
      replyTe: isTe ? replyText : undefined,
      loanExplanation,
      loanExplanationTe: isTe ? loanExplanation : undefined,
      recommendedSchemes: legacySchemes,
      workingCapitalBreakdown: {
        workingCapitalPercent: context.loan.workingCapitalPercent,
        capexPercent: context.loan.capexPercent,
        workingCapitalAmount: context.loan.workingCapitalAmount,
        capexAmount: context.loan.capexAmount,
        workingCapitalUses: context.loan.workingCapitalUses,
        capexUses: context.loan.capexUses,
      },
      seasonalMoratoriumAdvice: {
        isSeasonal: true,
        businessType: context.profile.businessType,
        leanSeasonMonths: context.business.leanSeason,
        peakSeasonMonths: context.business.peakSeason,
        moratoriumQuartersRecommended: 1,
        guidance: context.business.moratoriumGuidance,
        guidanceTe: context.business.moratoriumGuidanceTe,
      },
      providerUsed,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('API Error /api/ai/finance-advisor:', error);
    return NextResponse.json(
      {
        error: 'Finance advisory error',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
