/**
 * RuralCred Advisor — Centralized Demo Session Management
 * Provides robust client-side demo user creation, retrieval, presets, and teardown.
 */

export interface DemoUserProfile {
  name: string;
  businessName: string;
  location: string;
  category: string;
  marginCapital: number;
  hasActiveLoan: boolean;
  simulatingSecondLoan: boolean;
  onboardingCompleted: boolean;
}

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  isDemo: true;
  authMode: 'demo';
}

export interface DemoSessionData {
  user: DemoUser;
  profile: DemoUserProfile;
}

export const DEMO_USER_ID_KEY = 'ruralcred_demo_user_id';
export const LOCAL_AUTH_KEY = 'ruralcred_auth_user';
export const ACTIVE_PROFILE_KEY = 'ruralcred_active_profile';

export const PRESET_PROFILES: Record<'dairy' | 'kirana' | 'weaving', { user: Omit<DemoUser, 'id'>; profile: DemoUserProfile }> = {
  dairy: {
    user: {
      email: 'anita.dairy@ruralcred.in',
      name: 'Anita Sharma',
      isDemo: true,
      authMode: 'demo',
    },
    profile: {
      name: 'Anita Sharma',
      businessName: 'Sharma Dairy Farm',
      location: 'Warangal, Telangana',
      category: 'Dairy Farming',
      marginCapital: 150000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: true,
    },
  },
  kirana: {
    user: {
      email: 'ramesh.kirana@ruralcred.in',
      name: 'Ramesh Kumar',
      isDemo: true,
      authMode: 'demo',
    },
    profile: {
      name: 'Ramesh Kumar',
      businessName: 'Ramesh General & Kirana Store',
      location: 'Khammam, Telangana',
      category: 'Rural Grocery / Kirana',
      marginCapital: 50000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: true,
    },
  },
  weaving: {
    user: {
      email: 'lakshmi.handloom@ruralcred.in',
      name: 'Lakshmi Devi',
      isDemo: true,
      authMode: 'demo',
    },
    profile: {
      name: 'Lakshmi Devi',
      businessName: 'Lakshmi Handlooms & Textiles',
      location: 'Nalgonda, Telangana',
      category: 'Handloom / Weaving',
      marginCapital: 30000,
      hasActiveLoan: false,
      simulatingSecondLoan: false,
      onboardingCompleted: true,
    },
  },
};

function generateDemoId(prefix: string = 'demo'): string {
  const randomHex = Math.random().toString(16).substring(2, 10);
  return `${prefix}_${randomHex}`;
}

/**
 * Creates a generic demo user session with clean state for onboarding.
 */
export function createDemoSession(customProfile?: Partial<DemoUserProfile>): DemoSessionData {
  const userId = generateDemoId('demo');
  const user: DemoUser = {
    id: userId,
    email: `${userId}@demo.ruralcred.in`,
    name: 'Demo Entrepreneur',
    isDemo: true,
    authMode: 'demo',
  };

  const profile: DemoUserProfile = {
    name: 'Demo Entrepreneur',
    businessName: '',
    location: '',
    category: 'Dairy Farming',
    marginCapital: 100000,
    hasActiveLoan: false,
    simulatingSecondLoan: false,
    onboardingCompleted: false,
    ...customProfile,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DEMO_USER_ID_KEY, userId);
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('[DemoSession] localStorage write error:', e);
    }
  }

  return { user, profile };
}

/**
 * Creates a demo session initialized with a specific preset persona.
 */
export function createPresetSession(preset: 'dairy' | 'kirana' | 'weaving'): DemoSessionData {
  const template = PRESET_PROFILES[preset] || PRESET_PROFILES.dairy;
  const prefix = preset === 'dairy' ? 'demo_anita' : preset === 'kirana' ? 'demo_ramesh' : 'demo_lakshmi';
  const userId = generateDemoId(prefix);

  const user: DemoUser = {
    id: userId,
    email: template.user.email,
    name: template.user.name,
    isDemo: true,
    authMode: 'demo',
  };

  const profile: DemoUserProfile = {
    ...template.profile,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DEMO_USER_ID_KEY, userId);
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(`ruralcred_profile_${userId}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('[DemoSession] localStorage write error:', e);
    }
  }

  return { user, profile };
}

/**
 * Retrieves the active demo session from localStorage if present.
 */
export function getDemoSession(): DemoSessionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const demoId = localStorage.getItem(DEMO_USER_ID_KEY);
    if (!demoId) return null;

    let user: DemoUser | null = null;
    const rawUser = localStorage.getItem(LOCAL_AUTH_KEY);
    if (rawUser) {
      try {
        user = JSON.parse(rawUser);
      } catch {}
    }

    if (!user) {
      user = {
        id: demoId,
        email: `${demoId}@demo.ruralcred.in`,
        name: 'Demo Entrepreneur',
        isDemo: true,
        authMode: 'demo',
      };
    }

    let profile: DemoUserProfile | null = null;
    const rawProfile = localStorage.getItem(ACTIVE_PROFILE_KEY) || localStorage.getItem(`ruralcred_profile_${demoId}`);
    if (rawProfile) {
      try {
        profile = JSON.parse(rawProfile);
      } catch {}
    }

    if (!profile) {
      profile = {
        name: user.name || 'Demo Entrepreneur',
        businessName: '',
        location: '',
        category: 'Dairy Farming',
        marginCapital: 100000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
        onboardingCompleted: false,
      };
    }

    return { user, profile };
  } catch {
    return null;
  }
}

/**
 * Clears demo session markers and stored demo profiles.
 */
export function clearDemoSession(): void {
  if (typeof window === 'undefined') return;

  try {
    const demoId = localStorage.getItem(DEMO_USER_ID_KEY);
    localStorage.removeItem(DEMO_USER_ID_KEY);
    localStorage.removeItem(LOCAL_AUTH_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    if (demoId) {
      localStorage.removeItem(`ruralcred_profile_${demoId}`);
    }
  } catch (e) {
    console.warn('[DemoSession] clear error:', e);
  }
}
