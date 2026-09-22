'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Language } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { exportTransactionsToCsv, exportTransactionsToPdf } from '@/lib/export/logbook-export';
import {
  Settings,
  Languages,
  Bell,
  RefreshCw,
  Database,
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Cpu,
  Trash2,
  Check,
  IndianRupee,
} from 'lucide-react';

export function SettingsScreen({ setActive }: { setActive?: (value: string) => void }) {
  const {
    language,
    setLanguage,
    inputMode,
    setInputMode,
    backendMode,
    isBackendOnline,
    backendLoading,
    refreshBackendData,
    profile,
    entries,
  } = useApp();

  const isTe = language === 'te';
  const isHi = language === 'hi';

  // Notification Preferences State (Persisted in localStorage)
  const [notifications, setNotifications] = useState({
    smsAlerts: true,
    whatsappWeekly: true,
    repaymentReminders: true,
    schemeUpdates: true,
  });

  const [savedNotificationBanner, setSavedNotificationBanner] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ruralcred_notifications_config');
      if (stored) {
        try {
          setNotifications(JSON.parse(stored));
        } catch {}
      }
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  const toggleNotification = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ruralcred_notifications_config', JSON.stringify(updated));
    }
    setSavedNotificationBanner(true);
    setTimeout(() => setSavedNotificationBanner(false), 2000);
  };

  const handleManualSync = async () => {
    await refreshBackendData();
    setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleExportAllCsv = () => {
    exportTransactionsToCsv(entries, `RuralCred_Logbook_Full_Export.csv`);
  };

  const handleExportPdfStatement = () => {
    exportTransactionsToPdf(entries, {
      enterpriseName: profile.businessName || 'Rural Micro Enterprise',
      entrepreneurName: profile.name || 'Proprietor',
      location: profile.location || 'Warangal, Telangana',
      dateRangeLabel: 'All Records',
    });
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      const confirmClear = window.confirm(
        isTe
          ? 'మీ స్థానిక కాష్‌ని క్లియర్ చేయాలనుకుంటున్నారా? ప్రొఫైల్ వివరాలు డిఫాల్ట్‌కి రీసెట్ చేయబడతాయి.'
          : 'Are you sure you want to clear your local cache? Saved session preferences will be reset.'
      );
      if (confirmClear) {
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-lift stagger-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
              <Settings className="size-3.5" />
              {isTe ? 'సిస్టమ్ సెట్టింగ్‌లు' : 'System Settings & Preferences'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold font-sora tracking-tight text-foreground">
            {isTe ? 'సెట్టింగ్‌లు & కాన్ఫిగరేషన్' : 'Settings & Preferences'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {isTe
              ? 'భాష, నోటిఫికేషన్‌లు, బ్యాకెండ్ కనెక్షన్ మరియు డేటా బ్యాకప్‌లను నిర్వహించండి.'
              : 'Manage application language, SMS/WhatsApp alert preferences, backend sync status, and data exports.'}
          </p>
        </div>
      </div>

      {/* 1. Language & Input Mode Selection */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs card-lift stagger-2">
        <div className="pb-3 border-b flex items-center gap-2">
          <Languages className="size-4 text-primary" />
          <h3 className="font-bold font-sora text-base text-foreground">
            {isTe ? '1. భాష ఎంపిక' : '1. Language & Regional Dialect'}
          </h3>
        </div>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isTe
            ? 'మీకు అనుకూలమైన భాషను ఎంచుకోండి. యాప్ ఇంటర్‌ఫేస్ మరియు వాయిస్ ఆదేశాలు ఈ భాషకు అనుగుణంగా మారతాయి.'
            : 'Select your preferred language. The user interface, voice recognition, and advisory outputs will match your choice.'}
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {/* English */}
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-4 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
              language === 'en'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-muted/30 hover:bg-muted text-muted-foreground border-border'
            }`}
          >
            <div>
              <p className="text-sm font-semibold">English</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Indian English (en-IN)</p>
            </div>
            {language === 'en' && <Check className="size-4 text-primary" />}
          </button>

          {/* Telugu */}
          <button
            type="button"
            onClick={() => setLanguage('te')}
            className={`p-4 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
              language === 'te'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-muted/30 hover:bg-muted text-muted-foreground border-border'
            }`}
          >
            <div>
              <p className="text-sm font-semibold font-sora">తెలుగు</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Telangana & AP (te-IN)</p>
            </div>
            {language === 'te' && <Check className="size-4 text-primary" />}
          </button>
        </div>

        {/* Input Mode Preference */}
        <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-foreground block">
              {isTe ? 'ప్రాధాన్య ఇన్‌పుట్ పద్ధతి:' : 'Default Input Method:'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isTe ? 'కీబోర్డ్ టైపింగ్ లేదా మైక్రోఫోన్ వాయిస్ ఆదేశాలు' : 'Keyboard typing or speech recognition mode'}
            </span>
          </div>

          <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                inputMode === 'text' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              {isTe ? 'టెక్స్ట్' : 'Text Entry'}
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                inputMode === 'voice' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              {isTe ? 'వాయిస్' : 'Voice First'}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Currency Display Preference */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs card-lift stagger-3">
        <div className="pb-3 border-b flex items-center gap-2">
          <IndianRupee className="size-4 text-primary" />
          <h3 className="font-bold font-sora text-base text-foreground">
            {isTe ? '2. కరెన్సీ ప్రదర్శన' : '2. Currency & Numbering Format'}
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4 bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground">Indian Rupee (INR — ₹)</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Indian Lakhs & Crores grouping system (e.g. ₹10,00,000)
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold px-2 py-0.5">
              Active Standard
            </span>
          </div>

          <div className="rounded-xl border p-4 bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground">Amortization Frequency</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quarterly (Agricultural Crop Cycle) & Monthly EMI
              </p>
            </div>
            <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
              Enabled
            </span>
          </div>
        </div>
      </section>

      {/* 3. Notification Preferences */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs card-lift stagger-4">
        <div className="pb-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? '3. అలర్ట్‌లు & నోటిఫికేషన్లు' : '3. Notification & Repayment Alerts'}
            </h3>
          </div>
          {savedNotificationBanner && (
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold animate-in fade-in">
              ✓ Preferences Saved
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div
            onClick={() => toggleNotification('smsAlerts')}
            className="rounded-xl border p-3.5 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-foreground block">SMS Transaction Confirmations</span>
              <span className="text-[11px] text-muted-foreground">Instant SMS for recorded ledger receipts</span>
            </div>
            <input
              type="checkbox"
              checked={notifications.smsAlerts}
              onChange={() => {}}
              className="size-4 accent-primary cursor-pointer"
            />
          </div>

          <div
            onClick={() => toggleNotification('whatsappWeekly')}
            className="rounded-xl border p-3.5 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-foreground block">WhatsApp Weekly Ledger Summary</span>
              <span className="text-[11px] text-muted-foreground">Weekly balance & profit reports on WhatsApp</span>
            </div>
            <input
              type="checkbox"
              checked={notifications.whatsappWeekly}
              onChange={() => {}}
              className="size-4 accent-primary cursor-pointer"
            />
          </div>

          <div
            onClick={() => toggleNotification('repaymentReminders')}
            className="rounded-xl border p-3.5 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-foreground block">Repayment Due Date Reminders</span>
              <span className="text-[11px] text-muted-foreground">Alert 5 days before quarterly bank EMI is due</span>
            </div>
            <input
              type="checkbox"
              checked={notifications.repaymentReminders}
              onChange={() => {}}
              className="size-4 accent-primary cursor-pointer"
            />
          </div>

          <div
            onClick={() => toggleNotification('schemeUpdates')}
            className="rounded-xl border p-3.5 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-foreground block">Govt Scheme & Subsidy Alerts</span>
              <span className="text-[11px] text-muted-foreground">Notifications for MUDRA, PMEGP, and PM Vishwakarma</span>
            </div>
            <input
              type="checkbox"
              checked={notifications.schemeUpdates}
              onChange={() => {}}
              className="size-4 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 4. Sync Status & FastAPI Backend Mode */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs card-lift stagger-5">
        <div className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            <h3 className="font-bold font-sora text-base text-foreground">
              {isTe ? '4. బ్యాకెండ్ కనెక్షన్ & సింక్ స్థితి' : '4. Backend Architecture & Sync Status'}
            </h3>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={backendLoading}
            className="h-8 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${backendLoading ? 'animate-spin' : ''}`} />
            <span>{backendLoading ? 'Checking...' : 'Force Sync Check'}</span>
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="rounded-xl border p-3.5 bg-muted/20">
            <span className="text-muted-foreground block">FastAPI Server:</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`size-2 rounded-full ${isBackendOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <strong className="text-sm font-semibold text-foreground">
                {isBackendOnline ? 'Connected (Port 8000)' : 'Grounded Local Fallback'}
              </strong>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Last checked: {lastSyncTime}</span>
          </div>

          <div className="rounded-xl border p-3.5 bg-muted/20">
            <span className="text-muted-foreground block">AI Advisory Provider:</span>
            <strong className="text-sm font-semibold text-foreground mt-1 block">
              Google Gemini (gemini-2.5-flash)
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1 block">RAG Context Injection Enabled</span>
          </div>

          <div className="rounded-xl border p-3.5 bg-muted/20">
            <span className="text-muted-foreground block">Vector Knowledge Store:</span>
            <strong className="text-sm font-semibold text-foreground mt-1 block">
              ChromaDB (ruralcred_knowledge)
            </strong>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium mt-1 block">
              6 Approved Local Datasets Indexed
            </span>
          </div>
        </div>
      </section>

      {/* 5. Data Backup & Export */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs card-lift stagger-6">
        <div className="pb-3 border-b flex items-center gap-2">
          <Download className="size-4 text-primary" />
          <h3 className="font-bold font-sora text-base text-foreground">
            {isTe ? '5. డేటా బ్యాకప్ & ఎగుమతి' : '5. Data Backup & System Maintenance'}
          </h3>
        </div>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isTe
            ? 'మీ లాగ్‌బుక్ మరియు వ్యాపార ప్రొఫైల్ డేటాను భద్రంగా డౌన్‌లోడ్ చేసుకోండి లేదా ఆఫ్‌లైన్ కాష్‌ని క్లియర్ చేయండి.'
            : 'Download offline records for institutional submission or reset local sandbox cache.'}
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllCsv}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <FileText className="size-3.5" />
            <span>{isTe ? 'లాగ్‌బుక్ CSV ఎగుమతి' : 'Export Full Logbook (CSV)'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdfStatement}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>{isTe ? 'బ్యాంక్ స్టేట్‌మెంట్ PDF' : 'Download Bank Statement (PDF)'}</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearCache}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer ml-auto"
          >
            <Trash2 className="size-3.5" />
            <span>{isTe ? 'కాష్ క్లియర్ చేయండి' : 'Clear Local Cache'}</span>
          </Button>
        </div>
      </section>
    </div>
  );
}

export default SettingsScreen;
