import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function validateSupabaseConfig(url?: string, key?: string): {
  isValid: boolean;
  cleanUrl: string;
  cleanKey: string;
  error: string | null;
} {
  if (!url || !key) {
    return {
      isValid: false,
      cleanUrl: '',
      cleanKey: '',
      error: 'Missing Supabase environment variables',
    };
  }

  if (
    url.includes('your-supabase') ||
    url.includes('your-project') ||
    url.includes('<project-ref>') ||
    key.includes('your-supabase-anon-key')
  ) {
    return {
      isValid: false,
      cleanUrl: '',
      cleanKey: '',
      error: 'Placeholder Supabase environment variables detected',
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        cleanUrl: '',
        cleanKey: '',
        error: 'Invalid URL protocol for Supabase',
      };
    }
  } catch {
    return {
      isValid: false,
      cleanUrl: '',
      cleanKey: '',
      error: 'Invalid Supabase URL format',
    };
  }

  if (key.length < 10) {
    return {
      isValid: false,
      cleanUrl: '',
      cleanKey: '',
      error: 'Invalid Supabase Anon Key length',
    };
  }

  return {
    isValid: true,
    cleanUrl: url,
    cleanKey: key,
    error: null,
  };
}

const config = validateSupabaseConfig(rawUrl, rawKey);

export const isSupabaseConfigured = config.isValid;
export const supabaseConfigError = config.error;

let supabaseInstance: SupabaseClient | null = null;

if (config.isValid && config.cleanUrl && config.cleanKey) {
  try {
    supabaseInstance = createClient(config.cleanUrl, config.cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ruralcred_supabase_auth_token',
      },
    });
  } catch (err: any) {
    console.warn('[Supabase] Failed to initialize client:', err?.message || err);
  }
}

export const supabase = supabaseInstance;
