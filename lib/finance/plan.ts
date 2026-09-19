import { calculateAllEligibleSchemes, SchemeCalculationResult, SchemeEligibilityInput } from './schemes';

export interface MonthlyCashFlowItem {
  month: number;
  monthName: string;
  projectedRevenue: number;
  projectedExpense: number;
  netOperatingIncome: number;
  debtService: number;
  netCashFlow: number;
  closingCashBalance: number;
}

export interface DscrAnalysis {
  dscrValue: number;
  annualNetOperatingIncome: number;
  annualDebtService: number;
  isHealthy: boolean;
  benchmark: string;
  interpretation: string;
  interpretationTe: string;
}

export interface GuaranteeCoverageInfo {
  schemeName: string;
  guaranteeAgency: string;
  coveragePercent: number;
  isCollateralFree: boolean;
  statutoryBacking: string;
  plainLanguageExplanation: string;
  plainLanguageExplanationTe: string;
}

export interface CapitalAllocationItem {
  item: string;
  itemTe: string;
  amount: number;
  percentage: number;
  category: 'capex' | 'working_capital' | 'contingency';
}

export interface SupportingDocument {
  id: string;
  name: string;
  nameTe: string;
  importance: 'Mandatory' | 'Conditional' | 'Recommended';
  description: string;
  descriptionTe: string;
}

export interface BusinessPlanRequest {
  entrepreneurName?: string;
  businessName?: string;
  location: string;
  category: string;
  gender?: string;
  socialCategory?: string;
  isNewEnterprise?: boolean;
  marginCapital: number;
  loanAmount?: number;
  projectCost?: number;
  selectedSchemeId?: string;
  monthlyRevenueEstimate?: number;
  monthlyExpenseEstimate?: number;
  businessAdvisorSummary?: string;
  language?: 'en' | 'te';
}

export interface UnifiedBusinessPlan {
  enterpriseName: string;
  entrepreneurName: string;
  location: string;
  category: string;
  gender: string;
  socialCategory: string;
  isNewEnterprise: boolean;
  generatedDate: string;
  executiveSummary: string;
  executiveSummaryTe?: string;
  marketOpportunitySummary: string;
  marketOpportunitySummaryTe?: string;
  localDemandDrivers: string[];
  seasonalAdvice: string;
  totalProjectCost: number;
  promoterMargin: number;
  promoterMarginPercent: number;
  requestedLoanAmount: number;
  selectedSchemeId: string;
  selectedSchemeName: string;
  selectedSchemeNameTe: string;
  interestRateAnnual: number;
  subsidyPercent?: number | null;
  subsidyAmount?: number | null;
  tenureYears: number;
  moratoriumMonths: number;
  monthlyEmi: number;
  quarterlyEmi: number;
  capitalAllocations: CapitalAllocationItem[];
  cashFlowForecast: MonthlyCashFlowItem[];
  dscr: DscrAnalysis;
  guaranteeInfo: GuaranteeCoverageInfo;
  documentChecklist: SupportingDocument[];
  riskMitigations: string[];
  riskMitigationsTe: string[];
  providerUsed: string;
}

const MONTH_NAMES_EN = [
  'Month 1 (Setup)',
  'Month 2 (Ramp-up)',
  'Month 3 (Commercial Launch)',
  'Month 4 (Operations)',
  'Month 5 (Lean Season)',
  'Month 6 (Mid-Year)',
  'Month 7 (Growth)',
  'Month 8 (Festival Surge)',
  'Month 9 (Peak)',
  'Month 10 (Harvest/Trade)',
  'Month 11 (Steady)',
  'Month 12 (Annual Close)',
];

const CATEGORY_BENCHMARKS: Record<
  string,
  { monthlyRevRatio: number; opexRatio: number; capexShare: number; wcShare: number; contingencyShare: number }
