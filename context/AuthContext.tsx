'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isDemo?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loginAsDemoUser: (persona?: 'dairy' | 'kirana' | 'weaving') => Promise<void>;
  retryAuth: () => Promise<void>;
  goToLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_KEY = 'ruralcred_auth_user';
const AUTH_TIMEOUT_MS = 3500; // Guarantees auth state transition within 3.5 seconds

function getLocalStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalStoredUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_AUTH_KEY);
    }
  } catch {}
}

function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const initAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Case 1: Supabase is NOT configured (e.g. local evaluation, demo mode)
    if (!isSupabaseConfigured || !supabase) {
      const local = getLocalStoredUser();
      setUser(local);
      setSession(null);
      setLoading(false);
      return;
    }

    // Case 2: Supabase IS configured -> Query getSession with timeout race
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ isTimeout: true }), AUTH_TIMEOUT_MS);
    });

    try {
      const sessionPromise = supabase.auth.getSession().then((res) => ({
        isTimeout: false as const,
        data: res.data,
        error: res.error,
      }));

      const res = await Promise.race([sessionPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (res.isTimeout) {
        console.warn(`[Auth] Supabase getSession timed out after ${AUTH_TIMEOUT_MS}ms`);
        // Check if there is an existing local fallback session first
        const local = getLocalStoredUser();
        if (local) {
          setUser(local);
          setLoading(false);
        } else {
          setError('Unable to connect to authentication service.');
          setUser(null);
          setSession(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: sessionErr } = res;

      if (sessionErr) {
        console.warn('[Auth] Supabase getSession error:', sessionErr.message);
        // If token expired or invalid grant, clean up
        if (
          sessionErr.message?.includes('Refresh Token') ||
          sessionErr.message?.includes('invalid_grant') ||
          sessionErr.message?.includes('expired')
        ) {
          try {
            await supabase.auth.signOut();
          } catch {}
        }

        const local = getLocalStoredUser();
        if (local) {
          setUser(local);
        } else {
          setError('Unable to connect to authentication service.');
          setUser(null);
          setSession(null);
        }
        setLoading(false);
        return;
      }

      // Check if active Supabase session exists
      if (data?.session?.user) {
        const u = mapSupabaseUser(data.session.user);
        setSession(data.session);
        setUser(u);
        setLocalStoredUser(u);
        setError(null);
        setLoading(false);
        return;
      }

      // Supabase has NO active session -> first visit or logged-out user
      // Check local storage for persistent demo user
      const local = getLocalStoredUser();
      if (local && local.isDemo) {
        setUser(local);
      } else {
        setUser(null);
        setSession(null);
        setLocalStoredUser(null);
      }
      setError(null);
      setLoading(false);
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      console.warn('[Auth] Unexpected error during session check:', err);
      const local = getLocalStoredUser();
      if (local) {
        setUser(local);
      } else {
        setError('Unable to connect to authentication service.');
        setUser(null);
        setSession(null);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let authUnsubscribe: (() => void) | null = null;

    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, newSession) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (newSession?.user) {
              const u = mapSupabaseUser(newSession.user);
              setSession(newSession);
              setUser((prev) => {
                if (prev?.id === u.id && prev?.email === u.email) return prev;
                return u;
              });
              setLocalStoredUser(u);
              setError(null);
              setLoading(false);
            }
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setLocalStoredUser(null);
            setError(null);
            setLoading(false);
          }
        }
      );

      authUnsubscribe = () => {
        authListener.subscription.unsubscribe();
      };
    }

    // Run auth initialization immediately
    initAuth();

    return () => {
      if (authUnsubscribe) {
        authUnsubscribe();
      }
    };
  }, [initAuth]);

  const retryAuth = useCallback(async () => {
    await initAuth();
  }, [initAuth]);

  const goToLogin = useCallback(() => {
    setError(null);
    setLoading(false);
    setUser(null);
    setSession(null);
  }, []);

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
          setLocalStoredUser(u);
          if (data.session) setSession(data.session);
        }

        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Login failed. Please check network connection.' };
      }
    }

    // Resilient local auth fallback
    const mockId = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: cleanEmail.split('@')[0] || 'Anita Sharma',
    };
    setUser(newUser);
    setLocalStoredUser(newUser);
    setLoading(false);
    return { error: null };
  };

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
          setLocalStoredUser(u);
          if (data.session) setSession(data.session);
        }

        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Registration failed' };
      }
    }

    // Resilient local auth fallback
    const mockId = `usr_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0] || 'Rural Entrepreneur',
    };
    setUser(newUser);
    setLocalStoredUser(newUser);
    setLoading(false);
    return { error: null };
  };

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
    setLocalStoredUser(null);
    setError(null);
    setLoading(false);
  };

  const loginAsDemoUser = async (persona: 'dairy' | 'kirana' | 'weaving' = 'dairy') => {
    setLoading(true);
    setError(null);

    const personas: Record<string, AuthUser> = {
      dairy: {
        id: 'usr_anita_warangal_dairy',
        email: 'anita.dairy@ruralcred.in',
        name: 'Anita Sharma',
        isDemo: true,
      },
      kirana: {
        id: 'usr_ramesh_karimnagar_kirana',
        email: 'ramesh.kirana@ruralcred.in',
        name: 'Ramesh Kumar',
        isDemo: true,
      },
      weaving: {
        id: 'usr_lakshmi_nalgonda_handloom',
        email: 'lakshmi.handloom@ruralcred.in',
        name: 'Lakshmi Devi',
        isDemo: true,
      },
    };

    const chosen = personas[persona] || personas.dairy;
    setUser(chosen);
    setLocalStoredUser(chosen);
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
        configError: supabaseConfigError,
        signIn,
        signUp,
        signOut,
        loginAsDemoUser,
        retryAuth,
        goToLogin,
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
