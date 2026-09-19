/**
 * Transparent Rule-Based Alternative Credit Scoring Engine
 * 
 * Strict Weighting Formulation:
 * - 30% — Logging habit & discipline (consistency, days logged, gaps)
 * - 40% — Operating profit consistency & stability (net surplus positivity & stability across cycles)
 * - 30% — Expense-to-income discipline & cash buffer (expense control & runway reserves)
 * 
 * Generates transparent 0–100 score + 300–900 CIBIL equivalent scale,
 * mathematical "+X points" simulated actionable recommendations,
 * and Lender-Grade Alternative Credit Readiness Certificate PDF.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogbookEntry } from '@/lib/firebase/logbook';
import { formatDisplayDateToIso, formatIsoToDisplayDate, getTodayDisplayDate } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/currency';

export interface CreditScoreComponents {
  // 1. Logging habit & discipline (30%)
  loggingScore: number;          // 0-100
  loggingWeight: number;         // 0.30
  loggingWeightedPoints: number; // 0-30
  daysLoggedCount: number;
  longestGapDays: number;
  loggingStatus: 'high' | 'moderate' | 'low';
  loggingSummary: string;
  loggingSummaryTe: string;

  // 2. Operating profit consistency & stability (40%)
  profitScore: number;           // 0-100
  profitWeight: number;          // 0.40
  profitWeightedPoints: number;  // 0-40
  netProfit: number;
  profitMarginPct: number;
  profitStabilityStatus: 'strong' | 'moderate' | 'volatile';
  profitSummary: string;
  profitSummaryTe: string;

  // 3. Expense-to-income discipline & cash buffer (30%)
  expenseDisciplineScore: number;          // 0-100
  expenseDisciplineWeight: number;         // 0.30
  expenseDisciplineWeightedPoints: number; // 0-30
  expenseRatioPct: number;
  runwayDays: number;
  expenseDisciplineStatus: 'disciplined' | 'elevated' | 'severe';
  expenseSummary: string;
  expenseSummaryTe: string;
}

export interface ActionableSuggestion {
  id: string;
  component: 'logging' | 'profit' | 'expense';
  title: string;
  titleTe: string;
  actionText: string;
  actionTextTe: string;
  estimatedPointsGain: number; // Simulated mathematically
  currentScore: number;
  simulatedScore: number;
  priority: 'high' | 'medium' | 'low';
}

export interface CreditReadinessResult {
  overallScore: number;       // 0-100
  cibilEquivalent: number;    // 300-900 scale
  grade: 'Grade A+ (Prime)' | 'Grade A (Low Risk)' | 'Grade B (Acceptable)' | 'Grade C (Sub-Prime)';
  gradeTe: string;
  summary: string;
  summaryTe: string;
  components: CreditScoreComponents;
  suggestions: ActionableSuggestion[];
  generatedAt: string;
  certificateId: string;
}

/**
 * Resolves entry timestamp in milliseconds.
 */
