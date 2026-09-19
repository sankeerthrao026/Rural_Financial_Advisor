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
  CheckCircle2,
  ArrowRight,
  Building2,
} from 'lucide-react';

export function AuthScreen({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated?: () => void;
  onBack?: () => void;
}) {
  const { signIn, signUp, loginAsDemoUser, isConfigured } = useAuth();
  const { language, setLanguage } = useApp();
  const isTe = language === 'te';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
    } else {
      if (password.length < 6) {
        setError(isTe ? 'పాస్‌వర్డ్ కనీసం 6 అక్షరాలు ఉండాలి' : 'Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const res = await signUp(email, password, name);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onAuthenticated?.();
  };

  const handleDemoLogin = async (persona: 'dairy' | 'kirana' | 'weaving') => {
    setLoading(true);
    await loginAsDemoUser(persona);
    setLoading(false);
    onAuthenticated?.();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      {/* Top Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
        >
          <Languages className="size-3.5 text-primary" />
          <span>{language === 'en' ? 'తెలుగు (Telugu)' : 'English'}</span>
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
          >
            <span>← {isTe ? 'డెమో హోమ్‌కి తిరిగి వెళ్ళండి' : 'Back to Demo Entry'}</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-3">
            <span className="text-2xl font-bold font-sora">R</span>
          </div>
          <h1 className="text-2xl font-bold font-sora tracking-tight text-foreground">
            RuralCred Advisor
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {isTe
              ? 'గ్రామీణ సూక్ష్మ వ్యాపార సలహా మరియు అధికారిక ఆర్థిక నిర్మాణ వేదిక'
              : 'AI-Driven Hyper-Local Business Advisory & Financial Structuring'}
          </p>
        </div>

        {/* 1-Click Judge/Evaluator Quick Login Banner */}
        <div className="rounded-2xl border border-amber-200/80 bg-accent/50 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
            <Sparkles className="size-4 text-amber-700" />
            <span>{isTe ? 'హ్యాకథాన్ తక్షణ లాగిన్ (Judge Quick Access)' : 'Hackathon Quick Access Personas'}</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-900/80">
            {isTe
              ? 'ప్రతి ప్రొఫైల్ వేర్వేరు ఖాతా మరియు లాగ్‌బుక్ రికార్డులను కలిగి ఉంటుంది:'
              : 'Test user isolation with isolated Firestore logbooks and loan profiles:'}
          </p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleDemoLogin('dairy')}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span>Anita Sharma — Dairy Farmer (Warangal)</span>
              <ArrowRight className="size-3.5 opacity-60" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('kirana')}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span>Ramesh Kumar — Kirana Store (Karimnagar)</span>
              <ArrowRight className="size-3.5 opacity-60" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('weaving')}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
            >
              <span>Lakshmi Devi — Handloom Weaver (Nalgonda)</span>
              <ArrowRight className="size-3.5 opacity-60" />
            </button>
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs">
          {/* Tabs: Sign In / Register */}
          <div className="flex rounded-lg border p-1 bg-muted/40 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isTe ? 'లాగిన్ (Sign In)' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isTe ? 'కొత్త ఖాతా (Register)' : 'Create Account'}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isTe ? 'పూర్తి పేరు' : 'Full Name'}
                </label>
                <div className="relative mt-1">
                  <User className="size-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Anita Sharma"
                    required
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {isTe ? 'ఈమెయిల్ చిరునామా' : 'Email Address'}
              </label>
              <div className="relative mt-1">
                <Mail className="size-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="entrepreneur@ruralcred.in"
                  required
                  className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {isTe ? 'పాస్‌వర్డ్' : 'Password'}
              </label>
              <div className="relative mt-1">
                <Lock className="size-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border bg-background pl-9 pr-10 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2 font-semibold" size="lg">
              {loading ? (
                <span>{isTe ? 'ధృవీకరిస్తున్నాము...' : 'Authenticating...'}</span>
              ) : mode === 'login' ? (
                <span>{isTe ? 'లాగిన్ అవ్వండి' : 'Sign In to RuralCred'}</span>
              ) : (
                <span>{isTe ? 'ఖాతా సృష్టించండి' : 'Create RuralCred Account'}</span>
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t text-center flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>
              {isConfigured ? 'Secured by Supabase Auth' : 'Local Auth Fallback Active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
