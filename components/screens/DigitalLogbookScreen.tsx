'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
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
} from '@/lib/voice/speech';

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
    inputMode,
    syncStatus,
    dictionary,
  } = useApp();

  const t = dictionary.logbook;
  const isTe = language === 'te';

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('Sales');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('19 Sep 2026');
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrScanning(true);
    setOcrError(null);
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text || '';

      // Find amounts
      const matches = text.match(/\d+([,\.]\d+)?/g);
      if (matches && matches.length > 0) {
        const numbers = matches
          .map((n) => parseFloat(n.replace(/,/g, '')))
          .filter((n) => n >= 50 && n < 1000000);
        if (numbers.length > 0) {
          setAmount(Math.max(...numbers).toString());
        }
      }

      setNote(`Scanned Slip: ${text.slice(0, 35).replace(/[\r\n]+/g, ' ')}`);
      setShowAddForm(true);
    } catch (err: any) {
      setOcrError(
        isTe
          ? 'రశీదు స్కాన్ విఫలమైంది. దయచేసి వివరాలను మాన్యువల్‌గా నమోదు చేయండి.'
          : 'OCR scan failed. Please enter transaction details manually.'
      );
      setShowAddForm(true);
    } finally {
      setOcrScanning(false);
    }
  };

  const categories = {
    income: ['Sales', 'Cooperative Payout', 'Subsidy', 'Other Income'],
    expense: ['Feed / Supplies', 'Raw Material', 'Veterinary', 'Wages', 'Transport', 'Rent & Power'],
  };

  const handleVoiceQuickAdd = () => {
    if (!isSpeechRecognitionSupported()) {
      alert(dictionary.speechUnsupported);
      return;
    }

    setIsListening(true);
    startSpeechListening({
      language,
      onResult: (transcript) => {
        setIsListening(false);
        const parsed = parseSpokenTransaction(transcript);
        if (parsed.amount) {
          setAmount(parsed.amount.toString());
        }
        setType(parsed.type);
        setNote(parsed.note);
        setShowAddForm(true);
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount.replace(/[^\d]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    setSubmitting(true);
    await addNewEntry({
      date,
      amount: cleanAmount,
      type,
      category,
      note: note || (type === 'income' ? 'Daily sales receipt' : 'Operational supply expense'),
    });

    setAmount('');
    setNote('');
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
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Income */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.totalIncome}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <ArrowUpRight className="size-3" />
              {isTe ? 'ఆదాయం' : 'Inflow'}
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-emerald-800">
            {formatINR(totalIncome)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.filter((e) => e.type === 'income').length} {isTe ? 'లావాదేవీలు' : 'recorded receipts'}
          </p>
        </div>

        {/* Total Expenses */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.totalExpenses}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              <ArrowDownRight className="size-3" />
              {isTe ? 'ఖర్చులు' : 'Outflow'}
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-sora text-rose-800">
            {formatINR(totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.filter((e) => e.type === 'expense').length} {isTe ? 'ఖర్చు రికార్డులు' : 'recorded payments'}
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.netCashFlow}</p>
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
              netCashFlow >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
            }`}>
              {netCashFlow >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {netCashFlow >= 0 ? (isTe ? 'నికర మిగులు' : 'Net Surplus') : (isTe ? 'లోటు' : 'Deficit')}
            </div>
          </div>
          <p className={`mt-3 text-2xl font-bold font-sora ${netCashFlow >= 0 ? 'text-foreground' : 'text-rose-700'}`}>
            {formatINR(netCashFlow)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {syncStatus === 'synced' ? dictionary.syncedStatus : dictionary.waitingToSync}
          </p>
        </div>
      </div>

      {/* Action Header & Voice Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 font-semibold"
          >
            <PlusCircle className="size-4" />
            {showAddForm ? (isTe ? 'ఫారమ్ మూసివేయి' : 'Close Form') : t.addEntryBtn}
          </Button>

          <Button
            variant="outline"
            onClick={handleVoiceQuickAdd}
            className={`flex items-center gap-1.5 ${isListening ? 'border-destructive text-destructive animate-pulse' : ''}`}
          >
            <Mic className="size-4" />
            <span>{isListening ? (isTe ? 'వింటున్నాము...' : 'Listening...') : (isTe ? 'వాయిస్ ద్వారా నమోదు' : 'Voice Entry')}</span>
          </Button>

          {/* OCR Slip Scan Button */}
          <label className={`flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-muted transition-colors shadow-xs ${
            ocrScanning ? 'opacity-70 pointer-events-none' : ''
          }`}>
            <Camera className="size-3.5 text-primary" />
            <span>{ocrScanning ? (isTe ? 'స్కాన్ చేస్తోంది...' : 'Scanning...') : (isTe ? 'రశీదు OCR స్కాన్' : 'Scan Slip (OCR)')}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOcrUpload}
              disabled={ocrScanning}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetEntriesToDefault}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border bg-card"
          >
            <RefreshCw className="size-3" />
            <span>{isTe ? 'నమూనా డేటా రీసెట్' : 'Reset Demo Data'}</span>
          </button>
        </div>
      </div>

      {/* Add Transaction Form Modal/Card */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col gap-4 border-primary/30 animate-in fade-in duration-200">
          <h3 className="font-semibold font-sora text-sm">{t.addEntryBtn}</h3>

          <div className="grid gap-4 sm:grid-cols-4">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t.type}</label>
              <div className="mt-1.5 flex gap-1 rounded-lg border p-1 bg-background">
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setCategory('Sales');
                  }}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
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
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
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

            {/* Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t.date}</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
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
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Saving...' : t.saveEntry}
            </Button>
          </div>
        </form>
      )}

      {/* Cash Flow Chart (Recharts) */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="font-semibold font-sora text-base">{t.incomeVsExpense}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTe ? 'నగదు ప్రవాహ ధోరణి మరియు ఖర్చుల నియంత్రణ' : 'Deterministic weekly operational liquidity trend'}
            </p>
          </div>
        </div>

        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6EC" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#5C6479" />
              <YAxis tick={{ fontSize: 11 }} stroke="#5C6479" tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                formatter={(value: any) => [formatINR(Number(value)), '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E6EC' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Income" fill="#2F8F5B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#B23B3B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Ledger Table */}
      <section className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="font-semibold font-sora text-base">{t.recentTransactions}</h3>
          <span className="text-xs text-muted-foreground">
            {entries.length} {isTe ? 'నమోదులు' : 'total records'}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{t.date}</th>
                <th className="py-2.5 px-3 font-semibold">{t.note}</th>
                <th className="py-2.5 px-3 font-semibold">{t.category}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t.amount}</th>
                <th className="py-2.5 px-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-muted/40">
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{entry.date}</td>
                  <td className="py-3 px-3 font-medium text-foreground">{entry.note}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {entry.category}
                    </span>
                  </td>
                  <td className={`py-3 px-3 text-right font-bold tabular-nums ${
                    entry.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {entry.type === 'income' ? `+${formatINR(entry.amount)}` : `-${formatINR(entry.amount)}`}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
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
      </section>
    </div>
  );
}
