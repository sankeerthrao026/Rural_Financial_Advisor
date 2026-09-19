'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
        const savedProfile = localStorage.getItem(profileKey);
        if (savedProfile && active) {
          try {
            setProfile(JSON.parse(savedProfile));
          } catch (e) {}
        } else if (user?.isDemo && active) {
          // If fresh random demo user without saved profile, initialize for onboarding
          if (
            user.id.startsWith('demo_') &&
            !user.id.includes('anita') &&
            !user.id.includes('ramesh') &&
            !user.id.includes('lakshmi')
          ) {
            setProfile({
              name: user.name || 'Demo Entrepreneur',
              businessName: 'My Enterprise',
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
    const next = { ...profile, ...updates, onboardingCompleted: true };
    setProfile(next);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(next));
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
        marginCapital: 100000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
      });
      resetEntriesToDefault();
    } else if (presetKey === 'weaving') {
      updateProfile({
        name: 'Lakshmi Devi',
        businessName: 'Pochampally Handlooms',
        location: 'Nalgonda, Telangana',
        category: 'Handloom / Weaving',
        marginCapital: 30000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
      });
    } else if (presetKey === 'kirana') {
      updateProfile({
        name: 'Ramesh Kumar',
        businessName: 'Sri Balaji Kirana Store',
        location: 'Karimnagar, Telangana',
        category: 'Rural Grocery / Kirana',
        marginCapital: 12000, // Project Cost = ₹1,20,000 <= ₹1.40L (Triggers Micro Finance!)
        hasActiveLoan: false,
        simulatingSecondLoan: false,
      });
    } else if (presetKey === 'risk_case') {
      // Over-leverage and negative cash flow risk simulation
      updateProfile({
        hasActiveLoan: true,
        simulatingSecondLoan: true,
      });
      // Add high expense entry to trigger Rule 2
      addNewEntry({
        date: '19 Sep 2026',
        amount: 85000,
        type: 'expense',
        category: 'Asset Repairs',
        note: 'Emergency transformer replacement & repair',
      });
    }
  };

  // Deterministic Financial Calculation
  const finance = useMemo(() => {
    return calculateFinancePlan(profile.marginCapital);
  }, [profile.marginCapital]);

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

  // Deterministic Financial Health Score
  const healthScore = useMemo(() => {
    return calculateFinancialHealthScore({
      totalIncome,
      totalExpenses,
      entryCount: entries.length,
      hasDownwardTrend: netCashFlow < 15000 && totalIncome > 0,
    });
  }, [totalIncome, totalExpenses, entries.length, netCashFlow]);

  // Deterministic Risk Engine Evaluation
  const detectedRisks = useMemo(() => {
    return evaluateFinancialRisks({
      hasActiveLoan: profile.hasActiveLoan,
      simulatingSecondLoan: profile.simulatingSecondLoan,
      totalIncome,
      totalExpenses,
      netCashFlow,
      previousNetCashFlow: 35000,
    });
  }, [profile.hasActiveLoan, profile.simulatingSecondLoan, totalIncome, totalExpenses, netCashFlow]);

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
