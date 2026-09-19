/**
 * Shared Financial Metrics & Analytics Engine
 * 
 * Provides deterministic calculations for:
 * 1. Working Capital Runway (with configurable traffic-light thresholds)
 * 2. Operating Margin & Expense-to-Income Discipline Ratios
 * 3. Period-filtered Profit & Loss (P&L) Statements
 * 4. Cash Flow Time Series aggregation (Weekly, Monthly, Quarterly, Yearly)
 * 
 * Reusable by both the Financial Analytics Screen (Prompt 12)
 * and the Deterministic Risk Engine (Prompt 14).
 */

import { LogbookEntry } from '@/lib/firebase/logbook';
import { formatDisplayDateToIso } from '@/lib/utils/date';

export type AnalyticsPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Runway Thresholds (in days):
 * - Comfortable (Green): >= 60 days (~2 months or more)
 *   Business has healthy working capital reserves to absorb shocks.
 * - Caution (Amber): 30 to 59 days (~1 to 2 months)
 *   Working capital buffer is thinning; needs monitoring.
 * - Critical (Red): < 30 days (< 1 month)
 *   Imminent cash shortfall risk if receivables delay or expenses spike.
 * 
 * NOTE: These thresholds can be adjusted based on sector or season.
 */
export const RUNWAY_THRESHOLDS = {
  COMFORTABLE_DAYS: 60,
  CAUTION_DAYS: 30,
};

/**
 * Expense-to-Income Discipline Thresholds (Percentage):
 * - Disciplined (Green): < 60%
 *   Strong profit retention; operating costs well controlled.
 * - Elevated (Amber): 60% - 85%
 *   Moderate cost pressure; margins narrowing.
 * - Severe Margin Compression (Red): > 85%
 *   Critical risk threshold matching the rural credit underwriting standard.
 */
export const EXPENSE_RATIO_THRESHOLDS = {
  HEALTHY_MAX: 60,
  SEVERE_MIN: 85,
};

/**
 * Operating Margin Thresholds (Percentage):
 * - Healthy (Green): >= 25%
 * - Moderate (Amber): 10% - 24.9%
 * - Compressed (Red): < 10%
 */
export const OPERATING_MARGIN_THRESHOLDS = {
  HEALTHY_MIN: 25,
  MODERATE_MIN: 10,
};

export interface PeriodPnL {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
}

export interface RunwayMetrics {
  availableCash: number;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  runwayDays: number;
  runwayMonths: number;
  status: 'comfortable' | 'caution' | 'critical';
  statusColor: 'green' | 'amber' | 'red';
  statusMessage: string;
  statusMessageTe: string;
}

export interface OperatingMarginMetrics {
  operatingMarginPct: number;
  status: 'healthy' | 'moderate' | 'compressed';
  statusColor: 'green' | 'amber' | 'red';
  statusLabel: string;
  statusLabelTe: string;
}

export interface ExpenseRatioMetrics {
  expenseToIncomePct: number;
  status: 'disciplined' | 'elevated' | 'severe';
  statusColor: 'green' | 'amber' | 'red';
  isSevereCompression: boolean;
  statusLabel: string;
  statusLabelTe: string;
}

export interface CashFlowDataPoint {
  periodLabel: string;
  fullDate?: string;
  income: number;
  expense: number;
  net: number;
}

export interface DashboardFinancialMetrics {
  period: AnalyticsPeriod;
  periodDays: number;
  filteredEntries: LogbookEntry[];
  pnl: PeriodPnL;
  runway: RunwayMetrics;
  operatingMargin: OperatingMarginMetrics;
  expenseRatio: ExpenseRatioMetrics;
  timeSeriesData: CashFlowDataPoint[];
}

/**
 * Resolves a reliable timestamp in milliseconds for any logbook entry.
 */