> = {
  dairy: { monthlyRevRatio: 0.2, opexRatio: 0.58, capexShare: 0.65, wcShare: 0.25, contingencyShare: 0.1 },
  poultry: { monthlyRevRatio: 0.28, opexRatio: 0.68, capexShare: 0.6, wcShare: 0.3, contingencyShare: 0.1 },
  kirana: { monthlyRevRatio: 0.45, opexRatio: 0.82, capexShare: 0.35, wcShare: 0.55, contingencyShare: 0.1 },
  grocery: { monthlyRevRatio: 0.45, opexRatio: 0.82, capexShare: 0.35, wcShare: 0.55, contingencyShare: 0.1 },
  weaving: { monthlyRevRatio: 0.22, opexRatio: 0.5, capexShare: 0.55, wcShare: 0.35, contingencyShare: 0.1 },
  handloom: { monthlyRevRatio: 0.22, opexRatio: 0.5, capexShare: 0.55, wcShare: 0.35, contingencyShare: 0.1 },
  tailoring: { monthlyRevRatio: 0.24, opexRatio: 0.48, capexShare: 0.6, wcShare: 0.3, contingencyShare: 0.1 },
  flour: { monthlyRevRatio: 0.25, opexRatio: 0.52, capexShare: 0.7, wcShare: 0.2, contingencyShare: 0.1 },
};

function getCategoryConfig(category: string) {
  const cat = (category || '').toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_BENCHMARKS)) {
    if (cat.includes(key)) return val;
  }
  return { monthlyRevRatio: 0.22, opexRatio: 0.58, capexShare: 0.6, wcShare: 0.3, contingencyShare: 0.1 };
}

export function generate12MonthCashFlow(
  projectCost: number,
  category: string,
  monthlyEmi: number,
  moratoriumMonths: number,
  baseRevenue?: number,
  baseExpense?: number,
  initialCashBuffer: number = 20000
): MonthlyCashFlowItem[] {
  const cfg = getCategoryConfig(category);
  const nominalRevenue = baseRevenue && baseRevenue > 0 ? baseRevenue : projectCost * cfg.monthlyRevRatio;
  const nominalExpense = baseExpense && baseExpense > 0 ? baseExpense : nominalRevenue * cfg.opexRatio;

  const seasonality = [
    { rev: 0.55, exp: 0.7 },
    { rev: 0.75, exp: 0.8 },
    { rev: 0.9, exp: 0.9 },
    { rev: 1.0, exp: 1.0 },
    { rev: 0.88, exp: 0.92 },
    { rev: 0.95, exp: 0.95 },
    { rev: 1.05, exp: 1.0 },
    { rev: 1.25, exp: 1.1 },
    { rev: 1.2, exp: 1.08 },
    { rev: 1.05, exp: 1.02 },
    { rev: 1.0, exp: 1.0 },
    { rev: 1.1, exp: 1.05 },
  ];

  let runningBalance = initialCashBuffer;
  const items: MonthlyCashFlowItem[] = [];

  for (let i = 0; i < 12; i++) {
    const monthNum = i + 1;
    const factor = seasonality[i];
    const mRev = Math.round(nominalRevenue * factor.rev);
    const mExp = Math.round(nominalExpense * factor.exp);
    const noi = mRev - mExp;

    const mDebtService = monthNum <= moratoriumMonths ? 0 : Math.round(monthlyEmi);
    const netCash = noi - mDebtService;
    runningBalance += netCash;

    items.push({
      month: monthNum,
      monthName: MONTH_NAMES_EN[i],
      projectedRevenue: mRev,
      projectedExpense: mExp,
      netOperatingIncome: noi,
      debtService: mDebtService,
      netCashFlow: netCash,
      closingCashBalance: runningBalance,
    });
  }

  return items;
}

