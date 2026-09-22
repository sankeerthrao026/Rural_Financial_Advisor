/**
 * RuralCred Advisor — Pure Deterministic Multi-Scheme Calculation Engine.
 * 
 * Standardizes calculation logic for:
 * 1. MUDRA (PMMY) — Shishu (up to ₹50k), Kishore (₹50k–₹5L), Tarun (₹5L–₹10L).
 * 2. PM Vishwakarma — Traditional artisans (5.0% concessional interest, ₹15k toolkit grant, 100% CGTMSE).
 * 3. Stand-Up India — Women and SC/ST greenfield entrepreneurs (₹10L–₹1Cr, 15% margin, CGSUI guarantee).
 * 4. PMEGP — Credit-linked capital subsidy (25%–35% rural subsidy, 5%–10% promoter equity, CGTMSE).
 * 5. NBCFDC — Backward classes micro (6.5%) and term loan (8.0%) with grace periods.
 * 
 * Pure functions: (entrepreneur profile + loan request) -> (eligibility + numbers).
 * Reused across Frontend UI, API Client, and Scheme Matching.
 */

export interface SchemeEligibilityInput {
  loanAmount: number;
  category: string;
  gender: 'female' | 'male' | 'other' | string;
  socialCategory: 'General' | 'OBC' | 'SC' | 'ST' | string;
  locationType: 'rural' | 'urban';
  isNewEnterprise?: boolean;
  isArtisanTrade?: boolean;
}

export interface SchemeCalculationResult {
  schemeId: string;
  schemeName: string;
  schemeNameTe: string;
  category: string;
  agency: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  maxEligibleLoan: number;
  requestedLoanAmount: number;
  sanctionedLoanAmount: number;
  promoterContribution: number;
  promoterContributionPercent: number;
  totalProjectCost: number;
  interestRateAnnual: number;
  subsidyPercent?: number;
  subsidyAmount?: number;
  tenureYears: number;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyEmi: number;
  quarterlyEmi: number;
  totalInterestPaid: number;
  totalRepayment: number;
  collateralFree: boolean;
  guaranteeCoverage: string;
  guaranteeCoverageTe: string;
  benefits: string[];
  benefitsTe: string[];
  isTopMatch?: boolean;
}

