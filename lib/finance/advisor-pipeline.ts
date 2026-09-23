/**
 * RuralCred Advisor — Personalized Financial Advisor Reasoning Pipeline.
 * 
 * Provides:
 * 1. Normalized User Financial Context builder (aggregates profile, logbook, loans, khata, business metrics).
 * 2. Intent Classification Layer (affordability, savings, expense reduction, capacity for target profit, etc.).
 * 3. Question-Specific Deterministic Calculation Engine (EMI, DSCR, required cows/units, savings runway, max borrowing).
 * 4. Dynamic LLM Prompt generator with verified calculations.
 * 5. Personalized Grounded Fallback synthesizer (uses actual calculated metrics if Gemini is offline).
 */

import { LogbookEntry, KhataEntry } from '@/lib/firebase/logbook';
import { parseTargetAmount } from '@/lib/finance/business-calculator';
import { calculateAllEligibleSchemes, SchemeCalculationResult } from '@/lib/finance/schemes';

export interface UserFinancialInput {
  profile: {
    name?: string;
    businessName?: string;
    location?: string;
    category?: string;
    marginCapital?: number;
    hasActiveLoan?: boolean;
    simulatingSecondLoan?: boolean;
    gender?: string;
    socialCategory?: string;
  };
  loanState?: {
    marginCapital?: number;
    loanAmount?: number;
    projectCost?: number;
    quarterlyEmi?: number;
    interestRate?: number;
    tenureYears?: number;
    workingCapitalRatio?: number;
  };
  logbookEntries?: LogbookEntry[];
  khataEntries?: KhataEntry[];
  aggregates?: {
    totalIncome?: number;
    totalExpenses?: number;
    netCashFlow?: number;
  };
  userQuery?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  language?: 'en' | 'te';
}

export interface NormalizedFinancialContext {
  profile: {
    name: string;
    businessName: string;
    location: string;
    businessType: string;
    availableCapital: number;
    gender: string;
    socialCategory: string;
    hasActiveLoan: boolean;
    simulatingSecondLoan: boolean;
  };
  income: {
    monthlyRevenue: number;
    annualRevenue: number;
    averageMonthlyIncome: number;
    incomeSources: string[];
  };
  expenses: {
    monthlyExpenses: number;
    annualExpenses: number;
    averageMonthlyExpenses: number;
    largestCategories: { category: string; amount: number; percentage: number }[];
  };
  logbook: {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    monthlyCashFlow: number;
    transactionCount: number;
    recentTransactions: { date: string; type: string; category: string; amount: number; note: string }[];
    categoryTotals: Record<string, { income: number; expense: number }>;
    cashFlowTrend: 'positive' | 'tight' | 'negative';
  };
  khata: {
    totalCustomerCredit: number;
    totalSupplierCredit: number;
  };
  loan: {
    marginCapital: number;
    projectCost: number;
    loanAmount: number;
    interestRate: number;
    tenureYears: number;
    quarterlyEmi: number;
    monthlyEmiEquivalent: number;
    totalInterest: number;
    totalRepayment: number;
    workingCapitalAmount: number;
    workingCapitalPercent: number;
    capexAmount: number;
    capexPercent: number;
    workingCapitalUses: string[];
    capexUses: string[];
  };
  business: {
    businessType: string;
    location: string;
    leanSeason: string;
    peakSeason: string;
    moratoriumGuidance: string;
    moratoriumGuidanceTe: string;
    unitNameEn: string;
    unitNameTe: string;
    unitCapex: number;
    unitAnnualNetProfit: number;
    unitAnnualRevenue: number;
    unitAnnualOpex: number;
  };
  calculations: {
    monthlyProfit: number;
    annualProfit: number;
    disposableCash: number;
    debtToIncomeRatio: number; // EMI / Income %
    debtServiceCoverageRatio: number; // Net cash flow / EMI
    repaymentCapacity: 'strong' | 'adequate' | 'tight' | 'high_risk';
    maxSafeMonthlyEmi: number; // 40% of monthly net cash surplus
    maxSafeLoanAmount: number; // based on 5-year loan at 9%
  };
  schemes: SchemeCalculationResult[];
}

export type FinancialIntent =
  | 'loan_affordability' // "can I afford a ₹2 lakh loan?", "can I take this loan?"
  | 'max_borrowing_capacity' // "how much can I borrow?", "how much loan can I get?"
  | 'savings_planning' // "how much should I save every month?"
  | 'expense_reduction' // "how can I reduce my expenses?", "cut costs"
  | 'profit_analysis' // "how much profit am I making?", "what is my margin?"
  | 'target_profit_capacity' // "how many cows/units to get ₹500,000 profit?"
  | 'revenue_for_target_profit' // "how much revenue do I need for ₹5 lakh profit?"
  | 'business_expansion' // "should I expand my business?", "can I expand?"
  | 'government_schemes' // "what schemes am I eligible for?", "which government schemes?"
  | 'scheme_rationale' // "why Stand-Up India / PMEGP / Mudra?"
  | 'moratorium_guidance' // "can I get a seasonal moratorium?"
  | 'emi_calculation' // "what is my EMI / quarterly repayment?"
  | 'interest_cost' // "how much total interest?", "total cost of loan"
  | 'working_capital_split' // "how is loan split between capex and working capital?"
  | 'document_requirements' // "what documents will bank require?"
  | 'break_even_analysis' // "what is my break-even?"
  | 'cash_flow_analysis' // "what is my cash flow trend?"
  | 'open_ended_planning'; // general financial inquiry

export interface IntentAnalysisResult {
  intent: FinancialIntent;
  targetAmount: number | null;
  targetUnit: string | null;
  rawQuery: string;
}

/**
 * Sector benchmarks for unit economics
 */
const SECTOR_BENCHMARKS: Record<
  string,
  {
    unitNameEn: string;
    unitNameTe: string;
    unitCapex: number;
    unitAnnualRevenue: number;
    unitAnnualOpex: number;
    unitAnnualNetProfit: number;
    leanSeason: string;
    peakSeason: string;
    guidanceEn: string;
    guidanceTe: string;
    defaultWcRatio: number;
    wcUses: string[];
    capexUses: string[];
  }
> = {
  dairy: {
    unitNameEn: 'Murrah Buffalo / High-Yield Dairy Cow',
    unitNameTe: 'ముర్రా గేదె / మేలుజాతి పాడి ఆవు',
    unitCapex: 90000,
    unitAnnualRevenue: 156000, // 10-12 L/day * 300 days * ₹45-52/L
    unitAnnualOpex: 78000, // Fodder, concentrate feed, vet care
    unitAnnualNetProfit: 78000,
    leanSeason: 'April – June (Peak Summer Heat)',
    peakSeason: 'August – January (Monsoon & Winter Flush)',
    guidanceEn:
      'In dairy farming, summer heat stress depresses milk yield by 20%–30%. Structure a 1-quarter moratorium or interest-only period during summer, accelerating principal repayment during the winter flush season.',
    guidanceTe:
      'పాడి పరిశ్రమలో వేసవి కాలంలో పాల దిగుబడి 20%–30% తగ్గుతుంది. కాబట్టి వేసవిలో 1 త్రైమాసికం మారటోరియం తీసుకుని, శీతాకాలంలో అసలు వేగంగా చెల్లించడం ఉత్తమం.',
    defaultWcRatio: 0.35,
    wcUses: ['High-protein cattle feed & dry fodder reserves', 'Veterinary care, vaccines & milk transport cans'],
    capexUses: ['High-yield Murrah buffaloes / dairy cows', 'Pucca cattle shed construction & bulk milk chiller'],
  },
  kirana: {
    unitNameEn: 'Inventory Replenishment Cycle / SKU Line',
    unitNameTe: 'కిరాణా సరుకుల నిల్వ / వస్తువుల లైన్',
    unitCapex: 75000,
    unitAnnualRevenue: 360000,
    unitAnnualOpex: 288000,
    unitAnnualNetProfit: 72000, // 20% net margin on stock turns
    leanSeason: 'July – August (Kharif Sowing Season)',
    peakSeason: 'October – January (Festive & Harvest Season)',
    guidanceEn:
      'Rural grocery cash flows tighten during sowing months as farmers conserve cash for seeds. Request standard quarterly EMIs with working capital buffer before the festival season.',
    guidanceTe:
      'ఖరీఫ్ విత్తనాల కాలంలో అరువులు పెరుగుతాయి కాబట్టి సాధారణ వాయిదాలు చెల్లించి, పండుగల ముందు వర్కింగ్ క్యాపిటల్ పెంచుకోండి.',
    defaultWcRatio: 0.75,
    wcUses: ['FMCG wholesale stock & inventory replenishment', 'Bulk grains, pulses, spices & customer credit buffer'],
    capexUses: ['Commercial deep freezer & refrigeration', 'Modular steel racks, electronic scale & billing POS'],
  },
  weaving: {
    unitNameEn: 'Fly-Shuttle Pit Loom & Jacquard Setup',
    unitNameTe: 'ఫ్లై-షటిల్ పిట్ మగ్గం & జకార్డ్ అమరిక',
    unitCapex: 60000,
    unitAnnualRevenue: 240000,
    unitAnnualOpex: 156000, // Silk/cotton yarn, dyes, zari
    unitAnnualNetProfit: 84000,
    leanSeason: 'June – August (Monsoon Humidity)',
    peakSeason: 'September – February (Wedding & Festival Season)',
    guidanceEn:
      'Handloom drying slows during monsoon humidity. Structure a 1-quarter moratorium during monsoon, matching principal amortization with the wedding season.',
    guidanceTe:
      'వర్షాకాలంలో అమ్మకాలు మందగిస్తాయి కాబట్టి 1 త్రైమాసిక మారటోరియం తీసుకుని, పెళ్లిళ్ల సీజన్లో అసలు చెల్లించండి.',
    defaultWcRatio: 0.60,
    wcUses: ['Mulberry silk yarn, cotton yarn & metallic zari', 'Natural dyes, warp materials & weaver artisan wages'],
    capexUses: ['Fly-shuttle pit looms & electronic Jacquard box', 'Warping drum, creel stand & pirn winder'],
  },
};

