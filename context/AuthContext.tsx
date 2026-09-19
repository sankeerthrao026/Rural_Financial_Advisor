'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
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
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loginAsDemoUser: (persona?: 'dairy' | 'kirana' | 'weaving') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_KEY = 'ruralcred_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('Supabase getSession error:', error);
          }
          if (mounted && data.session?.user) {
            setSession(data.session);
            setUser({
              id: data.session.user.id,
              email: data.session.user.email || '',
              name: data.session.user.user_metadata?.name || data.session.user.email?.split('@')[0],
            });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Error reading Supabase session:', e);
        }

        // Subscribe to auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (!mounted) return;
            setSession(newSession);
            if (newSession?.user) {
              setUser({
                id: newSession.user.id,
                email: newSession.user.email || '',
                name: newSession.user.user_metadata?.name || newSession.user.email?.split('@')[0],
              });
            } else {
              setUser(null);
            }
            setLoading(false);
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      }

      // Fallback: Check local storage for persistent mock session
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_AUTH_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (mounted) setUser(parsed);
          } catch (e) {}
        }
      }

      if (mounted) setLoading(false);
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setLoading(false);
          return { error: error.message };
        }
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
          });
        }
        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Login failed' };
      }
    }

    // Resilient local auth fallback
    const mockId = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email,
      name: email.split('@')[0] || 'Anita Sharma',
    };
    setUser(newUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(newUser));
    }
    setLoading(false);
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: string | null }> => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
          },
        });
        if (error) {
          setLoading(false);
          return { error: error.message };
        }
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || '',
            name: name || data.user.email?.split('@')[0],
          });
        }
        setLoading(false);
        return { error: null };
      } catch (err: any) {
        setLoading(false);
        return { error: err?.message || 'Registration failed' };
      }
    }

    // Resilient local auth fallback
    const mockId = `usr_${Date.now()}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newUser: AuthUser = {
      id: mockId,
      email,
      name: name || email.split('@')[0] || 'Rural Entrepreneur',
    };
    setUser(newUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(newUser));
    }
    setLoading(false);
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Signout error:', e);
      }
    }
    setUser(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_AUTH_KEY);
    }
    setLoading(false);
  };

  const loginAsDemoUser = async (persona: 'dairy' | 'kirana' | 'weaving' = 'dairy') => {
    setLoading(true);
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(chosen));
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
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
