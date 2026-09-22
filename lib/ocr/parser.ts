/**
 * RuralCred Advisor — Multilingual OCR & Handwritten Ledger Parser.
 * Supports English (eng), Telugu (tel), Hindi (hin), and combined language packs.
 * 
 * Capabilities:
 * 1. Tesseract.js client-side OCR with progress tracking and language pack selection.
 * 2. Smart amount extraction prioritizing keywords (Total, మొత్తం, कुल) over raw Math.max.
 * 3. Date, vendor/shop name, and line-item extraction.
 * 4. Multi-entry batch extraction for photos of handwritten ledger pages (PRD Section 6).
 * 5. Gemini AI fallback pipeline when text is complex, handwritten, or ambiguous.
 */

export type OcrLanguage = 'eng' | 'tel' | 'hin' | 'eng+tel' | 'eng+hin' | 'eng+tel+hin';

export interface ParsedLineItem {
  description: string;
  amount: number;
}

export interface ParsedSlipResult {
  vendor: string;
  date: string;
  totalAmount?: number;
  type: 'income' | 'expense';
  category: string;
  note: string;
  lineItems: ParsedLineItem[];
  confidence: number;
  rawText: string;
}

export interface ParsedLedgerRow {
  id: string;
  date: string;
  note: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

export interface ParsedOcrPayload {
  mode: 'single_slip' | 'multi_entry_ledger';
  singleSlip: ParsedSlipResult;
  ledgerRows: ParsedLedgerRow[];
  source: 'local_parser' | 'gemini_ai';
}

/**
 * Executes Tesseract OCR with chosen language pack(s) and progress reporting.
 */
export async function performTesseractOcr(
  imageSource: File | Blob | string,
  languages: OcrLanguage = 'eng',
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const Tesseract = await import('tesseract.js');

  const result = await Tesseract.recognize(imageSource, languages, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct, `Reading text in [${languages}] (${pct}%)...`);
      } else if (m.status) {
        onProgress?.(20, `${m.status}...`);
      }
    },
  });

  return result?.data?.text || '';
}

/**
 * Normalizes date string into YYYY-MM-DD.
 */
function normalizeDate(rawDateStr: string): string {
  try {
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = rawDateStr.match(/(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})/);
    if (dmyMatch) {
      let day = parseInt(dmyMatch[1], 10);
      let month = parseInt(dmyMatch[2], 10);
      let year = parseInt(dmyMatch[3], 10);

      if (year < 100) year += 2000;
      if (month > 12 && day <= 12) {
        // Swap if month/day reversed
        const tmp = month;
        month = day;
        day = tmp;
      }

      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  } catch (e) {}

  // Default to today
  return new Date().toISOString().split('T')[0];
}

/**
 * Filter out numbers that represent phone numbers, PIN codes, or GSTIN digits.
 */
function isLikelyNonAmountNumber(num: number, rawStr: string): boolean {
  const str = Math.round(num).toString();
  // 10 digit phone number starting with 6, 7, 8, 9
  if (str.length === 10 && /^[6-9]/.test(str)) return true;
  // 6 digit PIN code starting with 5 (Telangana/Andhra: 500xxx, etc.)
  if (str.length === 6 && /^5\d{5}$/.test(str)) return true;
  // Standalone Year (e.g. 2024, 2025, 2026)
  if (num >= 2020 && num <= 2030 && !rawStr.includes('.')) return true;
  // Negative or excessive values
  if (num <= 0 || num > 5000000) return true;
  return false;
}

/**
 * Smart keyword-based parser for receipts and slips.
 */
