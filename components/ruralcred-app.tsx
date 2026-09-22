'use client';

import { useState } from 'react';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileBarChart,
  FileText,
  Languages,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
  Mic,
  LogOut,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomCursor } from '@/components/ui/custom-cursor';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthScreen } from './auth/AuthScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { BusinessProfileScreen } from './screens/BusinessProfileScreen';
import { FinanceAdvisorScreen } from './screens/FinanceAdvisorScreen';
import { DigitalLogbookScreen } from './screens/DigitalLogbookScreen';
import { CashFlowScreen } from './screens/CashFlowScreen';
import { BusinessAdvisorScreen } from './screens/BusinessAdvisorScreen';
import { RiskAlertsScreen } from './screens/RiskAlertsScreen';
import { BusinessPlanScreen } from './screens/BusinessPlanScreen';
import { SchemeMatchingScreen } from './screens/SchemeMatchingScreen';
import { FinancialAnalyticsScreen } from './screens/FinancialAnalyticsScreen';
import { CreditScoreScreen } from './screens/CreditScoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './onboarding/OnboardingScreen';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Business', icon: BriefcaseBusiness, items: ['Business Profile', 'Digital Logbook', 'Business Plan'] },
  { label: 'Finances', icon: WalletCards, items: ['Financial Analytics', 'Cash Flow'] },
  { label: 'Advisor', icon: Sparkles, items: ['Business Advisor', 'Finance Advisor'] },
  { label: 'Opportunities', icon: FileText, items: ['Scheme Matching', 'Credit Score'] },
  { label: 'Risk Alerts', icon: ShieldAlert },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 group cursor-pointer">
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform duration-200 group-hover:scale-105">
        <span className="text-lg font-bold font-sora">R</span>
      </div>
      <div>
        <p className="font-bold leading-none tracking-tight font-sora text-foreground">RuralCred</p>
        <p className="mt-1 text-[10px] uppercase font-semibold tracking-[0.18em] text-muted-foreground">
          Advisor
        </p>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  setActive,
  open,
  setOpen,
}: {
  active: string;
  setActive: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const { profile, language, detectedRisks, dictionary } = useApp();
  const { signOut, exitDemo, isDemo } = useAuth();
  const [expanded, setExpanded] = useState(['Business', 'Finances', 'Advisor', 'Opportunities']);
  const isTe = language === 'te';

  const toggle = (label: string) =>
    setExpanded((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );

  const initials = (profile?.name || 'Anita Sharma')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AS';

  // Map label to localized label if Telugu
  const getNavLabel = (label: string) => {
    if (!isTe) return label;
    const map: Record<string, string> = {
      Overview: 'ముఖ్యాంశాలు',
      Business: 'వ్యాపారం',
      'Business Profile': 'వ్యాపార ప్రొఫైల్',
      'Digital Logbook': 'డిజిటల్ లాగ్‌బుక్',
      'Business Plan': 'వ్యాపార ప్రణాళిక',
      Finances: 'ఆర్థిక అంశాలు',
      'Financial Analytics': 'ఆర్థిక విశ్లేషణ',
      'Cash Flow': 'నగదు ప్రవాహం',
      Advisor: 'సలహాదారు',
      'Business Advisor': 'వ్యాపార సలహాదారు',
      'Finance Advisor': 'ఆర్థిక సలహాదారు',
      Opportunities: 'అవకాశాలు',
      'Scheme Matching': 'ప్రభుత్వ పథకాలు',
      'Credit Score': 'క్రెడిట్ స్కోరు',
      'Risk Alerts': 'రిస్క్ హెచ్చరికలు',
      Settings: 'సెట్టింగ్‌లు',
    };
    return map[label] || label;
  };

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r bg-sidebar px-4 py-5 transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <div className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.workspace}
          </p>

          {navigation.map((item) => {
            const Icon = item.icon;
            const hasItems = Boolean(item.items);
            const isActive = active === item.label || item.items?.includes(active);
            const isRiskItem = item.label === 'Risk Alerts';

            return (
              <div key={item.label} className="transition-all duration-150">
                <button
                  onClick={() =>
                    hasItems ? toggle(item.label) : (setActive(item.label), setOpen(false))
                  }
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all duration-150 cursor-pointer ${
                    active === item.label
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : isActive
                      ? 'text-foreground font-semibold bg-muted/50'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                  <span className="flex-1 truncate">{getNavLabel(item.label)}</span>

                  {isRiskItem && detectedRisks.length > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
                      {detectedRisks.length}
                    </span>
                  )}

                  {hasItems && (
                    <ChevronDown
                      className={`size-3.5 transition-transform duration-200 ${
                        expanded.includes(item.label) ? '' : '-rotate-90'
                      }`}
                    />
                  )}
                </button>

                {hasItems && expanded.includes(item.label) && (
                  <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-border/80 pl-3 transition-all duration-200">
                    {item.items?.map((child) => (
                      <button
                        key={child}
                        onClick={() => {
                          setActive(child);
                          setOpen(false);
                        }}
                        className={`rounded-md px-2.5 py-1.5 text-left text-xs transition-all duration-150 cursor-pointer ${
                          active === child
                            ? 'font-semibold text-primary bg-primary/10 shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {getNavLabel(child)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Card & Sign Out at Bottom */}
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              setActive('Settings');
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer ${
              active === 'Settings'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings className="size-4 shrink-0" />
            <span className="flex-1 text-left">{isTe ? 'సెట్టింగ్‌లు' : 'Settings'}</span>
          </button>

          <button
            onClick={() => {
              setActive('Business Profile');
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-muted/40 p-2.5 text-left transition-all duration-150 hover:bg-muted hover:shadow-2xs cursor-pointer"
          >
            <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{profile.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{profile.businessName}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>

          {isDemo ? (
            <button
              type="button"
              onClick={() => exitDemo()}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-150 cursor-pointer active:scale-[0.98]"
            >
              <LogOut className="size-3.5" />
              <span>{isTe ? 'డెమో ముగించు' : 'Exit Demo'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer active:scale-[0.98]"
            >
              <LogOut className="size-3.5" />
              <span>{isTe ? 'లాగ్ అవుట్' : 'Sign Out'}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function MainContent({ active, setActive }: { active: string; setActive: (value: string) => void }) {
  const { profile, language, detectedRisks, dictionary } = useApp();
  const isTe = language === 'te';

  const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
    Overview: {
      eyebrow: new Date().toLocaleDateString(isTe ? 'te-IN' : 'en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      title: isTe ? `నమస్కారం, ${profile.name}` : `Good morning, ${profile.name}`,
      description: isTe
        ? 'మీ గ్రామీణ వ్యాపారం యొక్క సమగ్ర ఆర్థిక స్థితి మరియు మార్కెట్ అవకాశాల సమాచారం.'
        : "Here's a clear, grounded view of how your rural enterprise is performing today.",
    },
    'Business Profile': {
      eyebrow: dictionary.onboarding.title,
      title: isTe ? 'వ్యాపార ప్రొఫైల్ & వివరాలు' : 'Business Profile & Onboarding',
      description: isTe
        ? 'మీ వ్యాపార స్థలం, రంగం మరియు పెట్టుబడి వివరాలను సరిచూసుకోండి.'
        : 'Keep your location, category, and margin capital current to structure tailored loans.',
    },
    'Digital Logbook': {
      eyebrow: dictionary.logbook.title,
      title: isTe ? 'డిజిటల్ లాగ్‌బుక్ & లెడ్జర్' : 'Digital Logbook & Ledger',
      description: isTe
        ? 'రోజువారీ ఆదాయం మరియు ఖర్చులను రికార్డు చేసి రుణ అర్హతను పెంచుకోండి.'
        : 'A simple, reliable record of your daily business transactions with voice & manual inputs.',
    },
    'Business Plan': {
      eyebrow: dictionary.businessPlan.title,
      title: isTe ? 'బ్యాంక్-సిద్ధ వ్యాపార ప్రణాళిక' : 'Bank-Ready Business Plan',
      description: isTe
        ? 'ఆర్థిక గణాంకాలు మరియు మార్కెట్ సలహాను కలిపి తయారుచేసిన ప్రణాళిక.'
        : 'Consolidated proposal synthesizing deterministic finance and local market advisory.',
    },
    'Financial Analytics': {
      eyebrow: dictionary.finance.title,
      title: isTe ? 'ఆర్థిక విశ్లేషణ & త్రైమాసిక వాయిదాలు' : 'Financial Analytics & Amortization',
      description: isTe
        ? 'నియమాధారిత ప్రాజెక్ట్ వ్యయం, రుణ అర్హత మరియు మారటోరియం గణాంకాలు.'
        : 'Transparent deterministic loan structuring, EMI calculations, and health score.',
    },
    'Cash Flow': {
      eyebrow: dictionary.logbook.netCashFlow,
      title: isTe ? 'నగదు ప్రవాహ విశ్లేషణ' : 'Cash Flow Analytics',
      description: isTe
        ? 'నగదు నిల్వలు, రాబడులు మరియు వ్యయాల సమగ్ర పర్యవేక్షణ.'
        : 'Monitor incoming revenue, operational outflows, and liquid reserves.',
    },
    'Business Advisor': {
      eyebrow: dictionary.businessAdvisor.title,
      title: isTe ? 'స్థానిక AI వ్యాపార సలహాదారు' : 'Grounded AI Business Advisor',
      description: isTe
        ? 'జిల్లా స్థాయి బెంచ్‌మార్క్‌లు, మార్కెట్ గిరాకీ మరియు SWOT విశ్లేషణ.'
        : 'Hyper-local business intelligence grounded in authentic rural district benchmarks.',
    },
    'Finance Advisor': {
      eyebrow: dictionary.finance.title,
      title: isTe ? 'ఆర్థిక సలహాదారు' : 'Deterministic Finance Advisor',
      description: isTe
        ? 'ఖచ్చితమైన ప్రభుత్వ నిబంధనల ప్రకారం రుణం, వడ్డీ మరియు వాయిదాల ప్రణాళిక.'
        : 'Standard government guidelines applied with zero hallucination. 100% deterministic math.',
    },
    'Scheme Matching': {
      eyebrow: dictionary.nav.schemeMatching,
      title: isTe ? 'ప్రభుత్వ పథకాల సరిపోలిక' : 'Government Scheme Matching',
      description: isTe
        ? 'NBCFDC, MUDRA మరియు ఇతర అధికారిక రుణ పథకాల పూర్తి వివరాలు.'
        : 'Explore authentic statutory credit schemes matching your capital and business profile.',
    },
    'Credit Score': {
      eyebrow: dictionary.finance.healthScoreTitle,
      title: isTe ? 'ఆర్థిక ఆరోగ్య స్కోరు' : 'Rule-Based Financial Health Score',
      description: isTe
        ? 'లాగ్‌బుక్ రికార్డులు, లాభాల మార్జిన్ ఆధారంగా పారదర్శక 0–100 స్కోరు.'
        : 'Transparent 0–100 business scoring with explicit weights (No black-box ML).',
    },
    'Risk Alerts': {
      eyebrow: dictionary.risk.title,
      title: isTe ? 'రిస్క్ హెచ్చరికలు & AI పరిష్కారాలు' : 'Risk Alerts & Safeguards',
      description: isTe
        ? 'నియమాధారిత ఆర్థిక రిస్కుల గుర్తింపు మరియు తగిన చర్యల ప్రణాళిక.'
        : 'Deterministic invariant rule evaluation with friendly, localized action steps.',
    },
    Settings: {
      eyebrow: isTe ? 'కాన్ఫిగరేషన్' : 'Configuration',
      title: isTe ? 'సెట్టింగ్‌లు & ప్రొఫైల్' : 'Settings & Preferences',
      description: isTe ? 'భాష మరియు ఇన్‌పుట్ పద్ధతులను నిర్వహించండి.' : 'Manage language, voice preference, and rural persona.',
    },
  };

  const copy = pageCopy[active] || pageCopy.Overview;

  return (
    <div key={active} className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
      {/* Page Header */}
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold font-sora tracking-tight text-foreground">{copy.title}</h1>
        <p className="mt-1.5 max-w-2xl text-xs text-muted-foreground leading-relaxed">
          {copy.description}
        </p>
      </div>

      {/* Screen Router */}
      {active === 'Overview' && <OverviewScreen setActive={setActive} />}
      {active === 'Business Profile' && (
        <BusinessProfileScreen onSaved={() => setActive('Finance Advisor')} />
      )}
      {active === 'Digital Logbook' && <DigitalLogbookScreen />}
      {active === 'Business Plan' && <BusinessPlanScreen />}
      {active === 'Financial Analytics' && <FinancialAnalyticsScreen setActive={setActive} />}
      {active === 'Cash Flow' && <CashFlowScreen setActive={setActive} />}
      {active === 'Business Advisor' && <BusinessAdvisorScreen />}
      {active === 'Finance Advisor' && <FinanceAdvisorScreen setActive={setActive} />}
      {active === 'Scheme Matching' && <SchemeMatchingScreen setActive={setActive} />}
      {active === 'Credit Score' && <CreditScoreScreen setActive={setActive} />}
      {active === 'Risk Alerts' && <RiskAlertsScreen />}
      {active === 'Settings' && <SettingsScreen setActive={setActive} />}
    </div>
  );
}

function RuralCredAppInner() {
  const [active, setActive] = useState('Overview');
  const [open, setOpen] = useState(false);
  const {
    language,
    setLanguage,
    profile,
    detectedRisks,
    dictionary,
    backendMode,
    backendLoading,
    refreshBackendData,
  } = useApp();
  const { signOut, exitDemo, isDemo } = useAuth();
  const isTe = language === 'te';

  const initials = (profile?.name || 'Anita Sharma')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AS';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return isTe ? 'శుభోదయం' : 'Good morning';
    if (hour < 17) return isTe ? 'శుభ మధ్యాహ్నం' : 'Good afternoon';
    return isTe ? 'శుభ సాయంత్రం' : 'Good evening';
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar active={active} setActive={setActive} open={open} setOpen={setOpen} />

      <main className="min-w-0 flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 backdrop-blur-md px-5 sm:px-8 transition-colors">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
            <div className="hidden text-xs text-muted-foreground sm:flex items-center gap-2">
              <span className="font-medium text-foreground">{getGreeting()}, {(profile?.name || 'Anita Sharma').split(' ')[0]}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="truncate max-w-44 text-muted-foreground">{profile?.businessName || 'Rural Enterprise'}</span>
              {profile.location && (
                <span className="hidden md:inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border/60">
                  {profile.location}
                </span>
              )}
            </div>
            <div className="sm:hidden">
              <Brand />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* FastAPI Backend Connection Mode Indicator */}
            {backendMode === 'backend' ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 shadow-2xs transition-all"
                title="FastAPI Backend Live: Using Python server as source of truth"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden md:inline">FastAPI Live</span>
                <span className="md:hidden">FastAPI</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] font-semibold border border-amber-500/20 shadow-2xs transition-all"
                title="Offline / Local Calculation Mode: FastAPI server unreachable. Resilient local engine active."
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                <span className="hidden md:inline">{isTe ? 'ఆఫ్‌లైన్ మోడ్' : 'Offline Mode'}</span>
                <span className="md:hidden">Local</span>
                <button
                  type="button"
                  onClick={() => refreshBackendData()}
                  className="ml-0.5 text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer p-0.5 transition-transform active:scale-90"
                  title="Retry FastAPI connection"
                  disabled={backendLoading}
                >
                  <RefreshCw className={`size-2.5 ${backendLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Demo Mode Indicator */}
            {isDemo && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-semibold border border-amber-500/20 shadow-2xs">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Demo Mode</span>
              </div>
            )}

            {/* Multilingual Selector (English, Telugu) */}
            <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs font-semibold shadow-2xs">
              {(['en', 'te'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`px-2 py-1 rounded-md text-[11px] transition-all duration-150 cursor-pointer ${
                    language === l
                      ? 'bg-primary text-primary-foreground shadow-2xs font-bold scale-100'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  }`}
                  title={l === 'en' ? 'English' : 'Telugu (తెలుగు)'}
                >
                  {l === 'en' ? 'EN' : 'తె'}
                </button>
              ))}
            </div>

            {/* Notifications / Risk Alerts Icon */}
            <button
              onClick={() => setActive('Risk Alerts')}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer active:scale-95"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {detectedRisks.length > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-rose-600"></span>
                </span>
              )}
            </button>

            {/* Settings Quick Access Icon */}
            <button
              onClick={() => setActive('Settings')}
              className={`p-2 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${
                active === 'Settings'
                  ? 'text-primary bg-primary/10 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              aria-label="Settings"
              title={isTe ? 'సెట్టింగ్‌లు' : 'Settings'}
            >
              <Settings className="size-4" />
            </button>

            <div className="ml-1 hidden h-6 w-px bg-border sm:block" />

            {/* Profile CTA */}
            <button
              onClick={() => setActive('Business Profile')}
              className="hidden items-center gap-2 pl-2 text-left sm:flex hover:opacity-85 transition-all duration-150 cursor-pointer group"
            >
              <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-2xs transition-transform duration-150 group-hover:scale-105">
                {initials}
              </div>
              <div className="text-left">
                <span className="text-xs font-semibold text-foreground block leading-tight">
                  {profile?.name || 'Anita Sharma'}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate max-w-28">
                  {profile?.businessName || 'Sharma Dairy Farm'}
                </span>
              </div>
            </button>

            {/* Logout / Exit Demo Header Button */}
            {isDemo ? (
              <button
                onClick={() => exitDemo()}
                title={isTe ? 'డెమో నుండి నిష్క్రమించండి' : 'Exit Demo'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-150 ml-1 border border-amber-500/20 shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">{isTe ? 'డెమో ముగించు' : 'Exit Demo'}</span>
              </button>
            ) : (
              <button
                onClick={() => signOut()}
                title={isTe ? 'లాగ్ అవుట్' : 'Sign Out'}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 ml-1 cursor-pointer active:scale-95"
                aria-label="Sign Out"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1">
          <MainContent active={active} setActive={setActive} />
        </div>
      </main>
    </div>
  );
}

function RuralCredAppGate() {
  const { user } = useAuth();
  const { hasCompletedOnboarding, updateProfile } = useApp();

  return (
    <>
      <CustomCursor />
      {user ? (
        !hasCompletedOnboarding ? (
          <OnboardingScreen onComplete={() => updateProfile({ onboardingCompleted: true })} />
        ) : (
          <RuralCredAppInner />
        )
      ) : (
        <AuthScreen />
      )}
    </>
  );
}

export function RuralCredApp() {
  return (
    <AuthProvider>
      <AppProvider>
        <RuralCredAppGate />
      </AppProvider>
    </AuthProvider>
  );
}

export default RuralCredApp;
