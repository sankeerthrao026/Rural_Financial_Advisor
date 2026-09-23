/**
 * RuralCred Advisor — Deterministic Business & Capacity Calculation Engine.
 * Provides exact unit economics calculations for rural micro-enterprises.
 */

export type BusinessDomain =
  | 'handloom_weaving'
  | 'dairy_farming'
  | 'retail_shop'
  | 'poultry_farming'
  | 'tailoring_garments'
  | 'agri_processing'
  | 'agriculture_crop'
  | 'general_enterprise';

export interface ParsedQueryIntent {
  intent:
    | 'location_selection'
    | 'investment_decision'
    | 'capacity_calculation'
    | 'profitability_calculation'
    | 'break_even_calculation'
    | 'volume_target_calculation'
    | 'expansion_capital_calculation'
    | 'raw_material_optimization'
    | 'pricing_guidance'
    | 'government_schemes'
    | 'seasonal_operational_advice'
    | 'cash_flow_optimization'
    | 'general_advisory';
  targetAmount: number | null;
  isNumerical: boolean;
  entity: 'cow' | 'buffalo' | 'bird' | 'loom' | 'milk_litre' | null;
  timeframe: 'annual' | 'monthly' | 'daily';
  domain: BusinessDomain;
}

export interface CapacityCalculationResult {
  category: string;
  unitNameEn: string;
  unitNameTe: string;
  targetProfit: number;
  annualTargetProfit: number;
  exactUnitsNeeded: number;
  recommendedUnits: number;
  unitMetrics: Record<string, any>;
  financialOutlay: {
    totalProjectCost: number;
    promoterMarginRequired: number;
    bankLoanEligible: number;
  };
  assumptions?: string[];
  assumptionsTe?: string[];
}

export function parseTargetAmount(text: string): number | null {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/,/g, '').trim();

  // Lakhs pattern
  const mLakh = clean.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|lac|l|లక్షలు|లక్షల|లక్ష)/i);
  if (mLakh && mLakh[1]) {
    const val = parseFloat(mLakh[1]);
    if (!isNaN(val)) return val * 100000;
  }

  // Crores pattern
  const mCr = clean.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|crs?|cr|కోట్లు|కోట్ల|కోటి)/i);
  if (mCr && mCr[1]) {
    const val = parseFloat(mCr[1]);
    if (!isNaN(val)) return val * 10000000;
  }

  // Thousands pattern
  const mK = clean.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|వేలు|వేల)/i);
  if (mK && mK[1]) {
    const val = parseFloat(mK[1]);
    if (!isNaN(val)) return val * 1000;
  }

  // Raw numbers >= 1000
  const mNum = clean.match(/(?:₹|rs\.?|inr\s*)?\s*(\d{4,9})(?:\.\d+)?/i);
  if (mNum && mNum[1]) {
    const val = parseFloat(mNum[1]);
    if (!isNaN(val) && val >= 1000) return val;
  }

  return null;
}

