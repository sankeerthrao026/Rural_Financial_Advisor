export interface SchemeConfig {
  id: 'micro-finance' | 'term-loan';
  name: string;
  nameTe: string;
  agency: string;
  interestRateAnnual: number; // e.g. 6.5 or 8.0
  tenureYears: number; // e.g. 3 or 7
  moratoriumMonths: number; // e.g. 3 or 6
  maxProjectCost: number;
}

export const SCHEMES: Record<'micro-finance' | 'term-loan', SchemeConfig> = {
  'micro-finance': {
    id: 'micro-finance',
    name: 'Micro Finance Scheme',
    nameTe: 'సూక్ష్మ రుణ పథకం',
    agency: 'NBCFDC / State Minorities & Backward Classes Corporations',
    interestRateAnnual: 6.5,
    tenureYears: 3,
    moratoriumMonths: 3,
    maxProjectCost: 140000,
  },
  'term-loan': {
    id: 'term-loan',
    name: 'Term Loan Scheme',
    nameTe: 'టర్మ్ లోన్ పథకం',
    agency: 'National Backward Classes Finance & Development Corporation (NBCFDC)',
    interestRateAnnual: 8.0,
    tenureYears: 7,
    moratoriumMonths: 6,
    maxProjectCost: 5000000,
  },
};

export interface AmortizationQuarter {
  quarter: number;
  isMoratorium: boolean;
  startingPrincipal: number;
  principalPaid: number;
  interestPaid: number;
  totalPayment: number;
  remainingBalance: number;
}

export interface FinanceAnalysisResult {
  marginCapital: number;
  projectCost: number;
  loanAmount: number;
  marginPercentage: number;
  loanPercentage: number;
  scheme: SchemeConfig;
  quarterlyEmi: number;
  totalQuarters: number;
  moratoriumQuarters: number;
  repaymentQuarters: number;
  totalInterestPaid: number;
  totalRepayment: number;
  amortizationSchedule: AmortizationQuarter[];
}

/**
 * Deterministic Financial Calculations for RuralCred Advisor.
 * Project Cost = Margin Capital / 0.10
 * Loan Amount = 90% of Project Cost
 * Scheme Routing:
 *   If Project Cost <= ₹1,40,000 -> Micro Finance Scheme (6.5% p.a., 3 yrs, 3 mos moratorium)
 *   If ₹1,40,000 < Project Cost <= ₹50,00,000 -> Term Loan Scheme (8.0% p.a., 7 yrs, 6 mos moratorium)
 */
export function calculateFinancePlan(marginCapital: number): FinanceAnalysisResult {
  const cleanMargin = Math.max(1000, marginCapital || 0);

  // Deterministic Project Cost & Loan Amount
  const projectCost = Math.round(cleanMargin / 0.10);
  const loanAmount = Math.round(projectCost * 0.90);

  // Deterministic Scheme Routing
  const scheme: SchemeConfig =
    projectCost <= 140000 ? SCHEMES['micro-finance'] : SCHEMES['term-loan'];

  const annualRate = scheme.interestRateAnnual / 100;
  const quarterlyRate = annualRate / 4;
  const totalQuarters = scheme.tenureYears * 4;
  const moratoriumQuarters = Math.round(scheme.moratoriumMonths / 3);
  const repaymentQuarters = totalQuarters - moratoriumQuarters;

  // Standard Quarterly Reducing Balance Amortization Formula
  // EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
  const p = loanAmount;
  const r = quarterlyRate;
  const n = repaymentQuarters;

  let quarterlyEmi = 0;
  if (r > 0 && n > 0) {
    const compoundFactor = Math.pow(1 + r, n);
    quarterlyEmi = Math.round((p * r * compoundFactor) / (compoundFactor - 1));
  } else {
    quarterlyEmi = Math.round(p / n);
  }

  // Generate Quarter-by-Quarter Schedule
  const schedule: AmortizationQuarter[] = [];
  let currentBalance = loanAmount;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let q = 1; q <= totalQuarters; q++) {
    const isMoratorium = q <= moratoriumQuarters;
    const startPrincipal = currentBalance;
    const interest = Math.round(startPrincipal * r);
    totalInterest += interest;

    if (isMoratorium) {
      // During moratorium: Interest only (grace period for principal repayment)
      const payment = interest;
      totalPaid += payment;
      schedule.push({
        quarter: q,
        isMoratorium: true,
        startingPrincipal: startPrincipal,
        principalPaid: 0,
        interestPaid: interest,
        totalPayment: payment,
        remainingBalance: currentBalance,
      });
    } else {
      // Repayment quarter
      const isLastQuarter = q === totalQuarters;
      let principalPaid = isLastQuarter
        ? currentBalance
        : Math.round(quarterlyEmi - interest);

      if (principalPaid > currentBalance) {
        principalPaid = currentBalance;
      }

      const totalPayment = isLastQuarter
        ? principalPaid + interest
        : quarterlyEmi;

      currentBalance = Math.max(0, currentBalance - principalPaid);
      totalPaid += totalPayment;

      schedule.push({
        quarter: q,
        isMoratorium: false,
        startingPrincipal: startPrincipal,
        principalPaid: principalPaid,
        interestPaid: interest,
        totalPayment: totalPayment,
        remainingBalance: currentBalance,
      });
    }
  }

  return {
    marginCapital: cleanMargin,
    projectCost,
    loanAmount,
    marginPercentage: 10,
    loanPercentage: 90,
    scheme,
    quarterlyEmi,
    totalQuarters,
    moratoriumQuarters,
    repaymentQuarters,
    totalInterestPaid: totalInterest,
    totalRepayment: totalPaid,
    amortizationSchedule: schedule,
  };
}