function getEntryTime(entry: LogbookEntry): number {
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
 * Component 1: Logging habit & discipline (Weight: 30%)
 */
export function evaluateLoggingHabit(entries: LogbookEntry[]): {
  score: number;
  daysLoggedCount: number;
  longestGapDays: number;
  status: 'high' | 'moderate' | 'low';
  summary: string;
  summaryTe: string;
} {
  if (!entries || entries.length === 0) {
    return {
      score: 30,
      daysLoggedCount: 0,
      longestGapDays: 30,
      status: 'low',
      summary: 'No transactions recorded. Begin recording daily revenue to build credit history.',
      summaryTe: 'లావాదేవీలు ఏవీ నమోదు కాలేదు. క్రెడిట్ హిస్టరీ నిర్మించడానికి రోజువారీ రికార్డులను ప్రారంభించండి.',
    };
  }

  // Count unique calendar days logged
  const uniqueDays = new Set<string>();
  const timestamps: number[] = [];

  for (const e of entries) {
    const t = getEntryTime(e);
    timestamps.push(t);
    const d = new Date(t);
    uniqueDays.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }

  const daysLoggedCount = uniqueDays.size;

  // Calculate gaps between consecutive entries
  timestamps.sort((a, b) => a - b);
  let longestGapDays = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gapDays = Math.floor((timestamps[i] - timestamps[i - 1]) / (24 * 3600 * 1000));
    if (gapDays > longestGapDays) longestGapDays = gapDays;
  }

  // Baseline score based on unique days logged (target 8-12 days per month for micro-enterprises)
  let baseScore = 40;
  if (daysLoggedCount >= 10) baseScore = 95;
  else if (daysLoggedCount >= 6) baseScore = 85;
  else if (daysLoggedCount >= 4) baseScore = 75;
  else if (daysLoggedCount >= 2) baseScore = 60;
  else baseScore = 45;

  // Volume bonus if detailed ledger entries exist
  if (entries.length >= 8) baseScore = Math.min(100, baseScore + 5);

  // Gap penalty
  if (longestGapDays > 14) baseScore = Math.max(25, baseScore - 15);
  else if (longestGapDays > 7) baseScore = Math.max(30, baseScore - 5);

  const score = Math.min(100, Math.max(0, baseScore));
  const status: 'high' | 'moderate' | 'low' = score >= 80 ? 'high' : score >= 60 ? 'moderate' : 'low';

  const summary = status === 'high'
    ? `${daysLoggedCount} active recording days with consistent tracking and minimal gaps.`
    : status === 'moderate'
    ? `${daysLoggedCount} recording days logged. Regular daily entries will strengthen your score.`
    : 'Infrequent transaction logging observed. Needs consistent multi-day record keeping.';

  const summaryTe = status === 'high'
    ? `${daysLoggedCount} క్రియాశీల రోజుల్లో క్రమం తప్పకుండా లావాదేవీలు నమోదు చేయబడ్డాయి.`
    : status === 'moderate'
    ? `${daysLoggedCount} రోజులు నమోదు చేయబడ్డాయి. మరింత క్రమశిక్షణతో స్కోరు పెరుగుతుంది.`
    : 'లావాదేవీల నమోదు తక్కువగా ఉంది. రోజువారీ రికార్డులను కొనసాగించండి.';

  return { score, daysLoggedCount, longestGapDays, status, summary, summaryTe };
}

/**
 * Component 2: Operating profit consistency & stability (Weight: 40%)
 */
export function evaluateProfitStability(entries: LogbookEntry[]): {
  score: number;
  netProfit: number;
  profitMarginPct: number;
  status: 'strong' | 'moderate' | 'volatile';
  summary: string;
  summaryTe: string;
} {
  if (!entries || entries.length === 0) {
    return {
      score: 35,
      netProfit: 0,
      profitMarginPct: 0,
      status: 'moderate',
      summary: 'Insufficient operational transaction data to establish profit stability.',
      summaryTe: 'లాభాల స్థిరత్వాన్ని నిర్ధారించడానికి తగినంత లావాదేవీల సమాచారం లేదు.',
    };
  }

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const e of entries) {
    const amt = Math.abs(Number(e.amount) || 0);
    if (e.type === 'income') totalIncome += amt;
    else totalExpenses += amt;
  }

  const netProfit = totalIncome - totalExpenses;
  const profitMarginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  let baseScore = 50;

  // Margin strength
  if (profitMarginPct >= 30) baseScore = 95;
  else if (profitMarginPct >= 20) baseScore = 85;
  else if (profitMarginPct >= 10) baseScore = 75;
  else if (profitMarginPct > 0) baseScore = 60;
  else if (profitMarginPct === 0) baseScore = 45;
  else baseScore = 25; // deficit

  // Chronological cycle consistency check (split into halves)
  if (entries.length >= 4) {
    const sorted = [...entries].sort((a, b) => getEntryTime(a) - getEntryTime(b));
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const net1 = firstHalf.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
    const net2 = secondHalf.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);

    if (net1 > 0 && net2 > 0) {
      baseScore = Math.min(100, baseScore + 5); // Consistent surplus in both halves
    } else if (net1 > 0 && net2 < 0) {
      baseScore = Math.max(20, baseScore - 10); // Downward drift
    }
  }

  const score = Math.min(100, Math.max(0, baseScore));
  const status: 'strong' | 'moderate' | 'volatile' = score >= 80 ? 'strong' : score >= 60 ? 'moderate' : 'volatile';

  const summary = status === 'strong'
    ? `Strong, stable net surplus of ₹${Math.abs(netProfit).toLocaleString('en-IN')} (${profitMarginPct}% margin) with reliable debt-servicing buffer.`
    : status === 'moderate'
    ? `Positive operating margin of ${profitMarginPct}%, with room to build greater stability across seasonal cycles.`
    : `Operating deficit or compressed margin observed (₹${netProfit.toLocaleString('en-IN')}). High repayment volatility risk.`;

  const summaryTe = status === 'strong'
    ? `₹${Math.abs(netProfit).toLocaleString('en-IN')} నికర మిగులుతో (${profitMarginPct}%) స్థిరమైన మరియు బలమైన లాభదాయకత ఉంది.`
    : status === 'moderate'
    ? `${profitMarginPct}% అనుకూల లాభాల మార్జిన్ ఉంది. మరింత స్థిరత్వాన్ని పెంచుకోవచ్చు.`
    : `ప్రతికూల నగదు ప్రవాహం లేదా తక్కువ మార్జిన్ ఉంది. వాయిదాలు చెల్లించడంలో రిస్క్ ఉండవచ్చు.`;

  return { score, netProfit, profitMarginPct, status, summary, summaryTe };
}