export function calculateDscrAnalysis(
  cashFlowItems: MonthlyCashFlowItem[],
  monthlyEmi: number
): DscrAnalysis {
  const annualNoi = cashFlowItems.reduce((sum, item) => sum + item.netOperatingIncome, 0);
  const actualDebtService = cashFlowItems.reduce((sum, item) => sum + item.debtService, 0);
  const runRateDebtService = 12 * monthlyEmi;

  const evalDebtService = runRateDebtService > 0 ? runRateDebtService : actualDebtService > 0 ? actualDebtService : 1;
  const rawDscr = evalDebtService > 0 ? annualNoi / evalDebtService : 2.5;
  const dscrVal = Math.round(Math.max(0.1, Math.min(rawDscr, 9.99)) * 100) / 100;
  const isHealthy = dscrVal >= 1.2;

  let interpretation = '';
  let interpretationTe = '';

  if (dscrVal >= 1.5) {
    interpretation = `Your projected DSCR is ${dscrVal.toFixed(2)}x (Exceeds the 1.20x banking threshold). This indicates excellent cash flow adequacy, giving credit officers high confidence that you can easily service installments with a wide safety margin.`;
    interpretationTe = `మీ అంచనా రుణ చెల్లింపు నిష్పత్తి (DSCR) ${dscrVal.toFixed(2)}x (బ్యాంకు నిబంధన 1.20x కంటే చాలా ఎక్కువ). మీ వ్యాపార ఆదాయం వాయిదాల కంటే చాలా ఎక్కువగా ఉన్నందున బ్యాంకులు మరియు రుణదాతలు ఎలాంటి సంకోచం లేకుండా రుణం మంజూరు చేయడానికి అనుకూలంగా ఉంటుంది.`;
  } else if (dscrVal >= 1.2) {
    interpretation = `Your projected DSCR is ${dscrVal.toFixed(2)}x (Meets the 1.20x standard banking benchmark). Your enterprise produces a reliable surplus over debt obligations, qualifying comfortably for uncollateralized sanction.`;
    interpretationTe = `మీ అంచనా రుణ చెల్లింపు నిష్పత్తి (DSCR) ${dscrVal.toFixed(2)}x (బ్యాంకులకు అవసరమైన 1.20x ప్రమాణానికి అనుగుణంగా ఉంది). వాయిదాల చెల్లింపునకు సరిపడా నికర లాభం నమోదవుతుందని నిరూపిస్తుంది.`;
  } else if (dscrVal >= 1.0) {
    interpretation = `Your projected DSCR is ${dscrVal.toFixed(2)}x (Acceptable but tight). While income covers the loan, maintaining a rolling 1-month contingency buffer is advised to safeguard against delayed client receipts.`;
    interpretationTe = `మీ అంచనా రుణ చెల్లింపు నిష్పత్తి (DSCR) ${dscrVal.toFixed(2)}x (చెల్లింపులకు సరిపోతుంది కానీ స్వల్ప మిగులు ఉంటుంది). అమ్మకాలలో హెచ్చుతగ్గులు ఎదురైనా వాయిదా తప్పకుండా చెల్లించడానికి కనీసం 1 నెల నిల్వ ఉంచుకోవడం మంచిది.`;
  } else {
    interpretation = `Your projected DSCR is ${dscrVal.toFixed(2)}x (Below the 1.20x comfort line). Lenders may recommend either extending the loan tenure or increasing promoter equity to lower the monthly installment burden.`;
    interpretationTe = `మీ అంచనా రుణ చెల్లింపు నిష్పత్తి (DSCR) ${dscrVal.toFixed(2)}x (బ్యాంకు ఆశించే 1.20x కంటే తక్కువ). రుణ కాలాన్ని పెంచడం లేదా స్వంత పెట్టుబడిని కొద్దిగా పెంచడం ద్వారా నెలవారీ వాయిదా భారాన్ని తగ్గించుకోవాలని సూచించబడింది.`;
  }

  return {
    dscrValue: dscrVal,
    annualNetOperatingIncome: Math.round(annualNoi),
    annualDebtService: Math.round(evalDebtService),
    isHealthy,
    benchmark: 'Minimum 1.20x required by commercial banks & MFIs',
    interpretation,
    interpretationTe,
  };
}