export function detectBusinessDomain(
  query: string = '',
  history?: { role: string; content: string }[],
  fallbackCategory: string = 'Dairy Farming'
): BusinessDomain {
  const checkText = (text: string): BusinessDomain | null => {
    if (!text) return null;
    const t = text.toLowerCase();

    // Handloom / Weaving
    if (
      [
        'handloom', 'weaving', 'powerloom', 'loom', 'looms', 'saree', 'sarees', 'ikat',
        'pochampally', 'yarn', 'fabric', 'textile', 'textiles', 'weaver', 'weavers',
        'చేనేత', 'మగ్గం', 'మగ్గాలు', 'చీరలు', 'నూలు', 'వస్త్రాలు', 'పవర్లూమ్', 'हथकरघा'
      ].some((w) => t.includes(w))
    ) {
      return 'handloom_weaving';
    }

    // Dairy Farming
    if (
      [
        'dairy', 'cow', 'cows', 'buffalo', 'buffaloes', 'milch', 'milk', 'fodder', 'cattle',
        'butter', 'ghee', 'curd', 'lactation', 'dairy farm', 'పాడి', 'ఆవు', 'ఆవులు', 'బర్రె',
        'గేదె', 'గేదెలు', 'పాలు', 'దాణా', 'పశువులు', 'డెయిరీ', 'దుగ్ధ'
      ].some((w) => t.includes(w))
    ) {
      return 'dairy_farming';
    }

    // Retail / Kirana Shop
    if (
      [
        'kirana', 'grocery', 'provision', 'shop', 'retail', 'store', 'supermarket', 'general store',
        'fmcg', 'కిరాణా', 'షాప్', 'దుకాణం', 'జనరల్ స్టోర్', 'స్టోర్', 'కిరాణా దుకాణం'
      ].some((w) => t.includes(w))
    ) {
      return 'retail_shop';
    }

    // Poultry Farming
    if (
      [
        'poultry', 'chicken', 'broiler', 'layers', 'egg', 'eggs', 'bird', 'birds', 'natukodi',
        'desi murgi', 'hatchery', 'కోళ్లు', 'పౌల్ట్రీ', 'కోడి', 'గుడ్లు', 'నాటు కోడి'
      ].some((w) => t.includes(w))
    ) {
      return 'poultry_farming';
    }

    // Tailoring & Boutique
    if (
      [
        'tailor', 'tailoring', 'boutique', 'stitching', 'garment', 'garments', 'blouse', 'embroidery',
        'maggam work', 'sewing', 'టైలరింగ్', 'కుట్లు', 'బోటిక్', 'రవికె', 'మగ్గం వర్క్'
      ].some((w) => t.includes(w))
    ) {
      return 'tailoring_garments';
    }

    // Agri-Processing & Milling
    if (
      [
        'flour mill', 'spice mill', 'rice mill', 'chilli powder', 'milling', 'processing mill',
        'పిండి మిల్లు', 'మిర్చి మిల్లు', 'వరి మిల్లు', 'మసాలా మిల్లు'
      ].some((w) => t.includes(w))
    ) {
      return 'agri_processing';
    }

    // Agriculture / Crops
    if (
      [
        'crop', 'farming', 'cotton', 'paddy', 'chilli', 'turmeric', 'horticulture', 'seeds',
        'fertilizer', 'pesticide', 'harvest', 'వ్యవసాయం', 'పంట', 'పత్తి', 'వరి', 'మిర్చి', 'పసుపు'
      ].some((w) => t.includes(w))
    ) {
      return 'agriculture_crop';
    }

    return null;
  };

  // Priority 1: Current query
  if (query) {
    const dom = checkText(query);
    if (dom) return dom;
  }

  // Priority 2: Recent user messages in history
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user' && msg.content) {
        const dom = checkText(msg.content);
        if (dom) return dom;
      }
    }
  }

  // Priority 3: Fallback category
  const fbDom = checkText(fallbackCategory);
  if (fbDom) return fbDom;

  const fbLower = fallbackCategory.toLowerCase();
  if (fbLower.includes('weave') || fbLower.includes('handloom') || fbLower.includes('textile')) return 'handloom_weaving';
  if (fbLower.includes('dairy') || fbLower.includes('milk') || fbLower.includes('cow')) return 'dairy_farming';
  if (fbLower.includes('kirana') || fbLower.includes('grocery') || fbLower.includes('retail') || fbLower.includes('shop')) return 'retail_shop';
  if (fbLower.includes('poultry') || fbLower.includes('chicken') || fbLower.includes('bird')) return 'poultry_farming';
  if (fbLower.includes('tailor') || fbLower.includes('garment')) return 'tailoring_garments';
  if (fbLower.includes('mill') || fbLower.includes('agri')) return 'agri_processing';

  return 'general_enterprise';
}