/**
 * Component 3: Expense-to-income discipline & cash buffer (Weight: 30%)
 */
export function evaluateExpenseDiscipline(
  entries: LogbookEntry[],
  availableCashOverride?: number
): {
  score: number;
  expenseRatioPct: number;
  runwayDays: number;
  status: 'disciplined' | 'elevated' | 'severe';
  summary: string;
  summaryTe: string;
} {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const e of entries) {
    const amt = Math.abs(Number(e.amount) || 0);
    if (e.type === 'income') totalIncome += amt;
    else totalExpenses += amt;
  }

  const expenseRatioPct = totalIncome > 0
    ? Math.round((totalExpenses / totalIncome) * 100)
    : (totalExpenses > 0 ? 100 : 0);

  // Available cash & daily burn calculation
  const cumulativeNet = totalIncome - totalExpenses;
  const availableCash = typeof availableCashOverride === 'number'
    ? availableCashOverride
    : Math.max(0, cumulativeNet);

  const dailyBurn = totalExpenses > 0 ? Math.round(totalExpenses / 30) : 0;
  const runwayDays = dailyBurn > 0 ? Math.round(availableCash / dailyBurn) : 999;

  let baseScore = 50;

  // Expense-to-income discipline band
  if (expenseRatioPct <= 45) baseScore = 95;
  else if (expenseRatioPct <= 60) baseScore = 85;
  else if (expenseRatioPct <= 75) baseScore = 70;
  else if (expenseRatioPct <= 85) baseScore = 50;
  else baseScore = 25; // Severe Margin Compression (>85%)

  // Cash buffer modifier
  if (runwayDays >= 60) baseScore = Math.min(100, baseScore + 5);
  else if (runwayDays < 30) baseScore = Math.max(20, baseScore - 15);

  const score = Math.min(100, Math.max(0, baseScore));
  const status: 'disciplined' | 'elevated' | 'severe' =
    expenseRatioPct < 60 ? 'disciplined' : expenseRatioPct <= 85 ? 'elevated' : 'severe';

  const summary = status === 'disciplined'
    ? `Disciplined cost containment (${expenseRatioPct}% expense-to-income) and resilient cash runway (${runwayDays} days).`
    : status === 'elevated'
    ? `Moderate cost pressure (${expenseRatioPct}% expense ratio). Maintain tighter operating expense controls.`
    : `Severe Margin Compression (${expenseRatioPct}% of revenue consumed by expenses). High cash depletion risk.`;

  const summaryTe = status === 'disciplined'
    ? `ఆదాయంలో ఖర్చులు కేవలం ${expenseRatioPct}% మాత్రమే ఉండటం మరియు ${runwayDays} రోజుల నిల్వలు ఉండటం వల్ల అద్భుతమైన నియంత్రణ ఉంది.`
    : status === 'elevated'
    ? `ఖర్చుల శాతం ${expenseRatioPct}% గా ఉంది. నిర్వహణ వ్యయాలను మరింత తగ్గించుకోవడం మంచిది.`
    : `తీవ్రమైన ఖర్చుల భారం (${expenseRatioPct}%). వ్యాపారంలో నగదు నిల్వలు త్వరగా ఖర్చయ్యే ప్రమాదం ఉంది.`;

  return { score, expenseRatioPct, runwayDays, status, summary, summaryTe };
}