function resolveSector(category: string) {
  const catLower = (category || 'Dairy Farming').toLowerCase();
  if (catLower.includes('kirana') || catLower.includes('grocery') || catLower.includes('retail')) {
    return SECTOR_BENCHMARKS.kirana;
  }
  if (catLower.includes('weave') || catLower.includes('handloom') || catLower.includes('textile')) {
    return SECTOR_BENCHMARKS.weaving;
  }
  return SECTOR_BENCHMARKS.dairy;
}

/**
 * 1. Normalize and structure all financial data for the current user
 */
export function buildNormalizedFinancialContext(input: UserFinancialInput): NormalizedFinancialContext {
  const p = input.profile || {};
  const l = input.loanState || {};
  const entries = input.logbookEntries || [];
  const khata = input.khataEntries || [];

  const name = p.name || 'Anita Sharma';
  const businessName = p.businessName || `${name}'s Enterprise`;
  const location = p.location || 'Warangal, Telangana';
  const businessType = p.category || 'Dairy Farming';
  const availableCapital = Number(p.marginCapital) || Number(l.marginCapital) || 100000;
  const gender = p.gender || 'female';
  const socialCategory = p.socialCategory || 'OBC';
  const hasActiveLoan = Boolean(p.hasActiveLoan);
  const simulatingSecondLoan = Boolean(p.simulatingSecondLoan);

  const sector = resolveSector(businessType);

  // Logbook calculation
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: Record<string, { income: number; expense: number }> = {};
  const recentTransactions: { date: string; type: string; category: string; amount: number; note: string }[] = [];

  for (const entry of entries) {
    const amt = Number(entry.amount) || 0;
    if (!categoryTotals[entry.category]) {
      categoryTotals[entry.category] = { income: 0, expense: 0 };
    }
    if (entry.type === 'income') {
      totalIncome += amt;
      categoryTotals[entry.category].income += amt;
    } else if (entry.type === 'expense') {
      totalExpenses += amt;
      categoryTotals[entry.category].expense += amt;
    }
    if (recentTransactions.length < 5) {
      recentTransactions.push({
        date: entry.date,
        type: entry.type,
        category: entry.category,
        amount: amt,
        note: entry.note || '',
      });
    }
  }

  // If explicit aggregates were provided (e.g. from backend), merge them
  if (input.aggregates) {
    if (typeof input.aggregates.totalIncome === 'number' && input.aggregates.totalIncome > 0) {
      totalIncome = input.aggregates.totalIncome;
    }
    if (typeof input.aggregates.totalExpenses === 'number' && input.aggregates.totalExpenses > 0) {
      totalExpenses = input.aggregates.totalExpenses;
    }
  }

  // Fallback defaults if user has 0 entries yet
  if (totalIncome === 0 && totalExpenses === 0) {
    if (businessType.toLowerCase().includes('kirana')) {
      totalIncome = 65000;
      totalExpenses = 48000;
    } else if (businessType.toLowerCase().includes('weave')) {
      totalIncome = 42000;
      totalExpenses = 24000;
    } else {
      totalIncome = 45700;
      totalExpenses = 12700;
    }
  }

  const netCashFlow = totalIncome - totalExpenses;
  const monthlyCashFlow = netCashFlow;
  const monthlyRevenue = totalIncome;
  const monthlyExpenses = totalExpenses;
  const annualRevenue = monthlyRevenue * 12;
  const annualExpenses = monthlyExpenses * 12;

  // Largest expense categories
  const expenseCatArray = Object.entries(categoryTotals)
    .filter(([_, val]) => val.expense > 0)
    .map(([cat, val]) => ({
      category: cat,
      amount: val.expense,
      percentage: totalExpenses > 0 ? Math.round((val.expense / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Khata totals
  let totalCustCredit = 0;
  let totalSuppCredit = 0;
  for (const k of khata) {
    const remaining = Math.max(0, (k.amount || 0) - (k.paidAmount || 0));
    if (k.type === 'customer_credit') totalCustCredit += remaining;
    if (k.type === 'supplier_credit') totalSuppCredit += remaining;
  }

  // Loan calculation
  const projectCost = Number(l.projectCost) || Math.round(availableCapital / 0.10);
  const loanAmount = Number(l.loanAmount) || Math.round(projectCost * 0.90);
  const interestRate = Number(l.interestRate) || 9.0;
  const tenureYears = Number(l.tenureYears) || 5;
  const quarterlyRate = interestRate / 100 / 4;
  const totalQuarters = tenureYears * 4;

  let quarterlyEmi = Number(l.quarterlyEmi) || 0;
  if (!quarterlyEmi || quarterlyEmi <= 0) {
    if (quarterlyRate > 0 && totalQuarters > 0) {
      const cf = Math.pow(1 + quarterlyRate, totalQuarters);
      quarterlyEmi = Math.round((loanAmount * quarterlyRate * cf) / (cf - 1));
    } else {
      quarterlyEmi = Math.round(loanAmount / totalQuarters);
    }
  }

  const monthlyEmiEquivalent = Math.round(quarterlyEmi / 3);
  const totalRepayment = quarterlyEmi * totalQuarters;
  const totalInterest = Math.max(0, totalRepayment - loanAmount);

  // Working capital ratio
  const ratio =
    typeof l.workingCapitalRatio === 'number'
      ? Math.max(0.05, Math.min(0.95, l.workingCapitalRatio))
      : sector.defaultWcRatio;
  const wcPercent = Math.round(ratio * 1000) / 10;
  const capexPercent = Math.round((100 - wcPercent) * 10) / 10;
  const wcAmount = Math.round(loanAmount * (wcPercent / 100));
  const capexAmount = loanAmount - wcAmount;

  // Key ratios
  const monthlyProfit = monthlyRevenue - monthlyExpenses;
  const annualProfit = monthlyProfit * 12;
  const disposableCash = monthlyProfit - monthlyEmiEquivalent;
  const dti = monthlyRevenue > 0 ? Math.round((monthlyEmiEquivalent / monthlyRevenue) * 100) : 0;
  const dscr = monthlyEmiEquivalent > 0 ? Math.round((monthlyProfit / monthlyEmiEquivalent) * 100) / 100 : 9.99;

  let repaymentCapacity: 'strong' | 'adequate' | 'tight' | 'high_risk' = 'strong';
  if (dscr >= 1.5 && dti <= 35) {
    repaymentCapacity = 'strong';
  } else if (dscr >= 1.2 && dti <= 50) {
    repaymentCapacity = 'adequate';
  } else if (dscr >= 1.0) {
    repaymentCapacity = 'tight';
  } else {
    repaymentCapacity = 'high_risk';
  }

  const maxSafeMonthlyEmi = Math.max(0, Math.round(monthlyProfit * 0.40));
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = tenureYears * 12;
  let maxSafeLoanAmount = 0;
  if (monthlyRate > 0 && maxSafeMonthlyEmi > 0) {
    maxSafeLoanAmount = Math.round(
      (maxSafeMonthlyEmi * (1 - Math.pow(1 + monthlyRate, -totalMonths))) / monthlyRate
    );
  }

  // Calculate eligible government schemes
  const schemes = calculateAllEligibleSchemes({
    loanAmount,
    category: businessType,
    gender,
    socialCategory,
    locationType: 'rural',
    isNewEnterprise: true,
  });

  return {
    profile: {
      name,
      businessName,
      location,
      businessType,
      availableCapital,
      gender,
      socialCategory,
      hasActiveLoan,
      simulatingSecondLoan,
    },
    income: {
      monthlyRevenue,
      annualRevenue,
      averageMonthlyIncome: monthlyRevenue,
      incomeSources: Object.keys(categoryTotals).filter((c) => categoryTotals[c].income > 0),
    },
    expenses: {
      monthlyExpenses,
      annualExpenses,
      averageMonthlyExpenses: monthlyExpenses,
      largestCategories: expenseCatArray,
    },
    logbook: {
      totalIncome,
      totalExpenses,
      netCashFlow,
      monthlyCashFlow,
      transactionCount: entries.length,
      recentTransactions,
      categoryTotals,
      cashFlowTrend: netCashFlow > 15000 ? 'positive' : netCashFlow > 0 ? 'tight' : 'negative',
    },
    khata: {
      totalCustomerCredit: totalCustCredit,
      totalSupplierCredit: totalSuppCredit,
    },
    loan: {
      marginCapital: availableCapital,
      projectCost,
      loanAmount,
      interestRate,
      tenureYears,
      quarterlyEmi,
      monthlyEmiEquivalent,
      totalInterest,
      totalRepayment,
      workingCapitalAmount: wcAmount,
      workingCapitalPercent: wcPercent,
      capexAmount,
      capexPercent,
      workingCapitalUses: sector.wcUses,
      capexUses: sector.capexUses,
    },
    business: {
      businessType,
      location,
      leanSeason: sector.leanSeason,
      peakSeason: sector.peakSeason,
      moratoriumGuidance: sector.guidanceEn,
      moratoriumGuidanceTe: sector.guidanceTe,
      unitNameEn: sector.unitNameEn,
      unitNameTe: sector.unitNameTe,
      unitCapex: sector.unitCapex,
      unitAnnualNetProfit: sector.unitAnnualNetProfit,
      unitAnnualRevenue: sector.unitAnnualRevenue,
      unitAnnualOpex: sector.unitAnnualOpex,
    },
    calculations: {
      monthlyProfit,
      annualProfit,
      disposableCash,
      debtToIncomeRatio: dti,
      debtServiceCoverageRatio: dscr,
      repaymentCapacity,
      maxSafeMonthlyEmi,
      maxSafeLoanAmount,
    },
    schemes,
  };
}

/**
 * 2. Intent Classification Layer
 */
export function classifyFinancialQueryIntent(query: string): IntentAnalysisResult {
  if (!query || !query.trim()) {
    return {
      intent: 'open_ended_planning',
      targetAmount: null,
      targetUnit: null,
      rawQuery: '',
    };
  }

  const q = query.toLowerCase().trim();
  const targetAmt = parseTargetAmount(q);

  // Entity/Unit detection
  let targetUnit: string | null = null;
  if (q.includes('cow') || q.includes('ఆవు') || q.includes('गाय')) targetUnit = 'cow';
  else if (q.includes('buffalo') || q.includes('బర్రె') || q.includes('భైంస్')) targetUnit = 'buffalo';
  else if (q.includes('loom') || q.includes('మగ్గం') || q.includes('కర్ఘా')) targetUnit = 'loom';
  else if (q.includes('shop') || q.includes('kirana') || q.includes('స్టోర్')) targetUnit = 'store';

  // 1. Moratorium & Seasonal Grace
  if (
    ['moratorium', 'summer', 'lean', 'grace', 'pause', 'skip emi', 'మారటోరియం', 'వేసవి', 'విరామం'].some((k) =>
      q.includes(k)
    )
  ) {
    return { intent: 'moratorium_guidance', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 2. Target profit / Capacity question: "how many cows to make 500000 profit?"
  const isHowMany = [
    'how many', 'number of', 'how much animals', 'how much cows', 'cows do i need', 'cows should i buy',
    'buffaloes do i need', 'looms do i need', 'ఎన్ని ఆవులు', 'ఎన్ని బర్రెలు', 'ఎన్ని మగ్గాలు', 'ఎన్ని కావాలి',
    'ఆవులు కొనాలి', 'బర్రెలు కొనాలి'
  ].some((k) => q.includes(k));

  const isProfit = [
    'profit', 'earn', 'net income', 'income of', 'లాభం', 'సంపాదించడానికి', 'వార్షిక లాభం', 'मुनाफा', 'कमाई'
  ].some((k) => q.includes(k));

  if (isHowMany && (isProfit || targetAmt !== null)) {
    return { intent: 'target_profit_capacity', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 3. Revenue for target profit: "how much revenue / sales do I need to make 5 lakh profit?"
  if (
    (q.includes('revenue') || q.includes('sales') || q.includes('turnover') || q.includes('అమ్మకాలు') || q.includes('టర్నోవర్')) &&
    (isProfit || targetAmt !== null)
  ) {
    return { intent: 'revenue_for_target_profit', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 4. Savings planning: "how much should I save every month?"
  if (
    ['save', 'saving', 'savings', 'దాచుకోవాలి', 'పొదుపు', 'బచత్', 'emergency fund'].some((k) => q.includes(k)) &&
    !q.includes('subsidy')
  ) {
    return { intent: 'savings_planning', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 5. Expense reduction: "how can I reduce my expenses?"
  if (
    (['reduce', 'cut', 'lower', 'control', 'curtail', 'తగ్గించు', 'తగ్గించ'].some((k) => q.includes(k)) &&
      ['expense', 'cost', 'spending', 'ఖర్చు'].some((w) => q.includes(w))) ||
    q.includes('reduce my expenses')
  ) {
    return { intent: 'expense_reduction', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 6. Specific Scheme Rationale: "why Stand-Up India / PMEGP / Mudra?"
  if (
    ['why', 'ఎందుకు'].some((k) => q.includes(k)) &&
    ['stand-up', 'pmegp', 'mudra', 'vishwakarma', 'nbcfdc', 'scheme', 'పథకం'].some((k) => q.includes(k))
  ) {
    return { intent: 'scheme_rationale', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 7. Scheme eligibility & comparison: "what schemes am I eligible for?"
  if (
    ['scheme', 'eligible', 'government scheme', 'subsidies', 'subsidy', 'పథకాలు', 'ప్రభుత్వ పథకాలు', 'అర్హత', 'సబ్సిడీ'].some(
      (k) => q.includes(k)
    )
  ) {
    return { intent: 'government_schemes', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 8. Bank documentation checklist
  if (
    ['document', 'paperwork', 'bank require', 'kyc', 'apply', 'approval', 'పత్రాలు', 'డాక్యుమెంట్లు', 'బ్యాంక్ కాగితాలు'].some(
      (k) => q.includes(k)
    )
  ) {
    return { intent: 'document_requirements', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 9. Working capital vs Capex
  if (
    ['working capital', 'capex', 'split', 'machinery', 'stock', 'వర్కింగ్ క్యాపిటల్', 'కేపెక్స్', 'విభజన'].some((k) =>
      q.includes(k)
    )
  ) {
    return { intent: 'working_capital_split', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 10. Max borrowing: "how much can I borrow?", "how much loan can I get?"
  if (
    ['how much can i borrow', 'how much loan can i get', 'maximum loan', 'max loan', 'borrowing limit', 'ఎంత రుణం తీసుకోవచ్చు', 'ఎంత లోన్ వస్తుంది', 'ఎంత అప్పు పొందగలను'].some(
      (k) => q.includes(k)
    )
  ) {
    return { intent: 'max_borrowing_capacity', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 11. Repayment / EMI / Installments
  if (
    ['quarterly repayment', 'quarterly emi', 'monthly emi', 'installment', 'monthly pay', 'quarterly pay', 'వాయిదా', 'కిస్తీ', 'చెల్లింపు'].some((k) =>
      q.includes(k)
    ) ||
    ((q.includes('emi') || q.includes('repay')) && !q.includes('interest'))
  ) {
    return { intent: 'emi_calculation', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 12. Interest / Total Outlay
  if (
    ['interest rate', 'total cost of loan', 'total interest', 'total repay', 'వడ్డీ', 'మొత్తం వడ్డీ', 'వడ్డీ రేటు'].some((k) =>
      q.includes(k)
    )
  ) {
    return { intent: 'interest_cost', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 13. Loan Affordability: "Can I afford X?", "Can I take ₹2 lakh loan?"
  if (
    ['afford', 'can i take', 'can i borrow', 'తీసుకోవచ్చా', 'భరించగలనా', 'సాధ్యమేనా', 'తీసుకోవచ్చా లేదా'].some(
      (k) => q.includes(k)
    ) ||
    (targetAmt !== null && (q.includes('loan') || q.includes('రుణం') || q.includes('లోన్') || q.includes('lakh')))
  ) {
    return { intent: 'loan_affordability', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 14. Profit analysis: "how much profit am I making?"
  if (
    ['how much profit', 'my profit', 'profit margin', 'am i making profit', 'నా లాభం ఎంత', 'లాభాలు ఎంత', 'లాభం వస్తుందా'].some(
      (k) => q.includes(k)
    )
  ) {
    return { intent: 'profit_analysis', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 15. Business expansion: "should I expand?", "can I expand?"
  if (
    ['expand', 'expansion', 'grow business', 'వ్యాపార విస్తరణ', 'పెంచవచ్చా', 'విస్తరించవచ్చా', 'బ్రాంచ్'].some((k) =>
      q.includes(k)
    )
  ) {
    return { intent: 'business_expansion', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 16. Break-even analysis
  if (['break-even', 'breakeven', 'break even', 'బ్రేక్ ఈవెన్', 'నో లాస్'].some((k) => q.includes(k))) {
    return { intent: 'break_even_analysis', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  // 17. Cash flow analysis
  if (['cash flow', 'cashflow', 'నగదు ప్రవాహం', 'ఆదాయ వ్యయాలు'].some((k) => q.includes(k))) {
    return { intent: 'cash_flow_analysis', targetAmount: targetAmt, targetUnit, rawQuery: query };
  }

  return { intent: 'open_ended_planning', targetAmount: targetAmt, targetUnit, rawQuery: query };
}

/**
 * 3. Question-Specific Deterministic Calculations
 */
export interface SpecificCalculationResult {
  intent: FinancialIntent;
  summary: string;
  summaryTe: string;
  data: Record<string, any>;
}

export function performQuestionSpecificCalculations(
  ctx: NormalizedFinancialContext,
  intentResult: IntentAnalysisResult
): SpecificCalculationResult {
  const { intent, targetAmount } = intentResult;

  switch (intent) {
    case 'loan_affordability': {
      const loanToTest = targetAmount && targetAmount > 0 ? targetAmount : ctx.loan.loanAmount;
      const interestRate = ctx.loan.interestRate;
      const tenureYears = ctx.loan.tenureYears;
      const monthlyRate = interestRate / 100 / 12;
      const totalMonths = tenureYears * 12;

      // Calculate monthly EMI for proposed loan
      const cf = Math.pow(1 + monthlyRate, totalMonths);
      const testMonthlyEmi = Math.round((loanToTest * monthlyRate * cf) / (cf - 1));
      const testQuarterlyEmi = testMonthlyEmi * 3;

      const currentMonthlyIncome = ctx.income.monthlyRevenue;
      const currentMonthlyExpenses = ctx.expenses.monthlyExpenses;
      const currentMonthlySurplus = currentMonthlyIncome - currentMonthlyExpenses;
      const projectedDisposableCash = currentMonthlySurplus - testMonthlyEmi;

      const testDti = currentMonthlyIncome > 0 ? Math.round((testMonthlyEmi / currentMonthlyIncome) * 100) : 0;
      const testDscr = testMonthlyEmi > 0 ? Math.round((currentMonthlySurplus / testMonthlyEmi) * 100) / 100 : 9.99;

      const isAffordable = testDscr >= 1.25 && testDti <= 45;
      const isTight = testDscr >= 1.0 && !isAffordable;

      const summary = isAffordable
        ? `Yes, you can comfortably afford a ₹${loanToTest.toLocaleString('en-IN')} loan. At ${interestRate}% over ${tenureYears} years, your estimated monthly repayment will be ₹${testMonthlyEmi.toLocaleString('en-IN')} (Quarterly: ₹${testQuarterlyEmi.toLocaleString('en-IN')}). With your current monthly net cash flow of ₹${currentMonthlySurplus.toLocaleString('en-IN')}, you will retain ₹${projectedDisposableCash.toLocaleString('en-IN')} in disposable cash buffer (DSCR: ${testDscr}x, DTI: ${testDti}%).`
        : isTight
        ? `A ₹${loanToTest.toLocaleString('en-IN')} loan is possible but financially tight. The monthly EMI of ₹${testMonthlyEmi.toLocaleString('en-IN')} consumes ${testDti}% of your monthly income, leaving only ₹${projectedDisposableCash.toLocaleString('en-IN')} disposable cash (DSCR: ${testDscr}x). We recommend building an extra ₹15,000 emergency reserve or opting for a government subsidy scheme like PMEGP/Stand-Up India.`
        : `A ₹${loanToTest.toLocaleString('en-IN')} loan is NOT recommended right now. The monthly EMI of ₹${testMonthlyEmi.toLocaleString('en-IN')} exceeds or severely stresses your current monthly surplus of ₹${currentMonthlySurplus.toLocaleString('en-IN')} (DSCR: ${testDscr}x). Your maximum safe borrowing limit is approximately ₹${ctx.calculations.maxSafeLoanAmount.toLocaleString('en-IN')}.`;

      const summaryTe = isAffordable
        ? `అవును, మీరు ₹${loanToTest.toLocaleString('en-IN')} రుణాన్ని సులభంగా భరించగలరు. ${interestRate}% వడ్డీతో 5 సంవత్సరాలకు నెలవారీ వాయిదా సుమారు ₹${testMonthlyEmi.toLocaleString('en-IN')} (త్రైమాసికం: ₹${testQuarterlyEmi.toLocaleString('en-IN')}). మీ ప్రస్తుత నికర మిగులు ₹${currentMonthlySurplus.toLocaleString('en-IN')} లో వాయిదా పోను ₹${projectedDisposableCash.toLocaleString('en-IN')} మిగులు నిధులు ఉంటాయి (DSCR: ${testDscr}x).`
        : isTight
        ? `₹${loanToTest.toLocaleString('en-IN')} రుణం సాధ్యమే కానీ కాస్త రిస్క్ ఉంది. నెలవారీ వాయిదా ₹${testMonthlyEmi.toLocaleString('en-IN')} మీ ఆదాయంలో ${testDti}% తీసుకుంటుంది. మిగులు కేవలం ₹${projectedDisposableCash.toLocaleString('en-IN')} మాత్రమే ఉంటుంది.`
        : `ప్రస్తుత ఆదాయ పరిస్థితుల్లో ₹${loanToTest.toLocaleString('en-IN')} రుణం సిఫార్సు చేయబడదు. మీ ప్రస్తుత సురక్షిత రుణ పరిమితి దాదాపు ₹${ctx.calculations.maxSafeLoanAmount.toLocaleString('en-IN')}.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          testLoanAmount: loanToTest,
          testMonthlyEmi,
          testQuarterlyEmi,
          currentMonthlySurplus,
          projectedDisposableCash,
          testDti,
          testDscr,
          isAffordable,
        },
      };
    }

    case 'target_profit_capacity': {
      const targetProfit = targetAmount && targetAmount > 0 ? targetAmount : 500000;
      const unitNetProfit = ctx.business.unitAnnualNetProfit;
      const unitCapex = ctx.business.unitCapex;
      const unitName = ctx.business.unitNameEn;
      const unitNameTe = ctx.business.unitNameTe;

      const exactUnits = targetProfit / unitNetProfit;
      const recommendedUnits = Math.ceil(exactUnits);
      const totalOutlay = recommendedUnits * unitCapex;
      const promoterEquity = Math.round(totalOutlay * 0.10);
      const bankLoan = totalOutlay - promoterEquity;
      const annualProjectedRevenue = recommendedUnits * ctx.business.unitAnnualRevenue;
      const annualProjectedOpex = recommendedUnits * ctx.business.unitAnnualOpex;
      const grossAnnualProfit = annualProjectedRevenue - annualProjectedOpex;

      const summary = `To generate a target annual profit of ₹${targetProfit.toLocaleString('en-IN')}, you require ${recommendedUnits} ${unitName}s (exact: ${exactUnits.toFixed(1)}). Each unit generates ₹${unitNetProfit.toLocaleString('en-IN')} in annual net profit (Revenue: ₹${ctx.business.unitAnnualRevenue.toLocaleString('en-IN')} minus Opex: ₹${ctx.business.unitAnnualOpex.toLocaleString('en-IN')}). Total capital required is ₹${totalOutlay.toLocaleString('en-IN')}, structured as ₹${promoterEquity.toLocaleString('en-IN')} equity margin (10%) and ₹${bankLoan.toLocaleString('en-IN')} institutional loan.`;

      const summaryTe = `వార్షికంగా ₹${targetProfit.toLocaleString('en-IN')} నికర లాభం సంపాదించడానికి మీకు ${recommendedUnits} ${unitNameTe}లు అవసరం. ప్రతి యూనిట్ ద్వారా వార్షికంగా ₹${unitNetProfit.toLocaleString('en-IN')} నికర లాభం వస్తుంది. మొత్తం ప్రాజెక్ట్ వ్యయం ₹${totalOutlay.toLocaleString('en-IN')}, ఇందులో మీ స్వంత పెట్టుబడి ₹${promoterEquity.toLocaleString('en-IN')} (10%) మరియు బ్యాంక్ రుణం ₹${bankLoan.toLocaleString('en-IN')} (90%).`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          targetProfit,
          recommendedUnits,
          exactUnits,
          unitNetProfit,
          unitCapex,
          totalOutlay,
          promoterEquity,
          bankLoan,
          annualProjectedRevenue,
          grossAnnualProfit,
        },
      };
    }

    case 'expense_reduction': {
      const largest = ctx.expenses.largestCategories;
      const topCat = largest[0] || { category: 'Supplies & Feed', amount: 6250, percentage: 49 };
      const secondCat = largest[1] || { category: 'Fodder & Operations', amount: 4500, percentage: 35 };
      const potentialMonthlySavings = Math.round(ctx.expenses.monthlyExpenses * 0.15);

      const summary = `Based on your digital logbook records, your largest operational spending is in: 1) ${topCat.category} (₹${topCat.amount.toLocaleString('en-IN')}, ${topCat.percentage}% of total expenses) and 2) ${secondCat.category} (₹${secondCat.amount.toLocaleString('en-IN')}, ${secondCat.percentage}%). To cut costs: a) Source cattle feed/raw materials directly in cooperative bulk lots for 10%–15% discounts, b) Utilize green fodder silage during lean months, and c) Pre-settle supplier credit using cash discounts. This can save ₹${potentialMonthlySavings.toLocaleString('en-IN')} per month.`;

      const summaryTe = `మీ డిజిటల్ లాగ్‌బుక్ లెక్కల ప్రకారం, మీ ప్రధాన ఖర్చులు: 1) ${topCat.category} (₹${topCat.amount.toLocaleString('en-IN')}, ${topCat.percentage}%) మరియు 2) ${secondCat.category} (₹${secondCat.amount.toLocaleString('en-IN')}, ${secondCat.percentage}%). ఖర్చులు తగ్గించడానికి: డైరీ సహకార సంఘం ద్వారా హోల్‌సేల్ కొనుగోళ్లు చేయడం మరియు సైలేజ్ గడ్డిని నిల్వ చేసుకోవడం ద్వారా నెలకు సుమారు ₹${potentialMonthlySavings.toLocaleString('en-IN')} ఆదా చేయవచ్చు.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          topCategories: largest,
          potentialMonthlySavings,
        },
      };
    }

    case 'savings_planning': {
      const monthlySurplus = ctx.calculations.monthlyProfit;
      const recommendedEmergencyMonthly = Math.round(monthlySurplus * 0.25);
      const targetRunwayFund = ctx.expenses.monthlyExpenses * 3;
      const monthsToTarget = recommendedEmergencyMonthly > 0 ? Math.ceil(targetRunwayFund / recommendedEmergencyMonthly) : 12;

      const summary = `With your current monthly revenue of ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} and expenses of ₹${ctx.expenses.monthlyExpenses.toLocaleString('en-IN')}, your monthly net cash surplus is ₹${monthlySurplus.toLocaleString('en-IN')}. We advise allocating 25% (₹${recommendedEmergencyMonthly.toLocaleString('en-IN')}/month) into a liquid recurring savings fund. In ${monthsToTarget} months, you will build a full 3-month operating emergency runway of ₹${targetRunwayFund.toLocaleString('en-IN')}.`;

      const summaryTe = `మీ ప్రస్తుత నెలవారీ ఆదాయం ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} మరియు ఖర్చులు ₹${ctx.expenses.monthlyExpenses.toLocaleString('en-IN')} కాగా, మీ నికర మిగులు ₹${monthlySurplus.toLocaleString('en-IN')}. ఇందులో 25% (నెలకు ₹${recommendedEmergencyMonthly.toLocaleString('en-IN')}) పొదుపు చేయడం ద్వారా ${monthsToTarget} నెలల్లో 3 నెలల ఎమర్జెన్సీ ఫండ్ (₹${targetRunwayFund.toLocaleString('en-IN')}) సిద్ధమవుతుంది.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          monthlySurplus,
          recommendedEmergencyMonthly,
          targetRunwayFund,
          monthsToTarget,
        },
      };
    }

    case 'max_borrowing_capacity': {
      const safeMonthlyEmi = ctx.calculations.maxSafeMonthlyEmi;
      const maxSafeLoan = ctx.calculations.maxSafeLoanAmount;
      const safeQuarterlyEmi = safeMonthlyEmi * 3;

      const summary = `Based on your monthly net surplus of ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')}, your maximum safe debt-servicing capacity is ₹${safeMonthlyEmi.toLocaleString('en-IN')}/month (40% prudent underwriting cap). At a 9.0% annual interest rate over a 5-year tenure, your maximum prudent borrowing limit is approximately ₹${maxSafeLoan.toLocaleString('en-IN')} (Quarterly EMI: ₹${safeQuarterlyEmi.toLocaleString('en-IN')}).`;

      const summaryTe = `మీ నెలవారీ నికర మిగులు ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')} ఆధారంగా, మీరు నెలకు గరిష్టంగా ₹${safeMonthlyEmi.toLocaleString('en-IN')} వాయిదా చెల్లించగలరు (40% సురక్షిత పరిమితి). 9.0% వడ్డీతో 5 సంవత్సరాల కాలానికి మీ గరిష్ట రుణ పరిమితి సుమారు ₹${maxSafeLoan.toLocaleString('en-IN')} (త్రైమాసిక వాయిదా: ₹${safeQuarterlyEmi.toLocaleString('en-IN')}).`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          safeMonthlyEmi,
          safeQuarterlyEmi,
          maxSafeLoan,
          monthlySurplus: ctx.calculations.monthlyProfit,
        },
      };
    }

    case 'revenue_for_target_profit': {
      const targetProfit = targetAmount && targetAmount > 0 ? targetAmount : 500000;
      const currentProfitMargin =
        ctx.income.annualRevenue > 0
          ? Math.round((ctx.calculations.annualProfit / ctx.income.annualRevenue) * 100)
          : 50;
      const marginDecimal = Math.max(0.15, currentProfitMargin / 100);
      const requiredAnnualRevenue = Math.round(targetProfit / marginDecimal);
      const requiredMonthlyRevenue = Math.round(requiredAnnualRevenue / 12);

      const summary = `At your enterprise's operating profit margin of ${currentProfitMargin}%, generating ₹${targetProfit.toLocaleString('en-IN')} in annual net profit requires an annual top-line revenue of approximately ₹${requiredAnnualRevenue.toLocaleString('en-IN')} (₹${requiredMonthlyRevenue.toLocaleString('en-IN')}/month). This represents a ${(requiredAnnualRevenue / Math.max(1, ctx.income.annualRevenue)).toFixed(1)}x scaling of your current production volume.`;

      const summaryTe = `మీ వ్యాపార లాభాల మార్జిన్ ${currentProfitMargin}% ప్రకారం, వార్షికంగా ₹${targetProfit.toLocaleString('en-IN')} నికర లాభం పొందడానికి వార్షిక టర్నోవర్/ఆదాయం ₹${requiredAnnualRevenue.toLocaleString('en-IN')} (నెలకు ₹${requiredMonthlyRevenue.toLocaleString('en-IN')}) ఉండాలి.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          targetProfit,
          currentProfitMargin,
          requiredAnnualRevenue,
          requiredMonthlyRevenue,
        },
      };
    }

    case 'profit_analysis': {
      const monthlyProfit = ctx.calculations.monthlyProfit;
      const annualProfit = ctx.calculations.annualProfit;
      const profitMarginPct =
        ctx.income.monthlyRevenue > 0 ? Math.round((monthlyProfit / ctx.income.monthlyRevenue) * 100) : 0;

      const summary = `Your enterprise currently generates ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} in monthly revenue against ₹${ctx.expenses.monthlyExpenses.toLocaleString('en-IN')} in operating expenses. This yields a net monthly profit of ₹${monthlyProfit.toLocaleString('en-IN')} (Annualized: ₹${annualProfit.toLocaleString('en-IN')}) with a strong profit margin of ${profitMarginPct}%.`;

      const summaryTe = `మీ వ్యాపారం నెలవారీ ఆదాయం ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} మరియు ఖర్చులు ₹${ctx.expenses.monthlyExpenses.toLocaleString('en-IN')} కాగా, మీ నికర నెలవారీ లాభం ₹${monthlyProfit.toLocaleString('en-IN')} (వార్షికంగా: ₹${annualProfit.toLocaleString('en-IN')}). మీ లాభాల మార్జిన్ ${profitMarginPct}%.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          monthlyProfit,
          annualProfit,
          profitMarginPct,
        },
      };
    }

    case 'business_expansion': {
      const expansionCost = targetAmount && targetAmount > 0 ? targetAmount : Math.round(ctx.loan.projectCost * 0.5);
      const ownEquity = Math.round(expansionCost * 0.15);
      const expansionLoan = expansionCost - ownEquity;
      const newMonthlyEmi = Math.round((expansionLoan * 0.09) / 12 + expansionLoan / (5 * 12));
      const projectedNewProfit = Math.round(ctx.calculations.monthlyProfit * 1.45) - newMonthlyEmi;
      const isViable = ctx.calculations.repaymentCapacity === 'strong' || ctx.calculations.repaymentCapacity === 'adequate';

      const summary = isViable
        ? `Expansion is financially viable. For a ₹${expansionCost.toLocaleString('en-IN')} expansion project (₹${ownEquity.toLocaleString('en-IN')} equity + ₹${expansionLoan.toLocaleString('en-IN')} loan), your incremental monthly debt service will be ~₹${newMonthlyEmi.toLocaleString('en-IN')}. Supported by your ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')} existing monthly surplus, your projected post-expansion monthly profit increases to ₹${projectedNewProfit.toLocaleString('en-IN')}.`
        : `Immediate expansion is not advised until working capital reserves strengthen. The additional debt obligation of ₹${newMonthlyEmi.toLocaleString('en-IN')}/month would leave too narrow a margin for seasonal shocks. Focus on optimizing current capacity first.`;

      const summaryTe = isViable
        ? `వ్యాపార విస్తరణ అనుకూలంగా ఉంది. ₹${expansionCost.toLocaleString('en-IN')} ప్రాజెక్టుకు మీ పెట్టుబడి ₹${ownEquity.toLocaleString('en-IN')} మరియు రుణం ₹${expansionLoan.toLocaleString('en-IN')}. అదనపు వాయిదా ~₹${newMonthlyEmi.toLocaleString('en-IN')} పోను మీ నెలవారీ లాభం ₹${projectedNewProfit.toLocaleString('en-IN')} కు పెరుగుతుంది.`
        : `ప్రస్తుతానికి విస్తరణ కంటే వర్కింగ్ క్యాపిటల్ పెంచుకోవడం మంచిది. కొత్త వాయిదాలు నగదు ప్రవాహంపై ఒత్తిడి తెస్తాయి.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          expansionCost,
          ownEquity,
          expansionLoan,
          newMonthlyEmi,
          projectedNewProfit,
          isViable,
        },
      };
    }

    case 'government_schemes': {
      const topSchemes = ctx.schemes.slice(0, 3);
      const topScheme = topSchemes.find((s) => s.isTopMatch) || topSchemes[0];

      const summary = `Based on your profile (${ctx.profile.gender}, ${ctx.profile.socialCategory}, ${ctx.profile.location}), you qualify for: 1) ${topScheme.schemeName} (Top recommendation: ${topScheme.guaranteeCoverage}), 2) PMEGP (up to 35% capital subsidy for rural micro-enterprises), and 3) PM MUDRA Yojana (collateral-free credit up to ₹10 Lakhs).`;
      const summaryTe = `మీ ప్రొఫైల్ (${ctx.profile.gender === 'female' ? 'మహిళ' : 'పురుష'}, ${ctx.profile.socialCategory}, ${ctx.profile.location}) ఆధారంగా మీరు అర్హులైన పథకాలు: 1) ${topScheme.schemeNameTe}, 2) పీఎంఈజీపీ (35% వరకు గ్రామీణ సబ్సిడీ), 3) పీఎం ముద్రా యోజన (రూ. 10 లక్షల వరకు పూచీకత్తు లేని రుణం).`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          topSchemes,
        },
      };
    }

    case 'scheme_rationale': {
      const topScheme = ctx.schemes.find((s) => s.isTopMatch) || ctx.schemes[0];
      const isWoman = ctx.profile.gender === 'female';
      const isScSt = ['SC', 'ST'].includes(ctx.profile.socialCategory);

      const whyEn = topScheme.schemeId.includes('stand-up')
        ? `Stand-Up India is prioritized because as a ${isWoman ? 'woman' : isScSt ? 'SC/ST' : ''} entrepreneur, scheduled banks have a statutory mandate to disburse loans between ₹10 Lakhs and ₹1 Crore with concessional margin money (15%) and NCGTC credit guarantee.`
        : topScheme.schemeId.includes('pmegp')
        ? `PMEGP is recommended because Special Category promoters receive a 35% rural capital subsidy on micro-enterprises, reducing your net debt obligation by ₹${Math.round(ctx.loan.projectCost * 0.35).toLocaleString('en-IN')}.`
        : `PM MUDRA is recommended for universal 100% collateral-free credit with flexible overdraft/RuPay card facility for working capital.`;

      const whyTe = topScheme.schemeId.includes('stand-up')
        ? `స్టాండ్-అప్ ఇండియా పథకం మహిళలు మరియు SC/ST పారిశ్రామికవేత్తలకు ప్రాధాన్యత ఇస్తుంది. 15% మార్జిన్ మనీ మరియు ప్రభుత్వ క్రెడిట్ గ్యారెంటీతో రుణం లభిస్తుంది.`
        : topScheme.schemeId.includes('pmegp')
        ? `పీఎంఈజీపీ పథకం ద్వారా గ్రామీణ ప్రాంతంలో 35% ప్రభుత్వ సబ్సిడీ లభించి రుణ భారం తగ్గుతుంది.`
        : `పీఎం ముద్రా పథకం కింద ఎలాంటి పూచీకత్తు లేకుండా సులభంగా రుణం పొందవచ్చు.`;

      const summary = `We recommend ${topScheme.schemeName}: ${whyEn} Your quarterly repayment is ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')}.`;
      const summaryTe = `మీకు ${topScheme.schemeNameTe} సిఫార్సు చేయబడింది: ${whyTe} మీ త్రైమాసిక వాయిదా ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')}.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          recommendedScheme: topScheme,
          whyEn,
          whyTe,
        },
      };
    }

    case 'moratorium_guidance': {
      const summary = `${ctx.business.moratoriumGuidance} During ${ctx.business.leanSeason}, you only pay accrued interest on your ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} loan, preserving liquidity before cash flow accelerates in ${ctx.business.peakSeason}.`;
      const summaryTe = `${ctx.business.moratoriumGuidanceTe} ${ctx.business.leanSeason} కాలంలో అసలు చెల్లించకుండా కేవలం వడ్డీ మాత్రమే చెల్లించి, ${ctx.business.peakSeason} కాలంలో అసలు వేగంగా చెల్లించవచ్చు.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          leanSeason: ctx.business.leanSeason,
          peakSeason: ctx.business.peakSeason,
          moratoriumGuidance: ctx.business.moratoriumGuidance,
        },
      };
    }

    case 'emi_calculation': {
      const summary = `For your ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} loan at ${ctx.loan.interestRate}% interest over ${ctx.loan.tenureYears} years, your scheduled quarterly repayment is ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')} (monthly equivalent: ~₹${ctx.loan.monthlyEmiEquivalent.toLocaleString('en-IN')}).`;
      const summaryTe = `మీ ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} రుణానికి ${ctx.loan.interestRate}% వడ్డీతో ${ctx.loan.tenureYears} సంవత్సరాల కాలపరిమితిలో త్రైమాసిక వాయిదా ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')} (నెలకు సుమారు ₹${ctx.loan.monthlyEmiEquivalent.toLocaleString('en-IN')}).`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          loanAmount: ctx.loan.loanAmount,
          quarterlyEmi: ctx.loan.quarterlyEmi,
          monthlyEmiEquivalent: ctx.loan.monthlyEmiEquivalent,
          tenureYears: ctx.loan.tenureYears,
        },
      };
    }

    case 'interest_cost': {
      const summary = `Over your ${ctx.loan.tenureYears}-year tenure on ₹${ctx.loan.loanAmount.toLocaleString('en-IN')}, total interest paid is ₹${ctx.loan.totalInterest.toLocaleString('en-IN')}, bringing total principal + interest repayment outlay to ₹${ctx.loan.totalRepayment.toLocaleString('en-IN')}.`;
      const summaryTe = `మొత్తం ${ctx.loan.tenureYears} సంవత్సరాల కాలంలో ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} పై చెల్లించాల్సిన మొత్తం వడ్డీ ₹${ctx.loan.totalInterest.toLocaleString('en-IN')}, మొత్తం తిరిగి చెల్లింపు ₹${ctx.loan.totalRepayment.toLocaleString('en-IN')}.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          totalInterest: ctx.loan.totalInterest,
          totalRepayment: ctx.loan.totalRepayment,
        },
      };
    }

    case 'working_capital_split': {
      const summary = `Of your ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} credit facility: ₹${ctx.loan.workingCapitalAmount.toLocaleString('en-IN')} (${ctx.loan.workingCapitalPercent}%) is designated for operational working capital (${ctx.loan.workingCapitalUses.join(', ')}), and ₹${ctx.loan.capexAmount.toLocaleString('en-IN')} (${ctx.loan.capexPercent}%) is locked for capital asset acquisition (${ctx.loan.capexUses.join(', ')}).`;
      const summaryTe = `మీ ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} రుణంలో: రోజువారీ వర్కింగ్ క్యాపిటల్ కోసం ₹${ctx.loan.workingCapitalAmount.toLocaleString('en-IN')} (${ctx.loan.workingCapitalPercent}%) మరియు శాశ్వత యంత్రాలు/పరికరాల కోసం ₹${ctx.loan.capexAmount.toLocaleString('en-IN')} (${ctx.loan.capexPercent}%) కేటాయించబడింది.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          wcAmount: ctx.loan.workingCapitalAmount,
          wcPercent: ctx.loan.workingCapitalPercent,
          capexAmount: ctx.loan.capexAmount,
          capexPercent: ctx.loan.capexPercent,
        },
      };
    }

    case 'document_requirements': {
      const summary = `To sanction your ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} credit under ${ctx.schemes[0]?.schemeName || 'institutional schemes'}, banks require: 1) Aadhaar & PAN KYC, 2) Residence & Caste certificate (${ctx.profile.socialCategory}), 3) Machinery/Capex dealer proforma quotations (₹${ctx.loan.capexAmount.toLocaleString('en-IN')}), 4) 6 months digital logbook/bank statements proving ₹${ctx.loan.marginCapital.toLocaleString('en-IN')} equity margin readiness, and 5) Udyam MSME registration.`;
      const summaryTe = `మీ ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} రుణ దరఖాస్తుకు అవసరమైన పత్రాలు: 1) ఆధార్ & పాన్ కార్డు, 2) నివాస & కుల ధృవీకరణ పత్రం (${ctx.profile.socialCategory}), 3) యంత్రాల ప్రొఫార్మా కొటేషన్లు (₹${ctx.loan.capexAmount.toLocaleString('en-IN')}), 4) 6 నెలల లాగ్‌బుక్/బ్యాంక్ రికార్డులు (మీ ₹${ctx.loan.marginCapital.toLocaleString('en-IN')} పెట్టుబడికి సాక్ష్యం), మరియు 5) ఉద్యమ్ రిజిస్ట్రేషన్.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          requiredDocs: ['Aadhaar & PAN', 'Caste Certificate', 'Capex Quotations', 'Bank/Logbook Statements', 'Udyam MSME'],
        },
      };
    }

    case 'break_even_analysis': {
      const fixedMonthlyCosts = Math.round(ctx.expenses.monthlyExpenses * 0.40) + ctx.loan.monthlyEmiEquivalent;
      const contributionMarginRatio =
        ctx.income.monthlyRevenue > 0
          ? (ctx.income.monthlyRevenue - ctx.expenses.monthlyExpenses * 0.60) / ctx.income.monthlyRevenue
          : 0.50;
      const breakEvenMonthlyRevenue = Math.round(fixedMonthlyCosts / Math.max(0.1, contributionMarginRatio));

      const summary = `Your enterprise's estimated monthly break-even revenue (covering fixed overheads of ~₹${fixedMonthlyCosts.toLocaleString('en-IN')} including debt service) is ₹${breakEvenMonthlyRevenue.toLocaleString('en-IN')}. Since your current monthly revenue is ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')}, you operate with a ${(ctx.income.monthlyRevenue / Math.max(1, breakEvenMonthlyRevenue)).toFixed(1)}x safety margin above break-even.`;

      const summaryTe = `రుణ వాయిదాలతో కలిపి మీ వ్యాపార స్థిర ఖర్చులు నెలకు ~₹${fixedMonthlyCosts.toLocaleString('en-IN')}. మీ బ్రేక్-ఈవెన్ అమ్మకాలు నెలకు ₹${breakEvenMonthlyRevenue.toLocaleString('en-IN')}. మీ ప్రస్తుత అమ్మకాలు ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} దీనికంటే మెరుగ్గా ఉన్నాయి.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          fixedMonthlyCosts,
          breakEvenMonthlyRevenue,
          currentMonthlyRevenue: ctx.income.monthlyRevenue,
        },
      };
    }

    case 'cash_flow_analysis': {
      const summary = `Over the recorded period, total cash inflow is ₹${ctx.logbook.totalIncome.toLocaleString('en-IN')} against outflows of ₹${ctx.logbook.totalExpenses.toLocaleString('en-IN')}, generating net positive cash flow of ₹${ctx.logbook.netCashFlow.toLocaleString('en-IN')} (${ctx.logbook.transactionCount} transactions). Trend: ${ctx.logbook.cashFlowTrend}.`;
      const summaryTe = `మీ వ్యాపార రికార్డుల ప్రకారం: మొత్తం నగదు రాబడి ₹${ctx.logbook.totalIncome.toLocaleString('en-IN')}, ఖర్చులు ₹${ctx.logbook.totalExpenses.toLocaleString('en-IN')}, నికర నగదు ప్రవాహం ₹${ctx.logbook.netCashFlow.toLocaleString('en-IN')} (${ctx.logbook.transactionCount} లావాదేవీలు). నగదు ప్రవాహ పరిస్థితి: ${ctx.logbook.cashFlowTrend === 'positive' ? 'అనుకూలం' : 'ఒత్తిడి'}.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          totalIncome: ctx.logbook.totalIncome,
          totalExpenses: ctx.logbook.totalExpenses,
          netCashFlow: ctx.logbook.netCashFlow,
          trend: ctx.logbook.cashFlowTrend,
        },
      };
    }

    default: {
      const summary = `For your ${ctx.business.businessType} enterprise in ${ctx.profile.location}: your loan requirement of ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} requires scheduled quarterly payments of ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')}. With a net monthly surplus of ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')}, your debt-service coverage ratio is ${ctx.calculations.debtServiceCoverageRatio}x. Ask about schemes, subsidies, unit sizing, savings, or bank documents.`;
      const summaryTe = `${ctx.profile.location} లోని మీ ${ctx.business.businessType} వ్యాపార విశ్లేషణ ప్రకారం, మీ ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} రుణానికి త్రైమాసిక వాయిదా ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')}. మీ నెలవారీ నికర మిగులు ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')}. పథకాలు, సబ్సిడీలు లేదా బ్యాంక్ పత్రాల గురించి ప్రశ్నలు అడగవచ్చు.`;

      return {
        intent,
        summary,
        summaryTe,
        data: {
          loanAmount: ctx.loan.loanAmount,
          quarterlyEmi: ctx.loan.quarterlyEmi,
          monthlyProfit: ctx.calculations.monthlyProfit,
        },
      };
    }
  }
}

/**
 * 4. Dynamic LLM Prompt Generator
 */
export function buildDynamicAdvisorPrompt(
  ctx: NormalizedFinancialContext,
  intentResult: IntentAnalysisResult,
  calcResult: SpecificCalculationResult,
  language: 'en' | 'te',
  history?: { role: 'user' | 'assistant'; content: string }[]
) {
  const isTe = language === 'te';

  const systemPrompt = isTe
    ? `You are the user's personal financial advisor for RuralCred Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.

CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
Respond entirely in natural, fluent Telugu script. Do NOT write in English or Hindi. Do NOT provide bilingual text.

STRICT INSTRUCTIONS:
1. Answer the entrepreneur's question using ONLY the verified financial context and verified calculations supplied below.
2. DO NOT invent or hallucinate financial values or loan metrics.
3. DO NOT repeat a generic predefined financing paragraph.
4. The user's question has absolute priority. Answer their specific question directly in the very first sentence.
5. Use the provided deterministic calculations directly (e.g. EMI, surplus, unit counts, expense percentages, DSCR).
6. Personalize the answer to this specific entrepreneur (${ctx.profile.name}, ${ctx.profile.businessType} in ${ctx.profile.location}).
7. Explain the financial reasoning in simple, encouraging language.`
    : `You are the user's personal financial advisor for RuralCred Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.

CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do NOT include Telugu, Hindi, or regional-language scripts.

STRICT INSTRUCTIONS:
1. Answer the entrepreneur's question using ONLY the verified financial context and verified calculations supplied below.
2. DO NOT invent or hallucinate financial values or loan metrics.
3. DO NOT repeat a generic predefined financing paragraph.
4. The user's question has absolute priority. Answer their specific question directly in the very first sentence.
5. Use the provided deterministic calculations directly (e.g. EMI, surplus, unit counts, expense percentages, DSCR).
6. Personalize the answer to this specific entrepreneur (${ctx.profile.name}, ${ctx.profile.businessType} in ${ctx.profile.location}).
7. Explain the financial reasoning in simple, encouraging language.`;

  let historyText = '';
  if (history && history.length > 0) {
    const recent = history.slice(-6);
    historyText =
      'CONVERSATION HISTORY:\n' +
      recent.map((h) => `${h.role === 'user' ? 'Entrepreneur' : 'Financial Advisor'}: ${h.content}`).join('\n') +
      '\n\n';
  }

  const userPrompt = `${historyText}CURRENT USER PROFILE:
