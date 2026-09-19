import { NextRequest, NextResponse } from 'next/server';
import { apiClient, FinanceAdviceRequest, FinanceAdviceResponse } from '@/lib/api/client';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinanceAdviceRequest;
    const { marginCapital, loanAmount, projectCost, quarterlyEmi, category, gender, socialCategory, location, workingCapitalRatio, userQuery, history, language } = body;

    // 1. Attempt call to FastAPI backend /finance/advisor-chat
    const apiResult = await apiClient.consultFinanceAdvisor({
      marginCapital: Number(marginCapital) || 100000,
      loanAmount: Number(loanAmount) || 900000,
      projectCost: Number(projectCost) || 1000000,
      quarterlyEmi: Number(quarterlyEmi) || 42000,
      category: category || 'Dairy Farming',
      gender: gender || 'female',
      socialCategory: socialCategory || 'General',
      location: location || 'Warangal, Telangana',
      workingCapitalRatio: typeof workingCapitalRatio === 'number' ? workingCapitalRatio : undefined,
      userQuery: typeof userQuery === 'string' ? userQuery : undefined,
      history: Array.isArray(history) ? history : undefined,
      language: language === 'te' ? 'te' : 'en',
    });

    if (apiResult.success && apiResult.data) {
      return NextResponse.json(apiResult.data);
    }

    // 2. Resilient local fallback synthesizer if backend is unreachable
    const isTe = language === 'te';
    const isWoman = ['female', 'woman', 'f'].includes((gender || '').toLowerCase());
    const isScSt = ['SC', 'ST'].includes((socialCategory || '').toUpperCase());
    const isObc = (socialCategory || '').toUpperCase() === 'OBC';
    const cleanLoan = Number(loanAmount) || 900000;
    const catLower = (category || 'Dairy Farming').toLowerCase();

    // Working Capital vs Capex
    let defaultRatio = 0.5;
    let wcUses = ['Operational raw materials & consumables', 'Short-term liquidity & utility payments'];
    let capexUses = ['Machinery & commercial production fixtures', 'Transport/handling equipment'];

    if (catLower.includes('dairy') || catLower.includes('cattle')) {
      defaultRatio = 0.35;
      wcUses = ['High-protein cattle feed & dry fodder reserves', 'Veterinary care, vaccines & milk transport cans'];
      capexUses = ['High-yield Murrah buffaloes / dairy cows', 'Pucca cattle shed construction & bulk milk chiller'];
    } else if (catLower.includes('kirana') || catLower.includes('grocery')) {
      defaultRatio = 0.75;
      wcUses = ['FMCG wholesale stock & inventory replenishment', 'Bulk grains, pulses, spices & customer credit buffer'];
      capexUses = ['Commercial deep freezer & refrigeration', 'Modular steel racks, electronic scale & billing POS'];
    } else if (catLower.includes('weave') || catLower.includes('handloom')) {
      defaultRatio = 0.60;
      wcUses = ['Mulberry silk yarn, cotton yarn & metallic zari', 'Natural dyes, warp materials & weaver artisan wages'];
      capexUses = ['Fly-shuttle pit looms & electronic Jacquard box', 'Warping drum, creel stand & pirn winder'];
    }

    const ratio = typeof workingCapitalRatio === 'number' ? Math.max(0.05, Math.min(0.95, workingCapitalRatio)) : defaultRatio;
    const wcPercent = Math.round(ratio * 1000) / 10;
    const capexPercent = Math.round((100 - wcPercent) * 10) / 10;
    const wcAmount = Math.round(cleanLoan * (wcPercent / 100));
    const capexAmount = cleanLoan - wcAmount;

    // Seasonal Moratorium
    let isSeasonal = true;
    let leanSeason = 'April – June (Peak Summer Heat)';
    let peakSeason = 'August – January (Monsoon Flush)';
    let guidanceEn = 'In dairy farming, summer heat stress depresses milk yield by 20%–30%. We advise requesting a 1-quarter summer moratorium or interest-only period, accelerating principal repayment during the post-monsoon flush season.';
    let guidanceTe = 'పాడి పరిశ్రమలో వేసవి కాలంలో పాల దిగుబడి తగ్గుతుంది కాబట్టి 1 త్రైమాసికం మారటోరియం తీసుకుని, శీతాకాలంలో అసలు వేగంగా చెల్లించడం ఉత్తమం.';

    if (catLower.includes('kirana') || catLower.includes('grocery')) {
      leanSeason = 'July – August (Kharif Sowing Season)';
      peakSeason = 'October – January (Festive Harvest Surge)';
      guidanceEn = 'Rural grocery cash flows tighten during sowing months as farmers conserve cash for seeds. Request standard quarterly EMIs with working capital buffer before the festival season.';
      guidanceTe = 'ఖరీఫ్ విత్తనాల కాలంలో అరువులు పెరుగుతాయి కాబట్టి సాధారణ వాయిదాలు చెల్లించి, పండుగల ముందు వర్కింగ్ క్యాపిటల్ పెంచుకోండి.';
    } else if (catLower.includes('weave') || catLower.includes('handloom')) {
      leanSeason = 'June – August (Monsoon Humidity)';
      peakSeason = 'September – February (Wedding & Festival Season)';
      guidanceEn = 'Handloom drying slows during monsoon humidity. Structure a 1-quarter moratorium during monsoon, matching principal amortization with the wedding season.';
      guidanceTe = 'వర్షాకాలంలో అమ్మకాలు మందగిస్తాయి కాబట్టి 1 త్రైమాసిక మారటోరియం తీసుకుని, పెళ్లిళ్ల సీజన్లో అసలు చెల్లించండి.';
    }

    // Recommended Schemes
    const standUpWhy = isWoman
      ? "As a woman entrepreneur, you are legally prioritized under Stand-Up India's branch mandate for loans up to ₹1 Crore with concessional interest rates and lower margin money."
      : isScSt
      ? "As an SC/ST entrepreneur, every commercial bank branch has a mandatory credit target under Stand-Up India with concessional margin money."
      : "Eligible for greenfield enterprise expansion when partnering with qualifying women or SC/ST co-promoters.";

    const fallbackResponse: FinanceAdviceResponse = {
      reply: userQuery
        ? isTe
          ? `మీరు నమోదు చేసిన వివరాల ఆధారంగా, మీ ₹${cleanLoan.toLocaleString('en-IN')} రుణానికి త్రైమాసిక EMI ₹${(Number(quarterlyEmi) || 42000).toLocaleString('en-IN')}. వర్కింగ్ క్యాపిటల్ ₹${wcAmount.toLocaleString('en-IN')} మరియు మూలధన ఖర్చుల కోసం ₹${capexAmount.toLocaleString('en-IN')} కేటాయించబడింది.`
          : `Based on your loan requirement of ₹${cleanLoan.toLocaleString('en-IN')} for ${category || 'your enterprise'}, your quarterly repayment is ₹${(Number(quarterlyEmi) || 42000).toLocaleString('en-IN')}. We have structured ₹${wcAmount.toLocaleString('en-IN')} (${wcPercent}%) for working capital and ₹${capexAmount.toLocaleString('en-IN')} (${capexPercent}%) for asset capex with a seasonal moratorium during lean months.`
        : isTe
        ? `నమస్కారం! మీ ${category || 'వ్యాపారం'} కోసం ఆర్థిక సలహాదారు విశ్లేషణ సిద్ధంగా ఉంది. మీకు తగిన ప్రభుత్వ పథకాలు మరియు మారటోరియం షెడ్యూల్ క్రింద చూడవచ్చు.`
        : `Welcome! I have analyzed your ${category || 'enterprise'} financing structure. Your total loan requirement of ₹${cleanLoan.toLocaleString('en-IN')} is paired with tailored government schemes and seasonal repayment advisory below.`,
      replyTe: undefined,
      loanExplanation: isTe
        ? `ప్రాజెక్ట్ మొత్తం వ్యయం ₹${(Number(projectCost) || 1000000).toLocaleString('en-IN')}. మీ పెట్టుబడి ₹${(Number(marginCapital) || 100000).toLocaleString('en-IN')} కాగా బ్యాంక్ రుణం ₹${cleanLoan.toLocaleString('en-IN')}.`
        : `Total project outlay is ₹${(Number(projectCost) || 1000000).toLocaleString('en-IN')}, with ₹${(Number(marginCapital) || 100000).toLocaleString('en-IN')} promoter equity and ₹${cleanLoan.toLocaleString('en-IN')} bank loan.`,
      recommendedSchemes: [
        {
          id: 'stand-up-india',
          name: 'Stand-Up India Scheme for Women & SC/ST',
          nameTe: 'స్టాండ్-అప్ ఇండియా పథకం (మహిళలు & SC/ST)',
          agency: 'SIDBI & Scheduled Commercial Banks',
          maxAmount: 10000000,
          subsidyOrConcession: 'Lowest commercial rate, 15% margin money, NCGTC credit guarantee',
          subsidyOrConcessionTe: 'తక్కువ వడ్డీ రేటు, 15% మార్జిన్ మనీ, ప్రభుత్వ క్రెడిట్ గ్యారెంటీ',
          whyRecommended: standUpWhy,
          whyRecommendedTe: 'మహిళలు మరియు SC/ST లకు బ్యాంక్ బ్రాంచ్‌లో ప్రాధాన్యత లభిస్తుంది.',
          isTopMatch: isWoman || isScSt,
        },
        {
          id: 'pmegp',
          name: 'PMEGP Credit Linked Subsidy Scheme',
          nameTe: 'పీఎంఈజీపీ (PMEGP) సబ్సిడీ పథకం',
          agency: 'KVIC, KVIB & DIC',
          maxAmount: 5000000,
          subsidyOrConcession: isWoman || isScSt || isObc ? '35% Rural Capital Subsidy (Special Category)' : '25% Rural Capital Subsidy (General Category)',
          subsidyOrConcessionTe: isWoman || isScSt || isObc ? 'గ్రామీణ ప్రాంతాల్లో 35% భారీ సబ్సిడీ' : 'గ్రామీణ ప్రాంతాల్లో 25% సబ్సిడీ',
          whyRecommended: isWoman || isScSt || isObc ? 'Special Category grants you an elevated 35% capital subsidy, drastically cutting debt burden.' : 'Provides a 25% rural capital subsidy on micro-enterprises.',
          whyRecommendedTe: 'ప్రత్యేక కేటగిరీ కింద 35% ప్రభుత్వ సబ్సిడీ లభిస్తుంది.',
          isTopMatch: !(isWoman || isScSt) && isObc,
        },
        {
          id: 'mudra',
          name: 'Pradhan Mantri MUDRA Yojana (Kishor/Tarun)',
          nameTe: 'పీఎం ముద్రా యోజన',
          agency: 'NCGTC & Banks',
          maxAmount: 1000000,
          subsidyOrConcession: '100% collateral-free, MUDRA RuPay card for working capital',
          subsidyOrConcessionTe: 'ఎలాంటి షూరిటీ అవసరం లేదు, వర్కింగ్ క్యాపిటల్ కోసం ముద్రా కార్డ్',
          whyRecommended: 'Universal collateral-free micro-credit up to ₹10 Lakhs with flexible revolving credit for inventory.',
          whyRecommendedTe: 'రూ. 10 లక్షల వరకు ఎలాంటి పూచీకత్తు అవసరం లేదు.',
          isTopMatch: !(isWoman || isScSt || isObc),
        },
      ],
      workingCapitalBreakdown: {
        workingCapitalPercent: wcPercent,
        capexPercent: capexPercent,
        workingCapitalAmount: wcAmount,
        capexAmount: capexAmount,
        workingCapitalUses: wcUses,
        capexUses: capexUses,
      },
      seasonalMoratoriumAdvice: {
        isSeasonal,
        businessType: category || 'Dairy Farming',
        leanSeasonMonths: leanSeason,
        peakSeasonMonths: peakSeason,
        moratoriumQuartersRecommended: 1,
        guidance: guidanceEn,
        guidanceTe: guidanceTe,
      },
      providerUsed: 'Grounded Local Finance Engine (Fallback)',
    };

    return NextResponse.json(fallbackResponse);
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