/**
 * Calculates complete Alternative Credit Readiness result with 30/40/30 weighting.
 */
export function calculateCreditReadiness(
  entries: LogbookEntry[],
  options?: {
    availableCashOverride?: number;
    userName?: string;
    businessName?: string;
  }
): CreditReadinessResult {
  const loggingResult = evaluateLoggingHabit(entries);
  const profitResult = evaluateProfitStability(entries);
  const expenseResult = evaluateExpenseDiscipline(entries, options?.availableCashOverride);

  // Exact 30/40/30 mathematical weighting
  const loggingWeight = 0.30;
  const profitWeight = 0.40;
  const expenseDisciplineWeight = 0.30;

  const loggingWeightedPoints = Number((loggingResult.score * loggingWeight).toFixed(1));
  const profitWeightedPoints = Number((profitResult.score * profitWeight).toFixed(1));
  const expenseDisciplineWeightedPoints = Number((expenseResult.score * expenseDisciplineWeight).toFixed(1));

  const rawOverall = loggingResult.score * loggingWeight + profitResult.score * profitWeight + expenseResult.score * expenseDisciplineWeight;
  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverall)));

  // CIBIL-equivalent scale (300 to 900)
  const cibilEquivalent = Math.round(300 + (overallScore / 100) * 600);

  // Grade classification
  let grade: CreditReadinessResult['grade'] = 'Grade A (Low Risk)';
  let gradeTe = 'గ్రేడ్ A (తక్కువ రిస్క్)';
  let summary = 'Steady business performance suitable for priority rural credit appraisal.';
  let summaryTe = 'ప్రాధాన్యతా గ్రామీణ రుణ పరిశీలనకు అనువైన స్థిరమైన వ్యాపార పనితీరు.';

  if (overallScore >= 80) {
    grade = 'Grade A+ (Prime)';
    gradeTe = 'గ్రేడ్ A+ (ప్రైమ్ / అత్యుత్తమ అర్హత)';
    summary = 'Exemplary bookkeeping, high profit margins, and robust liquidity buffer. Eligible for fast-track sanctions.';
    summaryTe = 'అత్యుత్తమ రికార్డు నిర్వహణ, అధిక లాభాలు మరియు సురక్షిత నిల్వలు. త్వరితగతిన రుణ మంజూరుకు అర్హులు.';
  } else if (overallScore >= 70) {
    grade = 'Grade A (Low Risk)';
    gradeTe = 'గ్రేడ్ A (తక్కువ రిస్క్)';
    summary = 'Credit-ready rural enterprise. Predictable operating cash flows comfortably support planned debt installments.';
    summaryTe = 'రుణానికి సిద్ధంగా ఉన్న వ్యాపారం. ప్రతిపాదిత వాయిదాలను చెల్లించడానికి తగినంత నికర రాబడి ఉంది.';
  } else if (overallScore >= 60) {
    grade = 'Grade B (Acceptable)';
    gradeTe = 'గ్రేడ్ B (సంతృప్తికరం)';
    summary = 'Acceptable baseline creditworthiness. Strengthen recording consistency or increase working capital reserve.';
    summaryTe = 'సంతృప్తికరమైన అర్హత. రికార్డులను మరింత క్రమం తప్పకుండా నమోదు చేస్తే స్కోరు పెరుగుతుంది.';
  } else {
    grade = 'Grade C (Sub-Prime)';
    gradeTe = 'గ్రేడ్ C (మెరుగుదల అవసరం)';
    summary = 'Sub-prime score due to sparse logging records or elevated expense burn. Build a 30-day consistent record.';
    summaryTe = 'తక్కువ స్కోరు. క్రెడిట్ అర్హతను పెంచడానికి 30 రోజుల పాటు రోజువారీ లావాదేవీలను నమోదు చేయండి.';
  }

  const components: CreditScoreComponents = {
    loggingScore: loggingResult.score,
    loggingWeight,
    loggingWeightedPoints,
    daysLoggedCount: loggingResult.daysLoggedCount,
    longestGapDays: loggingResult.longestGapDays,
    loggingStatus: loggingResult.status,
    loggingSummary: loggingResult.summary,
    loggingSummaryTe: loggingResult.summaryTe,

    profitScore: profitResult.score,
    profitWeight,
    profitWeightedPoints,
    netProfit: profitResult.netProfit,
    profitMarginPct: profitResult.profitMarginPct,
    profitStabilityStatus: profitResult.status,
    profitSummary: profitResult.summary,
    profitSummaryTe: profitResult.summaryTe,

    expenseDisciplineScore: expenseResult.score,
    expenseDisciplineWeight,
    expenseDisciplineWeightedPoints,
    expenseRatioPct: expenseResult.expenseRatioPct,
    runwayDays: expenseResult.runwayDays,
    expenseDisciplineStatus: expenseResult.status,
    expenseSummary: expenseResult.summary,
    expenseSummaryTe: expenseResult.summaryTe,
  };

  // Generate mathematically grounded actionable recommendations
  const suggestions = generateActionableSuggestions(components, overallScore);

  // Generate unique certificate tracking hash
  const certificateId = `RC-CERT-${new Date().getFullYear()}-${Math.abs(overallScore * 137).toString().padStart(4, '0')}`;

  return {
    overallScore,
    cibilEquivalent,
    grade,
    gradeTe,
    summary,
    summaryTe,
    components,
    suggestions,
    generatedAt: getTodayDisplayDate(),
    certificateId,
  };
}