export function resolveGuaranteeDetails(schemeId: string, schemeName: string): GuaranteeCoverageInfo {
  const sId = (schemeId || '').toLowerCase();

  if (sId.includes('mudra')) {
    return {
      schemeName,
      guaranteeAgency: 'Credit Guarantee Fund for Micro Units (CGFMU)',
      coveragePercent: 100,
      isCollateralFree: true,
      statutoryBacking: 'CGFMU Scheme Notification, Department of Financial Services, Ministry of Finance',
      plainLanguageExplanation:
        'Eligible for 100% sovereign portfolio guarantee under CGFMU. Under RBI Master Directions, lending institutions are strictly mandated NOT to demand any third-party guarantee or tangible collateral for MUDRA loans.',
      plainLanguageExplanationTe:
        'CGFMU ద్వారా 100% కేంద్ర ప్రభుత్వ పూచీకత్తు వర్తిస్తుంది. RBI నిబంధనల ప్రకారం ముద్ర రుణాలకు ఎలాంటి వ్యక్తిగత ఆస్తి తాకట్టు లేదా ఇతరుల హామీ అవసరం లేదు.',
    };
  }

  if (sId.includes('vishwakarma')) {
    return {
      schemeName,
      guaranteeAgency: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE)',
      coveragePercent: 100,
      isCollateralFree: true,
      statutoryBacking: 'PM Vishwakarma Scheme Guidelines, Ministry of MSME, Govt of India',
      plainLanguageExplanation:
        '100% credit guarantee provided through CGTMSE. The entire annual guarantee fee is directly borne by the Ministry of MSME, exempting the artisan from both collateral and additional fee burdens.',
      plainLanguageExplanationTe:
        'CGTMSE ద్వారా 100% ప్రభుత్వ గ్యారెంటీ కవరేజ్ లభిస్తుంది. వార్షిక గ్యారెంటీ రుసుమును కూడా కేంద్ర సూక్ష్మ, చిన్న & మధ్యతరహా పరిశ్రమల మంత్రిత్వ శాఖే చెల్లిస్తుంది.',
    };
  }

  if (sId.includes('stand-up')) {
    return {
      schemeName,
      guaranteeAgency: 'Credit Guarantee Scheme for Stand Up India (CGSUI)',
      coveragePercent: 85,
      isCollateralFree: true,
      statutoryBacking: 'NCGTC Credit Guarantee Scheme for Stand Up India Loans',
      plainLanguageExplanation:
        'Covered under sovereign CGSUI scheme operated by NCGTC, providing institutional guarantee coverage up to ₹1 Crore. Borrowers do not need to pledge primary residential or agricultural property.',
      plainLanguageExplanationTe:
        'NCGTC నిర్వహించే CGSUI పథకం ద్వారా ₹1 కోటి వరకు ప్రభుత్వ గ్యారెంటీ లభిస్తుంది. వ్యవసాయ భూమి లేదా నివాస ఆస్తులను తాకట్టు పెట్టాల్సిన అవసరం లేదు.',
    };
  }

  if (sId.includes('pmegp')) {
    return {
      schemeName,
      guaranteeAgency: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE)',
      coveragePercent: 85,
      isCollateralFree: true,
      statutoryBacking: 'KVIC / PMEGP Scheme Guidelines, Ministry of MSME',
      plainLanguageExplanation:
        'PMEGP projects up to ₹50 Lakhs are covered under CGTMSE collateral-free credit guarantee, with upfront capital subsidy (margin money) deposited directly into borrower TDR account.',
      plainLanguageExplanationTe:
        'PMEGP కింద ₹50 లక్షల వరకు CGTMSE రక్షణ ఉంటుంది. ప్రభుత్వం అందించే సబ్సిడీ నేరుగా బ్యాంక్ డిపాజిట్ ఖాతాకు జమ అవుతుంది.',
    };
  }

  return {
    schemeName,
    guaranteeAgency: 'State Channelizing Agency (SCA) Credit Backstop',
    coveragePercent: 100,
    isCollateralFree: true,
    statutoryBacking: 'National Backward Classes Finance & Development Corporation (NBCFDC)',
    plainLanguageExplanation:
      'Financed through State Channelizing Agencies with subsidized refinance support from NBCFDC. Covered by statutory micro-enterprise social lending provisions without requiring external collateral.',
    plainLanguageExplanationTe:
      'NBCFDC మరియు రాష్ట్ర ఆర్థిక సహాయ సంస్థల ద్వారా మంజూరయ్యే రాయితీ రుణం. ఎలాంటి తాకట్టు లేకుండా కేటాయించబడుతుంది.',
  };
}