export function parseEntryTimestamp(entry: LogbookEntry): number {
  if (typeof entry.timestamp === 'number' && !isNaN(entry.timestamp) && entry.timestamp > 0) {
    return entry.timestamp;
  }
  if (entry.date) {
    const iso = formatDisplayDateToIso(entry.date);
    const parsed = new Date(iso).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Returns number of days represented by the selected analytics period.
 */
export function getPeriodDays(period: AnalyticsPeriod): number {
  switch (period) {
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    case 'yearly':
      return 365;
    default:
      return 30;
  }
}

/**
 * Filters logbook transactions based on the selected period.
 * Intelligently pins the reference time to either current time or the latest entry
 * so historical/demo transactions (e.g. Sept 2026) are captured accurately.
 */
export function filterEntriesByPeriod(
  entries: LogbookEntry[],
  period: AnalyticsPeriod,
  referenceTime?: number
): { filtered: LogbookEntry[]; periodDays: number; referenceTimestamp: number } {
  if (!entries || entries.length === 0) {
    return { filtered: [], periodDays: getPeriodDays(period), referenceTimestamp: Date.now() };
  }

  const periodDays = getPeriodDays(period);
  const periodDurationMs = periodDays * 24 * 60 * 60 * 1000;

  // Determine reference timestamp: max of given referenceTime, Date.now(), or max entry timestamp
  const timestamps = entries.map(parseEntryTimestamp);
  const maxEntryTimestamp = Math.max(...timestamps);
  const now = Date.now();
  const refTime = referenceTime || (maxEntryTimestamp > now ? maxEntryTimestamp : now);

  const windowStart = refTime - periodDurationMs;

  const filtered = entries.filter((e) => {
    const t = parseEntryTimestamp(e);
    return t >= windowStart && t <= refTime + 24 * 60 * 60 * 1000; // include full reference day
  });

  // If strict filtering returned 0 but entries exist (e.g. all entries are older than 7 days when weekly is picked),
  // return the latest N entries that best approximate the window, ensuring charts are always communicative.
  if (filtered.length === 0 && entries.length > 0) {
    const sorted = [...entries].sort((a, b) => parseEntryTimestamp(b) - parseEntryTimestamp(a));
    const count = period === 'weekly' ? Math.min(sorted.length, 7) : sorted.length;
    return {
      filtered: sorted.slice(0, count).reverse(),
      periodDays,
      referenceTimestamp: refTime,
    };
  }

  return { filtered, periodDays, referenceTimestamp: refTime };
}

/**
 * Calculates Profit & Loss (P&L) summary from a list of transactions.
 */
export function calculatePeriodPnL(entries: LogbookEntry[]): PeriodPnL {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const entry of entries) {
    const amt = Math.abs(Number(entry.amount) || 0);
    if (entry.type === 'income') {
      totalIncome += amt;
      incomeCount += 1;
    } else {
      totalExpenses += amt;
      expenseCount += 1;
    }
  }

  const netProfit = totalIncome - totalExpenses;
  const profitMarginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    profitMarginPct,
    transactionCount: entries.length,
    incomeCount,
    expenseCount,
  };
}

/**
 * Calculates Working Capital Runway:
 * Runway Days = Current Available Cash ÷ Daily Operating Expenses
 * 
 * Traffic-Light Classification:
 * - Green (Comfortable): >= 60 days (~2 months)
 * - Amber (Caution): 30 - 59 days (~1 to 2 months)
 * - Red (Critical): < 30 days (< 1 month)
 */