export interface FinancialHealthScoreResult {
  score: number; // 0 - 100
  loggingScore: number;
  profitTrendScore: number;
  expenseRatioScore: number;
  status: 'excellent' | 'steady' | 'needs_attention';
  statusTe: string;
  summary: string;
  summaryTe: string;
  breakdown: {
    label: string;
    labelTe: string;
    weight: string;
    score: number;
  }[];
}

/**
 * Transparent Rule-Based Financial Health Score (0 - 100).
 * Strictly rule-based calculation with transparent weights.
 * Not black-box or fake ML.
 */
export function calculateFinancialHealthScore(params: {
  totalIncome: number;
  totalExpenses: number;
  entryCount: number;
  hasDownwardTrend: boolean;
}): FinancialHealthScoreResult {
  const { totalIncome, totalExpenses, entryCount, hasDownwardTrend } = params;

  // 1. Logging Consistency (Weight 30%)
  let loggingScore = 40;
  if (entryCount >= 10) loggingScore = 95;
  else if (entryCount >= 5) loggingScore = 80;
  else if (entryCount >= 2) loggingScore = 65;

  // 2. Profit Trend (Weight 40%)
  const netCashFlow = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? netCashFlow / totalIncome : 0;
  let profitTrendScore = 50;

  if (margin > 0.25 && !hasDownwardTrend) profitTrendScore = 95;
  else if (margin > 0.10 && !hasDownwardTrend) profitTrendScore = 85;
  else if (margin >= 0 && !hasDownwardTrend) profitTrendScore = 70;
  else if (hasDownwardTrend && margin >= 0) profitTrendScore = 55;
  else profitTrendScore = 25; // Negative cash flow

  // 3. Expense-to-Income Ratio (Weight 30%)
  const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 1.0;
  let expenseRatioScore = 30;

  if (expenseRatio <= 0.60) expenseRatioScore = 95;
  else if (expenseRatio <= 0.75) expenseRatioScore = 80;
  else if (expenseRatio <= 0.90) expenseRatioScore = 65;
  else if (expenseRatio <= 1.00) expenseRatioScore = 45;
  else expenseRatioScore = 20;

  // Weighted aggregate
  const rawScore =
    loggingScore * 0.30 + profitTrendScore * 0.40 + expenseRatioScore * 0.30;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let status: 'excellent' | 'steady' | 'needs_attention' = 'steady';
  let statusTe = 'స్థిరంగా ఉంది';
  let summary = 'Your business cash flow is stable with positive operating margin.';
  let summaryTe = 'మీ వ్యాపార నగదు ప్రవాహం సానుకూల లాభాల మార్జిన్‌తో స్థిరంగా ఉంది.';

  if (score >= 80) {
    status = 'excellent';
    statusTe = 'అత్యుత్తమంగా ఉంది';
    summary = 'Strong financial discipline. Consistent records and healthy margin qualify you for priority scheme approvals.';
    summaryTe = 'గొప్ప ఆర్థిక క్రమశిక్షణ. క్రమబద్ధమైన రికార్డులు మరియు ఆరోగ్యకరమైన మార్జిన్ రుణ మంజూరుకు సహాయపడతాయి.';
  } else if (score < 50) {
    status = 'needs_attention';
    statusTe = 'శ్రద్ధ వహించాలి';
    summary = 'High expense ratio or negative cash flow detected. Focus on lowering operating costs before expanding.';
    summaryTe = 'అధిక ఖర్చులు లేదా ప్రతికూల నగదు ప్రవాహం ఉంది. వ్యాపార విస్తరణకు ముందు ఖర్చులను తగ్గించుకోవడం ముఖ్యం.';
  }

  return {
    score,
    loggingScore,
    profitTrendScore,
    expenseRatioScore,
    status,
    statusTe,
    summary,
    summaryTe,
    breakdown: [
      {
        label: 'Logging Consistency',
        labelTe: 'లాగ్‌బుక్ నిర్వహణ క్రమం',
        weight: '30%',
        score: loggingScore,
      },
      {
        label: 'Profit Trend & Margin',
        labelTe: 'లాభాల వృద్ధి ధోరణి',
        weight: '40%',
        score: profitTrendScore,
      },
      {
        label: 'Expense-to-Income Control',
        labelTe: 'ఖర్చులు-ఆదాయ నియంత్రణ',
        weight: '30%',
        score: expenseRatioScore,
      },
    ],
  };
}
