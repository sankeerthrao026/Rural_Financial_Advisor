'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Language, getDictionary } from '@/lib/i18n';
import {
  calculateFinancePlan,
  calculateFinancialHealthScore,
  FinanceAnalysisResult,
  FinancialHealthScoreResult,
} from '@/lib/finance/engine';
import { evaluateFinancialRisks, DetectedRisk } from '@/lib/risk/engine';
import {
  LogbookEntry,
  fetchLogbookEntries,
  addLogbookEntry,
  deleteLogbookEntry,
  INITIAL_DEMO_ENTRIES,
} from '@/lib/firebase/logbook';

import { useAuth } from './AuthContext';
import { firestoreInstance, isFirebaseConfigured } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PRESET_PROFILES, ACTIVE_PROFILE_KEY } from '@/lib/demo-session';
import { getTodayDisplayDate } from '@/lib/utils/date';
import { apiClient } from '@/lib/api/client';

export type BackendConnectionMode = 'backend' | 'local_fallback' | 'checking';

export interface UserProfile {
  name: string;
  businessName: string;
  location: string;
  category: string;
  marginCapital: number;
  hasActiveLoan: boolean;
  simulatingSecondLoan: boolean;
  onboardingCompleted?: boolean;
}

export interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  inputMode: 'text' | 'voice';
  setInputMode: (mode: 'text' | 'voice') => void;
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  loadPreset: (presetKey: 'dairy' | 'weaving' | 'kirana' | 'risk_case') => void;
  hasCompletedOnboarding: boolean;
  
  // Logbook
  entries: LogbookEntry[];
  addNewEntry: (entry: Omit<LogbookEntry, 'id' | 'timestamp'>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  resetEntriesToDefault: () => void;
  syncStatus: 'synced' | 'local_cache' | 'syncing';

  // Deterministic Analytics
  finance: FinanceAnalysisResult;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  healthScore: FinancialHealthScoreResult;
  detectedRisks: DetectedRisk[];
  dictionary: ReturnType<typeof getDictionary>;

  // Backend Connection Mode (FastAPI vs Local Fallback)
  backendMode: BackendConnectionMode;
  isBackendOnline: boolean;
  backendLoading: boolean;
  backendError: string | null;
  refreshBackendData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'demo-user';

  const [language, setLanguage] = useState<Language>('en');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local_cache' | 'syncing'>('synced');

  const [profile, setProfile] = useState<UserProfile>({
    name: user?.name || 'Anita Sharma',
    businessName: 'Sharma Dairy Farm',
    location: 'Warangal, Telangana',
    category: 'Dairy Farming',
    marginCapital: 100000,
    hasActiveLoan: false,
    simulatingSecondLoan: false,
    onboardingCompleted: true,
  });

  const [entries, setEntries] = useState<LogbookEntry[]>(INITIAL_DEMO_ENTRIES);

  // Initialize and load saved state whenever user or userId changes
  useEffect(() => {
    let active = true;

    async function loadUserData() {
      if (typeof window !== 'undefined') {
        const savedLang = localStorage.getItem('ruralcred_language') as Language;
        if (savedLang === 'en' || savedLang === 'te') {
          setLanguage(savedLang);
        }
        const savedMode = localStorage.getItem('ruralcred_input_mode') as 'text' | 'voice';
        if (savedMode) {
          setInputMode(savedMode);
        }
      }

      // Check Firestore profile if configured
      if (isFirebaseConfigured && firestoreInstance && userId) {
        try {
          const userDocRef = doc(firestoreInstance, 'users', userId);
          const snap = await getDoc(userDocRef);
          if (snap.exists() && active) {
            setProfile(snap.data() as UserProfile);
          }
        } catch (e) {
          console.warn('Firestore profile fetch error:', e);
        }
      } else if (typeof window !== 'undefined' && userId) {
        const profileKey = `ruralcred_profile_${userId}`;
        const savedProfile = localStorage.getItem(ACTIVE_PROFILE_KEY) || localStorage.getItem(profileKey);
        if (savedProfile && active) {
          try {
            setProfile(JSON.parse(savedProfile));
          } catch (e) {}
        } else if (user?.isDemo && active) {
          if (user.id.includes('anita')) {
            setProfile(PRESET_PROFILES.dairy.profile);
          } else if (user.id.includes('ramesh')) {
            setProfile(PRESET_PROFILES.kirana.profile);
          } else if (user.id.includes('lakshmi')) {
            setProfile(PRESET_PROFILES.weaving.profile);
          } else {
            setProfile({
              name: user.name || 'Demo Entrepreneur',
              businessName: '',
              location: '',
              category: 'Dairy Farming',
              marginCapital: 100000,
              hasActiveLoan: false,
              simulatingSecondLoan: false,
              onboardingCompleted: false,
            });
          }
        } else if (user && !user.isDemo && active) {
          // New registered user default profile
          setProfile({
            name: user.name || user.email.split('@')[0],
            businessName: `${user.name || 'New'} Enterprise`,
            location: '',
            category: 'Dairy Farming',
            marginCapital: 100000,
            hasActiveLoan: false,
            simulatingSecondLoan: false,
            onboardingCompleted: false,
          });
        }
      }

      // Fetch isolated user entries
      if (userId) {
        const loadedEntries = await fetchLogbookEntries(userId);
        if (active) setEntries(loadedEntries);
      }
    }

    loadUserData();

    return () => {
      active = false;
    };
  }, [userId, user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const next = {
      ...profile,
      ...updates,
      onboardingCompleted: updates.onboardingCompleted !== undefined ? updates.onboardingCompleted : (updates.location ? true : profile.onboardingCompleted),
    };
    setProfile(next);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(next));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(next));
    }

    if (isFirebaseConfigured && firestoreInstance && userId) {
      try {
        const userDocRef = doc(firestoreInstance, 'users', userId);
        await setDoc(userDocRef, next, { merge: true });
      } catch (e) {
        console.warn('Failed to save profile to Firestore:', e);
      }
    }
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ruralcred_language', lang);
    }
  };

  const handleSetInputMode = (mode: 'text' | 'voice') => {
    setInputMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ruralcred_input_mode', mode);
    }
  };

  const addNewEntry = async (entry: Omit<LogbookEntry, 'id' | 'timestamp'>) => {
    setSyncStatus('syncing');
    const newEntry = await addLogbookEntry(
      {
        ...entry,
        timestamp: Date.now(),
      },
      userId
    );
    setEntries((prev) => [newEntry, ...prev]);
    setTimeout(() => {
      setSyncStatus('synced');
    }, 600);
  };

  const removeEntry = async (id: string) => {
    await deleteLogbookEntry(id, userId);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const resetEntriesToDefault = () => {
    setEntries(INITIAL_DEMO_ENTRIES);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ruralcred_logbook_${userId}`, JSON.stringify(INITIAL_DEMO_ENTRIES));
    }
  };

  const loadPreset = (presetKey: 'dairy' | 'weaving' | 'kirana' | 'risk_case') => {
    if (presetKey === 'dairy') {
      updateProfile({
        name: 'Anita Sharma',
        businessName: 'Sharma Dairy Farm',
        location: 'Warangal, Telangana',
        category: 'Dairy Farming',
        marginCapital: 150000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
        onboardingCompleted: true,
      });
      resetEntriesToDefault();
    } else if (presetKey === 'weaving') {
      updateProfile({
        name: 'Lakshmi Devi',
        businessName: 'Lakshmi Handlooms & Textiles',
        location: 'Nalgonda, Telangana',
        category: 'Handloom / Weaving',
        marginCapital: 30000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
        onboardingCompleted: true,
      });
      resetEntriesToDefault();
    } else if (presetKey === 'kirana') {
      updateProfile({
        name: 'Ramesh Kumar',
        businessName: 'Ramesh General & Kirana Store',
        location: 'Khammam, Telangana',
        category: 'Rural Grocery / Kirana',
        marginCapital: 50000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
        onboardingCompleted: true,
      });
      resetEntriesToDefault();
    } else if (presetKey === 'risk_case') {
      // Over-leverage and negative cash flow risk simulation
      updateProfile({
        hasActiveLoan: true,
        simulatingSecondLoan: true,
      });
      // Add high expense entry to trigger Rule 2
      addNewEntry({
        date: getTodayDisplayDate(),
        amount: 85000,
        type: 'expense',
        category: 'Asset Repairs',
        note: 'Emergency transformer replacement & repair',
      });
    }
  };

  // Aggregate Logbook Totals
  const { totalIncome, totalExpenses, netCashFlow } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const e of entries) {
      if (e.type === 'income') inc += e.amount;
      if (e.type === 'expense') exp += e.amount;
    }
    return { totalIncome: inc, totalExpenses: exp, netCashFlow: inc - exp };
  }, [entries]);

  // Baseline Local Fallback Calculations (Synchronous & resilient ground-truth mirror)
  const localFinance = useMemo(() => {
    return calculateFinancePlan(profile.marginCapital);
  }, [profile.marginCapital]);

  const localHealthScore = useMemo(() => {
    return calculateFinancialHealthScore({
      totalIncome,
      totalExpenses,
      entryCount: entries.length,
      hasDownwardTrend: netCashFlow < 15000 && totalIncome > 0,
    });
  }, [totalIncome, totalExpenses, entries.length, netCashFlow]);

  const localDetectedRisks = useMemo(() => {
    return evaluateFinancialRisks({
      hasActiveLoan: profile.hasActiveLoan,
      simulatingSecondLoan: profile.simulatingSecondLoan,
      totalIncome,
      totalExpenses,
      netCashFlow,
      previousNetCashFlow: 35000,
    });
  }, [profile.hasActiveLoan, profile.simulatingSecondLoan, totalIncome, totalExpenses, netCashFlow]);

  // Active States: Source of truth defaults to local fallback on mount, then updates from FastAPI backend
  const [finance, setFinance] = useState<FinanceAnalysisResult>(localFinance);
  const [healthScore, setHealthScore] = useState<FinancialHealthScoreResult>(localHealthScore);
  const [detectedRisks, setDetectedRisks] = useState<DetectedRisk[]>(localDetectedRisks);
  const [backendMode, setBackendMode] = useState<BackendConnectionMode>('checking');
  const [backendLoading, setBackendLoading] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Keep local fallback synced if in local_fallback mode
  useEffect(() => {
    if (backendMode === 'local_fallback') {
      setFinance(localFinance);
      setHealthScore(localHealthScore);
      setDetectedRisks(localDetectedRisks);
    }
  }, [localFinance, localHealthScore, localDetectedRisks, backendMode]);

  // Asynchronously query FastAPI backend
  const refreshBackendData = useCallback(async () => {
    setBackendLoading(true);
    try {
      // 1. Finance calculation
      const financePromise = apiClient.calculateFinance(profile.marginCapital);

      // 2. Risk analysis
      const riskPromise = apiClient.analyzeRisk({
        hasActiveLoan: profile.hasActiveLoan,
        simulatingSecondLoan: profile.simulatingSecondLoan,
        totalIncome,
        totalExpenses,
        netCashFlow,
        previousNetCashFlow: 35000,
      });

      // 3. Health score
      const healthPromise = apiClient.getHealthScore(userId, {
        totalIncome,
        totalExpenses,
        entryCount: entries.length,
        hasDownwardTrend: netCashFlow < 15000 && totalIncome > 0,
      });

      const [financeRes, riskRes, healthRes] = await Promise.all([
        financePromise,
        riskPromise,
        healthPromise,
      ]);

      if (financeRes.success && financeRes.data) {
        // FastAPI Backend is LIVE! Use it as single source of truth
        const bData = financeRes.data;
        setFinance({
          ...bData,
          marginPercentage: Math.round((bData.marginCapital / bData.projectCost) * 100) || 10,
          loanPercentage: Math.round((bData.loanAmount / bData.projectCost) * 100) || 90,
          scheme: {
            ...bData.scheme,
            id: bData.scheme.id as 'micro-finance' | 'term-loan',
          },
        });

        if (riskRes.success && riskRes.data) {
          setDetectedRisks(riskRes.data.detectedRisks);
        } else {
          setDetectedRisks(localDetectedRisks);
        }

        if (healthRes.success && healthRes.data) {
          const bHealth = healthRes.data;
          setHealthScore({
            score: bHealth.score,
            status: bHealth.status === 'caution' ? 'needs_attention' : bHealth.status,
            statusTe: bHealth.statusTe,
            summary: bHealth.summary,
            summaryTe: bHealth.summaryTe,
            loggingScore: bHealth.breakdown.find((b) => b.metric.includes('Logging'))?.score ?? 80,
            profitTrendScore: bHealth.breakdown.find((b) => b.metric.includes('Profit'))?.score ?? 85,
            expenseRatioScore: bHealth.breakdown.find((b) => b.metric.includes('Expense'))?.score ?? 70,
            breakdown: bHealth.breakdown.map((b) => ({
              label: b.label,
              labelTe: b.labelTe,
              weight: b.weight,
              score: b.score,
            })),
          });
        } else {
          setHealthScore(localHealthScore);
        }

        setBackendMode('backend');
        setBackendError(null);
      } else {
        // Backend returned failure or unreachable -> fallback to local calculation
        setFinance(localFinance);
        setHealthScore(localHealthScore);
        setDetectedRisks(localDetectedRisks);
        setBackendMode('local_fallback');
        setBackendError(financeRes.error || 'FastAPI backend server offline');
      }
    } catch (err: any) {
      setFinance(localFinance);
      setHealthScore(localHealthScore);
      setDetectedRisks(localDetectedRisks);
      setBackendMode('local_fallback');
      setBackendError(err?.message || 'FastAPI backend connection error');
    } finally {
      setBackendLoading(false);
    }
  }, [
    profile.marginCapital,
    profile.hasActiveLoan,
    profile.simulatingSecondLoan,
    totalIncome,
    totalExpenses,
    netCashFlow,
    entries.length,
    userId,
    localFinance,
    localHealthScore,
    localDetectedRisks,
  ]);

  // Fetch from FastAPI backend whenever calculation inputs change
  useEffect(() => {
    let isSubscribed = true;
    refreshBackendData();

    // Auto-reconnect periodic check: ping health every 15s to switch back to backend if it turns online
    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      const health = await apiClient.checkHealth(2000);
      if (health.success) {
        if (backendMode !== 'backend') {
          refreshBackendData();
        }
      } else {
        if (backendMode === 'backend') {
          setBackendMode('local_fallback');
          setBackendError('FastAPI backend became unreachable');
        }
      }
    }, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [refreshBackendData, backendMode]);

  const dictionary = useMemo(() => getDictionary(language), [language]);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        inputMode,
        setInputMode: handleSetInputMode,
        profile,
        updateProfile,
        loadPreset,
        hasCompletedOnboarding: Boolean(profile.location && profile.onboardingCompleted !== false),
        entries,
        addNewEntry,
        removeEntry,
        resetEntriesToDefault,
        syncStatus,
        finance,
        totalIncome,
        totalExpenses,
        netCashFlow,
        healthScore,
        detectedRisks,
        dictionary,
        backendMode,
        isBackendOnline: backendMode === 'backend',
        backendLoading,
        backendError,
        refreshBackendData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