export function calculateWorkingCapitalRunway(
  availableCash: number,
  totalExpenses: number,
  periodDays: number
): RunwayMetrics {
  const safeCash = Math.max(0, availableCash);
  const safeDays = Math.max(1, periodDays);
  const dailyBurnRate = totalExpenses > 0 ? Math.round(totalExpenses / safeDays) : 0;
  const monthlyBurnRate = dailyBurnRate * 30;

  let runwayDays = 0;
  if (dailyBurnRate > 0) {
    runwayDays = Math.round(safeCash / dailyBurnRate);
  } else {
    // Zero expense burn rate implies long runway
    runwayDays = safeCash > 0 ? 999 : 0;
  }

  const runwayMonths = Math.min(36, Number((runwayDays / 30).toFixed(1)));

  let status: 'comfortable' | 'caution' | 'critical' = 'critical';
  let statusColor: 'green' | 'amber' | 'red' = 'red';
  let statusMessage = '';
  let statusMessageTe = '';

  if (runwayDays >= RUNWAY_THRESHOLDS.COMFORTABLE_DAYS) {
    status = 'comfortable';
    statusColor = 'green';
    statusMessage = `Your business can run for approximately ${runwayDays} days (${runwayMonths} months) without new income at your current spending rate.`;
    statusMessageTe = `ప్రస్తుత ఖర్చుల వేగం ప్రకారం కొత్త ఆదాయం లేకుండా మీ వ్యాపారం సుమారు ${runwayDays} రోజులు (${runwayMonths} నెలలు) సురక్షితంగా నడుస్తుంది.`;
  } else if (runwayDays >= RUNWAY_THRESHOLDS.CAUTION_DAYS) {
    status = 'caution';
    statusColor = 'amber';
    statusMessage = `Your business has approximately ${runwayDays} days of working capital runway remaining. Monitor upcoming operating expenses closely.`;
    statusMessageTe = `మీ వ్యాపారానికి దాదాపు ${runwayDays} రోజుల వర్కింగ్ క్యాపిటల్ మిగిలి ఉంది. రాబోయే నిర్వహణ ఖర్చులను గమనించండి.`;
  } else {
    status = 'critical';
    statusColor = 'red';
    statusMessage = `Critically short runway: only ${runwayDays} days of operating cash remaining without immediate revenue receipts.`;
    statusMessageTe = `తీవ్ర నగదు కొరత: తక్షణ రాబడి లేకపోతే కేవలం ${runwayDays} రోజుల నిర్వహణ నగదు మాత్రమే మిగిలి ఉంది.`;
  }

  return {
    availableCash: safeCash,
    dailyBurnRate,
    monthlyBurnRate,
    runwayDays,
    runwayMonths,
    status,
    statusColor,
    statusMessage,
    statusMessageTe,
  };
}

/**
 * Calculates Operating Margin:
 * Operating Margin = (Revenue - Operating Expenses) ÷ Revenue * 100
 */
export function calculateOperatingMargin(
  totalIncome: number,
  totalExpenses: number
): OperatingMarginMetrics {
  const marginPct = totalIncome > 0
    ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
    : 0;

  let status: 'healthy' | 'moderate' | 'compressed' = 'compressed';
  let statusColor: 'green' | 'amber' | 'red' = 'red';
  let statusLabel = 'Vulnerable / Compressed (<10%)';
  let statusLabelTe = 'తక్కువ లాభాల మార్జిన్ (<10%)';

  if (marginPct >= OPERATING_MARGIN_THRESHOLDS.HEALTHY_MIN) {
    status = 'healthy';
    statusColor = 'green';
    statusLabel = 'Strong Profit Buffer (>=25%)';
    statusLabelTe = 'బలమైన లాభదాయకత (>=25%)';
  } else if (marginPct >= OPERATING_MARGIN_THRESHOLDS.MODERATE_MIN) {
    status = 'moderate';
    statusColor = 'amber';
    statusLabel = 'Sustainable Operating Range (10–25%)';
    statusLabelTe = 'స్థిరమైన నిర్వహణ పరిధి (10–25%)';
  }

  return {
    operatingMarginPct: marginPct,
    status,
    statusColor,
    statusLabel,
    statusLabelTe,
  };
}

/**
 * Calculates Expense-to-Income Discipline Ratio:
 * Ratio = Total Expenses ÷ Total Income * 100
 * 
 * Thresholds:
 * - Green (<60%): Disciplined cost control
 * - Amber (60% - 85%): Elevated cost burden
 * - Red (>85%): Severe Margin Compression
 */
