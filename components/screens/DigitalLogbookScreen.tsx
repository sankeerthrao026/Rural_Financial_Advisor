'use client';

import React, { useState } from 'react';
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
  RefreshCw,
  TrendingUp,
  FileText,
  Calendar,
  IndianRupee,
  Sparkles,
  Camera,
  FileUp,
  Check,
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
  startSpeechListening,
  isSpeechRecognitionSupported,
  parseSpokenTransaction,
  SpokenTransactionResult,
} from '@/lib/voice/speech';
import { VoiceInputModal } from '@/components/voice/VoiceInputModal';
import { OcrReviewModal } from '@/components/ocr/OcrReviewModal';

export function DigitalLogbookScreen() {
  const {
    entries,
    addNewEntry,
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
  } = useApp();

  const t = dictionary.logbook;
  const isTe = language === 'te';
  const isHi = language === 'hi';

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('Sales');
  const [note, setNote] = useState('');
  const [selectedDateIso, setSelectedDateIso] = useState(getTodayIso());
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Compute Today's Activity metrics dynamically
  const todayDisplay = getTodayDisplayDate();
  const todayEntries = entries.filter((e) => isSameDay(e.date, todayDisplay));
  const todayIncome = todayEntries.filter((e) => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const todayExpense = todayEntries.filter((e) => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const todayNet = todayIncome - todayExpense;

  const handleOpenForm = (entryType: 'income' | 'expense') => {
    setType(entryType);
    setCategory(entryType === 'income' ? 'Sales' : 'Feed / Supplies');
    setSelectedDateIso(getTodayIso());
    setShowAddForm(true);
  };

  const handleOcrSaveSingle = async (entry: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    note: string;
  }) => {
    await addNewEntry({
      date: formatIsoToDisplayDate(entry.date),
      amount: entry.amount,
      type: entry.type,
      category: entry.category,
      note: entry.note,
    });
  };

  const handleOcrSaveBatch = async (entries: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    note: string;
  }[]) => {
    for (const item of entries) {
      await addNewEntry({
        date: formatIsoToDisplayDate(item.date),
        amount: item.amount,
        type: item.type,
        category: item.category,
        note: item.note,
      });
    }
  };

  const categories = {
    income: ['Sales', 'Cooperative Payout', 'Subsidy', 'Other Income'],
    expense: ['Feed / Supplies', 'Raw Material', 'Veterinary', 'Wages', 'Transport', 'Rent & Power'],
  };

  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const handleVoiceQuickAdd = () => {
    setShowVoiceModal(true);
  };

  const handleVoiceExtracted = (result: SpokenTransactionResult) => {
    if (result.amount) {
      setAmount(result.amount.toString());
    }
    setType(result.type);
    if (result.category) {
      setCategory(result.category);
    }
    if (result.note) {
      setNote(result.note);
    }
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount.replace(/[^\d]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    setSubmitting(true);
    await addNewEntry({
      date: formatIsoToDisplayDate(selectedDateIso),
      amount: cleanAmount,
      type,
      category,
      note: note || (type === 'income' ? 'Daily sales receipt' : 'Operational supply expense'),
    });

    setAmount('');
    setNote('');
    setSelectedDateIso(getTodayIso());
    setSubmitting(false);
    setShowAddForm(false);
  };

  // Prepare dynamic Recharts data
  const chartData = [
    { period: 'Week 1', Income: 14500, Expense: 4500 },
    { period: 'Week 2', Income: 12800, Expense: 1950 },
    { period: 'Week 3', Income: 18400, Expense: 6250 },
    { period: 'Current', Income: totalIncome > 45700 ? totalIncome - 45700 + 10000 : 12000, Expense: totalExpenses > 12700 ? totalExpenses - 12700 + 3500 : 4200 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Income */}
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.totalIncome}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
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
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.totalExpenses}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
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
        <div className="hover-lift rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.netCashFlow}</p>
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
              netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'text-rose-700 bg-rose-50'
            }`}>
              {netCashFlow >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {netCashFlow >= 0 ? (isTe ? 'నికర మిగులు' : 'Net Surplus') : (isTe ? 'లోటు' : 'Deficit')}
            </div>
          </div>
          <p className={`mt-3 text-2xl font-bold font-sora ${netCashFlow >= 0 ? 'text-foreground' : 'text-rose-700'}`}>
            <AnimatedNumber value={netCashFlow} formatter={formatINR} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {syncStatus === 'synced' ? dictionary.syncedStatus : dictionary.waitingToSync}
          </p>
        </div>
      </div>

      {/* 2. Today's Activity Summary & Quick-Action Toolbar */}
      <section className="rounded-2xl border bg-card p-5 shadow-xs hover-lift flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <span>{isTe ? 'ఆదాయం: ' : 'Inflow: '}<strong className="text-emerald-700 font-semibold">{formatINR(todayIncome)}</strong></span>
            <span>•</span>
            <span>{isTe ? 'ఖర్చులు: ' : 'Outflow: '}<strong className="text-rose-700 font-semibold">{formatINR(todayExpense)}</strong></span>
            <span>•</span>
            <span>{isTe ? 'నేటి నికర మొత్తం: ' : 'Net Today: '}<strong className={`font-bold ${todayNet >= 0 ? 'text-primary' : 'text-rose-700'}`}>{formatINR(todayNet)}</strong></span>
            {todayEntries.length === 0 && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                ({isTe ? 'నేడు కొత్త నమోదులు లేవు' : 'No entries recorded today'})
              </span>
            )}
          </div>
        </div>

        {/* Dual Primary Triggers: [+ Add Income] and [- Add Expense] */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenForm('income')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <PlusCircle className="size-4" />
            <span>{isTe ? '+ ఆదాయం నమోదు' : '+ Add Income'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenForm('expense')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <MinusCircle className="size-4" />
            <span>{isTe ? '− ఖర్చు నమోదు' : '− Add Expense'}</span>
          </button>

          {/* Voice Button with interactive recording & visualizer */}
          <button
            type="button"
            onClick={handleVoiceQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs bg-card hover:bg-muted text-foreground hover:border-primary/50"
            title="Open smart voice assistant with visualizer and multi-language support"
          >
            <Mic className="size-3.5 text-primary" />
            <span>{language === 'te' ? 'వాయిస్' : language === 'hi' ? 'वॉइस' : 'Voice'}</span>
          </button>

          {/* Smart OCR Slip & Ledger Scan Button */}
          <button
            type="button"
            onClick={() => setShowOcrModal(true)}
            className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-muted transition-colors shadow-xs hover:border-primary/50"
            title="Scan printed slips, mandi receipts, or handwritten ledger pages"
          >
            <Camera className="size-3.5 text-primary" />
            <span>{isTe ? 'స్లిప్ / లెడ్జర్ OCR' : isHi ? 'रसीद / खाता OCR' : 'Receipt / Ledger OCR'}</span>
          </button>
        </div>
      </section>

      {/* 3. Add Transaction Form Modal/Card */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col gap-4 border-primary/30 page-enter">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="font-semibold font-sora text-sm">
              {type === 'income' ? (isTe ? 'ఆదాయం నమోదు చేయండి' : 'Record New Income') : (isTe ? 'ఖర్చు నమోదు చేయండి' : 'Record New Expense')}
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ✕ Close
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
                    setCategory('Feed / Supplies');
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="₹ e.g. 2500"
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
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
                {(type === 'income' ? categories.income : categories.expense).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker defaulting to today */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">{t.date}</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDateIso(getTodayIso())}
                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    {isTe ? 'నేడు' : 'Today'}
                  </button>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      const yr = y.getFullYear();
                      const mo = String(y.getMonth() + 1).padStart(2, '0');
                      const da = String(y.getDate()).padStart(2, '0');
                      setSelectedDateIso(`${yr}-${mo}-${da}`);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                  >
                    {isTe ? 'నిన్న' : 'Yesterday'}
                  </button>
                </div>
              </div>
              <div className="relative mt-1.5">
                <input
                  type="date"
                  value={selectedDateIso}
                  onChange={(e) => setSelectedDateIso(e.target.value || getTodayIso())}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary cursor-pointer text-foreground"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {isTe ? 'ఎంచుకున్న తేదీ:' : 'Selected:'}{' '}
                <span className="font-semibold text-foreground">{formatIsoToDisplayDate(selectedDateIso)}</span>
              </p>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t.note}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sold 35 litres milk at morning counter"
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              {isTe ? 'రద్దు చేయండి' : 'Cancel'}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (isTe ? 'భద్రపరుస్తున్నాము...' : 'Saving...') : t.saveEntry}
            </Button>
          </div>
        </form>
      )}

      {/* 4. Ledger Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs hover-lift">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="font-semibold font-sora text-base">{t.recentTransactions}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entries.length} {isTe ? 'నమోదులు' : 'total verified records'}
            </p>
          </div>
          <button
            onClick={resetEntriesToDefault}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border bg-card cursor-pointer"
          >
            <RefreshCw className="size-3" />
            <span>{isTe ? 'నమూనా రీసెట్' : 'Reset Sample'}</span>
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground mb-3">
              <FileText className="size-6 opacity-70" />
            </div>
            <p className="text-sm font-semibold font-sora text-foreground">
              {isTe ? 'లాగ్‌బుక్ రికార్డులు ఏవీ లేవు' : 'No Transactions Recorded Yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {isTe
                ? 'మీ మొదటి లావాదేవీని నమోదు చేయడానికి "+ ఆదాయం" లేదా "− ఖర్చు" పై నొక్కండి.'
                : 'Start recording your daily sales or operational supplies to build your credit track-record.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => handleOpenForm('income')}>
                {isTe ? '+ ఆదాయం నమోదు' : '+ Add Income'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleOpenForm('expense')}>
                {isTe ? '− ఖర్చు నమోదు' : '− Add Expense'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">{t.date}</th>
                  <th className="py-2.5 px-3 font-semibold">{t.note}</th>
                  <th className="py-2.5 px-3 font-semibold">{t.category}</th>
                  <th className="py-2.5 px-3 font-semibold text-right">{t.amount}</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{isTe ? 'చర్య' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-muted/40">
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {formatIsoToDisplayDate(entry.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">{entry.note}</td>
                    <td className="py-3 px-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {entry.category}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-bold tabular-nums ${
                      entry.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}>
                      {entry.type === 'income' ? `+${formatINR(entry.amount)}` : `-${formatINR(entry.amount)}`}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-muted-foreground hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <VoiceInputModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        language={language}
        onLanguageChange={setLanguage}
        onExtracted={handleVoiceExtracted}
      />

      <OcrReviewModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        language={language}
        onSaveSingle={handleOcrSaveSingle}
        onSaveBatch={handleOcrSaveBatch}
      />
    </div>
  );
}

export default DigitalLogbookScreen;
