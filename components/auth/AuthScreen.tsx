'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Languages,
} from 'lucide-react';

export function AuthScreen({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const { signIn, signUp, continueAsDemo, loginAsDemoUser, isConfigured } = useAuth();
  const { language, setLanguage, updateProfile, loadPreset } = useApp();
  const isTe = language === 'te';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError(
        isTe
          ? 'దయచేసి మీ ఈమెయిల్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.'
          : 'Please enter your email and password.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(cleanEmail, password);
      if (res.error) {
        if (
          res.error.toLowerCase().includes('invalid login credentials') ||
          res.error.toLowerCase().includes('invalid')
        ) {
          setError(isTe ? 'చెల్లని ఈమెయిల్ లేదా పాస్‌వర్డ్.' : 'Invalid email or password.');
        } else {
          setError(res.error);
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      onAuthenticated?.();
    } catch (err: any) {
      setError(err?.message || (isTe ? 'లాగిన్ విఫలమైంది.' : 'Login failed. Please try again.'));
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError(
        isTe
          ? 'దయచేసి అన్ని అవసరమైన వివరాలను నమోదు చేయండి.'
          : 'Please fill in all required fields.'
      );
      return;
    }

    if (password.length < 6) {
      setError(isTe ? 'పాస్‌వర్డ్ కనీసం 6 అక్షరాలు ఉండాలి.' : 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError(isTe ? 'పాస్‌వర్డ్‌లు సరిపోలడం లేదు.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUp(cleanEmail, password, name);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setLoading(false);
      onAuthenticated?.();
    } catch (err: any) {
      setError(err?.message || (isTe ? 'ఖాతా నమోదు విఫలమైంది.' : 'Registration failed.'));
      setLoading(false);
    }
  };

  const handleContinueAsDemo = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      continueAsDemo();
      updateProfile({
        name: 'Demo Entrepreneur',
        businessName: '',
        location: '',
        category: 'Dairy Farming',
        marginCapital: 100000,
        hasActiveLoan: false,
        simulatingSecondLoan: false,
        onboardingCompleted: false,
      });
      onAuthenticated?.();
    } catch (err) {
      console.error('[AuthScreen] Demo session start error:', err);
      setError(
        isTe
          ? 'డెమో సెషన్ ప్రారంభించడం విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.'
          : 'Unable to start demo session. Please try again.'
      );
    }
  };

  const handlePersonaDemo = async (persona: 'dairy' | 'kirana' | 'weaving', e?: React.MouseEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      await loginAsDemoUser(persona);
      loadPreset(persona);
      onAuthenticated?.();
    } catch (err) {
      console.error('[AuthScreen] Preset load error:', err);
      setError(
        isTe
          ? 'డెమో ప్రొఫైల్ లోడ్ చేయడం విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.'
          : 'Unable to load demo preset. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Top Language Selector */}
      <div className="absolute top-6 right-6 flex items-center rounded-lg border bg-card p-0.5 text-xs font-semibold shadow-xs">
        {(['en', 'te', 'hi'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLanguage(l)}
            className={`px-2 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
              language === l
                ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={l === 'en' ? 'English' : l === 'te' ? 'Telugu' : 'Hindi'}
          >
            {l === 'en' ? 'EN' : l === 'te' ? 'తె' : 'हि'}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-3">
            <span className="text-2xl font-bold font-sora">R</span>
          </div>
          <h1 className="text-2xl font-bold font-sora tracking-tight text-foreground">
            RuralCred Advisor
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {mode === 'login'
              ? isTe
                ? 'తిరిగి స్వాగతం'
                : 'Welcome back'
              : isTe
              ? 'కొత్త ఖాతాను సృష్టించండి'
              : 'Create your account'}
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive leading-relaxed font-medium">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'ఈమెయిల్' : 'Email'}
                </label>
                <div className="relative mt-1">
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="entrepreneur@ruralcred.in"
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'పాస్‌వర్డ్' : 'Password'}
                </label>
                <div className="relative mt-1">
                  <Lock className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border bg-background pl-9 pr-10 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* [ Login ] Button */}
              <Button type="submit" disabled={loading} className="w-full mt-1 font-semibold cursor-pointer" size="lg">
                {loading
                  ? isTe
                    ? 'సైన్ ఇన్ అవుతోంది...'
                    : 'Signing in...'
                  : isTe
                  ? 'లాగిన్'
                  : 'Login'}
              </Button>

              {/* OR Divider */}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-semibold">
                    {isTe ? 'లేదా' : 'OR'}
                  </span>
                </div>
              </div>

              {/* [ Continue as Demo User ] Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleContinueAsDemo}
                className="w-full h-11 font-semibold gap-2 border-primary/30 hover:bg-primary/5 hover:border-primary text-primary cursor-pointer shadow-xs"
              >
                <Sparkles className="size-4 text-primary pointer-events-none" />
                <span className="pointer-events-none">{isTe ? 'డెమో వినియోగదారుగా కొనసాగండి' : 'Continue as Demo User'}</span>
              </Button>

              {/* Switch to Register */}
              <div className="text-center text-xs text-muted-foreground pt-2">
                <span>{isTe ? 'ఖాతా లేదా? ' : "Don't have an account? "}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode('register');
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline ml-1 cursor-pointer"
                >
                  {isTe ? 'ఖాతా సృష్టించండి' : 'Create Account'}
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'పూర్తి పేరు (ఐచ్ఛికం)' : 'Full Name (Optional)'}
                </label>
                <div className="relative mt-1">
                  <User className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Anita Sharma"
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'ఈమెయిల్' : 'Email'}
                </label>
                <div className="relative mt-1">
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="entrepreneur@ruralcred.in"
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'పాస్‌వర్డ్' : 'Password'}
                </label>
                <div className="relative mt-1">
                  <Lock className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border bg-background pl-9 pr-10 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'పాస్‌వర్డ్ నిర్ధారించండి' : 'Confirm Password'}
                </label>
                <div className="relative mt-1">
                  <Lock className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* [ Create Account ] Button */}
              <Button type="submit" disabled={loading} className="w-full mt-1 font-semibold cursor-pointer" size="lg">
                {loading
                  ? isTe
                    ? 'ఖాతా సృష్టిస్తోంది...'
                    : 'Creating account...'
                  : isTe
                  ? 'ఖాతా సృష్టించండి'
                  : 'Create Account'}
              </Button>

              {/* OR Divider */}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-semibold">
                    {isTe ? 'లేదా' : 'OR'}
                  </span>
                </div>
              </div>

              {/* [ Continue as Demo User ] Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleContinueAsDemo}
                className="w-full h-11 font-semibold gap-2 border-primary/30 hover:bg-primary/5 hover:border-primary text-primary cursor-pointer shadow-xs"
              >
                <Sparkles className="size-4 text-primary pointer-events-none" />
                <span className="pointer-events-none">{isTe ? 'డెమో వినియోగదారుగా కొనసాగండి' : 'Continue as Demo User'}</span>
              </Button>

              {/* Switch to Login */}
              <div className="text-center text-xs text-muted-foreground pt-2">
                <span>{isTe ? 'ఇప్పటికే ఖాతా ఉందా? ' : 'Already have an account? '}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline ml-1 cursor-pointer"
                >
                  {isTe ? 'లాగిన్ అవ్వండి' : 'Login'}
                </button>
              </div>
            </form>
          )}

          {/* Quick 1-Click Evaluator Presets for Hackathon Judges */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {isTe ? '1-క్లిక్ జడ్జ్ ప్రొఫైల్స్' : '1-Click Evaluator Presets'}
              </span>
              <span className="text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                {isTe ? 'తక్షణ ప్రవేశం' : 'Instant Access'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={(e) => handlePersonaDemo('dairy', e)}
                className="p-2 rounded-lg border bg-background/60 hover:bg-primary/5 hover:border-primary/40 text-center transition-all cursor-pointer select-none"
              >
                <p className="text-[11px] font-semibold text-foreground pointer-events-none">Anita S.</p>
                <p className="text-[9px] text-muted-foreground pointer-events-none">{isTe ? 'పాడి (₹1.5ల)' : 'Dairy (₹1.5L)'}</p>
              </button>
              <button
                type="button"
                onClick={(e) => handlePersonaDemo('kirana', e)}
                className="p-2 rounded-lg border bg-background/60 hover:bg-primary/5 hover:border-primary/40 text-center transition-all cursor-pointer select-none"
              >
                <p className="text-[11px] font-semibold text-foreground pointer-events-none">Ramesh K.</p>
                <p className="text-[9px] text-muted-foreground pointer-events-none">{isTe ? 'కిరాణా (₹50వే)' : 'Kirana (₹50k)'}</p>
              </button>
              <button
                type="button"
                onClick={(e) => handlePersonaDemo('weaving', e)}
                className="p-2 rounded-lg border bg-background/60 hover:bg-primary/5 hover:border-primary/40 text-center transition-all cursor-pointer select-none"
              >
                <p className="text-[11px] font-semibold text-foreground pointer-events-none">Lakshmi D.</p>
                <p className="text-[9px] text-muted-foreground pointer-events-none">{isTe ? 'చేనేత (₹30వే)' : 'Weaver (₹30k)'}</p>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t text-center flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 pointer-events-none" />
            <span className="pointer-events-none">
              {isConfigured ? (isTe ? 'సురక్షితమైన సుపాబేస్ లాగిన్' : 'Secured by Supabase Auth') : (isTe ? 'లోకల్ డెమో లాగిన్ సిద్ధం' : 'Local Demo Auth Ready')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