export function calculateExpenseToIncomeRatio(
  totalIncome: number,
  totalExpenses: number
): ExpenseRatioMetrics {
  const ratioPct = totalIncome > 0
    ? Math.round((totalExpenses / totalIncome) * 100)
    : (totalExpenses > 0 ? 100 : 0);

  let status: 'disciplined' | 'elevated' | 'severe' = 'severe';
  let statusColor: 'green' | 'amber' | 'red' = 'red';
  let statusLabel = 'Severe Margin Compression (>85%)';
  let statusLabelTe = 'తీవ్ర ఖర్చుల ఒత్తిడి (>85%)';
  const isSevereCompression = ratioPct >= EXPENSE_RATIO_THRESHOLDS.SEVERE_MIN;

  if (ratioPct < EXPENSE_RATIO_THRESHOLDS.HEALTHY_MAX) {
    status = 'disciplined';
    statusColor = 'green';
    statusLabel = 'Disciplined Cost Control (<60%)';
    statusLabelTe = 'ఆదర్శవంతమైన ఖర్చుల నియంత్రణ (<60%)';
  } else if (ratioPct <= EXPENSE_RATIO_THRESHOLDS.SEVERE_MIN) {
    status = 'elevated';
    statusColor = 'amber';
    statusLabel = 'Elevated Cost Burden (60–85%)';
    statusLabelTe = 'పెరిగిన ఖర్చుల భారం (60–85%)';
  }

  return {
    expenseToIncomePct: ratioPct,
    status,
    statusColor,
    isSevereCompression,
    statusLabel,
    statusLabelTe,
  };
}

/**
 * Aggregates cash flow into time series buckets for charts (Money In vs Money Out).
 * - Weekly: Daily points (e.g. 7 days)
 * - Monthly: 4 weekly points
 * - Quarterly: 3 monthly points
 * - Yearly: 4 quarterly points
 */
export function generateCashFlowTimeSeries(
  entries: LogbookEntry[],
  period: AnalyticsPeriod,
  options?: { periodDays?: number; referenceTimestamp?: number }
): CashFlowDataPoint[] {
  if (!entries || entries.length === 0) {
    // Generate empty skeleton points for the period
    return generateEmptyTimeSeriesSkeleton(period);
  }

  const periodDays = options?.periodDays || getPeriodDays(period);
  const refTime = options?.referenceTimestamp || Date.now();

  if (period === 'weekly') {
    // 7 Daily Buckets
    const points: CashFlowDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = refTime - i * 86400000;
      const d = new Date(dayStart);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

      // Match entries on this calendar day
      const dayEntries = entries.filter((e) => {
        const et = parseEntryTimestamp(e);
        const ed = new Date(et);
        return (
          ed.getFullYear() === d.getFullYear() &&
          ed.getMonth() === d.getMonth() &&
          ed.getDate() === d.getDate()
        );
      });

      const inc = dayEntries.filter((e) => e.type === 'income').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const exp = dayEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + (Number(e.amount) || 0), 0);

      points.push({
        periodLabel: label,
        fullDate: d.toLocaleDateString('en-IN'),
        income: inc,
        expense: exp,
        net: inc - exp,
      });
    }
    return points;
  }

  if (period === 'monthly') {
    // 4 Weekly Buckets across 30 days
    const points: CashFlowDataPoint[] = [];
    const weekLabels = ['Week 1 (Days 1–7)', 'Week 2 (Days 8–15)', 'Week 3 (Days 16–22)', 'Week 4 (Days 23–30)'];
    
    // Sort entries chronologically
    const sorted = [...entries].sort((a, b) => parseEntryTimestamp(a) - parseEntryTimestamp(b));
    const windowStart = refTime - 30 * 86400000;

    for (let w = 0; w < 4; w++) {
      const wStart = windowStart + w * 7.5 * 86400000;
      const wEnd = windowStart + (w + 1) * 7.5 * 86400000;

      const wEntries = sorted.filter((e) => {
        const t = parseEntryTimestamp(e);
        return t >= wStart && (w === 3 ? t <= refTime + 86400000 : t < wEnd);
      });

      const inc = wEntries.filter((e) => e.type === 'income').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const exp = wEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + (Number(e.amount) || 0), 0);

      points.push({
        periodLabel: `Week ${w + 1}`,
        income: inc,
        expense: exp,
        net: inc - exp,
      });
    }
    return points;
  }

  if (period === 'quarterly') {
    // 3 Monthly Buckets across 90 days
    const points: CashFlowDataPoint[] = [];
    const windowStart = refTime - 90 * 86400000;

    for (let m = 0; m < 3; m++) {
      const mStart = windowStart + m * 30 * 86400000;
      const mEnd = windowStart + (m + 1) * 30 * 86400000;
      const mDate = new Date(mStart + 15 * 86400000);
      const mName = mDate.toLocaleDateString('en-IN', { month: 'short' });

      const mEntries = entries.filter((e) => {
        const t = parseEntryTimestamp(e);
        return t >= mStart && (m === 2 ? t <= refTime + 86400000 : t < mEnd);
      });

      const inc = mEntries.filter((e) => e.type === 'income').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const exp = mEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + (Number(e.amount) || 0), 0);

      points.push({
        periodLabel: `Month ${m + 1} (${mName})`,
        income: inc,
        expense: exp,
        net: inc - exp,
      });
    }
    return points;
  }

  // Yearly: 4 Quarters
  const points: CashFlowDataPoint[] = [];
  const windowStart = refTime - 365 * 86400000;

  for (let q = 0; q < 4; q++) {
    const qStart = windowStart + q * 91.25 * 86400000;
    const qEnd = windowStart + (q + 1) * 91.25 * 86400000;

    const qEntries = entries.filter((e) => {
      const t = parseEntryTimestamp(e);
      return t >= qStart && (q === 3 ? t <= refTime + 86400000 : t < qEnd);
    });

    const inc = qEntries.filter((e) => e.type === 'income').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const exp = qEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + (Number(e.amount) || 0), 0);

    points.push({
      periodLabel: `Q${q + 1}`,
      income: inc,
      expense: exp,
      net: inc - exp,
    });
  }
  return points;
}

