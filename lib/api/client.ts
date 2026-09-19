/**
 * RuralCred Advisor — Next.js API Client for Python FastAPI Backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api';

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {},
  userId?: string
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export const apiClient = {
  // Health
  checkHealth: async () => {
    return fetchJson<{
      status: string;
      service: string;
      version: string;
      chromadb_connected: boolean;
      gemini_configured: boolean;
    }>('/health');
  },

  // Profile
  getProfile: async (userId: string) => {
    return fetchJson<any>('/profile', {}, userId);
  },
  updateProfile: async (userId: string, data: any) => {
    return fetchJson<any>('/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }, userId);
  },

  // Finance Engine
  calculateFinance: async (marginCapital: number) => {
    return fetchJson<any>('/finance/calculate', {
      method: 'POST',
      body: JSON.stringify({ marginCapital }),
    });
  },
  getUserFinance: async (userId: string) => {
    return fetchJson<any>('/finance', {}, userId);
  },
  getHealthScore: async (userId: string) => {
    return fetchJson<any>('/finance/health-score', {}, userId);
  },

  // Risk Engine
  analyzeRisk: async (req: {
    hasActiveLoan: boolean;
    simulatingSecondLoan: boolean;
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    previousNetCashFlow?: number;
  }) => {
    return fetchJson<any>('/risk/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // Dashboard
  getDashboard: async (userId: string) => {
    return fetchJson<any>('/dashboard', {}, userId);
  },

  // Logbook
  getLogbook: async (userId: string) => {
    return fetchJson<any[]>('/logbook', {}, userId);
  },
  createLogbookEntry: async (userId: string, entry: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    note: string;
  }) => {
    return fetchJson<any>('/logbook', {
      method: 'POST',
      body: JSON.stringify(entry),
    }, userId);
  },
  deleteLogbookEntry: async (userId: string, entryId: string) => {
    return fetchJson<{ success: boolean; deletedId: string }>(`/logbook/${entryId}`, {
      method: 'DELETE',
    }, userId);
  },

  // Business Advisor RAG
  analyzeAdvisor: async (req: {
    location: string;
    category: string;
    marginCapital: number;
    language: string;
    userQuery?: string;
  }) => {
    return fetchJson<any>('/advisor/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },
};