- Name: ${ctx.profile.name}
- Business: ${ctx.profile.businessType} (${ctx.profile.businessName})
- Location: ${ctx.profile.location}
- Demographics: ${ctx.profile.gender}, ${ctx.profile.socialCategory}
- Available Equity Margin: ₹${ctx.profile.availableCapital.toLocaleString('en-IN')}

CURRENT FINANCIAL SUMMARY:
- Monthly Revenue: ₹${ctx.income.monthlyRevenue.toLocaleString('en-IN')} (Annual: ₹${ctx.income.annualRevenue.toLocaleString('en-IN')})
- Monthly Expenses: ₹${ctx.expenses.monthlyExpenses.toLocaleString('en-IN')} (Annual: ₹${ctx.expenses.annualExpenses.toLocaleString('en-IN')})
- Net Monthly Cash Surplus: ₹${ctx.calculations.monthlyProfit.toLocaleString('en-IN')}
- Debt-Service Coverage Ratio (DSCR): ${ctx.calculations.debtServiceCoverageRatio}x
- Repayment Capacity: ${ctx.calculations.repaymentCapacity}
- Max Prudent Borrowing Limit: ₹${ctx.calculations.maxSafeLoanAmount.toLocaleString('en-IN')}

DIGITAL LOGBOOK SUMMARY:
- Total Income Recorded: ₹${ctx.logbook.totalIncome.toLocaleString('en-IN')}
- Total Expenses Recorded: ₹${ctx.logbook.totalExpenses.toLocaleString('en-IN')}
- Net Cash Flow: ₹${ctx.logbook.netCashFlow.toLocaleString('en-IN')} (Trend: ${ctx.logbook.cashFlowTrend})
- Largest Expense Categories: ${ctx.expenses.largestCategories.map((c) => `${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`).join(', ')}

