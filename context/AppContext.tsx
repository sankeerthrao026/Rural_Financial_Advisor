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
  updateLogbookEntry,
  deleteLogbookEntry,
  KhataEntry,
  fetchKhataEntries,
  saveKhataEntry,
  recordKhataPayment,
  updateKhataEntry as updateKhataStorage,
  deleteKhataEntry as deleteKhataStorage,
  INITIAL_DEMO_ENTRIES,
  INITIAL_KIRANA_ENTRIES,
  INITIAL_WEAVING_ENTRIES,
  INITIAL_KHATA_ENTRIES,
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
  gender?: string;
  socialCategory?: string;
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
  updateEntry: (entry: LogbookEntry) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  resetEntriesToDefault: () => void;
  syncStatus: 'synced' | 'local_cache' | 'syncing';

  // Khata / Customer Credit Ledger
  khataEntries: KhataEntry[];
  addKhataEntry: (entry: Omit<KhataEntry, 'id' | 'paidAmount' | 'status' | 'payments' | 'timestamp'>) => Promise<void>;
  updateKhataEntry: (entry: KhataEntry) => Promise<void>;
  recordKhataPayment: (id: string, paymentAmount: number, paymentDate: string, note?: string) => Promise<void>;
  removeKhataEntry: (id: string) => Promise<void>;
  totalCustomerCredit: number;
  totalSupplierCredit: number;

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
    gender: 'female',
    socialCategory: 'OBC',
  });

  const [entries, setEntries] = useState<LogbookEntry[]>(INITIAL_DEMO_ENTRIES);
  const [khataEntries, setKhataEntries] = useState<KhataEntry[]>(INITIAL_KHATA_ENTRIES);

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
      let profileFound = false;
      if (isFirebaseConfigured && firestoreInstance && userId) {
        try {
          const userDocRef = doc(firestoreInstance, 'users', userId);
          const snap = await getDoc(userDocRef);
          if (snap.exists() && active) {
            setProfile(snap.data() as UserProfile);
            profileFound = true;
          }
        } catch (e) {
          console.warn('Firestore profile fetch error:', e);
        }
      }

      if (!profileFound && typeof window !== 'undefined' && userId) {
        // Priority 1: Check if userId or user.email directly maps to one of our preset personas
        const lowerId = (userId || '').toLowerCase();
        const lowerEmail = (user?.email || '').toLowerCase();

        let presetProfile: UserProfile | null = null;
        if (lowerId.includes('anita') || lowerEmail.includes('anita') || lowerEmail.includes('dairy')) {
          presetProfile = { ...PRESET_PROFILES.dairy.profile, onboardingCompleted: true };
        } else if (lowerId.includes('ramesh') || lowerEmail.includes('ramesh') || lowerEmail.includes('kirana')) {
          presetProfile = { ...PRESET_PROFILES.kirana.profile, onboardingCompleted: true };
        } else if (lowerId.includes('lakshmi') || lowerEmail.includes('lakshmi') || lowerEmail.includes('weaving') || lowerEmail.includes('handloom')) {
          presetProfile = { ...PRESET_PROFILES.weaving.profile, onboardingCompleted: true };
        }

        if (presetProfile && active) {
          setProfile(presetProfile);
          try {
            localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(presetProfile));
            localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(presetProfile));
          } catch {}
        } else {
          // Priority 2: Check user-specific or active saved profile
          const profileKey = `ruralcred_profile_${userId}`;
          const savedProfile = localStorage.getItem(profileKey) || localStorage.getItem(ACTIVE_PROFILE_KEY);
          if (savedProfile && active) {
            try {
              const parsed = JSON.parse(savedProfile);
              setProfile({
                ...parsed,
                location: parsed.location || 'Warangal, Telangana',
                onboardingCompleted: true,
              });
            } catch (e) {}
          } else if (active) {
            const fallbackProfile: UserProfile = {
              name: user?.name || user?.email?.split('@')[0] || 'Anita Sharma',
              businessName: `${user?.name || 'Sharma'} Enterprises`,
              location: 'Warangal, Telangana',
              category: 'Dairy Farming',
              marginCapital: 100000,
              hasActiveLoan: false,
              simulatingSecondLoan: false,
              onboardingCompleted: true,
              gender: 'female',
              socialCategory: 'OBC',
            };
            setProfile(fallbackProfile);
            try {
              localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(fallbackProfile));
              localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(fallbackProfile));
            } catch {}
          }
        }
      }

      // Fetch isolated user entries and khata
      if (userId) {
        const loadedEntries = await fetchLogbookEntries(userId);
        if (active) setEntries(loadedEntries);

        const loadedKhata = await fetchKhataEntries(userId);
        if (active && loadedKhata) setKhataEntries(loadedKhata);
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
    setSyncStatus('synced');
  };

  const removeEntry = async (id: string) => {
    await deleteLogbookEntry(id, userId);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEntry = async (entry: LogbookEntry) => {
    setSyncStatus('syncing');
    await updateLogbookEntry(entry, userId);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    setSyncStatus('synced');
  };

  const addKhataEntry = async (
    entry: Omit<KhataEntry, 'id' | 'paidAmount' | 'status' | 'payments' | 'timestamp'>
  ) => {
    const created = await saveKhataEntry(entry, userId);
    setKhataEntries((prev) => [created, ...prev]);
  };

  const updateKhataEntry = async (entry: KhataEntry) => {
    await updateKhataStorage(entry, userId);
    setKhataEntries((prev) => prev.map((k) => (k.id === entry.id ? entry : k)));
  };

  const recordKhataPaymentHandler = async (
    id: string,
    paymentAmount: number,
    paymentDate: string,
    note?: string
  ) => {
    const updated = await recordKhataPayment(id, paymentAmount, paymentDate, note, userId);
    if (updated) {
      setKhataEntries((prev) => prev.map((k) => (k.id === id ? updated : k)));
    }
  };

  const removeKhataEntry = async (id: string) => {
    await deleteKhataStorage(id, userId);
    setKhataEntries((prev) => prev.filter((k) => k.id !== id));
  };

  const { totalCustomerCredit, totalSupplierCredit } = useMemo(() => {
    let cust = 0;
    let supp = 0;
    for (const k of khataEntries) {
      const remaining = Math.max(0, k.amount - k.paidAmount);
      if (k.type === 'customer_credit') cust += remaining;
      if (k.type === 'supplier_credit') supp += remaining;
    }
    return { totalCustomerCredit: cust, totalSupplierCredit: supp };
  }, [khataEntries]);

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
      setEntries(INITIAL_DEMO_ENTRIES);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ruralcred_logbook_${userId}`, JSON.stringify(INITIAL_DEMO_ENTRIES));
      }
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
      setEntries(INITIAL_WEAVING_ENTRIES);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ruralcred_logbook_${userId}`, JSON.stringify(INITIAL_WEAVING_ENTRIES));
      }
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
      setEntries(INITIAL_KIRANA_ENTRIES);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ruralcred_logbook_${userId}`, JSON.stringify(INITIAL_KIRANA_ENTRIES));
      }
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
        updateEntry,
        removeEntry,
        resetEntriesToDefault,
        syncStatus,
        khataEntries,
        addKhataEntry,
        updateKhataEntry,
        recordKhataPayment: recordKhataPaymentHandler,
        removeKhataEntry,
        totalCustomerCredit,
        totalSupplierCredit,
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
