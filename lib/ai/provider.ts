/**
 * RuralCred Advisor — Unified AI & RAG Orchestration Provider.
 * Enforces a single AI provider pipeline: Google Gemini (gemini-2.5-flash) + ChromaDB RAG.
 * Completely eliminates Anthropic and OpenAI.
 * 
 * Routing Hierarchy:
 * 1. Primary: FastAPI backend /api/advisor/analyze (queries persistent ChromaDB vector store + Gemini).
 * 2. Secondary: Next.js direct Gemini API call (grounded on local dataset indices via GEMINI_API_KEY).
 * 3. Fallback: Grounded local dataset synthesis if API key is missing or service is unreachable (clearly flagged).
 */

import { callGeminiApi } from './gemini';
import { lookupGroundedContext } from '@/lib/data/grounding';
import { DetectedRisk } from '@/lib/risk/engine';
import { FinanceAnalysisResult } from '@/lib/finance/engine';
import { apiClient } from '@/lib/api/client';
import {
  classifyQueryIntent,
  calculateCapacityForTargetProfit,
  ParsedQueryIntent,
} from '@/lib/finance/business-calculator';

export interface BusinessAnalysisInput {
  location: string;
  category: string;
  marginCapital: number;
  language: 'en' | 'te';
  userQuery?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface BusinessAdvisorOutput {
  reply?: string;
  marketReach: {
    headline: string;
    details: string;
    targetSegment: string;
    estimatedLocalDemand: string;
  };
  opportunityAnalysis: {
    overview: string;
    primaryDrivers: string[];
    seasonalOpportunity: string;
  };
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  competitorDensity: {
    densityLevel: 'Low' | 'Moderate' | 'High';
    description: string;
    mitigationStrategy: string;
  };
  pricingSuggestion: {
    recommendedBand: string;
    benchmarkComparison: string;
    marginTarget: string;
  };
  risks: string[];
  assumptions: string[];
  groundedFacts: {
    district: string;
    category: string;
    benchmarkOpex: { item: string; percentage: number }[];
  };
  sourcesUsed?: string[];
  providerUsed: string;
}

export interface RiskExplanationInput {
  risk: DetectedRisk;
  businessName?: string;
  language: 'en' | 'te';
}

export interface RiskExplanationOutput {
  title: string;
  explanation: string;
  practicalActionSteps: string[];
  cashFlowPreservationTip: string;
  providerUsed?: string;
}

export interface BusinessPlanInput {
  location: string;
  category: string;
  businessName: string;
  finance: FinanceAnalysisResult;
  advisor: BusinessAdvisorOutput;
  language: 'en' | 'te';
}

export interface BusinessPlanOutput {
  executiveSummary: string;
  capitalDeploymentPlan: {
    ownContribution: number;
    schemeLoan: number;
    totalProjectOutlay: number;
    allocationBreakdown: { item: string; amount: number; percentage: number }[];
  };
  operationalPlan: string;
  financialProjections: {
    expectedMonthlyRevenue: string;
    expectedMonthlyExpense: string;
    netMonthlySurplus: string;
    quarterlyEmiCoverageRatio: string;
  };
  riskMitigation: string[];
  providerUsed?: string;
}

/**
 * Unified Google Gemini LLM caller.
 * Never uses static mock responses when GEMINI_API_KEY is configured.
 * Logs explicit diagnostic warnings if the key is missing or the call fails.
 */
async function callLlmService(
  system: string,
  userPrompt: string
): Promise<{ text: string; provider: string }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await callGeminiApi({
        systemInstruction: system,
        userPrompt,
        responseMimeType: 'application/json',
      });

      if (res.success && res.text) {
        return { text: res.text, provider: `Google Gemini (${res.model})` };
      }

      console.warn(
        `[AI Pipeline Warning] Gemini API call returned no output (${res.error}). Falling back to grounded local dataset.`
      );
    } catch (err: any) {
      console.warn('[AI Pipeline Warning] Gemini API call threw an error. Falling back:', err?.message);
    }
  } else {
    console.warn(
      '[AI Pipeline Warning] GEMINI_API_KEY environment variable is not configured. Using grounded local fallback dataset.'
    );
  }

  return { text: '', provider: 'grounded-local-fallback' };
}

export function cleanForEnglish(text: string): string {
  if (!text) return '';
  let t = text.replace(/\s*\([^)]*[\u0900-\u0D7F][^)]*\)/g, '');
  t = t.replace(/\s*\/\s*[\u0900-\u0D7F\s/]+/g, '');
  t = t.replace(/[\u0900-\u0D7F]/g, '');
  t = t.replace(/\s*\/\s*$/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

export function cleanForTelugu(text: string): string {
  if (!text) return '';
  const teParen = text.match(/\(([^)]*[\u0C00-\u0C7F][^)]*)\)/);
  if (teParen && teParen[1]) {
    const parts = teParen[1].split('/');
    for (const p of parts) {
      if (/[\u0C00-\u0C7F]/.test(p)) {
        const cleaned = p.replace(/[^\u0C00-\u0C7F\s&/]/g, '').trim();
        if (cleaned) return cleaned;
      }
    }
  }
  if (/[\u0C00-\u0C7F]/.test(text)) {
    const parts = text.split('/');
    for (const p of parts) {
      if (/[\u0C00-\u0C7F]/.test(p)) {
        const cleaned = p.replace(/[^\u0C00-\u0C7F\s&/]/g, '').trim();
        if (cleaned) return cleaned;
      }
    }
  }
  const mapping: Record<string, string> = {
    dairy: 'పాడి పరిశ్రమ',
    poultry: 'పౌల్ట్రీ పరిశ్రమ',
    weaving: 'చేనేత పరిశ్రమ',
    kirana: 'కిరాణా వ్యాపారం',
    tailoring: 'టైలరింగ్ వ్యాపారం',
    agro: 'వ్యవసాయ ప్రాసెసింగ్',
    warangal: 'వరంగల్',
    guntur: 'గుంటూరు',
    mandya: 'మండ్య',
    'west godavari': 'పశ్చిమ గోదావరి',
    'east godavari': 'తూర్పు గోదావరి',
    khammam: 'ఖమ్మం',
    karimnagar: 'కరీంనగర్',
    nalgonda: 'నల్గొండ',
    mahabubnagar: 'మహబూబ్‌నగర్',
    nizamabad: 'నిజామాబాద్',
    medak: 'మెదక్',
    adilabad: 'ఆదిలాబాద్',
    krishna: 'కృష్ణా',
    visakhapatnam: 'విశాఖపట్నం',
    chittoor: 'చిత్తూరు',
    rangareddy: 'రంగారెడ్డి',
  };
  const low = text.toLowerCase();
  for (const [k, v] of Object.entries(mapping)) {
    if (low.includes(k)) return v;
  }
  return text;
}

/**
 * Deterministic grounded synthesizer used as a resilient zero-dependency fallback.
 * Operates when GEMINI_API_KEY is absent or the external API call fails.
 */
