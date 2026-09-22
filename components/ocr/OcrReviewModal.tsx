'use client';

import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Plus,
  Edit3,
  Calendar,
  Languages,
  RefreshCw,
  Layers,
} from 'lucide-react';
import {
  OcrLanguage,
  performTesseractOcr,
  parseReceiptOrLedgerWithAiFallback,
  ParsedSlipResult,
  ParsedLedgerRow,
  ParsedOcrPayload,
} from '@/lib/ocr/parser';
import { formatINR } from '@/lib/utils/currency';

interface OcrReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'te' | 'hi';
  onSaveSingle: (entry: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    note: string;
  }) => void;
  onSaveBatch: (entries: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    note: string;
  }[]) => void;
}

type ScanStatus = 'idle' | 'processing' | 'review' | 'error';

export function OcrReviewModal({
  isOpen,
  onClose,
  language,
  onSaveSingle,
  onSaveBatch,
}: OcrReviewModalProps) {
  const [ocrLang, setOcrLang] = useState<OcrLanguage>(
    language === 'te' ? 'eng+tel' : language === 'hi' ? 'eng+hin' : 'eng'
  );
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Mode and Data
  const [mode, setMode] = useState<'single_slip' | 'multi_entry_ledger'>('single_slip');
  const [singleData, setSingleData] = useState<ParsedSlipResult | null>(null);
  const [ledgerRows, setLedgerRows] = useState<ParsedLedgerRow[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isTe = language === 'te';
  const isHi = language === 'hi';

  const categories = [
    'Sales',
    'Cooperative Payout',
    'Subsidy',
    'Feed / Supplies',
    'Raw Material',
    'Veterinary',
    'Wages',
    'Transport',
    'Rent & Power',
    'Other Income',
    'Other Expense',
  ];

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setStatus('processing');
    setErrorMsg('');
    setProgressPct(5);
    setProgressMsg(isTe ? 'రశీదు చిత్రాన్ని లోడ్ చేస్తున్నాము...' : 'Loading receipt image...');

    // Generate local preview URL & Base64
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64Img = reader.result as string;

      try {
        // 1. Tesseract OCR with Selected Multilingual Pack
        setProgressPct(15);
        setProgressMsg(isTe ? `అక్షరాలను గుర్తిస్తున్నాము [${ocrLang}]...` : `Running OCR [${ocrLang}]...`);

        const text = await performTesseractOcr(file, ocrLang, (pct, msg) => {
          setProgressPct(pct);
          setProgressMsg(msg);
        });

        setRawText(text);

        if (!text || text.trim().length < 5) {
          throw new Error(
            isTe
              ? 'చిత్రంలో స్పష్టమైన అక్షరాలు కనిపించలేదు. దయచేసి స్పష్టమైన ఫోటో తీయండి.'
              : 'No clear text recognized. Please ensure good lighting and focus.'
          );
        }

        // 2. Smart Parser + Gemini AI Fallback
        setProgressPct(85);
        setProgressMsg(isTe ? 'ఖాతా వివరాలను విశ్లేషిస్తున్నాము...' : 'Parsing receipt & ledger fields with Gemini AI...');

        const result: ParsedOcrPayload = await parseReceiptOrLedgerWithAiFallback(
          text,
          language,
          base64Img
        );

        setMode(result.mode);
        setSingleData(result.singleSlip);
        setLedgerRows(result.ledgerRows);

        setProgressPct(100);
        setStatus('review');
      } catch (err: any) {
        console.error('OCR Processing error:', err);
        setErrorMsg(err?.message || 'Failed to scan image.');
        setStatus('error');
      }
    };
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleSaveSingle = () => {
    if (!singleData) return;
    onSaveSingle({
      date: singleData.date || new Date().toISOString().split('T')[0],
      amount: singleData.totalAmount || 100,
      type: singleData.type,
      category: singleData.category || 'Sales',
      note: singleData.note || singleData.vendor,
    });
    onClose();
  };

  const handleSaveBatch = () => {
    if (ledgerRows.length === 0) return;
    const entries = ledgerRows.map((r) => ({
      date: r.date,
      amount: r.amount,
      type: r.type,
      category: r.category,
      note: r.note,
    }));
    onSaveBatch(entries);
    onClose();
  };

  const removeLedgerRow = (id: string) => {
    setLedgerRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateLedgerRow = (id: string, updates: Partial<ParsedLedgerRow>) => {
    setLedgerRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const addEmptyLedgerRow = () => {
    setLedgerRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        note: 'New entry',
        amount: 500,
        type: 'expense',
        category: 'Feed / Supplies',
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden modal-enter">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {isTe ? 'స్మార్ట్ రశీదు & లెడ్జర్ OCR' : isHi ? 'स्मार्ट रसीद एवं खाता बही OCR' : 'Smart Receipt & Ledger OCR'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isTe
                  ? 'రశీదు లేదా చేతితో రాసిన ఖాతా కాగితాన్ని స్కాన్ చేయండి'
                  : isHi
                  ? 'रसीद या हस्तलिखित खाता बही पृष्ठ स्कैन करें'
                  : 'Scan printed slips, mandi receipts, or handwritten ledger pages'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Language Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Languages className="size-3.5 text-primary" />
              OCR Language Script:
            </span>
            <div className="flex items-center gap-1">
              {[
                { code: 'eng', label: 'English' },
                { code: 'eng+tel', label: 'తెలుగు (Telugu)' },
                { code: 'eng+hin', label: 'हिन्दी (Hindi)' },
                { code: 'eng+tel+hin', label: 'All (Multi)' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  disabled={status === 'processing'}
                  onClick={() => setOcrLang(item.code as OcrLanguage)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    ocrLang === item.code
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Idle Mode: Upload Buttons */}
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Native Back-Camera Capture (capture="environment") */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2.5 p-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer group"
                >
                  <div className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
                    <Camera className="size-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">
                      {isTe ? 'కెమెరాతో ఫోటో తీయండి' : isHi ? 'कैमरा से फोटो लें' : 'Take Photo with Camera'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Direct device camera capture (capture="environment")
                    </p>
                  </div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraChange}
                  />
                </button>

                {/* Gallery File Upload */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2.5 p-6 rounded-2xl border-2 border-dashed hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group"
                >
                  <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                    <Upload className="size-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">
                      {isTe ? 'గ్యాలరీ నుండి అప్‌లోడ్ చేయండి' : isHi ? 'गैलरी से अपलोड करें' : 'Upload from Device'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      JPG, PNG, or scanned receipts
                    </p>
                  </div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGalleryChange}
                  />
                </button>
              </div>

              {/* Informative Guidance */}
              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  What can you scan?
                </p>
                <p>• <strong>Single Slips:</strong> Mandi receipts, cooperative milk payouts, feed bills, fertilizer invoices.</p>
                <p>• <strong>Handwritten Ledgers:</strong> Full paper notebook pages with daily income/expense rows.</p>
              </div>
            </div>
          )}

          {/* Processing State */}
          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <div className="relative">
                <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Sparkles className="size-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{progressMsg}</p>
                <div className="w-56 h-2 rounded-full bg-muted mt-3 mx-auto overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Applying language pack & Gemini extraction...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40">
                <AlertCircle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-800 dark:text-rose-300">Scan Error</p>
                  <p className="text-rose-700 dark:text-rose-400">{errorMsg}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Review & Confirm State */}
          {status === 'review' && (
            <div className="space-y-5">
              {/* Mode Toggle Switcher */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Detected Mode:</span>
                  <div className="inline-flex rounded-lg border p-0.5 bg-muted text-xs">
                    <button
                      type="button"
                      onClick={() => setMode('single_slip')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        mode === 'single_slip'
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Single Slip
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('multi_entry_ledger')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        mode === 'multi_entry_ledger'
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Multi-Row Ledger ({ledgerRows.length})
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <FileText className="size-3" />
                  {showRawText ? 'Hide OCR text' : 'View OCR text'}
                </button>
              </div>

              {/* Raw OCR Text Collapsible */}
              {showRawText && (
                <div className="p-3 rounded-xl bg-muted/50 border text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {rawText}
                </div>
              )}

              {/* MODE 1: SINGLE SLIP CONFIRMATION FORM */}
              {mode === 'single_slip' && singleData && (
                <div className="space-y-4 rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Receipt Details Confirmation
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      Keyword-Verified Total
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-muted-foreground font-medium">Vendor / Shop Name</label>
                      <input
                        type="text"
                        value={singleData.vendor}
                        onChange={(e) => setSingleData({ ...singleData, vendor: e.target.value })}
                        className="mt-1 w-full rounded-lg border px-3 py-2 bg-background font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium">Transaction Date</label>
                      <input
                        type="date"
                        value={singleData.date}
                        onChange={(e) => setSingleData({ ...singleData, date: e.target.value })}
                        className="mt-1 w-full rounded-lg border px-3 py-2 bg-background font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium">Total Amount (₹)</label>
                      <input
                        type="number"
                        value={singleData.totalAmount || ''}
                        onChange={(e) =>
                          setSingleData({ ...singleData, totalAmount: parseFloat(e.target.value) || 0 })
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2 bg-background font-bold text-base text-foreground font-sora"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium">Category</label>
                      <select
                        value={singleData.category}
                        onChange={(e) => setSingleData({ ...singleData, category: e.target.value })}
                        className="mt-1 w-full rounded-lg border px-3 py-2 bg-background font-medium"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-muted-foreground font-medium">Transaction Type</label>
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSingleData({ ...singleData, type: 'income' })}
                          className={`flex-1 py-1.5 rounded-lg border font-semibold text-xs transition-colors ${
                            singleData.type === 'income'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          + Income (ఆదాయం / आय)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSingleData({ ...singleData, type: 'expense' })}
                          className={`flex-1 py-1.5 rounded-lg border font-semibold text-xs transition-colors ${
                            singleData.type === 'expense'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          − Expense (ఖర్చు / खर्च)
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-muted-foreground font-medium">Note / Description</label>
                      <input
                        type="text"
                        value={singleData.note}
                        onChange={(e) => setSingleData({ ...singleData, note: e.target.value })}
                        className="mt-1 w-full rounded-lg border px-3 py-2 bg-background"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSingle}
                    className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="size-4" />
                    Confirm & Add Entry to Logbook
                  </button>
                </div>
              )}

              {/* MODE 2: MULTI-ENTRY LEDGER BATCH TABLE */}
              {mode === 'multi_entry_ledger' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="size-4 text-primary" />
                      Extracted Ledger Rows ({ledgerRows.length})
                    </span>
                    <button
                      type="button"
                      onClick={addEmptyLedgerRow}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="size-3" />
                      Add Row
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {ledgerRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-3 rounded-xl border bg-card hover:border-primary/40 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-muted-foreground">Row #{idx + 1}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateLedgerRow(row.id, {
                                  type: row.type === 'income' ? 'expense' : 'income',
                                })
                              }
                              className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                                row.type === 'income'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {row.type === 'income' ? '+ Income' : '− Expense'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLedgerRow(row.id)}
                              className="p-1 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground">Date</span>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => updateLedgerRow(row.id, { date: e.target.value })}
                              className="w-full rounded border px-2 py-1 bg-background text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">Amount (₹)</span>
                            <input
                              type="number"
                              value={row.amount}
                              onChange={(e) =>
                                updateLedgerRow(row.id, { amount: parseFloat(e.target.value) || 0 })
                              }
                              className="w-full rounded border px-2 py-1 bg-background font-bold text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground">Description</span>
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => updateLedgerRow(row.id, { note: e.target.value })}
                              className="w-full rounded border px-2 py-1 bg-background text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {ledgerRows.length === 0 && (
                      <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">
                        No rows detected. Click "Add Row" or switch to Single Slip mode.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={ledgerRows.length === 0}
                    onClick={handleSaveBatch}
                    className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" />
                    Save All {ledgerRows.length} Ledger Entries to Logbook
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="w-full py-2 rounded-xl border bg-muted/40 hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
              >
                Scan Another Receipt / Image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