export function getStandardSupportingDocuments(
  category: string,
  isNew: boolean,
  socialCategory: string
): SupportingDocument[] {
  const docs: SupportingDocument[] = [
    {
      id: 'kyc-aadhaar',
      name: 'Aadhaar Card of Applicant & Co-applicant',
      nameTe: 'దరఖాస్తుదారు మరియు సహ-దరఖాస్తుదారు ఆధార్ కార్డు',
      importance: 'Mandatory',
      description: 'Primary proof of identity and local mandal/district residence.',
      descriptionTe: 'గుర్తింపు మరియు స్థానిక చిరునామా ధృవీకరణ పత్రం.',
    },
    {
      id: 'kyc-pan',
      name: 'PAN Card / Form 60',
      nameTe: 'పాన్ కార్డు లేదా ఫారం 60',
      importance: 'Mandatory',
      description: 'Statutory requirement for banking tax compliance and credit bureau check.',
      descriptionTe: 'బ్యాంకు లావాదేవీలు మరియు సిబిల్ తనిఖీ కోసం తప్పనిసరి.',
    },
    {
      id: 'bank-statements',
      name: 'Savings / Current Account Statement (Last 6 Months)',
      nameTe: 'గత 6 నెలల బ్యాంకు ఖాతా స్టేట్‌మెంట్',
      importance: 'Mandatory',
      description: 'Demonstrates account operation consistency and past turnover.',
      descriptionTe: 'నగదు ప్రవాహం మరియు క్రమబద్ధమైన లావాదేవీల ధృవీకరణ.',
    },
    {
      id: 'udyam-registration',
      name: 'Udyam Assist / MSME Registration Certificate',
      nameTe: 'ఉద్యమ్ అసిస్ట్ / MSME నమోదు పత్రం',
      importance: 'Mandatory',
      description: 'Free instant online registration on udyamregistration.gov.in required for PSL interest concession.',
      descriptionTe: 'ప్రభుత్వ రాయితీ మరియు తక్కువ వడ్డీ ప్రయోజనం కోసం ఉచిత రిజిస్ట్రేషన్.',
    },
    {
      id: 'asset-quotations',
      name: 'Machinery / Equipment / Livestock Quotation & Proforma Invoice',
      nameTe: 'యంత్రాలు / పరికరాలు / పశువుల ధరల కొటేషన్ & ఇన్వాయిస్',
      importance: 'Mandatory',
      description: 'Valid quotation from registered GST vendor or animal husbandry committee for loan disbursement.',
      descriptionTe: 'రుణం విడుదల కోసం అధీకృత డీలర్ లేదా సహకార సంఘం నుండి కొటేషన్.',
    },
  ];

  if (['OBC', 'SC', 'ST'].includes(socialCategory)) {
    docs.push({
      id: 'caste-cert',
      name: `${socialCategory} Community / Caste Certificate`,
      nameTe: `${socialCategory} కుల ధృవీకరణ పత్రం`,
      importance: 'Mandatory',
      description: `Issued by Revenue Tahsildar / MeeSeva to avail ${socialCategory} targeted subsidies & concessions.`,
      descriptionTe: 'ప్రభుత్వ రాయితీలు మరియు రిజర్వేషన్ వర్తించడానికి మీసేవ ధృవీకరణ పత్రం.',
    });
  }

  docs.push({
    id: 'premises-proof',
    name: 'Gram Panchayat NOC / Business Premises Rent Agreement or Land Patta',
    nameTe: 'గ్రామ పంచాయతీ అనుమతి పత్రం / స్థలం అద్దె ఒప్పందం',
    importance: 'Mandatory',
    description: 'Proof of operational shed, workshop, or farmland where enterprise operates.',
    descriptionTe: 'వ్యాపారం నిర్వహించే షెడ్డు లేదా స్థల ధృవీకరణ పత్రం.',
  });

  return docs;
}

