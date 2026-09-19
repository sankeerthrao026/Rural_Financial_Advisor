export type RiskType =
  | 'active_loan_multiple'
  | 'negative_cash_flow'
  | 'downward_profit_trend';

export type RiskSeverity = 'warning' | 'alert';

export interface DetectedRisk {
  riskType: RiskType;
  severity: RiskSeverity;
  title: string;
  titleTe: string;
  reason: string;
  reasonTe: string;
  ruleCode: string;
  metrics: {
    totalIncome?: number;
    totalExpenses?: number;
    netCashFlow?: number;
    previousNetCashFlow?: number;
    hasActiveLoan?: boolean;
    simulatingSecondLoan?: boolean;
    previousNet?: number;
    currentNet?: number;
    dropPercentage?: number;
    deficit?: number;
    [key: string]: any;
  };
}

export interface RiskEvaluationInput {
  hasActiveLoan: boolean;
  simulatingSecondLoan: boolean;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  previousNetCashFlow?: number;
}

/**
 * Deterministic Risk Engine.
 * Evaluates three strict financial invariant rules:
 * Rule 1: User has an active loan AND requests/simulates a second loan.
 * Rule 2: Net cash flow is negative (Expenses > Income).
 * Rule 3: Net cash flow is trending downward (Current net cash flow < Previous net cash flow).
 */
export function evaluateFinancialRisks(input: RiskEvaluationInput): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  // Rule 1: Active loan + second loan simulation
  if (input.hasActiveLoan && input.simulatingSecondLoan) {
    risks.push({
      riskType: 'active_loan_multiple',
      severity: 'alert',
      ruleCode: 'RULE_1',
      title: 'Active Loan & Over-Leverage Risk',
      titleTe: 'ఇప్పటికే రుణం ఉన్నందున అధిక అప్పుల రిస్క్',
      reason:
        'You have an existing active loan while simulating a new loan. Servicing dual debt obligations may severely constrain working capital.',
      reasonTe:
        'మీకు ఇప్పటికే ఒక క్రియాశీల రుణం ఉంది. రెండవ రుణం తీసుకోవడం వల్ల నెలవారీ వాయిదాలు పెరిగి వ్యాపార నిర్వహణకు ఇబ్బంది కలుగుతుంది.',
      metrics: {
        hasActiveLoan: true,
        simulatingSecondLoan: true,
      },
    });
  }

  // Rule 2: Net cash flow is negative
  if (input.netCashFlow < 0 || (input.totalIncome > 0 && input.totalExpenses > input.totalIncome)) {
    risks.push({
      riskType: 'negative_cash_flow',
      severity: 'alert',
      ruleCode: 'RULE_2',
      title: 'Negative Cash Flow Alert',
      titleTe: 'ప్రతికూల నగదు ప్రవాహం',
      reason: `Recorded operating expenses (₹${Math.abs(input.totalExpenses).toLocaleString('en-IN')}) exceed total revenue (₹${Math.abs(input.totalIncome).toLocaleString('en-IN')}) resulting in a deficit of ₹${Math.abs(input.netCashFlow).toLocaleString('en-IN')}.`,
      reasonTe: `మీ వ్యాపార ఆదాయం కంటే ఖర్చులు ఎక్కువగా ఉన్నాయి. నికర లోటు ₹${Math.abs(input.netCashFlow).toLocaleString('en-IN')} గా నమోదైంది.`,
      metrics: {
        totalIncome: input.totalIncome,
        totalExpenses: input.totalExpenses,
        netCashFlow: input.netCashFlow,
      },
    });
  }

  // Rule 3: Downward Net Cash Flow Trend (>30% drop from prior cycle)
  if (
    typeof input.previousNetCashFlow === 'number' &&
    input.previousNetCashFlow > 0 &&
    input.netCashFlow < input.previousNetCashFlow * 0.70
  ) {
    const dropPct = Math.round(
      ((input.previousNetCashFlow - input.netCashFlow) / input.previousNetCashFlow) * 100
    );
    risks.push({
      riskType: 'downward_profit_trend',
      severity: 'warning',
      ruleCode: 'RULE_3',
      title: 'Downward Cash Flow Trend',
      titleTe: 'నగదు ప్రవాహం క్షీణత (Rule 3)',
      reason: `Net monthly cash flow dropped by ${dropPct}% compared to prior interval (from ₹${input.previousNetCashFlow.toLocaleString('en-IN')} to ₹${input.netCashFlow.toLocaleString('en-IN')}).`,
      reasonTe: `గత నెలతో పోలిస్తే నికర నగదు ప్రవాహం ${dropPct}% తగ్గింది.`,
      metrics: {
        previousNet: input.previousNetCashFlow,
        currentNet: input.netCashFlow,
        dropPercentage: dropPct,
      },
    });
  }

  return risks;
}