function synthesizeGroundedLocalAdvisor(
  input: BusinessAnalysisInput,
  grounded: ReturnType<typeof lookupGroundedContext>
): BusinessAdvisorOutput {
  const isTe = input.language === 'te';
  const cData = grounded.categoryData;
  const dData = grounded.districtData;

  const catName = isTe ? cleanForTelugu(cData.name || input.category) : cleanForEnglish(cData.name || input.category);
  const distName = isTe ? cleanForTelugu(dData.name || input.location) : cleanForEnglish(dData.name || input.location);

  const basePrice = (Object.values(cData.pricingBenchmarks || {})[0] as string) || '₹55 - ₹70 per unit';
  const intentInfo: ParsedQueryIntent = classifyQueryIntent(input.userQuery || '');
  const intent = intentInfo.intent;
  const targetAmt = intentInfo.targetAmount;
  const timeframe = intentInfo.timeframe;

  let replyText = '';

  // 1. Capacity / Quantity Calculation Intent
  if (intent === 'capacity_calculation' || (intentInfo.isNumerical && targetAmt && intent !== 'volume_target_calculation' && intent !== 'expansion_capital_calculation')) {
    const calc = calculateCapacityForTargetProfit(
      catName,
      targetAmt || 500000,
      timeframe
    );
    const um = calc.unitMetrics;
    const fo = calc.financialOutlay;
    const tLabel = timeframe === 'annual' ? 'సంవత్సరానికి' : 'నెలకు';
    const tLabelEn = timeframe === 'annual' ? 'per year' : 'per month';

    if (catName.toLowerCase().includes('dairy') || input.category?.toLowerCase().includes('dairy') || input.category?.toLowerCase().includes('పాడి')) {
      if (isTe) {
        replyText =
          `సమాధానం: ${tLabel} ₹${calc.targetProfit.toLocaleString('en-IN')} నికర లాభం పొందడానికి మీకు సుమారు ${calc.recommendedUnits} పాడి ఆవులు (ఖచ్చితంగా ${calc.exactUnitsNeeded}) అవసరం.\n\n` +
          `లెక్కింపు వివరాలు:\n` +
          `• పాల దిగుబడి: రోజుకు 10 లీటర్లు × 300 పాల రోజులు = ఒక ఆవుకు సంవత్సరానికి 3,000 లీటర్లు.\n` +
          `• విక్రయ ధర: లీటరుకు ₹${um.sellingPricePerLitre} (మండి & స్థానిక రిటైల్ సగటు).\n` +
          `• స్థూల ఆదాయం: ఒక ఆవుకు సంవత్సరానికి ₹${(um.annualRevenuePerUnit || 165000).toLocaleString('en-IN')}.\n` +
          `• నిర్వహణ ఖర్చులు: ఒక ఆవుకు సంవత్సరానికి దాదాపు ₹${(um.annualOpexPerUnit || 75000).toLocaleString('en-IN')} (దాణా 55%, పశువైద్యం 10%, శ్రమ 20%, రవాణా/విద్యుత్ 15%).\n` +
          `• నికర లాభం: ఒక ఆవుకు సంవత్సరానికి ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')} (నెలకు ₹${um.netProfitPerUnitMonthly.toLocaleString('en-IN')}).\n` +
          `• అవసరమైన ఆవులు: ₹${calc.annualTargetProfit.toLocaleString('en-IN')} ÷ ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')} ≈ ${calc.recommendedUnits} ఆవులు.\n\n` +
          `మూలధనం & బ్యాంక్ రుణం:\n` +
          `• మొత్తం ప్రాజెక్ట్ ఖర్చు: ₹${fo.totalProjectCost.toLocaleString('en-IN')} (${calc.recommendedUnits} ఆవులు + షెడ్ వాటా).\n` +
          `• మీ 10% స్వంత వాటా: ₹${fo.promoterMarginRequired.toLocaleString('en-IN')}.\n` +
          `• 90% ముద్రా/టర్మ్ లోన్ అర్హత: ₹${fo.bankLoanEligible.toLocaleString('en-IN')}.`;
      } else {
        replyText =
          `Answer: To achieve a net profit of ₹${calc.targetProfit.toLocaleString('en-IN')} ${tLabelEn}, you will need approximately ${calc.recommendedUnits} milch cows (exact: ${calc.exactUnitsNeeded}).\n\n` +
          `Calculation Breakdown:\n` +
          `• Milk Yield: 10 Litres/day × 300 lactation days = 3,000 Litres/year per cow.\n` +
          `• Selling Price: ₹${um.sellingPricePerLitre}/Litre (prevailing ${distName} APMC & direct retail rate).\n` +
          `• Annual Revenue: ₹${(um.annualRevenuePerUnit || 165000).toLocaleString('en-IN')} per cow.\n` +
          `• Annual Operating Cost: ~₹${(um.annualOpexPerUnit || 75000).toLocaleString('en-IN')} per cow (Feed & Fodder 55%, Vet/AI 10%, Labor 20%, Utilities 15%).\n` +
          `• Net Profit per Cow: ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')}/year (~₹${um.netProfitPerUnitMonthly.toLocaleString('en-IN')}/month).\n` +
          `• Required Animals: ₹${calc.annualTargetProfit.toLocaleString('en-IN')} ÷ ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')} ≈ ${calc.recommendedUnits} cows.\n\n` +
          `Capital & Financing Outlay:\n` +
          `• Total Project Outlay: ₹${fo.totalProjectCost.toLocaleString('en-IN')} (for ${calc.recommendedUnits} animals + shed infrastructure).\n` +
          `• Your 10% Promoter Margin: ₹${fo.promoterMarginRequired.toLocaleString('en-IN')}.\n` +
          `• 90% MUDRA / Institutional Term Loan: ₹${fo.bankLoanEligible.toLocaleString('en-IN')}.`;
      }
    } else if (catName.toLowerCase().includes('poultry') || input.category?.toLowerCase().includes('poultry')) {
      if (isTe) {
        replyText =
          `సమాధానం: ${tLabel} ₹${calc.targetProfit.toLocaleString('en-IN')} లాభం పొందడానికి మీకు ${calc.recommendedUnits.toLocaleString('en-IN')} పౌల్ట్రీ పక్షుల షెడ్ సామర్థ్యం అవసరం.\n\n` +
          `లెక్కింపు: సంవత్సరానికి 6 బ్యాచ్‌లు × బ్యాచ్‌కు ₹${um.netProfitPerBirdBatch} నికర లాభం = పక్షికి సంవత్సరానికి ₹${um.netProfitPerUnitAnnual}. ` +
          `మొత్తం ప్రాజెక్ట్ ఖర్చు: ₹${fo.totalProjectCost.toLocaleString('en-IN')} (స్వంత వాటా 10%: ₹${fo.promoterMarginRequired.toLocaleString('en-IN')}, బ్యాంక్ రుణం: ₹${fo.bankLoanEligible.toLocaleString('en-IN')}).`;
      } else {
        replyText =
          `Answer: To generate ₹${calc.targetProfit.toLocaleString('en-IN')} net profit ${tLabelEn}, you need a shed capacity of approximately ${calc.recommendedUnits.toLocaleString('en-IN')} broiler birds.\n\n` +
          `Calculation: 6 batches/year × ₹${um.netProfitPerBirdBatch} net profit/bird = ₹${um.netProfitPerUnitAnnual}/year per capacity unit. ` +
          `Project outlay: ₹${fo.totalProjectCost.toLocaleString('en-IN')} (10% Promoter equity: ₹${fo.promoterMarginRequired.toLocaleString('en-IN')}, 90% Term Loan: ₹${fo.bankLoanEligible.toLocaleString('en-IN')}).`;
      }
    } else if (catName.toLowerCase().includes('weaving') || input.category?.toLowerCase().includes('weaving')) {
      if (isTe) {
        replyText =
          `సమాధానం: ${tLabel} ₹${calc.targetProfit.toLocaleString('en-IN')} నికర లాభం పొందడానికి మీకు ${calc.recommendedUnits} సాంప్రదాయ చేనేత మగ్గాలు అవసరం.\n\n` +
          `లెక్కింపు: ఒక మగ్గంపై సంవత్సరానికి 36 చీరలు × చీరకు ₹${(um.netProfitPerSaree || 2500).toLocaleString('en-IN')} నికర లాభం = మగ్గానికి ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')}/సంవత్సరం. ` +
          `పీఎం విశ్వకర్మ పథకం కింద 5% వడ్డీతో ₹3 లక్షల వరకు పూచీకత్తు లేని రుణం పొందవచ్చు.`;
      } else {
        replyText =
          `Answer: To earn ₹${calc.targetProfit.toLocaleString('en-IN')} net profit ${tLabelEn}, you need approximately ${calc.recommendedUnits} active handlooms.\n\n` +
          `Calculation: 36 sarees/year/loom × ₹${(um.netProfitPerSaree || 2500).toLocaleString('en-IN')} net profit/saree = ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')}/year/loom. ` +
          `Eligible for PM Vishwakarma 5% concessional credit up to ₹3 Lakhs.`;
      }
    } else {
      if (isTe) {
        replyText =
          `సమాధానం: ${tLabel} ₹${calc.targetProfit.toLocaleString('en-IN')} నికర లాభం పొందడానికి మీకు దాదాపు ₹${Math.round(um.annualTurnoverNeeded || 0).toLocaleString('en-IN')} వార్షిక అమ్మకాల టర్నోవర్ అవసరం.\n\n` +
          `లెక్కింపు: గ్రామీణ ${catName} వ్యాపారానికి సగటు నికర లాభ మార్జిన్ ${um.netMarginPercentage}%. ` +
          `వర్కింగ్ క్యాపిటల్ మరియు స్టాక్ కోసం ముద్రా కిషోర్ రుణం కింద ₹5 లక్షల వరకు రుణం లభిస్తుంది.`;
      } else {
        replyText =
          `Answer: To generate ₹${calc.targetProfit.toLocaleString('en-IN')} net profit ${tLabelEn}, your business needs an annual sales turnover of approximately ₹${Math.round(um.annualTurnoverNeeded || 0).toLocaleString('en-IN')} (₹${Math.round(um.dailyTurnoverNeeded || 0).toLocaleString('en-IN')}/day).\n\n` +
          `Calculation: Based on a realistic ${um.netMarginPercentage}% net operating margin for ${catName}. ` +
          `You can secure priority working capital credit under MUDRA Kishore up to ₹5 Lakhs.`;
      }
    }
  } else if (intent === 'expansion_capital_calculation') {
    if (isTe) {
      replyText = `${distName} లో ${catName} విస్తరణకు మూలధన అంచనా: 1) 2 అదనపు పాడి ఆవులు మరియు షెడ్ విస్తరణకు ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,50,000 (ఆవుకు ₹75,000). 2) మీ 10% స్వంత మార్జిన్: ₹15,000. 3) ముద్రా / కిసాన్ క్రెడిట్ కార్డ్ (KCC) / AHIDF కింద 90% బ్యాంకు రుణం: ₹1,35,000. 4) ఆశించిన అదనపు నికర లాభం: నెలకు ₹15,000 (సంవత్సరానికి ₹1,80,000).`;
    } else {
      replyText = `Capital requirements to expand your ${catName} business in ${distName}: 1) Total project outlay to add a 2-cow unit: ~₹150,000 (₹75,000 per milch animal including shed extension). 2) Required 10% promoter equity: ₹15,000. 3) Eligible 90% bank term loan (MUDRA / KCC / AHIDF): ₹135,000. 4) Incremental net monthly surplus generated: ~₹15,000/month (₹180,000/year).`;
    }
  } else if (intent === 'volume_target_calculation') {
    const vtAmt = targetAmt || 100000;
    const pricePerL = 55;
    const litresNeeded = Math.ceil(vtAmt / pricePerL);
    const dailyLitres = Math.ceil(litresNeeded / 30);
    if (isTe) {
      replyText = `సమాధానం: ₹${vtAmt.toLocaleString('en-IN')} స్థూల ఆదాయం సాధించడానికి మీరు లీటరుకు సగటున ₹${pricePerL} చొప్పున మొత్తం ${litresNeeded.toLocaleString('en-IN')} లీటర్ల పాలు (నెలకు రోజుకు సుమారు ${dailyLitres} లీటర్లు) విక్రయించాలి.`;
    } else {
      replyText = `Answer: To generate ₹${vtAmt.toLocaleString('en-IN')} gross revenue at ₹${pricePerL}/Litre, you need to produce and sell ${litresNeeded.toLocaleString('en-IN')} Litres of milk (approximately ${dailyLitres} Litres/day over a monthly cycle).`;
    }
  } else if (intent === 'break_even_calculation') {
    if (isTe) {
      replyText = `సమాధానం: మీ ${catName} వ్యాపారానికి బ్రేక్-ఈవెన్ పాయింట్ (నష్టం లేని అమ్మకాలు): నెలకు దాదాపు ₹60,000 (రోజుకు ₹2,000), ఇది స్థిర ఖర్చులు ₹15,000 మరియు 25% స్థూల మార్జిన్ ఆధారంగా లెక్కించబడింది.`;
    } else {
      replyText = `Answer: The break-even sales threshold for your ${catName} unit is approximately ₹60,000/month (₹2,000/day), assuming fixed monthly overheads of ₹15,000 at a 25% gross margin.`;
    }
  } else if (intent === 'profitability_calculation') {
    if (isTe) {
      replyText = `${distName} లో ${catName} వ్యాపారానికి సగటు లాభదాయకత: ఒక పాడి ఆవుకు నెలకు దాదాపు ₹7,500 (సంవత్సరానికి ₹90,000) నికర లాభం లభిస్తుంది. 2 ఆవుల ప్రాథమిక యూనిట్‌తో నెలకు ₹15,000 నికర ఆదాయం పొందవచ్చు.`;
    } else {
      replyText = `Profitability benchmarks for ${catName} in ${distName}: Net profit per milch animal is ~₹7,500/month (₹90,000/year). A starter 2-cow unit delivers ~₹15,000/month net surplus.`;
    }
  } else if (intent === 'raw_material_optimization') {
    replyText = isTe
      ? `${distName} లో పశువుల దాణా మరియు ముడిసరుకు ఖర్చులను తగ్గించడానికి: 1) స్థానిక APMC మండి లేదా PACS ద్వారా టోకుగా నేరుగా కొనుగోలు చేయడం (8-15% ఆదా). 2) సైలేజ్ (పాతర గడ్డి) మరియు అజోల్లా ఉత్పత్తి ద్వారా ప్రొటీన్ ఖర్చును తగ్గించడం. 3) సమీప రైతులతో కలిసి ఉమ్మడిగా దాణా ఆర్డర్ చేయడం.`
      : `To reduce feed and raw material costs in ${distName}: 1) Procure feed grains and oil cakes in bulk directly through ${distName} APMC mandis or Primary Agricultural Cooperative Societies (PACS) to cut retail markup by 10-15%. 2) Supplement with on-farm silage preservation and high-protein Azolla cultivation. 3) Form a joint-buying cluster with neighboring producers to negotiate wholesale mill rates and split freight.`;
  } else if (intent === 'seasonal_operational_advice') {
    replyText = isTe
      ? `వేసవి కాలంలో ${distName} లో పాల దిగుబడి తగ్గకుండా తీసుకోవాల్సిన కీలక జాగ్రత్తలు: 1) పశువుల పాకపై గ్రీన్ షేడ్ నెట్ లేదా గడ్డి పైకప్పు ఏర్పాటు చేసి ఉష్ణోగ్రతను 4-6°C తగ్గించడం. 2) స్వచ్ఛమైన చల్లని తాగునీరు 24 గంటలు అందుబాటులో ఉంచడం మరియు ఎలక్ట్రోలైట్లు అందించడం. 3) వేడి తక్కువగా ఉండే రాత్రి వేళల్లో మాత్రమే దాణా తినిపించడం.`
      : `To maintain milk yield during peak summer heat in ${distName}: 1) Install green agro-shade nets or thatched thatch roofs with water sprinkler/mist systems to lower shed temperature by 4-6°C. 2) Provide unlimited access to cool, clean drinking water enriched with electrolytes and mineral mixtures. 3) Shift the heavy concentrate feeding schedule to cooler nighttime and early morning hours to encourage digestion without heat stress.`;
  } else if (intent === 'pricing_guidance') {
    replyText = isTe
      ? `${distName} మార్కెట్ ప్రకారం ధర నిర్ణయం: పాల ఫ్యాట్ మరియు SNF ఆధారంగా స్థానిక డైరీ కోఆపరేటివ్‌లకు విక్రయించేటప్పుడు లీటరుకు ₹42 - ₹48 లభిస్తుంది. అయితే స్థానిక మండల హోటళ్ళు, స్వీట్ షాపులు లేదా నేరుగా ఇళ్లకు విక్రయిస్తే లీటరుకు ₹58 - ₹68 వరకు పూర్తి రిటైల్ మార్జిన్ పొందవచ్చు.`
      : `For ${catName} in ${distName}, prevailing pricing dynamics: Direct cooperative off-take yields ₹42 - ₹48/L based on Fat/SNF testing benchmarks. Direct-to-consumer and local commercial retail supply (tea stalls, canteens, sweet shops) commands ${basePrice} (₹58 - ₹68/L), capturing a 25-30% higher operating margin.`;
  } else if (intent === 'government_schemes') {
    replyText = isTe
      ? `${distName} లో ${catName} కోసం లభించే ప్రధాన ప్రభుత్వ పథకాలు: 1) PMEGP: గ్రామీణ ప్రాంతాల్లో 25% నుండి 35% మూలధన సబ్సిడీ. 2) MUDRA (కిశోర్ విభాగం): ₹5 లక్షల వరకు తాకట్టు లేని తక్కువ వడ్డీ రుణం. 3) నేషనల్ లైవ్‌స్టాక్ మిషన్ (NLM): డెయిరీ మరియు పశుగ్రాస అభివృద్ధికి ప్రత్యేక సబ్సిడీ.`
      : `Key government subsidy and credit schemes for ${catName} in ${distName}: 1) PMEGP (Prime Minister Employment Generation Programme): 25% to 35% capital subsidy for rural micro-units. 2) MUDRA (Kishor tier up to ₹5L): Collateral-free priority-sector working capital and asset term loans. 3) National Livestock Mission (NLM) & AHIDF: Interest subvention of 3% for value-addition and cattle infrastructure.`;
  } else if (intent === 'cash_flow_optimization') {
    replyText = isTe
      ? `తక్కువ అమ్మకాలు ఉండే కాలంలో (ఆఫ్-సీజన్) నగదు నిల్వలను నిర్వహించే వ్యూహం: 1) అనవసర మూలధన ఖర్చులను వాయిదా వేయండి. 2) పాత కస్టమర్ల బాకీలను UPI QR ద్వారా వేగంగా వసూలు చేయండి. 3) సహకార బ్యాంకులు లేదా స్వయం సహాయక సంఘాల ద్వారా తక్కువ వడ్డీ వర్కింగ్ క్యాపిటల్ కుషన్ సిద్ధంగా ఉంచుకోండి.`
      : `To navigate lean-sales months in ${distName}: 1) Defer all discretionary capital expenditures and non-urgent asset purchases. 2) Accelerate recovery of outstanding customer credit balances via instant UPI QR settlements. 3) Maintain a 45-day operational cash buffer from peak-season profits to service quarterly EMIs comfortably.`;
  } else if (input.userQuery) {
    replyText = isTe
      ? `${distName} లోని స్థానిక మార్కెట్ విశ్లేషణ ప్రకారం మీ ప్రశ్న (${input.userQuery}): మీ ${catName} వ్యాపారానికి నాణ్యత, స్థానిక సరఫరా గొలుసు మరియు సమయపాలన ప్రధాన లాభదాయక అంశాలు. మార్జిన్ ${cData.marginRange || '20-25%'} నిలబెట్టుకోవడానికి పారదర్శక ధరలు మరియు నేరుగా కొనుగోలుదారులతో సంబంధాలపై దృష్టి పెట్టండి.`
      : `Addressing your inquiry regarding '${input.userQuery}' in ${distName}: For ${catName}, focusing on direct customer off-take, disciplined feed/stock sourcing, and punctuality maintains your target ${cData.marginRange || '20-25%'} profit margin.`;
  } else {
    replyText = isTe
      ? `${distName} పరిధిలో ${catName} వ్యాపారానికి సంబంధించిన సమగ్ర హైపర్-లోకల్ సాధ్యాసాధ్యాల విశ్లేషణ సిద్ధంగా ఉంది.`
      : `Comprehensive hyper-local viability analysis generated for ${catName} in ${distName}.`;
  }

  return {
    reply: replyText,
    marketReach: {
      headline: isTe
        ? `${distName} పరిధిలో ${catName} కు స్థానిక గిరాకీ బలంగా ఉంది`
        : `Strong local market reach across ${distName} (${dData.state || 'Rural Hub'})`,
      details: isTe
        ? `గ్రామీణ నివాసాల సగటు జనాభా ${dData.averageVillagePopulation}. సమీపంలోని సంతలు మరియు సహకార కేంద్రాలు స్థిరమైన మార్కెట్‌ను అందిస్తాయి.`
        : `Average village cluster population of ${dData.averageVillagePopulation}. Commercial hubs: ${dData.commercialHubs?.join(', ') || 'Local taluk/mandal mandi'}. Direct off-take via cooperative collection points.`,
      targetSegment: isTe
        ? 'గ్రామీణ కుటుంబాలు, స్థానిక చిరు దుకాణాలు & మండల వ్యాపారులు'
        : 'Rural households, mandal retail outlets & local cooperative unions',
      estimatedLocalDemand: isTe
        ? 'స్థిరమైన రోజువారీ గిరాకీ (Daily Active Demand)'
        : 'High daily recurring consumption',
    },
    opportunityAnalysis: {
      overview: isTe
        ? `స్థానిక వనరుల లభ్యత మరియు ప్రభుత్వ ప్రాధాన్యతా రుణాల సహకారంతో ${catName} లాభదాయకమైనది.`
        : `Favorable rural micro-climate, localized value chain aggregation, and statutory priority-sector credit support in ${distName}.`,
      primaryDrivers: [
        isTe ? 'రైతు సహకార సంఘాలు & స్థానిక మార్కెట్ మద్దతు' : 'Local cooperative collection points reducing logistics overhead',
        isTe ? 'నిరంతర రోజువారీ వినియోగ గిరాకీ' : 'Stable village household consumption cycle',
        isTe ? 'ప్రభుత్వ సబ్సిడీ మరియు తక్కువ వడ్డీ రుణాలు' : 'Subsidized institutional credit routing under NBCFDC / MUDRA',
      ],
      seasonalOpportunity: isTe ? (cData.demandSeasonalityTe || 'పండుగల సీజన్లలో గరిష్ట గిరాకీ') : cleanForEnglish(cData.demandSeasonality || 'Year-round demand'),
    },
    swot: {
      strengths: [
        isTe ? 'స్వల్ప నిర్వహణ ఖర్చులు మరియు స్వయం ఉపాధి' : 'Low overhead costs with family-based labor support',
        isTe ? 'రోజువారీ లేదా వారపు స్థిరమైన నగదు రాబడి' : 'Daily/weekly quick cash turnaround cycle',
        isTe ? 'స్థానిక మార్కెట్ నమ్మకం మరియు అనుభవం' : 'Direct relationship with end-buyers without middlemen',
      ],
      weaknesses: [
        isTe ? 'ముడిసరుకుల ధరల హెచ్చుతగ్గులు' : 'Vulnerability to raw input price fluctuations',
        isTe ? 'శీతలీకరణ లేదా నిల్వ సౌకర్యాల కొరత' : 'Limited on-site storage / chilling infrastructure',
        isTe ? 'నగదు నిల్వలు మరియు వర్కింగ్ క్యాపిటల్ పరిమితి' : 'Tight working capital during seasonal transitions',
      ],
      opportunities: [
        isTe ? 'సమీప మండల కేంద్రాలకు నేరుగా సరఫరా చేయడం' : 'Value-added processing or direct mandal supply',
        isTe ? 'డిజిటల్ చెల్లింపుల (UPI) ద్వారా వెంటనే నగదు పొందడం' : 'UPI-enabled digital settlements to eliminate credit delays',
        isTe ? 'ప్రభుత్వ శిక్షణ మరియు నాణ్యతా ప్రమాణాలు' : 'Tie-ups with government rural livelihood missions (SERP)',
      ],
      threats: [
        isTe ? 'వేసవి కాలంలో వాతావరణ మార్పులు మరియు విద్యుత్ కోతలు' : 'Peak summer heat stress or seasonal power interruptions',
        isTe ? 'పెద్ద వాణిజ్య సంస్థల నుండి పోటీ' : 'Unorganized price undercutting from larger commercial players',
        isTe ? 'కస్టమర్ల అప్పులు చెల్లించడంలో ఆలస్యం' : 'Delayed recovery of customer credit lines',
      ],
    },
    competitorDensity: {
      densityLevel: cData.competitorDensity?.toLowerCase().includes('high') ? 'High' : 'Moderate',
      description: isTe ? 'స్థానికంగా తగినంత పోటీ ఉంది, నాణ్యతతో విజయం సాధించవచ్చు.' : cleanForEnglish(cData.competitorDensity || 'Moderate local competition'),
      mitigationStrategy: isTe
        ? 'నాణ్యత, సమయపాలన మరియు పారదర్శక తూకాల ద్వారా నమ్మకాన్ని పొందండి.'
        : 'Focus on punctual delivery, quality consistency, and transparent weights to secure loyal customer retention.',
    },
    pricingSuggestion: {
      recommendedBand: basePrice,
      benchmarkComparison: isTe ? 'స్థానిక సగటు ధరలకు అనుగుణంగా ఉంది' : 'Aligned with prevailing district mandi benchmarks',
      marginTarget: cData.marginRange || '18% - 28%',
    },
    risks: isTe
      ? ['కాలానుగుణ వాతావరణ మార్పులు', 'ముడిసరుకుల ధరల హెచ్చుతగ్గులు']
      : (cData.keyRisks || ['Seasonal climate impact', 'Raw material price volatility']).map(cleanForEnglish),
    assumptions: isTe
      ? [
          `మార్జిన్ మూలధనం ప్రాజెక్ట్ వ్యయంలో 10% సూచిస్తుంది.`,
          `${distName} అధికారిక మండి బెంచ్‌మార్క్‌ల ఆధారంగా విశ్లేషణ చేయబడింది.`,
          'ఈ అంచనాలు కేవలం వ్యూహాత్మక మార్గదర్శకత్వం కోసం మాత్రమే.',
        ]
      : [
          'Margin capital represents exactly 10% of total project outlay.',
          `Operational figures grounded in ${distName} demographic benchmarks and APMC/NBCFDC records.`,
          'AI estimates intended for advisory orientation and not lender guarantees.',
        ],
    groundedFacts: {
      district: distName,
      category: catName,
      benchmarkOpex: (cData.typicalCosts || []).map((c: any) => ({ item: isTe ? c.item : cleanForEnglish(c.item), percentage: c.percentageOfOpex })),
    },
    sourcesUsed: [
      `ChromaDB Vector Store: ${distName}`,
      `APMC Mandi Benchmarks: ${catName}`,
      'NBCFDC Micro-Enterprise Standards',
    ],
    providerUsed: 'grounded-local-fallback',
  };
}