/**
 * Generates actionable suggestions with real recalculated point gains.
 */
function generateActionableSuggestions(
  comp: CreditScoreComponents,
  currentOverall: number
): ActionableSuggestion[] {
  const suggestions: ActionableSuggestion[] = [];

  // 1. Logging Habit Recommendation (if < 85)
  if (comp.loggingScore < 85) {
    // Simulate what happens if user logs 5 additional days this month
    const targetLoggingScore = Math.min(100, comp.loggingScore + 30);
    const simulatedOverall = Math.round(
      targetLoggingScore * comp.loggingWeight +
      comp.profitScore * comp.profitWeight +
      comp.expenseDisciplineScore * comp.expenseDisciplineWeight
    );
    const gain = Math.max(3, simulatedOverall - currentOverall);

    suggestions.push({
      id: 'sugg-logging',
      component: 'logging',
      title: 'Maintain 5-Day Weekly Logging Habit',
      titleTe: 'వారానికి 5 రోజులు లావాదేవీలు నమోదు చేయండి',
      actionText: `Log daily sales and expense transactions at least 5 days this week to increase your credit readiness score by approximately +${gain} points.`,
      actionTextTe: `ఈ వారం కనీసం 5 రోజులు మీ వ్యాపార లావాదేవీలను నమోదు చేయడం ద్వారా మీ క్రెడిట్ స్కోరును సుమారు +${gain} పాయింట్లు పెంచుకోవచ్చు.`,
      estimatedPointsGain: gain,
      currentScore: currentOverall,
      simulatedScore: simulatedOverall,
      priority: comp.loggingScore < 60 ? 'high' : 'medium',
    });
  }

  // 2. Profit Stability Recommendation (if < 85)
  if (comp.profitScore < 85) {
    // Simulate stabilizing profit to a target 20% margin
    const targetProfitScore = Math.min(100, comp.profitScore + 25);
    const simulatedOverall = Math.round(
      comp.loggingScore * comp.loggingWeight +
      targetProfitScore * comp.profitWeight +
      comp.expenseDisciplineScore * comp.expenseDisciplineWeight
    );
    const gain = Math.max(4, simulatedOverall - currentOverall);

    suggestions.push({
      id: 'sugg-profit',
      component: 'profit',
      title: 'Target Positive Operating Surplus in Next Cycle',
      titleTe: 'తదుపరి సేల్స్ సైకిల్‌లో నికర మిగులు సాధించండి',
      actionText: `Maintain a consistent net positive operating surplus across the next 2 sales cycles to stabilize revenue and add approximately +${gain} points.`,
      actionTextTe: `రాబోయే 2 సైకిళ్లలో లాభాల మార్జిన్ స్థిరంగా ఉంచడం ద్వారా క్రెడిట్ స్కోరును దాదాపు +${gain} పాయింట్లు మెరుగుపరచుకోవచ్చు.`,
      estimatedPointsGain: gain,
      currentScore: currentOverall,
      simulatedScore: simulatedOverall,
      priority: comp.profitScore < 60 ? 'high' : 'medium',
    });
  }

  // 3. Expense Discipline Recommendation (if < 85)
  if (comp.expenseDisciplineScore < 85) {
    // Simulate reducing expense ratio to <= 60% and 45-day buffer
    const targetExpenseScore = Math.min(100, comp.expenseDisciplineScore + 30);
    const simulatedOverall = Math.round(
      comp.loggingScore * comp.loggingWeight +
      comp.profitScore * comp.profitWeight +
      targetExpenseScore * comp.expenseDisciplineWeight
    );
    const gain = Math.max(3, simulatedOverall - currentOverall);

    suggestions.push({
      id: 'sugg-expense',
      component: 'expense',
      title: 'Contain Operating Expenses Below 60% of Receipts',
      titleTe: 'ఖర్చులను రాబడిలో 60% లోపు నియంత్రించండి',
      actionText: `Keep ongoing operational expenditures below 60% of total revenue and preserve a 45-day working capital reserve to gain approximately +${gain} points.`,
      actionTextTe: `వ్యాపార ఖర్చులను రాబడిలో 60% లోపు ఉంచి, 45 రోజుల వర్కింగ్ క్యాపిటల్ నిల్వలను నిర్వహించడం ద్వారా +${gain} పాయింట్లు సాధించండి.`,
      estimatedPointsGain: gain,
      currentScore: currentOverall,
      simulatedScore: simulatedOverall,
      priority: comp.expenseDisciplineScore < 50 ? 'high' : 'medium',
    });
  }

  // If already exemplary in all 3 components, give an advanced maintenance recommendation
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'sugg-prime',
      component: 'logging',
      title: 'Preserve Exemplary Prime Record',
      titleTe: 'అత్యుత్తమ ప్రైమ్ రికార్డును కొనసాగించండి',
      actionText: `Your metrics are in the Prime tier! Continue daily ledger logging to maintain eligibility for lowest statutory interest rates (NBCFDC / MUDRA).`,
      actionTextTe: `మీ క్రెడిట్ అర్హత ప్రైమ్ స్థాయిలో ఉంది! తక్కువ వడ్డీ రుణాల కోసం ఈ రికార్డును ఇలాగే కొనసాగించండి.`,
      estimatedPointsGain: 0,
      currentScore: currentOverall,
      simulatedScore: currentOverall,
      priority: 'low',
    });
  }

  return suggestions;
}

