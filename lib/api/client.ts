/**
 * RuralCred Advisor — Next.js Typed API Client for Python FastAPI Backend.
 * Connects frontend views to FastAPI as the primary source of truth.
 * Handles timeouts, network errors, and offline fallbacks gracefully without unhandled exceptions.
 */

import { DetectedRisk } from '@/lib/risk/engine';

export interface SchemeDetails {
  id: string;
  name: string;
  nameTe: string;
  agency: string;
  interestRateAnnual: number;
  tenureYears: number;
  moratoriumMonths: number;
  maxProjectCost: number;
  repaymentFrequency?: string;
}

export interface AmortizationRow {
  quarter: number;
  isMoratorium: boolean;
  startingPrincipal: number;
  principalPaid: number;
  interestPaid: number;
  totalPayment: number;
  remainingBalance: number;
}

export interface FinanceCalculateRequest {
  marginCapital: number;
}

export interface FinancePlanResponse {
  marginCapital: number;
  projectCost: number;
  loanAmount: number;
  scheme: SchemeDetails;
  quarterlyEmi: number;
  totalQuarters: number;
  moratoriumQuarters: number;
  repaymentQuarters: number;
  totalInterestPaid: number;
  totalRepayment: number;
  amortizationSchedule: AmortizationRow[];
}

export interface MetricBreakdown {
  metric: string;
  score: number;
  weight: string;
  label: string;
  labelTe: string;
}

export interface FinancialHealthResponse {
  score: number;
  status: 'excellent' | 'steady' | 'caution';
  statusTe: string;
  summary: string;
  summaryTe: string;
  breakdown: MetricBreakdown[];
}

export interface RiskAnalysisRequest {
  hasActiveLoan: boolean;
  simulatingSecondLoan: boolean;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  previousNetCashFlow?: number;
}

export interface RiskAnalysisResponse {
  detectedRisks: DetectedRisk[];
  isSafe: boolean;
  activeCount: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  chromadb_connected: boolean;
  gemini_configured: boolean;
}

export interface TailoredSchemeRecommendation {
  id: string;
  name: string;
  nameTe: string;
  agency: string;
  maxAmount: number;
  subsidyOrConcession: string;
  subsidyOrConcessionTe: string;
  whyRecommended: string;
  whyRecommendedTe: string;
  isTopMatch: boolean;
}

export interface WorkingCapitalBreakdown {
  workingCapitalPercent: number;
  capexPercent: number;
  workingCapitalAmount: number;
  capexAmount: number;
  workingCapitalUses: string[];
  capexUses: string[];
}

export interface SeasonalMoratoriumAdvice {
  isSeasonal: boolean;
  businessType: string;
  leanSeasonMonths: string;
  peakSeasonMonths: string;
  moratoriumQuartersRecommended: number;
  guidance: string;
  guidanceTe: string;
}

export interface FinanceAdviceRequest {
  marginCapital: number;
  loanAmount: number;
  projectCost: number;
  quarterlyEmi: number;
  category?: string;
  gender?: string;
  socialCategory?: string;
  location?: string;
  workingCapitalRatio?: number;
  userQuery?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  language?: string;
  profile?: {
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
  logbookEntries?: any[];
  khataEntries?: any[];
  aggregates?: {
    totalIncome?: number;
    totalExpenses?: number;
    netCashFlow?: number;
  };
}

export interface FinanceAdviceResponse {
  reply: string;
  replyTe?: string;
  loanExplanation: string;
  loanExplanationTe?: string;
  recommendedSchemes: TailoredSchemeRecommendation[];
  workingCapitalBreakdown: WorkingCapitalBreakdown;
  seasonalMoratoriumAdvice: SeasonalMoratoriumAdvice;
  providerUsed: string;
}

export type { SchemeEligibilityInput, SchemeCalculationResult } from '@/lib/finance/schemes';
export type { UnifiedBusinessPlan, BusinessPlanRequest } from '@/lib/finance/plan';

export interface ApiResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  statusCode?: number;
  isOffline?: boolean;
}

/**
 * Resolves the backend base URL dynamically from NEXT_PUBLIC_API_BASE_URL
 * or falls back to port 8000 on the current browser host.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
}

/**
 * Robust fetch wrapper with timeout (default 3500ms) and comprehensive error interception.
 * Never throws unhandled exceptions; returns a strongly typed ApiResult<T>.
 */
async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {},
  userId?: string,
  timeoutMs: number = 3500
): Promise<ApiResult<T>> {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (userId) {
    headers['X-User-Id'] = userId;
    headers['X-Auth-Mode'] = userId.startsWith('demo') ? 'demo' : 'authenticated';
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        data: null,
        error: `HTTP ${res.status}: ${errorText || res.statusText}`,
        statusCode: res.status,
        isOffline: false,
      };
    }

    const data = (await res.json()) as T;
    return {
      success: true,
      data,
      statusCode: res.status,
      isOffline: false,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      data: null,
      error: isTimeout ? 'Request timed out after 3.5s' : (err?.message || 'Network connection failed'),
      isOffline: true,
    };
  }
}

