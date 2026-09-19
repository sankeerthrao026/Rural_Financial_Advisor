'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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
  configError: string | null;
  continueAsDemo: () => AuthUser;
  exitDemo: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loginAsDemoUser: (persona?: 'dairy' | 'kirana' | 'weaving') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_KEY = 'ruralcred_auth_user';
const DEMO_USER_ID_KEY = 'ruralcred_demo_user_id';

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check active demo session first
    const demoId = localStorage.getItem(DEMO_USER_ID_KEY);
    if (demoId) {
      const stored = localStorage.getItem(LOCAL_AUTH_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return {
        id: demoId,
        email: `${demoId}@demo.ruralcred.in`,
        name: 'Demo Entrepreneur',
        isDemo: true,
        authMode: 'demo',
      };
    }

    // 2. Check stored authenticated/mock user
    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      return JSON.parse(stored);
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
          // Never block or show error if background check fails
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
          setSession(null);
          setUser(null);
          persistUser(null);
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

  // 1. Primary Action: Continue as Demo User (instantaneous, random ID)
  const continueAsDemo = useCallback((): AuthUser => {
    const randomHex = Math.random().toString(16).substring(2, 10);
    const demoId = `demo_${randomHex}`;
    const demoUser: AuthUser = {
      id: demoId,
      email: `${demoId}@demo.ruralcred.in`,
      name: 'Demo Entrepreneur',
      isDemo: true,
      authMode: 'demo',
    };

    setUser(demoUser);
    persistUser(demoUser);
    setError(null);
    setLoading(false);
    return demoUser;
  }, []);

  // 2. Exit Demo: Clears demo session and returns to Welcome / Entry Screen
  const exitDemo = useCallback(() => {
    setUser(null);
    setSession(null);
    persistUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ruralcred_demo_profile');
    }
  }, []);

  // 3. Pre-configured Evaluator Demo Personas
  const loginAsDemoUser = async (persona: 'dairy' | 'kirana' | 'weaving' = 'dairy') => {
    const randomSuffix = Math.random().toString(16).substring(2, 6);
    const personas: Record<string, AuthUser> = {
      dairy: {
        id: `demo_anita_${randomSuffix}`,
        email: 'anita.dairy@ruralcred.in',
        name: 'Anita Sharma',
        isDemo: true,
        authMode: 'demo',
      },
      kirana: {
        id: `demo_ramesh_${randomSuffix}`,
        email: 'ramesh.kirana@ruralcred.in',
        name: 'Ramesh Kumar',
        isDemo: true,
        authMode: 'demo',
      },
      weaving: {
        id: `demo_lakshmi_${randomSuffix}`,
        email: 'lakshmi.handloom@ruralcred.in',
        name: 'Lakshmi Devi',
        isDemo: true,
        authMode: 'demo',
      },
    };

    const chosen = personas[persona] || personas.dairy;
    setUser(chosen);
    persistUser(chosen);
    setError(null);
    setLoading(false);
  };

  // 4. Optional Supabase Sign In
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInErr) {
          setLoading(false);
          return { error: signInErr.message };
        }

        if (data.user) {
          const u = mapSupabaseUser(data.user);
          setUser(u);
          persistUser(u);
          if (data.session) setSession(data.session);
        }

        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Login failed' };
      }
    }

    // Local fallback for testing
    const mockId = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: cleanEmail.split('@')[0] || 'Anita Sharma',
      isDemo: false,
      authMode: 'authenticated',
    };
    setUser(newUser);
    persistUser(newUser);
    setLoading(false);
    return { error: null };
  };

  // 5. Optional Supabase Sign Up
  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { name: name || cleanEmail.split('@')[0] },
          },
        });

        if (signUpErr) {
          setLoading(false);
          return { error: signUpErr.message };
        }

        if (data.user) {
          const u = mapSupabaseUser(data.user);
          setUser(u);
          persistUser(u);
          if (data.session) setSession(data.session);
        }

        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Registration failed' };
      }
    }

    // Local fallback
    const mockId = `usr_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0] || 'Rural Entrepreneur',
      isDemo: false,
      authMode: 'authenticated',
    };
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