export function classifyQueryIntent(
  query: string,
  history?: { role: string; content: string }[],
  fallbackCategory: string = 'Dairy Farming'
): ParsedQueryIntent {
  const domain = detectBusinessDomain(query, history, fallbackCategory);

  if (!query) {
    return {
      intent: 'general_advisory',
      targetAmount: null,
      isNumerical: false,
      entity: null,
      timeframe: 'annual',
      domain,
    };
  }

  const q = query.toLowerCase().trim();
  const targetAmt = parseTargetAmount(q);

  const isMonthly = ['month', 'monthly', 'నెల', 'నెలకు', 'మాసం', 'प्रति माह'].some((w) => q.includes(w));
  const isDaily = ['day', 'daily', 'రోజు', 'రోజుకు', 'రోజూ', 'प्रति दिन'].some((w) => q.includes(w));
  const timeframe = isDaily ? 'daily' : isMonthly ? 'monthly' : 'annual';

  // 1. Location Selection / Business Location Analysis (HIGH PRIORITY)
  const isLocationSelection = [
    'where should i establish', 'where can i establish', 'where should i open', 'where can i open',
    'where should i start', 'where to establish', 'where to open', 'where to set up', 'where to start',
    'suggest me places', 'suggest places', 'suggest some places', 'which localities', 'which locality',
    'which area', 'which location', 'best locations', 'best location', 'best localities', 'best place',
    'best places', 'good location', 'good place', 'profitable location', 'where i can get great profits',
    'where if i establish', 'which area is better', 'suitable location', 'cluster', 'location for my',
    'place for my', 'where to locate', 'area for my', 'localities can give', 'places where',
    'ఎక్కడ ప్రారంభించాలి', 'ఎక్కడ పెట్టాలి', 'ఎక్కడ స్థాపించాలి', 'ఏ ప్రాంతం', 'ఏ ప్రదేశాలు',
    'స్థలాలు', 'మంచి ప్రదేశం', 'లొకేషన్', 'ఏ ఊరు', 'ప్రదేశం', 'స్థలం ఎంపిక', 'ఏ ఏరియా', 'ప్రదేశాలు'
  ].some((w) => q.includes(w));

  // 2. Feed / Raw Material / Input Sourcing (Check before generic buy/invest)
  const isFeed = [
    'feed', 'fodder', 'raw material', 'input cost', 'cost of feed', 'yarn', 'fabric', 'daana', 'దాణా',
    'పచ్చిగడ్డి', 'ముడిసరుకు', 'తక్కువ ఖర్చు', 'నూలు', 'చౌకగా', 'buy feed', 'cheaper'
  ].some((w) => q.includes(w));

  // 3. Investment Decision
  const isInvestmentDecision = !isFeed && [
    'should i buy', 'can i buy', 'want to buy', 'is that a good investment', 'good investment',
    'is it safe to buy', 'safe for me to buy', 'is it safe to invest', 'worth buying', 'worth investing',
    'air conditioner', 'buy an ac', 'buy a machine', 'buy equipment', 'కొనవచ్చా', 'మంచి పెట్టుబడేనా'
  ].some((w) => q.includes(w));

  // 4. Quantity / Capacity calculation
  const isQuantityCalc = [
    'how many', 'how much animal', 'number of', 'ఎన్ని ఆవులు', 'ఎన్ని బర్రెలు', 'ఎన్ని కోళ్లు', 'ఎన్ని మగ్గాలు',
    'ఎన్ని', 'కౌస్', 'ఆవులు కావాలి', 'బర్రెలు కావాలి', 'how many cows', 'how many buffalo', 'how many birds',
    'how many looms', 'how much capacity', 'cows do i need', 'buffaloes do i need'
  ].some((w) => q.includes(w));

  // 5. Profitability inquiry
  const isProfitInquiry = [
    'how much profit', 'my profit', 'expected profit', 'profit margin', 'what profit',
    'net profit', 'income of', 'earning', 'earnings', 'లాభం ఎంత', 'నికర లాభం', 'ఎంత లాభం',
    'సంపాదన', 'मुनाफा'
  ].some((w) => q.includes(w));

  const isBreakEven = [
    'break even', 'break-even', 'breakeven', 'నో లాస్ నో ప్రాఫిట్', 'బ్రేక్ ఈవెన్', 'ఖర్చులు రాబట్టడం'
  ].some((w) => q.includes(w));

  const isVolumeTarget = [
    'how much milk', 'milk do i need to sell', 'litres', 'how much sales', 'volume to sell', 'how much turnover',
    'ఎంత పాలు', 'ఎన్ని లీటర్లు', 'ఎంత అమ్మాలి', 'అమ్మకాలు ఎంత చేయాలి'
  ].some((w) => q.includes(w));

  const isExpansionCalc = [
    'expand', 'expansion', 'expanding', 'next village', 'scale up', 'capital do i need',
    'cost to expand', 'investment to expand', 'how much capital', 'విస్తరణ ఖర్చు',
    'పెట్టుబడి ఎంత కావాలి', 'మరో 2 ఆవులు కొనడానికి', 'ఎంత పెట్టుబడి', 'విస్తరించడానికి', 'విస్తరణ'
  ].some((w) => q.includes(w));

  const isPricing = [
    'pricing', 'selling price', 'rate per', 'cost per', 'charge', 'ధర', 'ఎంత అమ్మాలి', 'ధర నిర్ణయం', 'రేటు', 'కిలో ధర'
  ].some((w) => q.includes(w));

  const isSchemes = [
    'scheme', 'subsidy', 'subsidies', 'government', 'mudra', 'pmegp', 'nbcfdc', 'vishwakarma', 'stand-up',
    'సబ్సిడీ', 'పథకం', 'ప్రభుత్వ పథకాలు', 'రాయితీ'
  ].some((w) => q.includes(w));

  const isSummerHeat = [
    'summer', 'heat', 'hot', 'yield in summer', 'temperature', 'weather', 'lean season',
    'ఎండ', 'వేసవి', 'దిగుబడి'
  ].some((w) => q.includes(w));

  const isCashFlow = [
    'cash flow', 'low sales', 'lean month', 'off-season', 'working capital', 'udhaari', 'credit', 'బాకీలు',
    'నగదు', 'తక్కువ అమ్మకాలు', 'ఖర్చులు'
  ].some((w) => q.includes(w));

  let intent: ParsedQueryIntent['intent'] = 'general_advisory';
  let isNumerical = false;

  if (isLocationSelection) {
    intent = 'location_selection';
    isNumerical = false;
  } else if (isInvestmentDecision) {
    intent = 'investment_decision';
    isNumerical = false;
  } else if (isQuantityCalc && (targetAmt || isProfitInquiry)) {
    intent = 'capacity_calculation';
    isNumerical = true;
  } else if (isVolumeTarget && targetAmt) {
    intent = 'volume_target_calculation';
    isNumerical = true;
  } else if (isBreakEven) {
    intent = 'break_even_calculation';
    isNumerical = true;
  } else if (isExpansionCalc) {
    intent = 'expansion_capital_calculation';
    isNumerical = true;
  } else if (isProfitInquiry && targetAmt) {
    intent = 'capacity_calculation';
    isNumerical = true;
  } else if (isProfitInquiry) {
    intent = 'profitability_calculation';
    isNumerical = true;
  } else if (isFeed) {
    intent = 'raw_material_optimization';
    isNumerical = false;
  } else if (isPricing) {
    intent = 'pricing_guidance';
    isNumerical = false;
  } else if (isSchemes) {
    intent = 'government_schemes';
    isNumerical = false;
  } else if (isSummerHeat) {
    intent = 'seasonal_operational_advice';
    isNumerical = false;
  } else if (isCashFlow) {
    intent = 'cash_flow_optimization';
    isNumerical = false;
  } else if (targetAmt) {
    intent = 'capacity_calculation';
    isNumerical = true;
  }

  let entity: ParsedQueryIntent['entity'] = null;
  if (['cow', 'cows', 'ఆవు', 'ఆవులు'].some((w) => q.includes(w))) entity = 'cow';
  else if (['buffalo', 'buffaloes', 'బర్రె', 'గేదె', 'బర్రెలు'].some((w) => q.includes(w))) entity = 'buffalo';
  else if (['bird', 'birds', 'hen', 'hens', 'chicken', 'కోళ్లు', 'కోడి'].some((w) => q.includes(w))) entity = 'bird';
  else if (['loom', 'looms', 'మగ్గం', 'మగ్గాలు'].some((w) => q.includes(w))) entity = 'loom';
  else if (['milk', 'litre', 'litres', 'పాలు', 'లీటర్లు'].some((w) => q.includes(w))) entity = 'milk_litre';

  return {
    intent,
    targetAmount: targetAmt,
    isNumerical,
    entity,
    timeframe,
    domain,
  };
}