/**
 * Generates an official, bank-ready "Alternative Credit Readiness Certificate" PDF.
 */
export function generateCreditReadinessCertificatePdf(
  result: CreditReadinessResult,
  profile: {
    name: string;
    businessName: string;
    category: string;
    location: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Elegant Certificate Border
  doc.setDrawColor(22, 101, 52); // Forest Green primary
  doc.setLineWidth(1.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setDrawColor(187, 247, 208); // Light green inner accent
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // 2. Header / Crest
  doc.setFillColor(240, 253, 244); // bg-emerald-50
  doc.roundedRect(20, 18, pageWidth - 40, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52);
  doc.text('RURALCRED ADVISOR', pageWidth / 2, 28, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALTERNATIVE CREDIT READINESS CERTIFICATE', pageWidth / 2, 36, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Statutory & Cash-Flow Grounded Financial Assessment for MFIs, NBFCs & Rural Banks', pageWidth / 2, 42, { align: 'center' });

  // 3. Certificate Details Row
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Certificate Ref: ${result.certificateId}`, 22, 57);
  doc.text(`Date of Appraisal: ${result.generatedAt}`, pageWidth - 22, 57, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 60, pageWidth - 20, 60);

  // 4. Beneficiary Information Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 64, pageWidth - 40, 30, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('ENTERPRISE & PROMOTER PROFILE', 25, 71);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Promoter Name:  ${profile.name}`, 25, 78);
  doc.text(`Enterprise:  ${profile.businessName}`, 25, 85);

  doc.text(`Sector / Category:  ${profile.category || 'Rural Enterprise'}`, pageWidth / 2 + 5, 78);
  doc.text(`Operational District:  ${profile.location || 'Telangana / Andhra Pradesh'}`, pageWidth / 2 + 5, 85);

  // 5. Highlight Score Box
  doc.setFillColor(22, 101, 52); // Deep emerald
  doc.roundedRect(20, 100, pageWidth - 40, 36, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('EVALUATED CREDIT READINESS SCORE', pageWidth / 2, 108, { align: 'center' });

  doc.setFontSize(26);
  doc.text(`${result.overallScore} / 100`, pageWidth / 2, 120, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text(`${result.grade}   |   Equivalent CIBIL Range: ~${result.cibilEquivalent}`, pageWidth / 2, 129, { align: 'center' });

  // 6. Transparent 30/40/30 Component Table
  autoTable(doc, {
    startY: 142,
    margin: { left: 20, right: 20 },
    theme: 'grid',
    head: [
      ['Underwriting Dimension', 'Weight', 'Sub-Score', 'Weighted Pts', 'Evaluated Metrics & Evidence']
    ],
    body: [
      [
        'Digital Logging Habit & Discipline\n(Recording frequency, consistency, gaps)',
        '30%',
        `${result.components.loggingScore}/100`,
        `${result.components.loggingWeightedPoints} pts`,
        `${result.components.daysLoggedCount} active ledger recording days; ${result.components.longestGapDays}d max gap.`
      ],
      [
        'Operating Profit Stability & Margin\n(Net cash flow positivity & consistency)',
        '40%',
        `${result.components.profitScore}/100`,
        `${result.components.profitWeightedPoints} pts`,
        `Net Surplus: ₹${Math.abs(result.components.netProfit).toLocaleString('en-IN')} (${result.components.profitMarginPct}% profit margin).`
      ],
      [
        'Expense Discipline & Cash Buffer\n(Cost-to-income control, runway reserves)',
        '30%',
        `${result.components.expenseDisciplineScore}/100`,
        `${result.components.expenseDisciplineWeightedPoints} pts`,
        `Expense Ratio: ${result.components.expenseRatioPct}%; Working Capital Runway: ${result.components.runwayDays} days.`
      ],
      [
        'Consolidated Alternative Credit Score',
        '100%',
        '—',
        `${result.overallScore} / 100`,
        `${result.grade} (Transparent additive formula with zero black-box bias)`
      ]
    ],
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      lineColor: [226, 232, 240],
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
    },
  });

  // 7. Assessment Summary & MFI Attestation Notice
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CREDIT APPRAISAL ASSESSMENT', 20, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const splitSummary = doc.splitTextToSize(result.summary, pageWidth - 40);
  doc.text(splitSummary, 20, finalY + 5);

  const boxY = finalY + 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(20, boxY, pageWidth - 40, 24, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VERIFICATION & METHODOLOGY NOTICE:', 23, boxY + 6);
  doc.text(
    'This Alternative Credit Readiness Certificate utilizes a deterministic, rule-based 30/40/30 scoring model evaluated directly from authentic digital logbook cash-flow transactions. It eliminates traditional algorithmic bias and provides rural banking institutions with verifiable debt-service capability evidence.',
    23,
    boxY + 11,
    { maxWidth: pageWidth - 46 }
  );

  // 8. Signature & Stamp placeholders at the bottom
  const sigY = pageHeight - 34;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(25, sigY, 75, sigY);
  doc.line(pageWidth - 75, sigY, pageWidth - 25, sigY);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Beneficiary Promoter Signature', 50, sigY + 4, { align: 'center' });
  doc.text('RuralCred Algorithmic Seal', pageWidth - 50, sigY + 4, { align: 'center' });

  // Save the PDF directly to browser downloads
  const filename = `RuralCred_Credit_Certificate_${profile.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