LOAN SUMMARY:
- Principal Loan: ₹${ctx.loan.loanAmount.toLocaleString('en-IN')} | Project Cost: ₹${ctx.loan.projectCost.toLocaleString('en-IN')}
- Interest Rate: ${ctx.loan.interestRate}% p.a. | Tenure: ${ctx.loan.tenureYears} Years
- Scheduled Quarterly Repayment: ₹${ctx.loan.quarterlyEmi.toLocaleString('en-IN')} (Monthly equiv: ₹${ctx.loan.monthlyEmiEquivalent.toLocaleString('en-IN')})
- Working Capital Split: ₹${ctx.loan.workingCapitalAmount.toLocaleString('en-IN')} (${ctx.loan.workingCapitalPercent}%)
- Capex Asset Split: ₹${ctx.loan.capexAmount.toLocaleString('en-IN')} (${ctx.loan.capexPercent}%)
- Recommended Scheme: ${ctx.schemes[0]?.schemeName || 'Priority Micro Credit'}

QUESTION INTENT DETECTED: ${intentResult.intent}

VERIFIED DETERMINISTIC CALCULATIONS FOR THIS QUESTION:
${isTe ? calcResult.summaryTe : calcResult.summary}
Raw Calculation Data: ${JSON.stringify(calcResult.data)}

ENTREPRENEUR'S CURRENT QUESTION:
"${intentResult.rawQuery || 'Provide financial advice for my business'}"

Provide a direct, empathetic, and financially accurate answer (2 to 4 concise paragraphs) addressing their question directly using the verified calculations above.`;

  return { systemPrompt, userPrompt };
}