/**
 * Fallback empty skeleton data for charts.
 */
function generateEmptyTimeSeriesSkeleton(period: AnalyticsPeriod): CashFlowDataPoint[] {
  switch (period) {
    case 'weekly':
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({
        periodLabel: d,
        income: 0,
        expense: 0,
        net: 0,
      }));
    case 'monthly':
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w) => ({
        periodLabel: w,
        income: 0,
        expense: 0,
        net: 0,
      }));
    case 'quarterly':
      return ['Month 1', 'Month 2', 'Month 3'].map((m) => ({
        periodLabel: m,
        income: 0,
        expense: 0,
        net: 0,
      }));
    case 'yearly':
      return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
        periodLabel: q,
        income: 0,
        expense: 0,
        net: 0,
      }));
  }
}

/**
 * Calculates complete dashboard metrics for the chosen period and transaction data.
 */
export function calculateFullDashboardMetrics(
  allEntries: LogbookEntry[],
  period: AnalyticsPeriod,
  options?: {
    availableCashOverride?: number;
    referenceTimestamp?: number;
  }
): DashboardFinancialMetrics {
  const { filtered, periodDays, referenceTimestamp } = filterEntriesByPeriod(
    allEntries,
    period,
    options?.referenceTimestamp
  );

  const pnl = calculatePeriodPnL(filtered);

  // Available cash determination:
  // If override provided (e.g. cumulative net cash flow + liquid reserve), use it.
  // Otherwise, use cumulative net cash from all entries (minimum 0).
  let availableCash = options?.availableCashOverride;
  if (typeof availableCash !== 'number') {
    const cumulativeNet = allEntries.reduce((sum, e) => {
      const amt = Number(e.amount) || 0;
      return sum + (e.type === 'income' ? amt : -amt);
    }, 0);
    availableCash = Math.max(0, cumulativeNet);
  }

  const runway = calculateWorkingCapitalRunway(availableCash, pnl.totalExpenses, periodDays);
  const operatingMargin = calculateOperatingMargin(pnl.totalIncome, pnl.totalExpenses);
  const expenseRatio = calculateExpenseToIncomeRatio(pnl.totalIncome, pnl.totalExpenses);
  const timeSeriesData = generateCashFlowTimeSeries(filtered, period, {
    periodDays,
    referenceTimestamp,
  });

  return {
    period,
    periodDays,
    filteredEntries: filtered,
    pnl,
    runway,
    operatingMargin,
    expenseRatio,
    timeSeriesData,
  };
}
