'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import {
  createDemoSession,
  createPresetSession,
  getDemoSession,
  clearDemoSession,
  DEMO_USER_ID_KEY,
  LOCAL_AUTH_KEY,
  ACTIVE_PROFILE_KEY,
} from '@/lib/demo-session';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isDemo?: boolean;
  authMode?: 'demo' | 'authenticated';
}

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  isDemo: boolean;
  demoModeEnabled: boolean;
  configError: string | null;
  continueAsDemo: () => AuthUser;
  exitDemo: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loginAsDemoUser: (persona?: 'dairy' | 'kirana' | 'weaving') => Promise<void>;
}

// When true or unset, the app keeps its convenient demo auth: preset personas,
// demo user session creation, and local persona switching. When explicitly set to 'false',
// the dummy fallbacks are disabled and real authentication is required.
const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check active demo session first
    const demo = getDemoSession();
    if (demo && demo.user?.id) {
      return demo.user;
    }

    // 2. Check stored authenticated/mock user
    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function persistUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
      if (user.isDemo) {
        localStorage.setItem(DEMO_USER_ID_KEY, user.id);
      }
    } else {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      localStorage.removeItem(DEMO_USER_ID_KEY);
    }
  } catch {}
}

function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    isDemo: false,
    authMode: 'authenticated',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous initialization from localStorage ensures ZERO loading delay on startup
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isDemo = Boolean(
    user?.isDemo ||
      user?.id?.startsWith('demo_') ||
      user?.id?.startsWith('demo-') ||
      (typeof window !== 'undefined' && Boolean(localStorage.getItem(DEMO_USER_ID_KEY)))
  );

  // Background non-blocking session check for optional Supabase
  useEffect(() => {
    let active = true;

    async function checkBackgroundSupabaseSession() {
      // If user is already in demo mode, do not override with Supabase
      const hasDemoSession = typeof window !== 'undefined' && localStorage.getItem(DEMO_USER_ID_KEY);
      if (hasDemoSession) return;

      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (active && data.session?.user) {
            const u = mapSupabaseUser(data.session.user);
            setSession(data.session);
            setUser(u);
            persistUser(u);
          }
        } catch (e) {
          console.debug('[Auth] Optional Supabase background check:', e);
        }
      }
    }

    checkBackgroundSupabaseSession();

    let unsubscribe: (() => void) | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!active) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (newSession?.user) {
            const u = mapSupabaseUser(newSession.user);
            setSession(newSession);
            setUser(u);
            persistUser(u);
          }
        } else if (event === 'SIGNED_OUT') {
          // Do not wipe session if user is in demo mode
          const inDemo = typeof window !== 'undefined' && Boolean(localStorage.getItem(DEMO_USER_ID_KEY));
          if (!inDemo) {
            setSession(null);
            setUser(null);
            persistUser(null);
          }
        }
      });

      unsubscribe = () => {
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 1. Primary Action: Continue as Demo User (instantaneous dummy session with complete data)
  const continueAsDemo = useCallback((): AuthUser => {
    const { user: demoUser } = createPresetSession('dairy');
    setUser(demoUser);
    persistUser(demoUser);
    setError(null);
    setLoading(false);
    return demoUser;
  }, []);

  // 2. Exit Demo: Clears demo session and returns to Welcome / Entry Screen
  const exitDemo = useCallback(() => {
    clearDemoSession();
    setUser(null);
    setSession(null);
    persistUser(null);
    setError(null);
    setLoading(false);
  }, []);

  // 3. Pre-configured Evaluator Demo Personas
  const loginAsDemoUser = async (persona: 'dairy' | 'kirana' | 'weaving' = 'dairy') => {
    const { user: chosen } = createPresetSession(persona);
    setUser(chosen);
    persistUser(chosen);
    setError(null);
    setLoading(false);
  };

  // 4. Dummy & Supabase Sign In
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim();

    if (!DEMO_MODE_ENABLED) {
      if (!cleanEmail || !password.trim()) {
        setLoading(false);
        return { error: 'Please enter your email and password.' };
      }
    }

    // 1. Direct dummy profile matching (demo mode only):
    const lowerEmail = cleanEmail.toLowerCase();
    let persona: 'dairy' | 'kirana' | 'weaving' | null = null;
    if (DEMO_MODE_ENABLED) {
      if (lowerEmail.includes('anita') || lowerEmail.includes('dairy')) {
        persona = 'dairy';
      } else if (lowerEmail.includes('ramesh') || lowerEmail.includes('kirana')) {
        persona = 'kirana';
      } else if (lowerEmail.includes('lakshmi') || lowerEmail.includes('weaving') || lowerEmail.includes('handloom')) {
        persona = 'weaving';
      }
    }

    if (persona) {
      const { user: chosen } = createPresetSession(persona);
      setUser(chosen);
      persistUser(chosen);
      setLoading(false);
      return { error: null };
    }

    // 2. If Supabase is configured and not a preset email, try Supabase with immediate local fallback:
    if (isSupabaseConfigured && supabase) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500)
        );

        const { data, error: signInErr } = (await Promise.race([
          supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password || 'demo123',
          }),
          timeoutPromise,
        ])) as any;

        if (!signInErr && data?.user) {
          const u = mapSupabaseUser(data.user);
          setUser(u);
          persistUser(u);
          if (data.session) setSession(data.session);
          setLoading(false);
          return { error: null };
        }
      } catch (e) {
        console.warn('[Auth] Supabase attempt bypassed for local dummy session:', e);
      }
    }

    // 3. Robust Dummy Auth: ANY other email logs in immediately as an active dummy user!
    //    (Demo mode only — outside demo mode the dummy fallback is disabled.)
    if (!DEMO_MODE_ENABLED) {
      setLoading(false);
      return { error: 'Sign-in is unavailable. Enable NEXT_PUBLIC_DEMO_MODE=true for demo auth or configure a real auth provider.' };
    }

    const mockId = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const displayName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ') || 'Anita Sharma';
    const formattedName = displayName.replace(/\b\w/g, (c) => c.toUpperCase());

    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: formattedName,
      isDemo: true,
      authMode: 'demo',
    };

    const defaultProfile = {
      name: formattedName,
      businessName: `${formattedName} Enterprises`,
      location: 'Warangal, Telangana',
      category: 'Dairy Farming',
      marginCapital: 100000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: true,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_ID_KEY, mockId);
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(newUser));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(defaultProfile));
      localStorage.setItem(`ruralcred_profile_${mockId}`, JSON.stringify(defaultProfile));
    }

    setUser(newUser);
    persistUser(newUser);
    setLoading(false);
    return { error: null };
  };

  // 5. Dummy & Supabase Sign Up
  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setLoading(false);
      return { error: 'Please fill in your email.' };
    }

    if (!DEMO_MODE_ENABLED && !password.trim()) {
      setLoading(false);
      return { error: 'Please enter a password.' };
    }

    if (!DEMO_MODE_ENABLED) {
      setLoading(false);
      return { error: 'Account creation is unavailable. Enable NEXT_PUBLIC_DEMO_MODE=true for demo registration or configure a real auth provider.' };
    }

    const mockId = `usr_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const chosenName = name?.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ') || 'Rural Entrepreneur';
    const formattedName = chosenName.replace(/\b\w/g, (c) => c.toUpperCase());

    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: formattedName,
      isDemo: true,
      authMode: 'demo',
    };

    const newProfile = {
      name: formattedName,
      businessName: `${formattedName} Enterprises`,
      location: 'Warangal, Telangana',
      category: 'Dairy Farming',
      marginCapital: 100000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: true,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_ID_KEY, mockId);
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(newUser));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(newProfile));
      localStorage.setItem(`ruralcred_profile_${mockId}`, JSON.stringify(newProfile));
    }

    setUser(newUser);
    persistUser(newUser);
    setLoading(false);
    return { error: null };
  };

  // 6. Sign Out
  const signOut = async (): Promise<void> => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Signout error:', e);
      }
    }
    clearDemoSession();
    setUser(null);
    setSession(null);
    persistUser(null);
    setError(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        isConfigured: isSupabaseConfigured,
        isDemo,
        demoModeEnabled: DEMO_MODE_ENABLED,
        configError: supabaseConfigError,
        continueAsDemo,
        exitDemo,
        signIn,
        signUp,
        signOut,
        loginAsDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
