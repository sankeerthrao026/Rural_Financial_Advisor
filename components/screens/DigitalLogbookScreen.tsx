'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import {
  getTodayIso,
  getTodayDisplayDate,
  formatIsoToDisplayDate,
  formatDisplayDateToIso,
  isSameDay,
} from '@/lib/utils/date';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  PlusCircle,
  MinusCircle,
  Mic,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit2,
  RefreshCw,
  TrendingUp,
  FileText,
  Calendar,
  IndianRupee,
  Sparkles,
  Camera,
  FileUp,
  Check,
  Search,
  Tag,
  X,
  Download,
  BookOpen,
  Users,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  isSpeechRecognitionSupported,
  parseSpokenTransaction,
  SpokenTransactionResult,
} from '@/lib/voice/speech';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceButton } from '@/components/ui/voice-button';
import { VoiceInputModal } from '@/components/voice/VoiceInputModal';
import { OcrReviewModal } from '@/components/ocr/OcrReviewModal';
import { LogbookEntry, KhataEntry } from '@/lib/firebase/logbook';
import { exportTransactionsToCsv, exportTransactionsToPdf } from '@/lib/export/logbook-export';

const DEFAULT_CATEGORIES = {
  income: [
    'Sales',
    'Cooperative Payout',
    'Subsidy',
    'Wholesale Off-take',
    'Service Fee',
    'Other Income',
  ],
  expense: [
    'Raw Materials',
    'Labor',
    'Fuel',
    'Feed / Supplies',
    'Debt Repayment',
    'Transport',
    'Rent & Power',
    'Equipment Maintenance',
    'Healthcare / Veterinary',
    'General Expenses',
  ],
};

const SUGGESTED_TAGS = [
  '#morning_batch',
  '#urgent',
  '#mandi_sale',
  '#bulk_deal',
  '#festive_stock',
  '#shg_member',
  '#cash',
  '#upi_qr',
];