export const apiClient = {
  // 1. Health & Status
  checkHealth: async (timeoutMs: number = 2500): Promise<ApiResult<HealthResponse>> => {
    return requestJson<HealthResponse>('/health', {}, undefined, timeoutMs);
  },

  // 2. Deterministic Finance Engine
  calculateFinance: async (marginCapital: number): Promise<ApiResult<FinancePlanResponse>> => {
    return requestJson<FinancePlanResponse>('/finance/calculate', {
      method: 'POST',
      body: JSON.stringify({ marginCapital }),
    });
  },

  getUserFinance: async (userId: string): Promise<ApiResult<FinancePlanResponse>> => {
    return requestJson<FinancePlanResponse>('/finance', {}, userId);
  },

  getHealthScore: async (
    userId?: string,
    params?: {
      totalIncome?: number;
      totalExpenses?: number;
      entryCount?: number;
      hasDownwardTrend?: boolean;
    }
  ): Promise<ApiResult<FinancialHealthResponse>> => {
    let endpoint = '/finance/health-score';
    if (params) {
      const q = new URLSearchParams();
      if (params.totalIncome !== undefined) q.set('totalIncome', params.totalIncome.toString());
      if (params.totalExpenses !== undefined) q.set('totalExpenses', params.totalExpenses.toString());
      if (params.entryCount !== undefined) q.set('entryCount', params.entryCount.toString());
      if (params.hasDownwardTrend !== undefined) q.set('hasDownwardTrend', params.hasDownwardTrend.toString());
      const qs = q.toString();
      if (qs) endpoint += `?${qs}`;
    }
    return requestJson<FinancialHealthResponse>(endpoint, {}, userId);
  },

  // 3. Deterministic Risk Engine
  analyzeRisk: async (req: RiskAnalysisRequest): Promise<ApiResult<RiskAnalysisResponse>> => {
    return requestJson<RiskAnalysisResponse>('/risk/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // 4. User Profile
  getProfile: async (userId: string): Promise<ApiResult<any>> => {
    return requestJson<any>('/profile', {}, userId);
  },

  updateProfile: async (userId: string, data: any): Promise<ApiResult<any>> => {
    return requestJson<any>('/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }, userId);
  },

  // 5. Dashboard Aggregates
  getDashboard: async (userId: string): Promise<ApiResult<any>> => {
    return requestJson<any>('/dashboard', {}, userId);
  },

  // 6. Logbook Transactions
  getLogbook: async (userId: string): Promise<ApiResult<any[]>> => {
    return requestJson<any[]>('/logbook', {}, userId);
  },

  createLogbookEntry: async (
    userId: string,
    entry: {
      date: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      note: string;
    }
  ): Promise<ApiResult<any>> => {
    return requestJson<any>('/logbook', {
      method: 'POST',
      body: JSON.stringify(entry),
    }, userId);
  },

  deleteLogbookEntry: async (
    userId: string,
    entryId: string
  ): Promise<ApiResult<{ success: boolean; deletedId: string }>> => {
    return requestJson<{ success: boolean; deletedId: string }>(`/logbook/${entryId}`, {
      method: 'DELETE',
    }, userId);
  },

  // 7. Business Advisor RAG
  analyzeAdvisor: async (req: {
    location: string;
    category: string;
    marginCapital: number;
    language: string;
    userQuery?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<ApiResult<any>> => {
    return requestJson<any>('/advisor/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // 8. Interactive AI Finance Advisor
  consultFinanceAdvisor: async (
    req: FinanceAdviceRequest,
    timeoutMs: number = 8000
  ): Promise<ApiResult<FinanceAdviceResponse>> => {
    return requestJson<FinanceAdviceResponse>(
      '/finance/advisor-chat',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      undefined,
      timeoutMs
    );
  },

  // 9. Pure Deterministic Multi-Scheme Calculation Engine
  calculateSchemes: async (
    req: {
      loanAmount: number;
      category: string;
      gender: string;
      socialCategory: string;
      locationType: 'rural' | 'urban';
      isNewEnterprise?: boolean;
      isArtisanTrade?: boolean;
    },
    timeoutMs: number = 5000
  ): Promise<ApiResult<any[]>> => {
    return requestJson<any[]>(
      '/finance/schemes/calculate',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      undefined,
      timeoutMs
    );
  },

  // 10. Unified Lender-Ready Business Plan Generator
  generateBusinessPlan: async (
    req: {
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
      language?: string;
    },
    timeoutMs: number = 10000
  ): Promise<ApiResult<any>> => {
    return requestJson<any>(
      '/plan/generate',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      undefined,
      timeoutMs
    );
  },
};
