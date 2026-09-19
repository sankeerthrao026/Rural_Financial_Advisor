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
  if (entryCount >= 10) loggingScore = 100;
  else if (entryCount >= 5) loggingScore = 85;
  else if (entryCount >= 2) loggingScore = 65;

  // 2. Expense-to-Income Ratio (Weight 30%)
  let expenseRatioScore = 30;
  if (totalIncome > 0) {
    const ratio = totalExpenses / totalIncome;
    if (ratio <= 0.40) expenseRatioScore = 100;
    else if (ratio <= 0.60) expenseRatioScore = 85;
    else if (ratio <= 0.80) expenseRatioScore = 70;
    else if (ratio <= 1.00) expenseRatioScore = 50;
    else expenseRatioScore = 25;
  }

  // 3. Profit Trend (Weight 40%)
  const net = totalIncome - totalExpenses;
  let profitTrendScore = 25;
  if (net > 0 && !hasDownwardTrend) profitTrendScore = 95;
  else if (net > 0 && hasDownwardTrend) profitTrendScore = 70;
  else if (net === 0) profitTrendScore = 50;
  else profitTrendScore = 25;

  // Weighted aggregate
  const rawScore =
    loggingScore * 0.30 + profitTrendScore * 0.40 + expenseRatioScore * 0.30;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let status: 'excellent' | 'steady' | 'needs_attention' = 'steady';
  let statusTe = 'స్థిరమైన ఆర్థిక స్థితి (Steady)';
  let summary = 'Predictable revenue with balanced operating expenses. Capable of debt servicing.';
  let summaryTe = 'స్థిరమైన రాబడి మరియు నియంత్రిత ఖర్చులు. సాధారణ రుణ వాయిదాలను చెల్లించగలరు.';

  if (score >= 80) {
    status = 'excellent';
    statusTe = 'ఉత్తమ ఆర్థిక ఆరోగ్యం (Excellent)';
    summary = 'Strong operating cash buffer with high savings margin. High loan repayment capacity.';
    summaryTe = 'బలమైన నికర నగదు ప్రవాహం మరియు అద్భుతమైన రుణ చెల్లింపు సామర్థ్యం.';
  } else if (score < 60) {
    status = 'needs_attention';
    statusTe = 'జాగ్రత్త అవసరం (Caution)';
    summary = 'Operating cash buffer is limited or expenses are near receipts. Tighten liquidity before borrowing.';
    summaryTe = 'నగదు నిల్వలు తక్కువగా ఉన్నాయి లేదా ఖర్చులు ఎక్కువగా ఉన్నాయి. అప్పు తీసుకునే ముందు జాగ్రత్త పడండి.';
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
        label: 'Digital Logging Habit',
        labelTe: 'లాగ్‌బుక్ నిర్వహణ క్రమబద్ధత (30%)',
        weight: '30%',
        score: loggingScore,
      },
      {
        label: 'Net Operating Profitability',
        labelTe: 'నికర లాభదాయకత ధోరణి (40%)',
        weight: '40%',
        score: profitTrendScore,
      },
      {
        label: 'Expense-to-Income Discipline',
        labelTe: 'ఆదాయం-ఖర్చుల నిష్పత్తి (30%)',
        weight: '30%',
        score: expenseRatioScore,
      },
    ],
  };
}