export function calculateCapacityForTargetProfit(
  category: string,
  targetProfit: number,
  timeframe: 'annual' | 'monthly' | 'daily' = 'annual'
): CapacityCalculationResult {
  const catLower = (category || '').toLowerCase();
  const target = targetProfit && targetProfit > 0 ? targetProfit : 500000;
  const annualTarget = timeframe === 'monthly' ? target * 12 : target;

  if (catLower.includes('dairy') || catLower.includes('పాడి') || catLower.includes('cow') || catLower.includes('milk')) {
    const yieldPerDay = 10;
    const milkingDays = 300;
    const annualLitresPerCow = yieldPerDay * milkingDays; // 3,000 L
    const sellingPricePerL = 55;
    const annualRevPerCow = annualLitresPerCow * sellingPricePerL; // 1,65,000
    const annualOpexPerCow = 75000; // 75,000
    const netProfitPerCowAnnual = annualRevPerCow - annualOpexPerCow; // 90,000
    const netProfitPerCowMonthly = netProfitPerCowAnnual / 12; // 7,500

    const exactUnits = annualTarget / netProfitPerCowAnnual;
    const recommendedUnits = Math.max(1, Math.ceil(exactUnits));
    const capexPerUnit = 75000;
    const totalProjectCost = recommendedUnits * capexPerUnit;

    return {
      category: 'Dairy Farming',
      unitNameEn: 'milch cows',
      unitNameTe: 'పాడి ఆవులు',
      targetProfit: target,
      annualTargetProfit: annualTarget,
      exactUnitsNeeded: Math.round(exactUnits * 100) / 100,
      recommendedUnits,
      unitMetrics: {
        dailyYieldLitres: yieldPerDay,
        milkingDaysPerYear: milkingDays,
        annualProductionLitres: annualLitresPerCow,
        sellingPricePerLitre: sellingPricePerL,
        annualRevenuePerUnit: annualRevPerCow,
        annualOpexPerUnit: annualOpexPerCow,
        netProfitPerUnitAnnual: netProfitPerCowAnnual,
        netProfitPerUnitMonthly: netProfitPerCowMonthly,
        capexPerUnit,
      },
      financialOutlay: {
        totalProjectCost,
        promoterMarginRequired: totalProjectCost * 0.1,
        bankLoanEligible: totalProjectCost * 0.9,
      },
      assumptions: [
        'Average milk yield of 10 Litres/day per crossbred cow over a 300-day lactation cycle.',
        'Blended farm-gate & direct retail milk selling price of ₹55 per Litre.',
        'Annual operating cost of ~₹75,000 per cow (Feed & Fodder 55%, Vet/AI 10%, Labor 20%, Utilities 15%).',
        'Net annual profit of approximately ₹90,000 per milch cow (₹7,500/month).',
      ],
      assumptionsTe: [
        'ఒక సంకరజాతి పాడి ఆవు 300 రోజుల పాల కాలంలో రోజుకు సగటున 10 లీటర్ల దిగుబడిని ఇస్తుంది.',
        'స్థానిక మండి మరియు ప్రత్యక్ష రిటైల్ విక్రయాల సగటు ధర లీటరుకు ₹55.',
        'ఒక ఆవుకు వార్షిక నిర్వహణ ఖర్చు దాదాపు ₹75,000 (దాణా & పచ్చిగడ్డి 55%, పశువైద్యం 10%, శ్రమ 20%, రవాణా/విద్యుత్ 15%).',
        'ప్రతి పాడి ఆవు నుండి సంవత్సరానికి దాదాపు ₹90,000 (నెలకు ₹7,500) నికర లాభం లభిస్తుంది.',
      ],
    };
  } else if (catLower.includes('poultry') || catLower.includes('కోడి') || catLower.includes('chicken')) {
    const netProfitPerBirdAnnual = 180;
    const exactUnits = annualTarget / netProfitPerBirdAnnual;
    const recommendedUnits = Math.max(100, Math.ceil(exactUnits / 50) * 50);
    const capexPerBird = 250;
    const totalProjectCost = recommendedUnits * capexPerBird;

    return {
      category: 'Poultry Farming',
      unitNameEn: 'broiler birds (shed capacity)',
      unitNameTe: 'పౌల్ట్రీ పక్షుల షెడ్ సామర్థ్యం',
      targetProfit: target,
      annualTargetProfit: annualTarget,
      exactUnitsNeeded: Math.round(exactUnits * 10) / 10,
      recommendedUnits,
      unitMetrics: {
        batchesPerYear: 6,
        netProfitPerBirdBatch: 30,
        netProfitPerUnitAnnual: netProfitPerBirdAnnual,
        netProfitPerUnitMonthly: netProfitPerBirdAnnual / 12,
        capexPerUnit: capexPerBird,
      },
      financialOutlay: {
        totalProjectCost,
        promoterMarginRequired: totalProjectCost * 0.1,
        bankLoanEligible: totalProjectCost * 0.9,
      },
      assumptions: [
        '6 rearing cycles per year (40-45 day batch cycle).',
        'Net profit of ₹30 per bird per batch (~₹180 per capacity slot annually).',
        'Shed infrastructure capex of ₹250 per bird capacity.',
      ],
      assumptionsTe: [
        'సంవత్సరానికి 6 బ్యాచ్‌ల పెంపకం చక్రం (40-45 రోజులు).',
        'ఒక పక్షికి బ్యాచ్‌కు ₹30 నికర లాభం (వార్షికంగా ₹180).',
        'షెడ్ మౌలిక సదుపాయాల వ్యయం ఒక్కో పక్షికి ₹250.',
      ],
    };
  } else if (catLower.includes('weaving') || catLower.includes('handloom') || catLower.includes('చేనేత')) {
    const netProfitPerLoomAnnual = 90000;
    const exactUnits = annualTarget / netProfitPerLoomAnnual;
    const recommendedUnits = Math.max(1, Math.ceil(exactUnits));
    const capexPerLoom = 50000;
    const totalProjectCost = recommendedUnits * capexPerLoom;

    return {
      category: 'Handloom & Weaving',
      unitNameEn: 'traditional handlooms',
      unitNameTe: 'చేనేత మగ్గాలు',
      targetProfit: target,
      annualTargetProfit: annualTarget,
      exactUnitsNeeded: Math.round(exactUnits * 100) / 100,
      recommendedUnits,
      unitMetrics: {
        sareesPerMonth: 3,
        annualSareesPerLoom: 36,
        netProfitPerSaree: 2500,
        netProfitPerUnitAnnual: netProfitPerLoomAnnual,
        netProfitPerUnitMonthly: netProfitPerLoomAnnual / 12,
        capexPerUnit: capexPerLoom,
      },
      financialOutlay: {
        totalProjectCost,
        promoterMarginRequired: totalProjectCost * 0.1,
        bankLoanEligible: totalProjectCost * 0.9,
      },
      assumptions: [
        'Production of 3 traditional sarees per month per active loom (36 sarees/year).',
        'Net profit margin of ₹2,500 per saree after yarn, dyes, and weaving labor.',
        'Annual net profit of ~₹90,000 per handloom.',
      ],
      assumptionsTe: [
        'ఒక మగ్గంపై నెలకు 3 చేనేత చీరల ఉత్పత్తి (సంవత్సరానికి 36 చీరలు).',
        'నూలు, రంగులు మరియు శ్రమ ఖర్చులు పోను చీరకు ₹2,500 నికర లాభం.',
        'ఒక మగ్గం నుండి వార్షిక నికర లాభం సుమారు ₹90,000.',
      ],
    };
  } else {
    const netMarginPct = 15;
    const annualTurnoverNeeded = annualTarget / (netMarginPct / 100);
    const monthlyTurnoverNeeded = annualTurnoverNeeded / 12;
    const dailyTurnoverNeeded = annualTurnoverNeeded / 365;

    return {
      category: category || 'Rural Enterprise',
      unitNameEn: 'gross annual sales turnover',
      unitNameTe: 'వార్షిక స్థూల అమ్మకాల టర్నోవర్',
      targetProfit: target,
      annualTargetProfit: annualTarget,
      exactUnitsNeeded: Math.round(annualTurnoverNeeded),
      recommendedUnits: Math.round(annualTurnoverNeeded),
      unitMetrics: {
        netMarginPercentage: netMarginPct,
        annualTurnoverNeeded,
        monthlyTurnoverNeeded,
        dailyTurnoverNeeded,
        netProfitPerUnitAnnual: annualTarget,
        netProfitPerUnitMonthly: annualTarget / 12,
        capexPerUnit: annualTurnoverNeeded * 0.25,
      },
      financialOutlay: {
        totalProjectCost: annualTurnoverNeeded * 0.25,
        promoterMarginRequired: (annualTurnoverNeeded * 0.25) * 0.1,
        bankLoanEligible: (annualTurnoverNeeded * 0.25) * 0.9,
      },
      assumptions: [
        `Realistic net operating profit margin of ${netMarginPct}% for rural retail/services.`,
        `Daily gross sales target of ₹${Math.round(dailyTurnoverNeeded).toLocaleString('en-IN')} (₹${Math.round(monthlyTurnoverNeeded).toLocaleString('en-IN')}/month).`,
      ],
      assumptionsTe: [
        `గ్రామీణ వ్యాపారాలకు వాస్తవిక నికర లాభ మార్జిన్ ${netMarginPct}%.`,
        `రోజువారీ సగటు అమ్మకాల లక్ష్యం ₹${Math.round(dailyTurnoverNeeded).toLocaleString('en-IN')} (నెలకు ₹${Math.round(monthlyTurnoverNeeded).toLocaleString('en-IN')}).`,
      ],
    };
  }
}
