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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
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
  const { signOut } = useAuth();
  const [expanded, setExpanded] = useState(['Business', 'Finances', 'Advisor', 'Opportunities']);
  const isTe = language === 'te';

  const toggle = (label: string) =>
    setExpanded((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Map label to localized label if Telugu
  const getNavLabel = (label: string) => {
    if (!isTe) return label;
    const map: Record<string, string> = {
      Overview: 'ఓవర్‌వ్యూ (Overview)',
      Business: 'వ్యాపారం (Business)',
      'Business Profile': 'వ్యాపార ప్రొఫైల్',
      'Digital Logbook': 'డిజిటల్ లాగ్‌బుక్',
      'Business Plan': 'వ్యాపార ప్రణాళిక',
      Finances: 'ఆర్థిక అంశాలు (Finances)',
      'Financial Analytics': 'ఆర్థిక విశ్లేషణ',
      'Cash Flow': 'నగదు ప్రవాహం (Cash Flow)',
      Advisor: 'సలహాదారు (Advisor)',
      'Business Advisor': 'వ్యాపార సలహాదారు (AI)',
      'Finance Advisor': 'ఆర్థిక సలహాదారు',
      Opportunities: 'అవకాశాలు (Opportunities)',
      'Scheme Matching': 'ప్రభుత్వ పథకాలు',
      'Credit Score': 'క్రెడిట్ స్కోరు',
      'Risk Alerts': 'రిస్క్ హెచ్చరికలు',
    };
    return map[label] || label;
  };

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-xs lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r bg-sidebar px-4 py-5 transition-transform lg:static lg:translate-x-0 ${
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

        <div className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.workspace}
          </p>

          {navigation.map((item) => {
            const Icon = item.icon;
            const hasItems = Boolean(item.items);
            const isActive = active === item.label || item.items?.includes(active);
            const isRiskItem = item.label === 'Risk Alerts';

            return (
              <div key={item.label}>
                <button
                  onClick={() =>
                    hasItems ? toggle(item.label) : (setActive(item.label), setOpen(false))
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    active === item.label
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : isActive
                      ? 'text-foreground font-semibold bg-muted/40'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{getNavLabel(item.label)}</span>

                  {isRiskItem && detectedRisks.length > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      {detectedRisks.length}
                    </span>
                  )}

                  {hasItems && (
                    <ChevronDown
                      className={`size-3.5 transition-transform ${
                        expanded.includes(item.label) ? '' : '-rotate-90'
                      }`}
                    />
                  )}
                </button>

                {hasItems && expanded.includes(item.label) && (
                  <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
                    {item.items?.map((child) => (
                      <button
                        key={child}
                        onClick={() => {
                          setActive(child);
                          setOpen(false);
                        }}
                        className={`rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                          active === child
                            ? 'font-semibold text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
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
              setActive('Business Profile');
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-muted/40 p-2.5 text-left transition-colors hover:bg-muted"
          >
            <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{profile.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{profile.businessName}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-3.5" />
            <span>{isTe ? 'లాగ్ అవుట్ (Logout)' : 'Sign Out'}</span>
          </button>
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
      eyebrow: 'Monday, 19 September 2026',
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
      title: isTe ? 'నగదు ప్రవాహం (Cash Flow Analytics)' : 'Cash Flow Analytics',
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
      title: isTe ? 'ఆర్థిక సలహాదారు (Finance Advisor)' : 'Deterministic Finance Advisor',
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
      title: isTe ? 'ఆర్థిక ఆరోగ్య స్కోరు (Health Score)' : 'Rule-Based Financial Health Score',
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
      eyebrow: 'Configuration',
      title: isTe ? 'సెట్టింగ్‌లు & ప్రొఫైల్' : 'Settings & Preferences',
      description: isTe ? 'భాష మరియు ఇన్‌పుట్ పద్ధతులను నిర్వహించండి.' : 'Manage language, voice preference, and rural persona.',
    },
  };

  const copy = pageCopy[active] || pageCopy.Overview;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
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
      {active === 'Financial Analytics' && <FinanceAdvisorScreen setActive={setActive} />}
      {active === 'Cash Flow' && <CashFlowScreen setActive={setActive} />}
      {active === 'Business Advisor' && <BusinessAdvisorScreen />}
      {active === 'Finance Advisor' && <FinanceAdvisorScreen setActive={setActive} />}
      {active === 'Scheme Matching' && <SchemeMatchingScreen setActive={setActive} />}
      {active === 'Credit Score' && <FinanceAdvisorScreen setActive={setActive} />}
      {active === 'Risk Alerts' && <RiskAlertsScreen />}
      {active === 'Settings' && <BusinessProfileScreen onSaved={() => setActive('Overview')} />}
    </div>
  );
}

function RuralCredAppInner() {
  const [active, setActive] = useState('Overview');
  const [open, setOpen] = useState(false);
  const { language, setLanguage, profile, detectedRisks, dictionary } = useApp();
  const { signOut } = useAuth();
  const isTe = language === 'te';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'te' : 'en');
  };

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar active={active} setActive={setActive} open={open} setOpen={setOpen} />

      <main className="min-w-0 flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-5 sm:px-8">
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
            <div className="hidden text-xs text-muted-foreground sm:flex items-center">
              <span>{dictionary.workspace}</span>
              <ChevronRight className="mx-1.5 size-3 text-muted-foreground" />
              <span className="font-semibold text-foreground">{active}</span>
            </div>
            <div className="sm:hidden">
              <Brand />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
              title="Toggle English / Telugu"
            >
              <Languages className="size-3.5 text-primary" />
              <span>{language === 'en' ? 'తెలుగు' : 'English'}</span>
            </button>

            {/* Notifications / Risk Alerts Icon */}
            <button
              onClick={() => setActive('Risk Alerts')}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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

            <div className="ml-1 hidden h-6 w-px bg-border sm:block" />

            {/* Profile CTA */}
            <button
              onClick={() => setActive('Business Profile')}
              className="hidden items-center gap-2 pl-2 text-left sm:flex hover:opacity-85 transition-opacity"
            >
              <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              <div className="text-left">
                <span className="text-xs font-semibold text-foreground block leading-tight">
                  {profile.name}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate max-w-28">
                  {profile.businessName}
                </span>
              </div>
            </button>

            {/* Logout Header Button */}
            <button
              onClick={() => signOut()}
              title={isTe ? 'లాగ్ అవుట్' : 'Sign Out'}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
              aria-label="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
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
  const { user, loading } = useAuth();
  const { hasCompletedOnboarding } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md animate-pulse mb-3">
          <span className="text-xl font-bold font-sora">R</span>
        </div>
        <p className="text-sm font-bold font-sora text-foreground">RuralCred Advisor</p>
        <p className="text-xs text-muted-foreground mt-1">Connecting to authenticated session...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingScreen />;
  }

  return <RuralCredAppInner />;
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