export function generateUnifiedBusinessPlan(req: BusinessPlanRequest): UnifiedBusinessPlan {
  const marginCap = req.marginCapital > 0 ? req.marginCapital : 100000;
  const projectCost = req.projectCost && req.projectCost > 0 ? req.projectCost : marginCap / 0.1;
  const loanAmount = req.loanAmount && req.loanAmount > 0 ? req.loanAmount : projectCost - marginCap;

  const eligInput: SchemeEligibilityInput = {
    loanAmount,
    category: req.category,
    gender: req.gender || 'female',
    socialCategory: req.socialCategory || 'OBC',
    locationType: 'rural',
    isNewEnterprise: req.isNewEnterprise ?? true,
  };

  const allSchemes = calculateAllEligibleSchemes(eligInput);

  let chosenScheme = req.selectedSchemeId
    ? allSchemes.find((s) => s.schemeId === req.selectedSchemeId)
    : null;

  if (!chosenScheme) {
    const eligible = allSchemes.filter((s) => s.isEligible);
    chosenScheme = eligible[0] || allSchemes[0];
  }

  const sanctionedLoan = chosenScheme.sanctionedLoanAmount;
  const interestRate = chosenScheme.interestRateAnnual;
  const tenureYears = chosenScheme.tenureYears;
  const moratoriumMonths = chosenScheme.moratoriumMonths;
  const monthlyEmi = chosenScheme.monthlyEmi;
  const quarterlyEmi = chosenScheme.quarterlyEmi;
  const subsidyPct = chosenScheme.subsidyPercent;
  const subsidyAmt = chosenScheme.subsidyAmount;
  const promoterMargin = chosenScheme.promoterContribution;
  const promoterPct = chosenScheme.promoterContributionPercent;

  const cfg = getCategoryConfig(req.category);
  const capexAmt = Math.round(projectCost * cfg.capexShare);
  const wcAmt = Math.round(projectCost * cfg.wcShare);
  const contingencyAmt = Math.round(projectCost * cfg.contingencyShare);

  const capitalAllocations: CapitalAllocationItem[] = [
    {
      item: 'Core Productive Assets, Machinery & Equipment',
      itemTe: 'ప్రధాన ఉత్పాదక ఆస్తులు, యంత్రాలు మరియు పరికరాల కొనుగోలు',
      amount: capexAmt,
      percentage: Math.round(cfg.capexShare * 100),
      category: 'capex',
    },
    {
      item: 'Initial Working Capital, Inventory & Raw Materials',
      itemTe: 'ప్రారంభ వర్కింగ్ క్యాపిటల్, ముడిసరుకులు మరియు నిల్వలు',
      amount: wcAmt,
      percentage: Math.round(cfg.wcShare * 100),
      category: 'working_capital',
    },
    {
      item: 'Contingency Reserve, Licensing & Insurance',
      itemTe: 'అత్యవసర నిల్వ నిధి, అనుమతులు మరియు బీమా ఖర్చులు',
      amount: contingencyAmt,
      percentage: Math.round(cfg.contingencyShare * 100),
      category: 'contingency',
    },
  ];

  const cashFlow = generate12MonthCashFlow(
    projectCost,
    req.category,
    monthlyEmi,
    moratoriumMonths,
    req.monthlyRevenueEstimate,
    req.monthlyExpenseEstimate,
    marginCap * 0.2
  );

  const dscrAnalysis = calculateDscrAnalysis(cashFlow, monthlyEmi);
  const guaranteeInfo = resolveGuaranteeDetails(chosenScheme.schemeId, chosenScheme.schemeName);
  const checklist = getStandardSupportingDocuments(req.category, req.isNewEnterprise ?? true, req.socialCategory || 'OBC');

  const marketHeadline =
    req.businessAdvisorSummary ||
    `Strong localized demand for ${req.category} in ${req.location} cluster with direct village off-take.`;
  const marketHeadlineTe = `${req.location} ప్రాంతంలో ${req.category} వ్యాపారానికి బలమైన స్థానిక గిరాకీ మరియు గ్రామ మార్కెట్లలో అధిక లాభదాయకత ఉంది.`;

  const demandDrivers = [
    `High daily consumption of ${req.category} products in surrounding mandals and weekly haats.`,
    'Proximity to established rural road infrastructure enabling low-cost freight and timely distribution.',
    'Rising preference for fresh, locally produced goods over urban processed alternatives.',
  ];

  const seasonalNotes = `Peak sales coincide with festival quarters (Dussehra/Diwali/harvesting). The ${moratoriumMonths}-month loan moratorium shields cash flows during initial setup.`;

  const execSummary = `Lender-Ready Project Proposal for '${req.businessName || 'Rural Enterprise'}' promoted by ${req.entrepreneurName || 'Entrepreneur'} at ${req.location}. The proposed enterprise involves a total capital outlay of ₹${projectCost.toLocaleString('en-IN')}, structured with ${promoterPct}% promoter equity (₹${promoterMargin.toLocaleString('en-IN')}) and an institutional credit requirement of ₹${sanctionedLoan.toLocaleString('en-IN')} under ${chosenScheme.schemeName} at an annual interest rate of ${interestRate.toFixed(1)}%. The operation demonstrates healthy unit economics with a projected DSCR of ${dscrAnalysis.dscrValue.toFixed(2)}x and full collateral exemption under ${guaranteeInfo.guaranteeAgency}.`;

  const execSummaryTe = `'${req.businessName || 'గ్రామీణ వ్యాపారం'}' ప్రాజెక్ట్ సమగ్ర రుణ దరఖాస్తు ప్రతిపాదన (${req.entrepreneurName || 'వ్యవస్థాపకులు'}, ${req.location}). మొత్తం ప్రాజెక్ట్ వ్యయం ₹${projectCost.toLocaleString('en-IN')} కాగా, వ్యవస్థాపకురాలి వాటా ${promoterPct}% (₹${promoterMargin.toLocaleString('en-IN')}) మరియు ${chosenScheme.schemeNameTe} కింద రుణం ₹${sanctionedLoan.toLocaleString('en-IN')} (${interestRate.toFixed(1)}% వార్షిక వడ్డీ). ఈ వ్యాపారం ${dscrAnalysis.dscrValue.toFixed(2)}x రుణ కవరేజ్ (DSCR) మరియు ${guaranteeInfo.guaranteeAgency} రక్షణతో పూర్తిగా లాభదాయకంగా నడుస్తుంది.`;

  const riskMitigations = [
    'Comprehensive insurance coverage for all capital assets and livestock against accidental and natural risks.',
    'Formal supply agreements with local mandal buyers and rural self-help groups (SHGs) to stabilize volume.',
    'Rigorous maintenance of digital logbook ledger entries to audit operating margins every month.',
    'Disciplined 15% revenue retention into a rolling liquidity reserve to meet lean season costs.',
  ];

  const riskMitigationsTe = [
    'ప్రధాన యంత్రాలు, పరికరాలు లేదా పశువులకు పూర్తి సమగ్ర బీమా రక్షణ.',
    'స్థానిక మండల విక్రయదారులతో స్థిరమైన విక్రయ ఒప్పందాలు.',
    'నెలవారీ లాభనష్టాల సమీక్ష కోసం డిజిటల్ లాగ్‌బుక్ రికార్డులను నిరంతరం నమోదు చేయడం.',
    'లీన్ సీజన్ ఖర్చుల కోసం ప్రతి నెలా 15% నికర ఆదాయాన్ని రిజర్వ్ నిధిగా ఉంచడం.',
  ];

  return {
    enterpriseName: req.businessName || 'Rural Micro Enterprise',
    entrepreneurName: req.entrepreneurName || 'Rural Entrepreneur',
    location: req.location,
    category: req.category,
    gender: req.gender || 'female',
    socialCategory: req.socialCategory || 'OBC',
    isNewEnterprise: req.isNewEnterprise ?? true,
    generatedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    executiveSummary: execSummary,
    executiveSummaryTe: execSummaryTe,
    marketOpportunitySummary: marketHeadline,
    marketOpportunitySummaryTe: marketHeadlineTe,
    localDemandDrivers: demandDrivers,
    seasonalAdvice: seasonalNotes,
    totalProjectCost: projectCost,
    promoterMargin: promoterMargin,
    promoterMarginPercent: promoterPct,
    requestedLoanAmount: sanctionedLoan,
    selectedSchemeId: chosenScheme.schemeId,
    selectedSchemeName: chosenScheme.schemeName,
    selectedSchemeNameTe: chosenScheme.schemeNameTe,
    interestRateAnnual: interestRate,
    subsidyPercent: subsidyPct,
    subsidyAmount: subsidyAmt,
    tenureYears,
    moratoriumMonths,
    monthlyEmi,
    quarterlyEmi,
    capitalAllocations,
    cashFlowForecast: cashFlow,
    dscr: dscrAnalysis,
    guaranteeInfo,
    documentChecklist: checklist,
    riskMitigations,
    riskMitigationsTe,
    providerUsed: 'Unified Plan Engine (Deterministic + Grounded Benchmarks)',
  };
}