export function extractSmartSlipData(rawText: string): ParsedSlipResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Extract Vendor / Shop Name (first non-empty line with letters)
  let vendor = 'Local Rural Enterprise';
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const line = lines[i];
    // Ignore lines that are only dates, numbers, or symbols
    if (line.replace(/[\d\s\W]/g, '').length >= 3) {
      vendor = line.replace(/[^\w\s\u0C00-\u0C7F\u0900-\u097F&.,'-]/g, '').trim();
      break;
    }
  }

  // 2. Extract Date
  let date = new Date().toISOString().split('T')[0];
  const dateRegex = /\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b/;
  for (const line of lines) {
    const dMatch = line.match(dateRegex);
    if (dMatch && dMatch[1]) {
      date = normalizeDate(dMatch[1]);
      break;
    }
  }

  // 3. Extract Total Amount
  // Keywords indicating a final total:
  const totalKeywords = [
    // English
    'grand total', 'net total', 'net amount', 'total amount', 'total due',
    'balance due', 'amount paid', 'net payable', 'sub total', 'subtotal',
    'total', 'amount', 'balance', 'paid',
    // Telugu
    'మొత్తం', 'మొత్తము', 'చెల్లించవలసిన మొత్తం', 'నికర మొత్తం', 'బిల్లు మొత్తం', 'ఖర్చు', 'చెల్లింపు',
    // Hindi
    'कुल योग', 'कुल राशि', 'देय राशि', 'शुद्ध राशि', 'कुल', 'योग', 'राशि', 'भुगतान'
  ];

  let totalAmount: number | undefined;
  let highestConfidence = 0;

  // First Pass: Find line containing a Total keyword and extract the number on that line or next line
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const kw of totalKeywords) {
      if (lineLower.includes(kw)) {
        // Look for number in current line
        const numMatches = lines[i].match(/\d+(?:[,\.]\d+)?/g);
        if (numMatches) {
          for (const m of numMatches) {
            const val = parseFloat(m.replace(/,/g, ''));
            if (!isNaN(val) && !isLikelyNonAmountNumber(val, m)) {
              totalAmount = val;
              highestConfidence = 0.85;
              break;
            }
          }
        }

        // If not found in current line, check next line
        if (!totalAmount && i + 1 < lines.length) {
          const nextMatches = lines[i + 1].match(/\d+(?:[,\.]\d+)?/g);
          if (nextMatches && nextMatches.length > 0) {
            const val = parseFloat(nextMatches[0].replace(/,/g, ''));
            if (!isNaN(val) && !isLikelyNonAmountNumber(val, nextMatches[0])) {
              totalAmount = val;
              highestConfidence = 0.75;
              break;
            }
          }
        }

        if (totalAmount) break;
      }
    }
    if (totalAmount) break;
  }

  // Second Pass Fallback: If no keyword match, collect valid numbers and pick the most reasonable amount
  if (!totalAmount) {
    const validCandidates: number[] = [];
    for (const line of lines) {
      const matches = line.match(/\d+(?:[,\.]\d+)?/g);
      if (matches) {
        for (const m of matches) {
          const val = parseFloat(m.replace(/,/g, ''));
          if (!isNaN(val) && !isLikelyNonAmountNumber(val, m) && val >= 10 && val < 500000) {
            validCandidates.push(val);
          }
        }
      }
    }
    if (validCandidates.length > 0) {
      // Pick the max reasonable candidate (excluding anomalies)
      totalAmount = Math.max(...validCandidates);
      highestConfidence = 0.55;
    }
  }

  // 4. Line Items Extraction
  const lineItems: ParsedLineItem[] = [];
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z\u0C00-\u0C7F\u0900-\u097F\s]{3,})\s+(?:.*?\s+)?(\d+(?:[,\.]\d+)?)$/);
    if (match && match[1] && match[2]) {
      const desc = match[1].trim();
      const itemAmt = parseFloat(match[2].replace(/,/g, ''));
      if (!isLikelyNonAmountNumber(itemAmt, match[2]) && itemAmt > 0 && itemAmt < (totalAmount || 100000)) {
        lineItems.push({ description: desc, amount: itemAmt });
      }
    }
  }

  // 5. Determine Transaction Type & Category
  const lowerText = rawText.toLowerCase();
  let type: 'income' | 'expense' = 'expense';
  let category = 'Feed / Supplies';

  if (
    lowerText.includes('sale') ||
    lowerText.includes('sold') ||
    lowerText.includes('payout') ||
    lowerText.includes('collection') ||
    lowerText.includes('అమ్మకం') ||
    lowerText.includes('బిక్రీ') ||
    lowerText.includes('बिक्री')
  ) {
    type = 'income';
    category = 'Sales';
  } else if (lowerText.includes('feed') || lowerText.includes('దాణా') || lowerText.includes('चारा')) {
    category = 'Feed / Supplies';
  } else if (lowerText.includes('fertilizer') || lowerText.includes('seeds') || lowerText.includes('ఎరువులు') || lowerText.includes('खाद')) {
    category = 'Raw Material';
  } else if (lowerText.includes('veterinary') || lowerText.includes('medical') || lowerText.includes('వైద్యం') || lowerText.includes('दवा')) {
    category = 'Veterinary';
  } else if (lowerText.includes('diesel') || lowerText.includes('petrol') || lowerText.includes('transport') || lowerText.includes('రవాణా')) {
    category = 'Transport';
  } else if (lowerText.includes('wages') || lowerText.includes('salary') || lowerText.includes('కూలీ') || lowerText.includes('मजदूरी')) {
    category = 'Wages';
  }

  return {
    vendor,
    date,
    totalAmount,
    type,
    category,
    note: `${vendor} (${category})`,
    lineItems,
    confidence: highestConfidence,
    rawText,
  };
}

/**
 * Multi-Entry Batch Extraction for Handwritten Paper Ledger Pages (PRD Section 6).
 * Splits recognized text into rows based on line breaks and repeated date/amount patterns.
 */