export function calculateReducingEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
  moratoriumMonths: number = 0
): {
  monthlyEmi: number;
  quarterlyEmi: number;
  totalInterestPaid: number;
  totalRepayment: number;
} {
  const p = Math.max(0, principal);
  if (p <= 0 || tenureMonths <= 0) {
    return { monthlyEmi: 0, quarterlyEmi: 0, totalInterestPaid: 0, totalRepayment: 0 };
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const repaymentMonths = Math.max(1, tenureMonths - moratoriumMonths);

  let monthlyEmi = 0;
  if (monthlyRate > 0 && repaymentMonths > 0) {
    const compound = Math.pow(1 + monthlyRate, repaymentMonths);
    monthlyEmi = (p * monthlyRate * compound) / (compound - 1);
  } else {
    monthlyEmi = p / repaymentMonths;
  }

  const moratoriumInterest = p * monthlyRate * moratoriumMonths;
  const postMoratoriumRepayment = monthlyEmi * repaymentMonths;
  const totalRepayment = Math.round(moratoriumInterest + postMoratoriumRepayment);
  const totalInterest = Math.max(0, Math.round(totalRepayment - p));

  const quarterlyRate = annualRatePercent / 100 / 4;
  const quarterlyRepaymentPeriods = Math.max(1, Math.round(repaymentMonths / 3));
  let quarterlyEmi = 0;
  if (quarterlyRate > 0 && quarterlyRepaymentPeriods > 0) {
    const qCompound = Math.pow(1 + quarterlyRate, quarterlyRepaymentPeriods);
    quarterlyEmi = (p * quarterlyRate * qCompound) / (qCompound - 1);
  } else {
    quarterlyEmi = p / quarterlyRepaymentPeriods;
  }

  return {
    monthlyEmi: Math.round(monthlyEmi),
    quarterlyEmi: Math.round(quarterlyEmi),
    totalInterestPaid: totalInterest,
    totalRepayment,
  };
}

export const VISHWAKARMA_TRADES = [
  'weaver', 'weaving', 'handloom', 'textile', 'spinning',
  'carpenter', 'suthar', 'woodcraft',
  'potter', 'kumhaar', 'clay', 'ceramics',
  'blacksmith', 'lohar', 'ironwork', 'metal',
  'goldsmith', 'sonar', 'jewelry',
  'cobbler', 'charmakar', 'leather', 'footwear',
  'sculptor', 'moortikar', 'stone',
  'tailor', 'darzi', 'stitching', 'garment',
  'barber', 'naai', 'salon',
  'basket', 'broom', 'bamboo', 'coir', 'mat',
  'doll', 'toy', 'handicraft',
  'mason', 'raajmistri', 'construction',
  'dhobi', 'washerman', 'laundry',
  'locksmith', 'armorer', 'boat',
];

export function isArtisanCategory(categoryStr: string): boolean {
  const clean = (categoryStr || '').toLowerCase();
  return VISHWAKARMA_TRADES.some((trade) => clean.includes(trade));
}

// 1. MUDRA Scheme
export function calculateMudra(inp: SchemeEligibilityInput): SchemeCalculationResult {
  const amount = Number(inp.loanAmount) || 50000;
  let tierId = 'mudra-kishore';
  let tierName = 'MUDRA (Kishore Tier)';
  let tierNameTe = 'పీఎం ముద్రా (కిషోర్ - ₹50,000 నుండి ₹5 లక్షలు)';
  let maxLoan = 500000;
  let marginPercent = 10;
  let interestRate = inp.gender.toLowerCase() === 'female' ? 9.75 : 10.0;
  let tenureYears = 5;
  let tenureMonths = 60;
  let moratoriumMonths = 6;
  let tierDesc = 'For expanding micro-enterprises purchasing inventory, equipment, or business stock up to ₹5 Lakhs.';
  let tierDescTe = 'వ్యాపార విస్తరణ మరియు ముడిసరుకు కొనుగోలుకు ₹5 లక్షల వరకు లభించే పూచీకత్తు రహిత రుణం.';

  if (amount <= 50000) {
    tierId = 'mudra-shishu';
    tierName = 'MUDRA (Shishu Tier)';
    tierNameTe = 'పీఎం ముద్రా (శిశు - ₹50,000 వరకు)';
    maxLoan = 50000;
    marginPercent = 0;
    interestRate = 8.5;
    tenureYears = 3;
    tenureMonths = 36;
    moratoriumMonths = 3;
    tierDesc = 'For micro-starters needing small working capital injections with 0% margin money and zero processing fees.';
    tierDescTe = 'చిన్న వ్యాపారాల ప్రారంభానికి ఎటువంటి సొంత వాటా లేకుండా సున్నా ప్రాసెసింగ్ ఫీజుతో లభించే రుణం.';
  } else if (amount > 500000) {
    tierId = 'mudra-tarun';
    tierName = 'MUDRA (Tarun Tier)';
    tierNameTe = 'పీఎం ముద్రా (తరుణ్ - ₹5 లక్షల నుండి ₹10 లక్షలు)';
    maxLoan = 1000000;
    marginPercent = 15;
    interestRate = inp.gender.toLowerCase() === 'female' ? 10.75 : 11.0;
    tenureYears = 5;
    tenureMonths = 60;
    moratoriumMonths = 6;
    tierDesc = 'For established micro-enterprises scaling operations, setting up production units, or upgrading tech.';
    tierDescTe = 'స్థిరపడిన వ్యాపారాల విస్తరణకు ₹10 లక్షల వరకు లభించే ఉన్నత స్థాయి ముద్రా రుణం.';
  }

  const sanctioned = Math.min(amount, maxLoan);
  const loanShare = (100 - marginPercent) / 100;
  const projectCost = marginPercent === 0 ? sanctioned : Math.round(sanctioned / loanShare);
  const promoterContrib = projectCost - sanctioned;

  const emiData = calculateReducingEmi(sanctioned, interestRate, tenureMonths, moratoriumMonths);

  return {
    schemeId: tierId,
    schemeName: tierName,
    schemeNameTe: tierNameTe,
    category: 'Micro Enterprise (PMMY)',
    agency: 'National Credit Guarantee Trustee Company (NCGTC) & Banks',
    isEligible: true,
    maxEligibleLoan: maxLoan,
    requestedLoanAmount: amount,
    sanctionedLoanAmount: sanctioned,
    promoterContribution: promoterContrib,
    promoterContributionPercent: marginPercent,
    totalProjectCost: projectCost,
    interestRateAnnual: interestRate,
    tenureYears,
    tenureMonths,
    moratoriumMonths,
    monthlyEmi: emiData.monthlyEmi,
    quarterlyEmi: emiData.quarterlyEmi,
    totalInterestPaid: emiData.totalInterestPaid,
    totalRepayment: emiData.totalRepayment,
    collateralFree: true,
    guaranteeCoverage: 'CGFMU (Credit Guarantee Fund for Micro Units, up to 75% default cover)',
    guaranteeCoverageTe: 'CGFMU (మైక్రో యూనిట్ల క్రెడిట్ గ్యారెంటీ ఫండ్ ద్వారా రక్షణ)',
    benefits: [
      '100% collateral-free credit with zero mortgage of land or house',
      'Pre-approved MUDRA RuPay debit card for revolving working capital withdrawal',
      tierDesc,
    ],
    benefitsTe: [
      'ఎటువంటి ఆస్తి తాకట్టు అవసరం లేని 100% పూచీకత్తు రహిత రుణం',
      'వర్కింగ్ క్యాపిటల్ అవసరాల కోసం ముద్రా రూపే డెబిట్ కార్డు సదుపాయం',
      tierDescTe,
    ],
  };
}

// 2. PM Vishwakarma Scheme
export function calculatePmVishwakarma(inp: SchemeEligibilityInput): SchemeCalculationResult {
  const amount = Number(inp.loanAmount) || 100000;
  const isArtisan = inp.isArtisanTrade !== undefined ? inp.isArtisanTrade : isArtisanCategory(inp.category);

  const maxLoan = 300000;
  const sanctioned = Math.min(amount, maxLoan);
  const marginPercent = 5;
  const projectCost = Math.round(sanctioned / 0.95);
  const promoterContrib = projectCost - sanctioned;

  const tenureMonths = sanctioned <= 100000 ? 18 : 30;
  const tenureYears = tenureMonths / 12;
  const moratoriumMonths = 3;
  const interestRate = 5.0;

  const emiData = calculateReducingEmi(sanctioned, interestRate, tenureMonths, moratoriumMonths);

  return {
    schemeId: 'pm-vishwakarma',
    schemeName: 'PM Vishwakarma Scheme',
    schemeNameTe: 'పీఎం విశ్వకర్మ పథకం (చేతివృత్తుల రుణం)',
    category: 'Artisan & Traditional Crafts',
    agency: 'Ministry of Micro, Small and Medium Enterprises (MoMSME)',
    isEligible: isArtisan,
    ineligibilityReason: isArtisan
      ? undefined
      : 'PM Vishwakarma is reserved for 18 designated traditional artisan/craft trades (weavers, carpenters, potters, tailors, etc.).',
    maxEligibleLoan: maxLoan,
    requestedLoanAmount: amount,
    sanctionedLoanAmount: sanctioned,
    promoterContribution: promoterContrib,
    promoterContributionPercent: marginPercent,
    totalProjectCost: projectCost,
    interestRateAnnual: interestRate,
    subsidyPercent: 8.0,
    subsidyAmount: Math.round(sanctioned * 0.08 * tenureYears),
    tenureYears,
    tenureMonths,
    moratoriumMonths,
    monthlyEmi: emiData.monthlyEmi,
    quarterlyEmi: emiData.quarterlyEmi,
    totalInterestPaid: emiData.totalInterestPaid,
    totalRepayment: emiData.totalRepayment,
    collateralFree: true,
    guaranteeCoverage: 'CGTMSE (100% Credit Guarantee fee paid by Ministry of MSME)',
    guaranteeCoverageTe: 'CGTMSE (క్రెడిట్ గ్యారెంటీ ఫీజును కేంద్ర ప్రభుత్వమే పూర్తిగా చెల్లిస్తుంది)',
    benefits: [
      'Heavily subsidized 5.0% annual interest rate with 8% MoMSME interest subvention',
      '₹15,000 modern toolkit grant voucher upon basic skill verification',
      'Collateral-free institutional credit with ₹1 digital transaction incentive',
    ],
    benefitsTe: [
      'కేంద్ర ప్రభుత్వం 8% వడ్డీ రాయితీ ఇవ్వడం వల్ల కేవలం 5.0% వార్షిక వడ్డీ మాత్రమే',
      'నైపుణ్య శిక్షణతో పాటు ₹15,000 విలువైన ఆధునిక టూల్‌కిట్ గ్రాంట్ ఉచితం',
      'ఎటువంటి ఆస్తి తనఖా అవసరం లేని పూర్తి పూచీకత్తు రహిత రుణం',
    ],
  };
}

// 3. Stand-Up India Scheme
export function calculateStandUpIndia(inp: SchemeEligibilityInput): SchemeCalculationResult {
  const amount = Number(inp.loanAmount) || 1000000;
  const isWoman = ['female', 'woman', 'f'].includes(inp.gender.toLowerCase());
  const isScSt = ['SC', 'ST'].includes(inp.socialCategory.toUpperCase());
  const isEligible = isWoman || isScSt;

  const maxLoan = 10000000;
  const minLoan = 1000000;
  const sanctioned = Math.max(minLoan, Math.min(amount, maxLoan));
  const marginPercent = 15;
  const projectCost = Math.round(sanctioned / 0.85);
  const promoterContrib = projectCost - sanctioned;

  const interestRate = 8.5;
  const tenureYears = 7;
  const tenureMonths = 84;
  const moratoriumMonths = 12;

  const emiData = calculateReducingEmi(sanctioned, interestRate, tenureMonths, moratoriumMonths);

  return {
    schemeId: 'stand-up-india',
    schemeName: 'Stand-Up India Scheme',
    schemeNameTe: 'స్టాండ్-అప్ ఇండియా పథకం (మహిళలు & SC/ST)',
    category: 'Greenfield Enterprise (SC/ST & Women)',
    agency: 'SIDBI & Scheduled Commercial Banks',
    isEligible,
    ineligibilityReason: isEligible
      ? undefined
      : 'Stand-Up India is statutorily reserved for Women and SC/ST entrepreneurs setting up greenfield enterprises.',
    maxEligibleLoan: maxLoan,
    requestedLoanAmount: amount,
    sanctionedLoanAmount: sanctioned,
    promoterContribution: promoterContrib,
    promoterContributionPercent: marginPercent,
    totalProjectCost: projectCost,
    interestRateAnnual: interestRate,
    tenureYears,
    tenureMonths,
    moratoriumMonths,
    monthlyEmi: emiData.monthlyEmi,
    quarterlyEmi: emiData.quarterlyEmi,
    totalInterestPaid: emiData.totalInterestPaid,
    totalRepayment: emiData.totalRepayment,
    collateralFree: true,
    guaranteeCoverage: 'CGSUI (Credit Guarantee Scheme for Stand-Up India via NCGTC)',
    guaranteeCoverageTe: 'CGSUI (NCGTC ద్వారా ప్రభుత్వ సావరిన్ క్రెడిట్ గ్యారెంటీ రక్షణ)',
    benefits: [
      'Statutory bank branch mandate: ₹10 Lakh to ₹1 Crore priority credit window',
      'Lowest applicable commercial interest rate with reduced 15% margin money',
      'Up to 18 months repayment moratorium during initial enterprise stabilization',
    ],
    benefitsTe: [
      'ప్రతి బ్యాంక్ శాఖలో మహిళలు మరియు SC/ST లకు ₹10 లక్షల నుండి ₹1 కోటి వరకు తప్పనిసరి రుణం',
      'బ్యాంకుల్లో అతి తక్కువ వాణిజ్య వడ్డీ రేటు మరియు కేవలం 15% స్వంత వాటా నిబంధన',
      'వ్యాపారం స్థిరపడేందుకు గరిష్టంగా 18 నెలల వరకు మారటోరియం వెసులుబాటు',
    ],
  };
}

// 4. PMEGP Scheme
export function calculatePmegp(inp: SchemeEligibilityInput): SchemeCalculationResult {
  const amount = Number(inp.loanAmount) || 500000;
  const isWoman = ['female', 'woman', 'f'].includes(inp.gender.toLowerCase());
  const isSpecialCategory = isWoman || ['SC', 'ST', 'OBC'].includes(inp.socialCategory.toUpperCase());
  const isRural = inp.locationType.toLowerCase() === 'rural';

  const cleanCat = (inp.category || '').toLowerCase();
  const isService = ['grocery', 'kirana', 'retail', 'shop', 'service', 'tailor', 'salon'].some((k) => cleanCat.includes(k));
  const maxProjectCost = isService ? 2000000 : 5000000;

  const subsidyPercent = isSpecialCategory ? (isRural ? 35 : 25) : (isRural ? 25 : 15);
  const promoterPercent = isSpecialCategory ? 5 : 10;
  // Bank loan covers only what remains after promoter equity AND the capital subsidy:
  // promoter + loan + subsidy must equal 100% of project cost (within rounding).
  const loanSharePercent = 100 - promoterPercent - subsidyPercent;
  const maxLoan = maxProjectCost * (loanSharePercent / 100);

  const sanctioned = Math.min(amount, maxLoan);
  const projectCost = Math.round(sanctioned / (loanSharePercent / 100));
  const subsidyAmount = Math.round(projectCost * (subsidyPercent / 100));
  const promoterContrib = projectCost - sanctioned - subsidyAmount;

  const interestRate = 9.0;
  const tenureYears = 5;
  const tenureMonths = 60;
  const moratoriumMonths = 6;

  const emiData = calculateReducingEmi(sanctioned, interestRate, tenureMonths, moratoriumMonths);
  const specialTag = isSpecialCategory ? 'Special Category (Women/SC/ST/OBC)' : 'General Category';
  const locTag = isRural ? 'Rural' : 'Urban';

  return {
    schemeId: 'pmegp',
    schemeName: `PMEGP (${subsidyPercent}% ${locTag} Subsidy)`,
    schemeNameTe: `పీఎంఈజీపీ సబ్సిడీ పథకం (${subsidyPercent}% సబ్సిడీ)`,
    category: 'Credit-Linked Capital Subsidy',
    agency: 'KVIC, KVIB & District Industries Centre (DIC)',
    isEligible: true,
    maxEligibleLoan: maxLoan,
    requestedLoanAmount: amount,
    sanctionedLoanAmount: sanctioned,
    promoterContribution: promoterContrib,
    promoterContributionPercent: promoterPercent,
    totalProjectCost: projectCost,
    interestRateAnnual: interestRate,
    subsidyPercent,
    subsidyAmount,
    tenureYears,
    tenureMonths,
    moratoriumMonths,
    monthlyEmi: emiData.monthlyEmi,
    quarterlyEmi: emiData.quarterlyEmi,
    totalInterestPaid: emiData.totalInterestPaid,
    totalRepayment: emiData.totalRepayment,
    collateralFree: true,
    guaranteeCoverage: 'CGTMSE (Credit Guarantee Scheme up to 85% default coverage)',
    guaranteeCoverageTe: 'CGTMSE (85% వరకు రుణ హామీ రక్షణ, ఆస్తుల తాకట్టు లేదు)',
    benefits: [
      `Government Non-Refundable Capital Subsidy: ${subsidyPercent}% (₹${subsidyAmount.toLocaleString('en-IN')})`,
      `Low promoter equity requirement of only ${promoterPercent}% for ${specialTag}`,
      '3-year lock-in period after which the capital subsidy directly reduces your loan liability',
    ],
    benefitsTe: [
      `ప్రభుత్వ ఉచిత మూలధన సబ్సిడీ: ${subsidyPercent}% (రూ. ${subsidyAmount.toLocaleString('en-IN')} రాయితీ)`,
      `${specialTag} కింద స్వంత పెట్టుబడి కేవలం ${promoterPercent}% మాత్రమే`,
      '3 సంవత్సరాల లాక్-ఇన్ తర్వాత సబ్సిడీ మొత్తం నేరుగా మీ రుణ ఖాతాకు జమ అవుతుంది',
    ],
  };
}

// 5. NBCFDC Scheme
export function calculateNbcfdc(inp: SchemeEligibilityInput): SchemeCalculationResult {
  const amount = Number(inp.loanAmount) || 90000;
  const isObc = inp.socialCategory.toUpperCase() === 'OBC';

  const projectCostCalc = Math.round(amount / 0.9);
  const isMicro = projectCostCalc <= 140000;

  const schemeId = isMicro ? 'nbcfdc-micro' : 'nbcfdc-term';
  const schemeName = isMicro ? 'NBCFDC Micro Finance Scheme' : 'NBCFDC Term Loan Scheme';
  const schemeNameTe = isMicro ? 'ఎన్‌బీసీఎఫ్‌డీసీ సూక్ష్మ రుణ పథకం' : 'ఎన్‌బీసీఎఫ్‌డీసీ టర్మ్ లోన్ పథకం';
  const maxLoan = isMicro ? 126000 : 4500000;
  const sanctioned = Math.min(amount, maxLoan);
  const interestRate = isMicro ? 6.5 : 8.0;
  const tenureYears = isMicro ? 3 : 7;
  const tenureMonths = tenureYears * 12;
  const moratoriumMonths = isMicro ? 3 : 6;

  const actualProjectCost = Math.round(sanctioned / 0.9);
  const promoterContrib = actualProjectCost - sanctioned;

  const emiData = calculateReducingEmi(sanctioned, interestRate, tenureMonths, moratoriumMonths);

  return {
    schemeId,
    schemeName,
    schemeNameTe,
    category: 'Backward Classes Concessional Credit',
    agency: 'National Backward Classes Finance & Development Corporation (NBCFDC)',
    isEligible: isObc,
    ineligibilityReason: isObc
      ? undefined
      : 'NBCFDC concessional lending is designated for Other Backward Classes (OBC) entrepreneurs.',
    maxEligibleLoan: maxLoan,
    requestedLoanAmount: amount,
    sanctionedLoanAmount: sanctioned,
    promoterContribution: promoterContrib,
    promoterContributionPercent: 10,
    totalProjectCost: actualProjectCost,
    interestRateAnnual: interestRate,
    tenureYears,
    tenureMonths,
    moratoriumMonths,
    monthlyEmi: emiData.monthlyEmi,
    quarterlyEmi: emiData.quarterlyEmi,
    totalInterestPaid: emiData.totalInterestPaid,
    totalRepayment: emiData.totalRepayment,
    collateralFree: true,
    guaranteeCoverage: 'Statutory Sovereign refinance window via State Channelising Agencies',
    guaranteeCoverageTe: 'రాష్ట్ర వెనుకబడిన తరగతుల కార్పొరేషన్ ద్వారా ప్రత్యక్ష ప్రభుత్వ హామీ',
    benefits: [
      `Statutory concessional interest rate of ${interestRate.toFixed(1)}% p.a. with quarterly reducing balance`,
      `${moratoriumMonths} months grace period prior to commencement of principal amortization`,
      'Convenient quarterly repayment cycle aligned with rural cash-flow cycles',
    ],
    benefitsTe: [
      `చట్టబద్ధమైన రాయితీ వడ్డీ రేటు కేవలం ${interestRate.toFixed(1)}% మాత్రమే`,
      `ప్రారంభంలో ${moratoriumMonths} నెలల వరకు అసలు చెల్లించాల్సిన అవసరం లేని గ్రేస్ పీరియడ్`,
      'గ్రామీణ ఆదాయ చక్రాలకు సరిపోయే త్రైమాసిక వాయిదాల చెల్లింపు సదుపాయం',
    ],
  };
}

// Master Evaluation Function
export function calculateAllEligibleSchemes(inp: SchemeEligibilityInput): SchemeCalculationResult[] {
  const results: SchemeCalculationResult[] = [
    calculateMudra(inp),
    calculatePmVishwakarma(inp),
    calculateStandUpIndia(inp),
    calculatePmegp(inp),
    calculateNbcfdc(inp),
  ];

  const isWoman = ['female', 'woman', 'f'].includes(inp.gender.toLowerCase());
  const isScSt = ['SC', 'ST'].includes(inp.socialCategory.toUpperCase());
  const isObc = inp.socialCategory.toUpperCase() === 'OBC';
  const isArtisan = inp.isArtisanTrade !== undefined ? inp.isArtisanTrade : isArtisanCategory(inp.category);

  let topId = 'mudra-kishore';
  if (isArtisan && inp.loanAmount <= 300000) {
    topId = 'pm-vishwakarma';
  } else if ((isWoman || isScSt) && inp.loanAmount >= 1000000) {
    topId = 'stand-up-india';
  } else if ((isWoman || isScSt || isObc) && inp.loanAmount > 140000 && inp.loanAmount < 1000000) {
    topId = 'pmegp';
  } else if (isObc && inp.loanAmount <= 140000) {
    topId = 'nbcfdc-micro';
  } else if (inp.loanAmount <= 50000) {
    topId = 'mudra-shishu';
  } else if (inp.loanAmount > 500000) {
    topId = 'mudra-tarun';
  }

  for (const r of results) {
    if (r.schemeId === topId) {
      r.isTopMatch = true;
      break;
    }
  }

  if (!results.some((r) => r.isTopMatch)) {
    const firstEligible = results.find((r) => r.isEligible);
    if (firstEligible) firstEligible.isTopMatch = true;
  }

  results.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    if (a.isTopMatch !== b.isTopMatch) return a.isTopMatch ? -1 : 1;
    const subDiff = (b.subsidyPercent || 0) - (a.subsidyPercent || 0);
    if (subDiff !== 0) return subDiff;
    return a.interestRateAnnual - b.interestRateAnnual;
  });

  return results;
}