export function DigitalLogbookScreen() {
  const {
    entries,
    addNewEntry,
    updateEntry,
    removeEntry,
    resetEntriesToDefault,
    totalIncome,
    totalExpenses,
    netCashFlow,
    language,
    setLanguage,
    inputMode,
    syncStatus,
    dictionary,
    profile,
    khataEntries,
    addKhataEntry,
    updateKhataEntry,
    recordKhataPayment,
    removeKhataEntry,
    totalCustomerCredit,
    totalSupplierCredit,
  } = useApp();

  const t = dictionary.logbook;
  const isTe = language === 'te';
  const isHi = language === 'hi';

  // Active top-level tab: Cash Logbook vs Khata (Udhaar)
  const [activeTab, setActiveTab] = useState<'logbook' | 'khata'>('logbook');

  // ----------------- Transaction Form State (Add & Edit) -----------------
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('Sales');
  const [note, setNote] = useState('');
  const [selectedDateIso, setSelectedDateIso] = useState<string>(getTodayIso());
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ----------------- Filters & Search State -----------------
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'last7' | 'last30'>('all');

  // ----------------- Export Modal State -----------------
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<'all' | 'month' | 'last30'>('all');

  // ----------------- Khata Form & Payment State -----------------
  const [showKhataModal, setShowKhataModal] = useState(false);
  const [khataPartyName, setKhataPartyName] = useState('');
  const [khataPartyPhone, setKhataPartyPhone] = useState('');
  const [khataType, setKhataType] = useState<'customer_credit' | 'supplier_credit'>('customer_credit');
  const [khataAmount, setKhataAmount] = useState('');
  const [khataDateGiven, setKhataDateGiven] = useState(getTodayIso());
  const [khataDueDate, setKhataDueDate] = useState('');
  const [khataNotes, setKhataNotes] = useState('');
  const [khataFilter, setKhataFilter] = useState<'all' | 'customer_credit' | 'supplier_credit' | 'unsettled'>('all');

  // Payment Recording Modal
  const [payingKhataItem, setPayingKhataItem] = useState<KhataEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayIso());
  const [paymentNote, setPaymentNote] = useState('');

  // Modals for Voice & OCR
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Today metrics
  const todayDisplay = getTodayDisplayDate();
  const todayEntries = entries.filter((e) => isSameDay(e.date, todayDisplay));
  const todayIncome = todayEntries.filter((e) => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const todayExpense = todayEntries.filter((e) => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const todayNet = todayIncome - todayExpense;

  // Open Form for Adding
  const handleOpenAddForm = (entryType: 'income' | 'expense') => {
    setEditingEntryId(null);
    setType(entryType);
    setCategory(entryType === 'income' ? 'Sales' : 'Raw Materials');
    setSelectedDateIso(getTodayIso());
    setAmount('');
    setNote('');
    setTags([]);
    setCustomTagInput('');
    setShowAddForm(true);
  };

  // Open Form for Editing
  const handleOpenEditForm = (entry: LogbookEntry) => {
    setEditingEntryId(entry.id);
    setType(entry.type);
    setCategory(entry.category);
    setAmount(entry.amount.toString());
    setNote(entry.note);
    setSelectedDateIso(formatDisplayDateToIso(entry.date));
    setTags(entry.tags || []);
    setCustomTagInput('');
    setShowAddForm(true);
  };

  // Tag Management helpers
  const handleAddTag = (tagToAdd: string) => {
    const formatted = tagToAdd.trim().startsWith('#') ? tagToAdd.trim() : `#${tagToAdd.trim()}`;
    if (formatted.length > 1 && !tags.includes(formatted)) {
      setTags([...tags, formatted]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Submit Add or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount.replace(/[^\d.]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    setSubmitting(true);

    if (editingEntryId) {
      // Edit existing entry
      const existing = entries.find((e) => e.id === editingEntryId);
      if (existing) {
        await updateEntry({
          ...existing,
          date: formatIsoToDisplayDate(selectedDateIso),
          amount: cleanAmount,
          type,
          category,
          note: note || (type === 'income' ? 'Daily sales receipt' : 'Operational supply expense'),
          tags,
        });
      }
    } else {
      // Add new entry
      await addNewEntry({
        date: formatIsoToDisplayDate(selectedDateIso),
        amount: cleanAmount,
        type,
        category,
        note: note || (type === 'income' ? 'Daily sales receipt' : 'Operational supply expense'),
        tags,
      });
    }

    setAmount('');
    setNote('');
    setTags([]);
    setSelectedDateIso(getTodayIso());
    setSubmitting(false);
    setShowAddForm(false);
    setEditingEntryId(null);
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // 1. Type filter
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;

      // 2. Category filter
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;

      // 3. Tag filter
      if (activeTagFilter && (!e.tags || !e.tags.includes(activeTagFilter))) return false;

      // 4. Date filter
      if (dateRangeFilter === 'today' && !isSameDay(e.date, todayDisplay)) return false;
      if (dateRangeFilter === 'last7') {
        const diff = Date.now() - (e.timestamp || 0);
        if (diff > 7 * 86400000) return false;
      }
      if (dateRangeFilter === 'last30') {
        const diff = Date.now() - (e.timestamp || 0);
        if (diff > 30 * 86400000) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (e.note || '').toLowerCase().includes(q);
        const catMatch = (e.category || '').toLowerCase().includes(q);
        const tagMatch = (e.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!noteMatch && !catMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [entries, typeFilter, categoryFilter, activeTagFilter, dateRangeFilter, searchQuery, todayDisplay]);

  // All unique tags across entries for filtering
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => (e.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [entries]);

  // Handle Export
  const handleExportCsv = () => {
    let toExport = entries;
    if (exportRange === 'last30') {
      toExport = entries.filter((e) => Date.now() - (e.timestamp || 0) <= 30 * 86400000);
    } else if (exportRange === 'month') {
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      toExport = entries.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
    }

    const rangeLabel = exportRange === 'all' ? 'All Time' : exportRange === 'last30' ? 'Last 30 Days' : 'Current Month';
    exportTransactionsToCsv(toExport, `RuralCred_Logbook_${rangeLabel.replace(/\s+/g, '_')}.csv`);
    setShowExportModal(false);
  };

  const handleExportPdf = () => {
    let toExport = entries;
    if (exportRange === 'last30') {
      toExport = entries.filter((e) => Date.now() - (e.timestamp || 0) <= 30 * 86400000);
    } else if (exportRange === 'month') {
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      toExport = entries.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
    }

    const rangeLabel = exportRange === 'all' ? 'All Time' : exportRange === 'last30' ? 'Last 30 Days' : 'Current Month';
    exportTransactionsToPdf(toExport, {
      enterpriseName: profile.businessName || 'Rural Micro Enterprise',
      entrepreneurName: profile.name || 'Proprietor',
      location: profile.location || 'Warangal, Telangana',
      dateRangeLabel: rangeLabel,
    });
    setShowExportModal(false);
  };

  // Handle Khata Form Submission
  const handleAddKhataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parseFloat(khataAmount.replace(/[^\d.]/g, ''));
    if (!khataPartyName.trim() || !cleanAmt || cleanAmt <= 0) return;

    await addKhataEntry({
      partyName: khataPartyName.trim(),
      partyPhone: khataPartyPhone.trim() || undefined,
      type: khataType,
      amount: cleanAmt,
      dateGiven: formatIsoToDisplayDate(khataDateGiven),
      dueDate: khataDueDate ? formatIsoToDisplayDate(khataDueDate) : undefined,
      notes: khataNotes.trim() || undefined,
    });

    setKhataPartyName('');
    setKhataPartyPhone('');
    setKhataAmount('');
    setKhataNotes('');
    setKhataDueDate('');
    setKhataDateGiven(getTodayIso());
    setShowKhataModal(false);
  };

  // Handle Payment Recording
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingKhataItem) return;
    const cleanAmt = parseFloat(paymentAmount.replace(/[^\d.]/g, ''));
    if (!cleanAmt || cleanAmt <= 0) return;

    await recordKhataPayment(
      payingKhataItem.id,
      cleanAmt,
      formatIsoToDisplayDate(paymentDate),
      paymentNote.trim() || undefined
    );

    setPaymentAmount('');
    setPaymentNote('');
    setPaymentDate(getTodayIso());
    setPayingKhataItem(null);
  };

  // Filtered Khata Entries
  const filteredKhata = useMemo(() => {
    return khataEntries.filter((k) => {
      if (khataFilter === 'customer_credit' && k.type !== 'customer_credit') return false;
      if (khataFilter === 'supplier_credit' && k.type !== 'supplier_credit') return false;
      if (khataFilter === 'unsettled' && k.status === 'settled') return false;
      return true;
    });
  }, [khataEntries, khataFilter]);

  // Voice handler
  const voiceInput = useVoiceInput({
    targetLanguage: language as 'en' | 'te',
    onResult: (transcript) => {
      const parsed = parseSpokenTransaction(transcript);
      if (parsed.amount) setAmount(parsed.amount.toString());
      setType(parsed.type);
      if (parsed.category) setCategory(parsed.category);
      setNote(parsed.note);
      setShowAddForm(true);
    },
  });

  const handleToggleVoice = () => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
    } else {
      voiceInput.startListening();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tab Navigation: Cash Logbook vs Khata (Udhaar) */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('logbook')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'logbook'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            <BookOpen className="size-4" />
            <span>{isTe ? 'నగదు లాగ్‌బుక్' : 'Cash Logbook'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30 text-current">
              {entries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('khata')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'khata'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            <CreditCard className="size-4" />
            <span>{isTe ? 'ఖాతా & అప్పులు (ఉధార్)' : 'Khata / Credit Ledger'}</span>
            {khataEntries.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold">
                {khataEntries.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Export Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <Download className="size-3.5" />
          <span>{isTe ? 'స్టేట్‌మెంట్ ఎగుమతి' : 'Export Statement'}</span>
        </Button>
      </div>

      {activeTab === 'logbook' ? (
        <>
          {/* 1. Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Total Income */}
            <div className="stagger-1 hover-lift hover-glow-emerald rounded-2xl border bg-card p-5 shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t.totalIncome}</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded shadow-2xs">
                  <ArrowUpRight className="size-3" />
                  {isTe ? 'ఆదాయం' : 'Inflow'}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold font-sora text-emerald-800 dark:text-emerald-400">
                <AnimatedNumber value={totalIncome} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entries.filter((e) => e.type === 'income').length} {isTe ? 'లావాదేవీలు' : 'recorded receipts'}
              </p>
            </div>

            {/* Total Expenses */}
            <div className="stagger-2 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t.totalExpenses}</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded shadow-2xs">
                  <ArrowDownRight className="size-3" />
                  {isTe ? 'ఖర్చులు' : 'Outflow'}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold font-sora text-rose-800 dark:text-rose-400">
                <AnimatedNumber value={totalExpenses} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entries.filter((e) => e.type === 'expense').length} {isTe ? 'ఖర్చు రికార్డులు' : 'recorded payments'}
              </p>
            </div>

            {/* Net Cash Flow */}
            <div className="stagger-3 hover-lift rounded-2xl border bg-card p-5 shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t.netCashFlow}</p>
                <div
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded shadow-2xs ${
                    netCashFlow >= 0
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                      : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40'
                  }`}
                >
                  {netCashFlow >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {netCashFlow >= 0 ? (isTe ? 'నికర మిగులు' : 'Net Surplus') : (isTe ? 'లోటు' : 'Deficit')}
                </div>
              </div>
              <p className={`mt-3 text-2xl font-bold font-sora ${netCashFlow >= 0 ? 'text-foreground' : 'text-rose-700 dark:text-rose-400'}`}>
                <AnimatedNumber value={netCashFlow} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {syncStatus === 'synced' ? dictionary.syncedStatus : dictionary.waitingToSync}
              </p>
            </div>
          </div>

          {/* 2. Today's Activity Summary & Quick Actions */}
          <section className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-600 animate-ping" />
                <h3 className="font-semibold font-sora text-sm text-foreground">
                  {isTe ? 'నేటి వ్యాపార కార్యాచరణ' : "Today's Ledger Activity"}
                </h3>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
                  {todayDisplay}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs">
                <span>
                  {isTe ? 'ఆదాయం: ' : 'Inflow: '}
                  <strong className="text-emerald-700 font-semibold">{formatINR(todayIncome)}</strong>
                </span>
                <span>•</span>
                <span>
                  {isTe ? 'ఖర్చులు: ' : 'Outflow: '}
                  <strong className="text-rose-700 font-semibold">{formatINR(todayExpense)}</strong>
                </span>
                <span>•</span>
                <span>
                  {isTe ? 'నేటి నికర మొత్తం: ' : 'Net Today: '}
                  <strong className={`font-bold ${todayNet >= 0 ? 'text-primary' : 'text-rose-700'}`}>
                    {formatINR(todayNet)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenAddForm('income')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                <PlusCircle className="size-4" />
                <span>{isTe ? '+ ఆదాయం నమోదు' : '+ Add Income'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddForm('expense')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                <MinusCircle className="size-4" />
                <span>{isTe ? '− ఖర్చు నమోదు' : '− Add Expense'}</span>
              </button>

              <VoiceButton
                status={voiceInput.status}
                onToggle={handleToggleVoice}
                errorMessage={voiceInput.error}
                onRetry={voiceInput.startListening}
                label={isTe ? 'వాయిస్' : isHi ? 'वॉइस' : 'Voice'}
                listeningLabel={isTe ? 'వింటున్నాము...' : isHi ? 'सुन रहे हैं...' : 'Listening...'}
              />

              <button
                type="button"
                onClick={() => setShowOcrModal(true)}
                className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-muted transition-colors shadow-xs"
              >
                <Camera className="size-3.5 text-primary" />
                <span>{isTe ? 'స్లిప్ / రసీదు OCR' : 'Receipt OCR'}</span>
              </button>
            </div>
          </section>

          {/* 3. Transaction Form (Add or Edit) */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border-2 border-primary/30 bg-card p-6 shadow-sm flex flex-col gap-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <h3 className="font-bold font-sora text-sm text-foreground">
                    {editingEntryId
                      ? isTe
                        ? 'లావాదేవీని సవరించండి'
                        : 'Edit Transaction Record'
                      : type === 'income'
                      ? isTe
                        ? 'కొత్త ఆదాయాన్ని నమోదు చేయండి'
                        : 'Record New Income'
                      : isTe
                      ? 'కొత్త ఖర్చును నమోదు చేయండి'
                      : 'Record New Expense'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingEntryId(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X className="size-3.5" />
                  <span>{isTe ? 'మూసివేయి' : 'Close'}</span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                {/* Type Switcher */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.type}</label>
                  <div className="mt-1.5 flex gap-1 rounded-lg border p-1 bg-background">
                    <button
                      type="button"
                      onClick={() => {
                        setType('income');
                        setCategory('Sales');
                      }}
                      className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        type === 'income' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.income}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setType('expense');
                        setCategory('Raw Materials');
                      }}
                      className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        type === 'expense' ? 'bg-rose-600 text-white' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.expense}
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.amount}</label>
                  <input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="₹ e.g. 2500"
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary font-mono"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.category}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {(type === 'income' ? DEFAULT_CATEGORIES.income : DEFAULT_CATEGORIES.expense).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proper Date Picker defaulting to today */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">{t.date}</label>
                    <button
                      type="button"
                      onClick={() => setSelectedDateIso(getTodayIso())}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {isTe ? 'నేడు' : 'Today'}
                    </button>
                  </div>
                  <input
                    type="date"
                    value={selectedDateIso}
                    onChange={(e) => setSelectedDateIso(e.target.value || getTodayIso())}
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary cursor-pointer text-foreground"
                    required
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatIsoToDisplayDate(selectedDateIso)}
                  </p>
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t.note}</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Morning counter milk sales (35 L) or Tractor green fodder load"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Custom Tagging Section */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {isTe ? 'కస్టమ్ ట్యాగ్‌లు (బహుళ ట్యాగ్‌లు జోడించవచ్చు)' : 'Custom Tags & Identifiers'}
                </label>

                {/* Selected Tags Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {tags.map((tItem) => (
                    <span
                      key={tItem}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium border border-primary/20"
                    >
                      <span>{tItem}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tItem)}
                        className="text-primary hover:text-foreground cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* Tag Input + Suggestions */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customTagInput.trim()) handleAddTag(customTagInput);
                      }
                    }}
                    placeholder="Type tag (e.g. #mandi, #wholesale) and press Enter"
                    className="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary flex-1 max-w-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (customTagInput.trim()) handleAddTag(customTagInput);
                    }}
                    className="h-8 text-xs font-medium cursor-pointer"
                  >
                    + Add Tag
                  </Button>
                </div>

                {/* Quick Suggested Tags */}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span>{isTe ? 'సూచించిన ట్యాగ్‌లు:' : 'Suggested:'}</span>
                  {SUGGESTED_TAGS.map((sTag) => (
                    <button
                      key={sTag}
                      type="button"
                      onClick={() => handleAddTag(sTag)}
                      className="rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors"
                    >
                      {sTag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingEntryId(null);
                  }}
                >
                  {isTe ? 'రద్దు చేయండి' : 'Cancel'}
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="font-semibold cursor-pointer">
                  {submitting
                    ? isTe
                      ? 'భద్రపరుస్తున్నాము...'
                      : 'Saving...'
                    : editingEntryId
                    ? isTe
                      ? 'మార్పులను భద్రపరచండి'
                      : 'Save Changes'
                    : t.saveEntry}
                </Button>
              </div>
            </form>
          )}

          {/* 4. Filter Toolbar & Search */}
          <section className="rounded-2xl border bg-card p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isTe ? 'శోధించండి (వివరణ, ట్యాగ్, కేటగిరీ)...' : 'Search records, tags, notes...'}
                  className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>

              {/* Type Filter */}
              <div className="flex rounded-lg border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                    typeFilter === 'all' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('income')}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                    typeFilter === 'income' ? 'bg-emerald-600 text-white font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('expense')}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                    typeFilter === 'expense' ? 'bg-rose-600 text-white font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Expense
                </button>
              </div>

              {/* Date Filter */}
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today Only</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
              </select>
            </div>

            {/* Tags quick filter chips */}
            {allUniqueTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-muted-foreground font-medium mr-1">Tags:</span>
                {allUniqueTags.slice(0, 4).map((tagItem) => (
                  <button
                    key={tagItem}
                    onClick={() => setActiveTagFilter(activeTagFilter === tagItem ? null : tagItem)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-colors border ${
                      activeTagFilter === tagItem
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {tagItem}
                  </button>
                ))}
                {activeTagFilter && (
                  <button
                    onClick={() => setActiveTagFilter(null)}
                    className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer ml-1"
                  >
                    Clear tag
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 5. Verified Transaction Ledger Table */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold font-sora text-base">{t.recentTransactions}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredEntries.length} of {entries.length} {isTe ? 'నమోదులు ప్రదర్శించబడుతున్నాయి' : 'records shown'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetEntriesToDefault}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border bg-card cursor-pointer"
                >
                  <RefreshCw className="size-3" />
                  <span>{isTe ? 'నమూనా రీసెట్' : 'Reset Sample'}</span>
                </button>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground mb-3">
                  <FileText className="size-6 opacity-70" />
                </div>
                <p className="text-sm font-semibold font-sora text-foreground">
                  {isTe ? 'లావాదేవీలు ఏవీ కనుగొనబడలేదు' : 'No Transactions Found'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {isTe
                    ? 'ఫిల్టర్లను మార్చండి లేదా కొత్త లావాదేవీని నమోదు చేయండి.'
                    : 'Try changing your search query or filters, or add a new transaction.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{t.date}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.note}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.category}</th>
                      <th className="py-2.5 px-3 font-semibold">Tags</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{t.amount}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{isTe ? 'చర్యలు' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="transition-colors hover:bg-muted/40 group">
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap font-medium">
                          {formatIsoToDisplayDate(entry.date)}
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground max-w-xs truncate">
                          {entry.note}
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {entry.category}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {entry.tags && entry.tags.length > 0 ? (
                              entry.tags.map((tg) => (
                                <span
                                  key={tg}
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20"
                                >
                                  {tg}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">—</span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold tabular-nums ${
                            entry.type === 'income'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {entry.type === 'income' ? `+${formatINR(entry.amount)}` : `-${formatINR(entry.amount)}`}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit Action Button */}
                            <button
                              onClick={() => handleOpenEditForm(entry)}
                              title={isTe ? 'సవరించండి' : 'Edit entry'}
                              className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-muted cursor-pointer"
                            >
                              <Edit2 className="size-3.5" />
                            </button>

                            {/* Delete Action Button */}
                            <button
                              onClick={() => removeEntry(entry.id)}
                              title={isTe ? 'తొలగించండి' : 'Delete entry'}
                              className="text-muted-foreground hover:text-rose-600 transition-colors p-1.5 rounded hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        /* ----------------- KHATA / UDHAAR LEDGER TAB ----------------- */
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Khata Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* You'll Get (Customer Credit) */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                  {isTe ? 'రావాల్సినవి (కస్టమర్ అప్పు)' : "You'll Get (Customer Credit)"}
                </span>
                <Users className="size-4 text-emerald-700" />
              </div>
              <p className="mt-3 text-2xl font-bold font-sora text-emerald-800 dark:text-emerald-400">
                <AnimatedNumber value={totalCustomerCredit} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {khataEntries.filter((k) => k.type === 'customer_credit' && k.status !== 'settled').length}{' '}
                {isTe ? 'కస్టమర్ బకాయిలు' : 'pending customer balances'}
              </p>
            </div>

            {/* You'll Give (Supplier Credit) */}
            <div className="rounded-2xl border-2 border-rose-500/30 bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-400 uppercase tracking-wider">
                  {isTe ? 'ఇవ్వాల్సినవి (సప్లయర్ బాకీ)' : "You'll Pay (Supplier Credit)"}
                </span>
                <Clock className="size-4 text-rose-700" />
              </div>
              <p className="mt-3 text-2xl font-bold font-sora text-rose-800 dark:text-rose-400">
                <AnimatedNumber value={totalSupplierCredit} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {khataEntries.filter((k) => k.type === 'supplier_credit' && k.status !== 'settled').length}{' '}
                {isTe ? 'సప్లయర్ బాకీలు' : 'pending supplier dues'}
              </p>
            </div>

            {/* Net Khata Position */}
            <div className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isTe ? 'నికర ఖాతా స్థితి' : 'Net Khata Position'}
                </span>
                <CreditCard className="size-4 text-primary" />
              </div>
              <p
                className={`mt-3 text-2xl font-bold font-sora ${
                  totalCustomerCredit >= totalSupplierCredit ? 'text-primary' : 'text-rose-700'
                }`}
              >
                <AnimatedNumber value={totalCustomerCredit - totalSupplierCredit} formatter={formatINR} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalCustomerCredit >= totalSupplierCredit
                  ? isTe
                    ? 'నికర మిగులు రాబడి'
                    : 'Net receivable surplus'
                  : isTe
                  ? 'నికర చెల్లించాల్సిన మొత్తం'
                  : 'Net payable balance'}
              </p>
            </div>
          </div>

          {/* Khata Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card rounded-2xl border p-4 shadow-xs">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setKhataFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  khataFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {isTe ? 'అన్నీ' : 'All Accounts'} ({khataEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setKhataFilter('customer_credit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  khataFilter === 'customer_credit'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {isTe ? "రావాల్సినవి (కస్టమర్లు)" : "You'll Get (Customers)"}
              </button>
              <button
                type="button"
                onClick={() => setKhataFilter('supplier_credit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  khataFilter === 'supplier_credit'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {isTe ? 'ఇవ్వాల్సినవి (సప్లయర్లు)' : "You'll Pay (Suppliers)"}
              </button>
              <button
                type="button"
                onClick={() => setKhataFilter('unsettled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  khataFilter === 'unsettled' ? 'bg-amber-600 text-white font-semibold' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {isTe ? 'బాకీలు మాత్రమే' : 'Pending Dues Only'}
              </button>
            </div>

            {/* Add New Khata Button */}
            <Button
              size="sm"
              onClick={() => setShowKhataModal(true)}
              className="flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>{isTe ? '+ ఖాతా నమోదు' : '+ Add Khata Record'}</span>
            </Button>
          </div>

          {/* Khata List Table */}
          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            {filteredKhata.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground mb-3">
                  <CreditCard className="size-6 opacity-70" />
                </div>
                <p className="text-sm font-semibold font-sora text-foreground">
                  {isTe ? 'ఖాతా రికార్డులు ఏవీ లేవు' : 'No Khata Records Found'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {isTe
                    ? 'కస్టమర్ లేదా సప్లయర్ అప్పు వివరాలను నమోదు చేయడానికి "+ ఖాతా నమోదు" పై నొక్కండి.'
                    : 'Record money customers owe you or money you owe suppliers to maintain accurate digital books.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{isTe ? 'పేరు & రకం' : 'Party Name & Type'}</th>
                      <th className="py-2.5 px-3 font-semibold">{isTe ? 'తేదీ / గడువు' : 'Date / Due Date'}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'మొత్తం అప్పు' : 'Total Amount'}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'చెల్లించిన మొత్తం' : 'Paid Back'}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{isTe ? 'మిగిలిన బాకీ' : 'Balance Due'}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{isTe ? 'స్థితి' : 'Status'}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{isTe ? 'చర్య' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredKhata.map((item) => {
                      const balance = Math.max(0, item.amount - item.paidAmount);
                      const isCustomer = item.type === 'customer_credit';

                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground">{item.partyName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isCustomer
                                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-800 dark:text-rose-400'
                                }`}
                              >
                                {isCustomer ? "You'll Get" : "You'll Pay"}
                              </span>
                              {item.partyPhone && (
                                <span className="text-[10px] text-muted-foreground">{item.partyPhone}</span>
                              )}
                            </div>
                            {item.notes && <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-xs">{item.notes}</p>}
                          </td>

                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                            <div>{formatIsoToDisplayDate(item.dateGiven)}</div>
                            {item.dueDate && (
                              <div className="text-[10px] font-medium text-amber-900 dark:text-amber-300 mt-0.5 flex items-center gap-1">
                                <Clock className="size-3" />
                                <span>Due: {formatIsoToDisplayDate(item.dueDate)}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-semibold tabular-nums text-foreground">
                            {formatINR(item.amount)}
                          </td>

                          <td className="py-3 px-3 text-right font-medium tabular-nums text-emerald-800 dark:text-emerald-400">
                            {formatINR(item.paidAmount)}
                          </td>

                          <td className="py-3 px-3 text-right font-bold tabular-nums text-primary text-sm">
                            {formatINR(balance)}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.status === 'settled'
                                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                                  : item.status === 'partially_paid'
                                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-400'
                                  : 'bg-rose-500/20 text-rose-800 dark:text-rose-400'
                              }`}
                            >
                              {item.status === 'settled'
                                ? isTe
                                  ? 'పూర్తయింది'
                                  : 'Settled'
                                : item.status === 'partially_paid'
                                ? isTe
                                  ? 'పాక్షిక చెల్లింపు'
                                  : 'Partially Paid'
                                : isTe
                                ? 'చెల్లించలేదు'
                                : 'Unpaid'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.status !== 'settled' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPayingKhataItem(item);
                                    setPaymentAmount(balance.toString());
                                    setPaymentDate(getTodayIso());
                                  }}
                                  className="h-7 text-xs px-2 cursor-pointer font-medium"
                                >
                                  {isTe ? 'చెల్లింపు నమోదు' : 'Record Pay'}
                                </Button>
                              )}

                              <button
                                onClick={() => removeKhataEntry(item.id)}
                                className="text-muted-foreground hover:text-rose-600 p-1 cursor-pointer transition-colors"
                                title="Delete Khata"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ----------------- EXPORT STATEMENT MODAL ----------------- */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Download className="size-4 text-primary" />
                <h3 className="font-bold font-sora text-sm text-foreground">
                  {isTe ? 'లాగ్‌బుక్ స్టేట్‌మెంట్ ఎగుమతి' : 'Export Verified Transaction Statement'}
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {isTe
                ? 'బ్యాంకు రుణం లేదా ఆర్థిక ధృవీకరణ కోసం మీ లాగ్‌బుక్ లావాదేవీల రికార్డులను ఎక్సెల్ (CSV) లేదా బ్యాంక్ PDF రూపంలో డౌన్‌లోడ్ చేసుకోండి.'
                : 'Download digitally certified transaction records to present directly to bank managers or MFI credit officers.'}
            </p>

            {/* Range Selection */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                {isTe ? 'కాలపరిమితిని ఎంచుకోండి:' : 'Select Statement Period:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportRange('all')}
                  className={`rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                    exportRange === 'all'
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {isTe ? 'మొత్తం రికార్డులు' : 'All Time'}
                </button>
                <button
                  type="button"
                  onClick={() => setExportRange('month')}
                  className={`rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                    exportRange === 'month'
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {isTe ? 'ఈ నెల' : 'This Month'}
                </button>
                <button
                  type="button"
                  onClick={() => setExportRange('last30')}
                  className={`rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                    exportRange === 'last30'
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {isTe ? 'గత 30 రోజులు' : 'Last 30 Days'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleExportCsv}
                className="flex items-center gap-2 font-semibold cursor-pointer"
              >
                <FileText className="size-4 text-primary" />
                <span>CSV / Excel</span>
              </Button>

              <Button
                onClick={handleExportPdf}
                className="flex items-center gap-2 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
              >
                <Download className="size-4" />
                <span>Bank PDF</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- ADD KHATA MODAL ----------------- */}
      {showKhataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleAddKhataSubmit}
            className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-lg flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-bold font-sora text-sm text-foreground">
                {isTe ? 'కొత్త ఖాతా / ఉధార్ నమోదు' : 'Add New Khata / Credit Record'}
              </h3>
              <button
                type="button"
                onClick={() => setShowKhataModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Khata Type Switcher */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {isTe ? 'ఖాతా రకం:' : 'Credit Direction:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKhataType('customer_credit')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    khataType === 'customer_credit'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {isTe ? 'రావాల్సినవి (కస్టమర్ అప్పు)' : "You'll Get (Customer Credit)"}
                </button>
                <button
                  type="button"
                  onClick={() => setKhataType('supplier_credit')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    khataType === 'supplier_credit'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {isTe ? 'ఇవ్వాల్సినవి (సప్లయర్ బాకీ)' : "You'll Pay (Supplier Credit)"}
                </button>
              </div>
            </div>

            {/* Party Name & Phone */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {khataType === 'customer_credit' ? (isTe ? 'కస్టమర్ పేరు' : 'Customer Name') : (isTe ? 'సప్లయర్ పేరు' : 'Supplier Name')}
                </label>
                <input
                  type="text"
                  value={khataPartyName}
                  onChange={(e) => setKhataPartyName(e.target.value)}
                  placeholder="e.g. Ramesh Kirana or Krishna Milk Depot"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{isTe ? 'ఫోన్ నంబర్' : 'Phone (Optional)'}</label>
                <input
                  type="tel"
                  value={khataPartyPhone}
                  onChange={(e) => setKhataPartyPhone(e.target.value)}
                  placeholder="e.g. 9848012345"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Amount & Date Given */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{isTe ? 'మొత్తం (₹)' : 'Amount (₹)'}</label>
                <input
                  type="number"
                  step="any"
                  value={khataAmount}
                  onChange={(e) => setKhataAmount(e.target.value)}
                  placeholder="₹ 2500"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{isTe ? 'ఇచ్చిన తేదీ' : 'Date Given'}</label>
                <input
                  type="date"
                  value={khataDateGiven}
                  onChange={(e) => setKhataDateGiven(e.target.value || getTodayIso())}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{isTe ? 'చెల్లింపు గడువు' : 'Due Date (Optional)'}</label>
                <input
                  type="date"
                  value={khataDueDate}
                  onChange={(e) => setKhataDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isTe ? 'వివరణ' : 'Notes / Goods Supplied'}</label>
              <input
                type="text"
                value={khataNotes}
                onChange={(e) => setKhataNotes(e.target.value)}
                placeholder="e.g. 5 days milk supply or 2 bags cattle feed"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowKhataModal(false)}>
                {isTe ? 'రద్దు చేయండి' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm" className="font-semibold cursor-pointer">
                {isTe ? 'భద్రపరచండి' : 'Save Khata'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------- RECORD KHATA PAYMENT MODAL ----------------- */}
      {payingKhataItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleRecordPaymentSubmit}
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="font-bold font-sora text-sm text-foreground">
                  {isTe ? 'చెల్లింపును నమోదు చేయండి' : 'Record Repayment / Receipt'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Party: <strong className="text-foreground">{payingKhataItem.partyName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingKhataItem(null)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 text-xs flex justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground block">{isTe ? 'మొత్తం అప్పు' : 'Total Credit'}</span>
                <strong>{formatINR(payingKhataItem.amount)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">{isTe ? 'ఇంతవరకు చెల్లించినది' : 'Already Paid'}</span>
                <strong className="text-emerald-700">{formatINR(payingKhataItem.paidAmount)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">{isTe ? 'మిగిలిన బాకీ' : 'Remaining Due'}</span>
                <strong className="text-primary">{formatINR(payingKhataItem.amount - payingKhataItem.paidAmount)}</strong>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isTe ? 'చెల్లించే మొత్తం (₹)' : 'Payment Amount (₹)'}</label>
              <input
                type="number"
                step="any"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="₹ e.g. 1000"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
                required
              />
            </div>

            {/* Payment Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isTe ? 'చెల్లింపు తేదీ' : 'Payment Date'}</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value || getTodayIso())}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary cursor-pointer"
                required
              />
            </div>

            {/* Payment Note */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isTe ? 'వివరణ' : 'Payment Mode / Note'}</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. Cash received at Sunday market or PhonePe UPI"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPayingKhataItem(null)}>
                {isTe ? 'రద్దు చేయండి' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm" className="font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
                {isTe ? 'చెల్లింపు నమోదు చేయండి' : 'Save Payment'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* OCR and Voice Modals */}
      <VoiceInputModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        language={language}
        onLanguageChange={setLanguage}
        onExtracted={(parsed) => {
          if (parsed.amount) setAmount(parsed.amount.toString());
          setType(parsed.type);
          if (parsed.category) setCategory(parsed.category);
          setNote(parsed.note);
          setShowAddForm(true);
        }}
      />

      <OcrReviewModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        language={language}
        onSaveSingle={async (item) => {
          await addNewEntry({
            date: formatIsoToDisplayDate(item.date),
            amount: item.amount,
            type: item.type,
            category: item.category,
            note: item.note,
          });
        }}
        onSaveBatch={async (items) => {
          for (const item of items) {
            await addNewEntry({
              date: formatIsoToDisplayDate(item.date),
              amount: item.amount,
              type: item.type,
              category: item.category,
              note: item.note,
            });
          }
        }}
      />
    </div>
  );
}

export default DigitalLogbookScreen;