export function extractLedgerRows(rawText: string): ParsedLedgerRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedLedgerRow[] = [];
  const dateRegex = /\b(\d{1,2}[-/\.]\d{1,2}(?:[-/\.]\d{2,4})?)\b/;

  let lastKnownDate = new Date().toISOString().split('T')[0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find date in row if present
    const dateMatch = line.match(dateRegex);
    if (dateMatch && dateMatch[1]) {
      lastKnownDate = normalizeDate(dateMatch[1]);
    }

    // Look for monetary number in line
    const numbers = line.match(/\d+(?:[,\.]\d+)?/g);
    if (numbers && numbers.length > 0) {
      // Find the best candidate amount in this row
      const validRowNumbers = numbers
        .map((n) => parseFloat(n.replace(/,/g, '')))
        .filter((n) => !isNaN(n) && !isLikelyNonAmountNumber(n, n.toString()) && n >= 20 && n <= 500000);

      if (validRowNumbers.length > 0) {
        const rowAmount = validRowNumbers[validRowNumbers.length - 1];
        // Clean note text (remove the numbers and date)
        let noteText = line
          .replace(dateRegex, '')
          .replace(/\d+(?:[,\.]\d+)?/g, '')
          .replace(/[^\w\s\u0C00-\u0C7F\u0900-\u097F]/g, '')
          .trim();

        if (noteText.length < 3) {
          noteText = `Ledger entry row ${rows.length + 1}`;
        }

        const lowerRow = line.toLowerCase();
        let rowType: 'income' | 'expense' = 'expense';
        let rowCategory = 'Feed / Supplies';

        if (
          lowerRow.includes('sale') ||
          lowerRow.includes('sold') ||
          lowerRow.includes('cr') ||
          lowerRow.includes('credit') ||
          lowerRow.includes('ఆదాయం') ||
          lowerRow.includes('जमा')
        ) {
          rowType = 'income';
          rowCategory = 'Sales';
        }

        rows.push({
          id: `ledger-row-${Date.now()}-${rows.length}`,
          date: lastKnownDate,
          note: noteText,
          amount: rowAmount,
          type: rowType,
          category: rowCategory,
        });
      }
    }
  }

  return rows;
}

/**
 * Full OCR & Ledger pipeline with smart local parsing and Gemini AI fallback.
 */
export async function parseReceiptOrLedgerWithAiFallback(
  rawText: string,
  language: string = 'en',
  imageBase64?: string
): Promise<ParsedOcrPayload> {
  // 1. Run local heuristic extraction
  const singleSlip = extractSmartSlipData(rawText);
  const ledgerRows = extractLedgerRows(rawText);

  // If local parsing detected a clear multi-entry ledger page (3 or more rows with amounts)
  if (ledgerRows.length >= 3) {
    return {
      mode: 'multi_entry_ledger',
      singleSlip,
      ledgerRows,
      source: 'local_parser',
    };
  }

  // If single slip local parsing has high confidence, return local result
  if (singleSlip.totalAmount && singleSlip.confidence >= 0.8) {
    return {
      mode: 'single_slip',
      singleSlip,
      ledgerRows,
      source: 'local_parser',
    };
  }

  // 2. Fallback: Call Gemini AI extraction endpoint (/api/ai/ocr-parse)
  try {
    const res = await fetch('/api/ai/ocr-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ocrText: rawText,
        imageBase64,
        language,
      }),
    });

    if (res.ok) {
      const responseData = await res.json();
      if (responseData.success && responseData.data) {
        const aiData = responseData.data;

        if (aiData.mode === 'multi_entry_ledger' && Array.isArray(aiData.ledgerRows) && aiData.ledgerRows.length > 0) {
          const formattedRows: ParsedLedgerRow[] = aiData.ledgerRows.map((r: any, idx: number) => ({
            id: `ai-row-${Date.now()}-${idx}`,
            date: r.date ? normalizeDate(r.date) : singleSlip.date,
            note: r.note || `Ledger item ${idx + 1}`,
            amount: Number(r.amount) || 0,
            type: r.type === 'income' ? 'income' : 'expense',
            category: r.category || 'General',
          }));

          return {
            mode: 'multi_entry_ledger',
            singleSlip,
            ledgerRows: formattedRows,
            source: 'gemini_ai',
          };
        }

        if (aiData.singleSlip) {
          const s = aiData.singleSlip;
          return {
            mode: 'single_slip',
            singleSlip: {
              vendor: s.vendor || singleSlip.vendor,
              date: s.date ? normalizeDate(s.date) : singleSlip.date,
              totalAmount: s.totalAmount ?? singleSlip.totalAmount,
              type: s.type === 'income' ? 'income' : 'expense',
              category: s.category || singleSlip.category,
              note: s.note || singleSlip.note,
              lineItems: Array.isArray(s.lineItems) ? s.lineItems : singleSlip.lineItems,
              confidence: 0.95,
              rawText,
            },
            ledgerRows,
            source: 'gemini_ai',
          };
        }
      }
    }
  } catch (aiErr) {
    console.warn('[OCR Engine] Gemini AI extraction failed; using local parser result:', aiErr);
  }

  // 3. Return local result if AI unavailable or failed
  return {
    mode: ledgerRows.length >= 2 ? 'multi_entry_ledger' : 'single_slip',
    singleSlip,
    ledgerRows,
    source: 'local_parser',
  };
}