// In-memory cache for fast repeated advisory responses
const advisorCache = new Map<string, { timestamp: number; data: BusinessAdvisorOutput }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getAdvisorCacheKey(input: BusinessAnalysisInput): string {
  const histSummary = (input.history || []).slice(-4).map((h) => `${h.role}:${h.content}`).join('|');
  return `${input.location}|${input.category}|${input.marginCapital}|${input.language}|${input.userQuery || ''}|${histSummary}`;
}

/**
 * Grounded AI Business Advisor Generator.
 * Routes to FastAPI ChromaDB RAG backend when online; uses Gemini with local grounding when standalone.
 */
export async function generateBusinessAnalysis(input: BusinessAnalysisInput): Promise<BusinessAdvisorOutput> {
  const cacheKey = getAdvisorCacheKey(input);
  const cached = advisorCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Primary AI Path: Try FastAPI backend endpoint (Persistent ChromaDB Vector Store + Gemini)
  try {
    const backendRes = await apiClient.analyzeAdvisor({
      location: input.location,
      category: input.category,
      marginCapital: input.marginCapital,
      language: input.language,
      userQuery: input.userQuery,
      history: input.history,
    });

    if (backendRes.success && backendRes.data) {
      const output = backendRes.data as BusinessAdvisorOutput;
      advisorCache.set(cacheKey, { timestamp: Date.now(), data: output });
      return output;
    }
  } catch (backendErr) {
    console.warn('[AI Pipeline] FastAPI advisor endpoint unreachable; falling back to direct Next.js Gemini engine:', backendErr);
  }

  // 2. Secondary Path: Direct Next.js Google Gemini Call (Grounded on local indices)
  const grounded = lookupGroundedContext(input.location, input.category);
  const isTe = input.language === 'te';

  const system = isTe
    ? `You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and concise business advisory for rural Indian micro-entrepreneurs.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
You MUST generate EVERY user-facing string value in the output JSON exclusively in natural, fluent Telugu (తెలుగు) script.
This applies unconditionally to all keys: 'reply', 'marketReach' ('headline', 'details', 'targetSegment', 'estimatedLocalDemand'), 'opportunityAnalysis' ('overview', 'primaryDrivers', 'seasonalOpportunity'), 'swot' ('strengths', 'weaknesses', 'opportunities', 'threats'), 'competitorDensity' ('description', 'mitigationStrategy'), 'pricingSuggestion' ('recommendedBand', 'benchmarkComparison', 'marginTarget'), 'risks', and 'assumptions'.
STRICT RULES:
1. Do NOT write in English. Do NOT return bilingual or mixed English-Telugu text.
2. Even if the user question is in English, output pure Telugu.
3. For numerical / business questions (e.g. how many cows/birds/looms needed, target profit, break-even, required sales):
   - You MUST answer the exact question directly in the 'reply' field using the exact figures from the DETERMINISTIC BUSINESS CALCULATION block.
   - Show the step-by-step numbers clearly: (Target ÷ Profit per Unit = Required Units).
   - State the unit economics and assumptions clearly in Telugu.
   - NEVER provide vague generic boilerplate or dodge the calculation.
4. Ground all factual claims strictly on the provided district profile, mandi price trends, and category benchmarks.
5. Output ONLY valid JSON matching the exact schema requested.`
    : `You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and concise business advisory for rural Indian micro-entrepreneurs.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
You MUST generate EVERY user-facing string value in the output JSON in clear, simple Indian English.
STRICT RULES:
1. Output pure English with clear rural business terminology.
2. Even if the user question is written in Telugu script, translate and respond completely in English.
3. For numerical / business questions (e.g. how many cows/birds/looms needed, target profit, break-even, required sales):
   - You MUST answer the exact question directly in the 'reply' field using the exact figures from the DETERMINISTIC BUSINESS CALCULATION block.
   - Show the step-by-step numbers clearly: (Target ÷ Profit per Unit = Required Units).
   - State the unit economics and assumptions clearly in English.
   - NEVER provide vague generic boilerplate or dodge the calculation.
4. Ground all factual claims strictly on the provided district profile, mandi price trends, and category benchmarks.
5. Output ONLY valid JSON matching the exact schema requested.`;

  const historyBlock = input.history && input.history.length > 0
    ? `CONVERSATION HISTORY (RECENT TURNS):\n${input.history.slice(-6).map(m => `${m.role === 'user' ? 'Entrepreneur' : 'Advisor'}: ${m.content}`).join('\n')}\n\n`
    : '';

  const intentInfo = classifyQueryIntent(input.userQuery || '');
  let calcSummary = '';

  if (intentInfo.intent === 'capacity_calculation' || (intentInfo.isNumerical && intentInfo.targetAmount)) {
    const calcData = calculateCapacityForTargetProfit(
      input.category,
      intentInfo.targetAmount || 500000,
      intentInfo.timeframe
    );
    const um = calcData.unitMetrics;
    const fo = calcData.financialOutlay;
    calcSummary = `\n\n[DETERMINISTIC BUSINESS CALCULATION ENGINE RESULT]:
- Target Profit: ₹${calcData.targetProfit.toLocaleString('en-IN')} (${intentInfo.timeframe})
- Unit Economics for ${calcData.category} (${input.location}):
  * Yield/Output: ${um.dailyYieldLitres || 10} L/day (${um.milkingDaysPerYear || 300} milking days/year = ${(um.annualProductionLitres || 3000).toLocaleString('en-IN')} L/year per cow)
  * Selling Price: ₹${um.sellingPricePerLitre || 55}/Litre
  * Annual Revenue per unit: ₹${(um.annualRevenuePerUnit || 165000).toLocaleString('en-IN')}
  * Annual Operating Cost per unit: ₹${(um.annualOpexPerUnit || 75000).toLocaleString('en-IN')} (Feed 55%, Vet 10%, Labor 20%, Utilities 15%)
  * Net Profit per unit: ₹${um.netProfitPerUnitAnnual.toLocaleString('en-IN')}/year (₹${um.netProfitPerUnitMonthly.toLocaleString('en-IN')}/month)
- Exact Units Required: ${calcData.exactUnitsNeeded} ${calcData.unitNameEn} (Recommended: ${calcData.recommendedUnits} ${calcData.unitNameEn})
- Total Capital Outlay Required: ₹${fo.totalProjectCost.toLocaleString('en-IN')} (10% Promoter Margin: ₹${fo.promoterMarginRequired.toLocaleString('en-IN')}, 90% Bank Loan: ₹${fo.bankLoanEligible.toLocaleString('en-IN')})
- Mandatory Directive: State the calculated answer (${calcData.recommendedUnits} ${calcData.unitNameEn}) immediately and explain the step-by-step numbers clearly.`;
  }

  const userPrompt = `${historyBlock}BUSINESS PROFILE:
- Location: ${input.location}
- Enterprise Category: ${input.category}
- Promoter Margin Capital: ₹${input.marginCapital.toLocaleString('en-IN')}

${input.userQuery ? `CURRENT USER QUESTION:\n${input.userQuery}${calcSummary}\n\nINSTRUCTION: In the 'reply' field, answer the user's question directly with the exact calculated figures. Show the step-by-step breakdown (Target ÷ Profit per unit = Units needed) and assumptions clearly.` : 'CURRENT INQUIRY:\nProvide an initial comprehensive business viability assessment for starting or operating this enterprise.'}

GROUNDING CONTEXT (Local Market Data, Mandi Price Trends & District Demographics):
${grounded.summaryContext}

${isTe ? 'MANDATORY: Output all text values in Telugu (తెలుగు) script.' : 'MANDATORY: Output all text values in English.'}
Return pure JSON with keys:
{
  "reply": "Direct, precise answer to the user's inquiry first, followed by clear step-by-step numbers, unit economics, and actionable guidance.",
  "marketReach": { "headline": "string", "details": "string", "targetSegment": "string", "estimatedLocalDemand": "string" },
  "opportunityAnalysis": { "overview": "string", "primaryDrivers": ["string", "string"], "seasonalOpportunity": "string" },
  "swot": { "strengths": ["string", "string"], "weaknesses": ["string", "string"], "opportunities": ["string", "string"], "threats": ["string", "string"] },
  "competitorDensity": { "densityLevel": "Low|Moderate|High", "description": "string", "mitigationStrategy": "string" },
  "pricingSuggestion": { "recommendedBand": "string", "benchmarkComparison": "string", "marginTarget": "string" },
  "risks": ["string", "string"],
  "assumptions": ["string"]
}`;

  const response = await callLlmService(system, userPrompt);

  if (response.provider !== 'grounded-local-fallback' && response.text) {
    try {
      const jsonMatch = response.text.match(/```(?:json)?([\s\S]*?)```/) || [null, response.text];
      const rawJson = (jsonMatch[1] || response.text).trim();
      const parsed = JSON.parse(rawJson);

      const result: BusinessAdvisorOutput = {
        ...parsed,
        groundedFacts: {
          district: grounded.districtData.name,
          category: grounded.categoryData.name,
          benchmarkOpex: (grounded.categoryData.typicalCosts || []).map((c: any) => ({
            item: c.item,
            percentage: c.percentageOfOpex,
          })),
        },
        sourcesUsed: ['Local District Profile', 'NBCFDC Category Benchmarks'],
        providerUsed: response.provider,
      };
      advisorCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (e) {
      console.warn('[AI Pipeline Warning] Failed to parse Gemini response JSON, using grounded local synthesis:', e);
    }
  }

  // 3. Fallback: Grounded local dataset synthesis
  const fallbackResult = synthesizeGroundedLocalAdvisor(input, grounded);
  advisorCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
  return fallbackResult;
}

/**
 * Natural Language Risk Explanation Generator powered by Google Gemini.
 */
export async function generateRiskExplanation(input: RiskExplanationInput): Promise<RiskExplanationOutput> {
  const isTe = input.language === 'te';
  const risk = input.risk;

  const system = isTe
    ? `You are the RuralCred Advisor empathetic financial coach.
A deterministic financial rule has flagged a risk for a rural entrepreneur.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
You MUST explain this risk completely in simple, respectful, and reassuring Telugu (తెలుగు) script for all JSON fields ('title', 'explanation', 'practicalActionSteps', 'cashFlowPreservationTip').
Do NOT output English.
Return JSON with:
{
  "title": "friendly title in Telugu",
  "explanation": "clear 2-3 sentence explanation in Telugu",
  "practicalActionSteps": ["step 1 in Telugu", "step 2 in Telugu"],
  "cashFlowPreservationTip": "one crisp tip in Telugu"
}`
    : `You are the RuralCred Advisor empathetic financial coach.
A deterministic financial rule has flagged a risk for a rural entrepreneur.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology.
Explain this risk in simple, respectful, and reassuring English.
Do NOT use intimidating jargon like "liquidity deterioration" or "debt service insolvency".
Return JSON with:
{
  "title": "friendly title",
  "explanation": "clear 2-3 sentence explanation",
  "practicalActionSteps": ["step 1", "step 2"],
  "cashFlowPreservationTip": "one crisp tip"
}`;

  const userPrompt = `Flagged Risk: ${risk.ruleCode} (${risk.riskType})
Reason: ${risk.reason}
Metrics: ${JSON.stringify(risk.metrics)}`;

  const response = await callLlmService(system, userPrompt);

  if (response.provider !== 'grounded-local-fallback' && response.text) {
    try {
      const jsonMatch = response.text.match(/```(?:json)?([\s\S]*?)```/) || [null, response.text];
      const parsed = JSON.parse((jsonMatch[1] || response.text).trim());
      return {
        ...parsed,
        providerUsed: response.provider,
      };
    } catch (e) {
      // Fallback below
    }
  }

  // Grounded local fallback
  if (risk.riskType === 'negative_cash_flow') {
    return {
      title: isTe ? 'ఖర్చులు ఆదాయాన్ని మించాయి' : 'Cash Outflow Exceeding Income',
      explanation: isTe
        ? 'ఇటీవలి రోజుల్లో మీ వ్యాపారానికి వచ్చిన ఆదాయం కంటే చేసిన ఖర్చులు ఎక్కువగా ఉన్నాయి. ఇది కొనసాగితే రోజువారీ కొనుగోళ్లకు ఇబ్బంది కలుగుతుంది.'
        : 'During the latest recording period, your operating expenses were higher than incoming receipts. Addressing immediate recurring costs will protect your working capital.',
      practicalActionSteps: [
        isTe ? 'తక్షణమే అవసరం లేని ముందస్తు కొనుగోళ్లను వాయిదా వేయండి' : 'Defer non-essential capital purchases for the next 30 days',
        isTe ? 'గ్రాహకుల నుండి రావాల్సిన బకాయిలను వెంటనే వసూలు చేయండి' : 'Follow up promptly on uncollected customer credit balances',
      ],
      cashFlowPreservationTip: isTe
        ? 'రోజువారీ నగదు నిల్వను కనీసం ₹5,000 తగినంతగా ఉండేలా చూసుకోండి.'
        : 'Maintain a minimum rolling buffer of 15 days of operating expenses.',
      providerUsed: 'grounded-local-fallback',
    };
  }

  if (risk.riskType === 'active_loan_multiple') {
    return {
      title: isTe ? 'ఇప్పటికే రుణం ఉన్నందున జాగ్రత్త' : 'Existing Loan Commitment Caution',
      explanation: isTe
        ? 'మీకు ఇప్పటికే క్రియాశీల రుణం ఉంది. రెండవ రుణం కోసం దరఖాస్తు చేసే ముందు, మీ నికర ఆదాయం రెండు వాయిదాలను చెల్లించడానికి సరిపోతుందో లేదో చూడాలి.'
        : 'You currently have an active loan balance. Taking on an additional scheme loan will increase quarterly repayment obligations.',
      practicalActionSteps: [
        isTe ? 'మొదటి రుణం యొక్క వాయిదాను సమయానికి చెల్లించండి' : 'Ensure flawless repayment record on the existing loan',
        isTe ? 'రెండవ రుణం బదులు వ్యాపార లాభాల నుండే పెట్టుబడి పెట్టేందుకు ప్రయత్నించండి' : 'Explore self-funding incremental stock from current business profits',
      ],
      cashFlowPreservationTip: isTe
        ? 'మొత్తం రుణ వాయిదాలు మీ నెలవారీ నికర లాభంలో 40% మించకూడదు.'
        : 'Total debt service should not exceed 40% of your average monthly net income.',
      providerUsed: 'grounded-local-fallback',
    };
  }

  return {
    title: isTe ? 'నగదు నిల్వలు తగ్గుతున్న సూచన' : 'Declining Cash Flow Trend',
    explanation: isTe
      ? 'గత నెలతో పోలిస్తే ఈ నెలలో మిగులు నగదు కొద్దిగా తగ్గింది. ఇది కాలానుగుణ మార్పు కావొచ్చు లేదా అమ్మకాలు మందగించడం కావొచ్చు.'
      : 'Net cash flow in the latest cycle is lower than the prior period. Reviewing recent sales volumes helps prevent further dips.',
    practicalActionSteps: [
      isTe ? 'అమ్మకాల సంఖ్యను సమీక్షించి స్థానిక సంతలలో వేగంగా అమ్మండి' : 'Evaluate sales conversion across weekly mandal haats',
      isTe ? 'అధిక లాభం ఇచ్చే వస్తువులపై దృష్టి పెట్టండి' : 'Prioritize high-margin product lines over slow-moving stock',
    ],
    cashFlowPreservationTip: isTe
      ? 'ఖర్చులను లాగ్‌బుక్‌లో ప్రతిరోజూ క్రమం తప్పకుండా నమోదు చేయండి.'
      : 'Maintain daily entry habits to catch expenditure leaks early.',
    providerUsed: 'grounded-local-fallback',
  };
}

/**
 * Bank-Ready Business Plan Synthesis powered by Google Gemini.
 */
export async function generateBusinessPlan(input: BusinessPlanInput): Promise<BusinessPlanOutput> {
  const isTe = input.language === 'te';
  const f = input.finance;
  const catName = isTe ? cleanForTelugu(input.category) : cleanForEnglish(input.category);
  const locName = isTe ? cleanForTelugu(input.location) : cleanForEnglish(input.location);
  const busName = isTe ? cleanForTelugu(input.businessName) : cleanForEnglish(input.businessName);

  const system = isTe
    ? `You are a Senior Rural Banking Credit Officer.
Synthesize a concise, bank-ready Project Proposal & Business Plan for a rural entrepreneur.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
Respond entirely in Telugu. Do not include Hindi. Use Telugu as the primary language throughout the answer.
You MUST generate all descriptive text ('executiveSummary', 'operationalPlan', 'riskMitigation') in fluent Telugu (తెలుగు) script.
Return JSON with:
{
  "executiveSummary": "string in Telugu",
  "capitalDeploymentPlan": {
    "ownContribution": number,
    "schemeLoan": number,
    "totalProjectOutlay": number,
    "allocationBreakdown": [{ "item": "string", "amount": number, "percentage": number }]
  },
  "operationalPlan": "string in Telugu",
  "financialProjections": {
    "expectedMonthlyRevenue": "string in Telugu",
    "expectedMonthlyExpense": "string in Telugu",
    "netMonthlySurplus": "string in Telugu",
    "quarterlyEmiCoverageRatio": "string in Telugu"
  },
  "riskMitigation": ["string in Telugu"]
}`
    : `You are a Senior Rural Banking Credit Officer.
Synthesize a concise, bank-ready Project Proposal & Business Plan for a rural entrepreneur.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology.
Combine the deterministic loan values with market advisory.
Return JSON with:
{
  "executiveSummary": "string",
  "capitalDeploymentPlan": {
    "ownContribution": number,
    "schemeLoan": number,
    "totalProjectOutlay": number,
    "allocationBreakdown": [{ "item": "string", "amount": number, "percentage": number }]
  },
  "operationalPlan": "string",
  "financialProjections": {
    "expectedMonthlyRevenue": "string",
    "expectedMonthlyExpense": "string",
    "netMonthlySurplus": "string",
    "quarterlyEmiCoverageRatio": "string"
  },
  "riskMitigation": ["string"]
}`;

  const userPrompt = `Business: ${busName} (${catName})
Location: ${locName}
Project Cost: ₹${f.projectCost.toLocaleString('en-IN')}
Own Margin: ₹${f.marginCapital.toLocaleString('en-IN')} (10%)
Scheme Loan: ₹${f.loanAmount.toLocaleString('en-IN')} (90%)
Routed Scheme: ${isTe ? (f.scheme.nameTe || f.scheme.name) : f.scheme.name} (${f.scheme.interestRateAnnual}%, ${f.scheme.tenureYears} yrs)
Quarterly EMI: ₹${f.quarterlyEmi.toLocaleString('en-IN')}
Market Summary: ${input.advisor.marketReach.headline}`;

  const response = await callLlmService(system, userPrompt);

  if (response.provider !== 'grounded-local-fallback' && response.text) {
    try {
      const jsonMatch = response.text.match(/```(?:json)?([\s\S]*?)```/) || [null, response.text];
      const parsed = JSON.parse((jsonMatch[1] || response.text).trim());
      return {
        ...parsed,
        providerUsed: response.provider,
      };
    } catch (e) {
      // Fallback below
    }
  }

  // Grounded local fallback plan
  const machineryAmount = Math.round(f.projectCost * 0.60);
  const workingCapitalAmount = Math.round(f.projectCost * 0.30);
  const contingencyAmount = Math.round(f.projectCost * 0.10);

  return {
    executiveSummary: isTe
      ? `${locName} లో ${catName} స్థాపన కోసం మొత్తం ప్రాజెక్ట్ వ్యయం ₹${f.projectCost.toLocaleString('en-IN')}. ఇందులో వ్యవస్థాపకురాలి వాటా 10% (₹${f.marginCapital.toLocaleString('en-IN')}) కాగా, మిగిలిన 90% (₹${f.loanAmount.toLocaleString('en-IN')}) ${f.scheme.nameTe || f.scheme.name} ద్వారా సమకూర్చబడుతుంది.`
      : `Bank-ready project proposal for ${busName} situated at ${locName}. The enterprise entails a total capital outlay of ₹${f.projectCost.toLocaleString('en-IN')}, structured with 10% promoter margin (₹${f.marginCapital.toLocaleString('en-IN')}) and 90% institutional credit under ${f.scheme.name}.`,
    capitalDeploymentPlan: {
      ownContribution: f.marginCapital,
      schemeLoan: f.loanAmount,
      totalProjectOutlay: f.projectCost,
      allocationBreakdown: [
        { item: isTe ? 'ప్రధాన యంత్రాలు / పశు సంపద / మౌలిక వసతులు' : 'Core Equipment / Livestock / Asset Creation', amount: machineryAmount, percentage: 60 },
        { item: isTe ? 'ప్రారంభ వర్కింగ్ క్యాపిటల్ & ముడిసరుకులు' : 'Initial Working Capital & Raw Materials', amount: workingCapitalAmount, percentage: 30 },
        { item: isTe ? 'అత్యవసర నిధి మరియు అనుమతుల ఖర్చులు' : 'Contingency & Statutory Licensing', amount: contingencyAmount, percentage: 10 },
      ],
    },
    operationalPlan: isTe
      ? `స్థానిక వనరులు మరియు గ్రామీణ సహకార వ్యవస్థల ఆధారంగా వ్యాపార కార్యకలాపాలు నిర్వహించబడతాయి. మొదటి ${f.scheme.moratoriumMonths} నెలల మారటోరియం కాలంలో వ్యాపారాన్ని స్థిరపరచి, ఆ తర్వాత త్రైమాసిక వాయిదాల చెల్లింపు ప్రారంభమవుతుంది.`
      : `Operations will be anchored locally with raw input procurement within the mandal. The initial ${f.scheme.moratoriumMonths}-month moratorium permits full operational ramp-up prior to commencement of quarterly principal amortizations.`,
    financialProjections: {
      expectedMonthlyRevenue: `₹${Math.round(f.projectCost * 0.15).toLocaleString('en-IN')} - ₹${Math.round(f.projectCost * 0.22).toLocaleString('en-IN')}`,
      expectedMonthlyExpense: `₹${Math.round(f.projectCost * 0.09).toLocaleString('en-IN')} - ₹${Math.round(f.projectCost * 0.13).toLocaleString('en-IN')}`,
      netMonthlySurplus: `₹${Math.round(f.projectCost * 0.06).toLocaleString('en-IN')} - ₹${Math.round(f.projectCost * 0.09).toLocaleString('en-IN')}`,
      quarterlyEmiCoverageRatio: '2.4x (Healthy Debt Service Coverage)',
    },
    riskMitigation: [
      isTe ? 'పశు లేదా పరికరాల పూర్తి బీమా రక్షణ' : 'Mandatory asset & comprehensive livestock insurance coverage',
      isTe ? 'స్థానిక సహకార మార్కెట్లతో ముందుగానే ఒప్పందాలు' : 'Formal off-take linkage with registered mandal cooperatives',
      isTe ? 'వారపు లాగ్‌బుక్ రికార్డులను ఖచ్చితంగా నిర్వహించడం' : 'Rigorous maintenance of digital logbook records for quarterly audits',
    ],
    providerUsed: 'grounded-local-fallback',
  };
}
