# RuralCred Advisor — Hyper-Local Business Advisory & Financial Structuring

> **Smart India Hackathon (SIH) Problem Statement 26091**  
> *AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs.*

---

## 1. System Architecture

```text
                                  USER
                                    │
                                    ▼
                         NEXT.JS + REACT FRONTEND
                        (UI, Charts, Forms, Speech)
                                    │
                              REST API / HTTP
                                    │
                                    ▼
                          PYTHON + FASTAPI BACKEND
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
     ▼                              ▼                              ▼
FINANCE ENGINE                 RISK ENGINE                  APPLICATION APIs
(100% Deterministic)       (Invariant Rules 1, 2, 3)     (Profile, Logbook, Dashboard)
     │                              │                              │
     └──────────────────────────────┼──────────────────────────────┘
                                    │
                                    ▼
                             AI / RAG PIPELINE
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
                ChromaDB        Local Data      Gemini API
             (Vector Store)     (JSON Datasets) (Generative AI)
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
                             AI RESPONSE & DATA
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            Firebase Firestore                Supabase Auth
        (User-Isolated Persistence)        (Identity & Sessions)
```

---

## 2. Core Modules & Responsibilities

### Next.js + React (Frontend)
- **Visual Design System**: Sora for headings, Inter for data, custom RuralCred palette (`--ink: #12141C`, `--indigo: #1B2A4A`, `--marigold: #E3A857`, `--growth: #2F8F5B`, `--alert: #B23B3B`, `--canvas: #F7F8FA`).
- **Bilingual Support**: Instant toggle between English and Telugu (తెలుగు) across all views.
- **Voice & Accessibility**: Web Speech API integration for Telugu/English speech recognition (STT) and synthesis (TTS), with receipt slip OCR scanning via Tesseract.js.
- **Analytics Visualization**: Dynamic Recharts charts for operational cash flow, income vs. expenses, and category cost allocation.

### Python + FastAPI (Backend Source of Truth)
- **Deterministic Finance Engine**:
  - `Project Cost = Margin Capital ÷ 0.10`
  - `Eligible Loan Amount = 90% of Project Cost`
  - **Micro Finance Scheme** (Project Cost $\le$ ₹1.40 Lakh): 6.5% p.a., 3 years tenure, 3-month moratorium.
  - **Term Loan Scheme** (₹1.40 Lakh < Project Cost $\le$ ₹50 Lakh): 8.0% p.a., 7 years tenure, 6-month moratorium.
  - Quarterly reducing balance EMI formula and full quarterly amortization schedule.
- **Rule-Based Risk Engine**:
  - `RULE_1`: Active loan + second loan simulation (Over-leverage alert).
  - `RULE_2`: Negative net cash flow (Expenses exceed receipts).
  - `RULE_3`: Downward net cash flow trend (>30% drop from prior cycle).
- **Financial Health Score (0–100)**:
  - 30% Logging habit consistency
  - 40% Net operating profit trend
  - 30% Expense-to-income discipline
- **ChromaDB Vector Store & RAG Pipeline**:
  - Persistent semantic vector database indexing district demographics, mandi prices, and statutory schemes.
  - Repeatable automated ingestion via `python -m app.ingestion.ingest`.
  - Grounded context retrieval supplied directly to Gemini API (`gemini-2.5-flash`).
  - Strict safety prompt ensuring generative AI never computes critical finance math or invents fake competitors.

---

## 3. Quick Start & Local Development

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+

### 1. Backend Setup (FastAPI + ChromaDB)

```powershell
# 1. Navigate to backend and create virtual environment
cd backend
python -m venv venv

# Windows Activation
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Ingest local knowledge base into ChromaDB
$env:PYTHONPATH='backend'
python -m app.ingestion.ingest

# 4. Start FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify backend health at: `http://127.0.0.1:8000/health`  
Interactive Swagger docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup (Next.js)

```powershell
# In the repository root
npm install
npm run dev
```

Visit application at: `http://localhost:3000`

---

## 4. Automated Testing

### Backend Test Suite (Pytest)
```powershell
$env:PYTHONPATH='backend'
.\backend\venv\Scripts\pytest.exe backend/tests -v
```
Verifies:
- Micro Finance & Term Loan boundaries, quarterly EMI, zero-balance amortization schedules.
- Deterministic 0-100 financial health scoring.
- Risk detection rules (Rule 1, Rule 2, Rule 3).
- ChromaDB semantic similarity queries.
- User isolation in logbook CRUD (User A never sees User B's entries).

### Frontend Typecheck & Build
```powershell
npx tsc --noEmit
npm run build
```

---

## 5. Environment Configuration

Create a `.env` or `.env.local` file with the following optional keys:

```env
# Gemini API Key (Required for live AI generation; resilient grounded local fallback active when absent)
GEMINI_API_KEY=

# Supabase Authentication (Optional: resilient scoped local session active by default)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Firebase Firestore (Optional: resilient isolated local storage active by default)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

---

## 6. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health status, ChromaDB connection, and Gemini configuration |
| `GET` | `/api/profile` | Retrieve authenticated user profile |
| `POST` | `/api/profile` | Create or update user profile and onboarding status |
| `POST` | `/api/finance/calculate` | Compute deterministic project cost, scheme routing, EMI, amortization |
| `GET` | `/api/finance/health-score` | Compute deterministic 0–100 financial health score |
| `POST` | `/api/risk/analyze` | Evaluate deterministic invariant financial rules |
| `GET` | `/api/logbook` | List user-scoped logbook transactions |
| `POST` | `/api/logbook` | Add income or expense transaction |
| `DELETE` | `/api/logbook/{entry_id}` | Delete transaction |
| `GET` | `/api/dashboard` | Aggregated dashboard: metrics, trends, risks, health |
| `POST` | `/api/advisor/analyze` | ChromaDB RAG retrieval & Gemini grounded business advisory |
