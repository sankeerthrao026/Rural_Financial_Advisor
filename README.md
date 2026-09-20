<div align="center">

# 🌾 RuralCred Advisor

### AI-Driven Hyper-Local Business Advisory & Financial Structuring for Rural Micro-Entrepreneurs

*Turning informal, instinct-run rural businesses into credit-ready, data-backed enterprises — in their own language, by voice.*

<br/>

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-1B2A4A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-1B2A4A?style=for-the-badge&logo=typescript&logoColor=3178C6)
![Python](https://img.shields.io/badge/Python-1B2A4A?style=for-the-badge&logo=python&logoColor=3776AB)
![FastAPI](https://img.shields.io/badge/FastAPI-2F8F5B?style=for-the-badge&logo=fastapi&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-E3A857?style=for-the-badge&logo=googlegemini&logoColor=12141C)
![ChromaDB](https://img.shields.io/badge/ChromaDB-12141C?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firestore-B23B3B?style=for-the-badge&logo=firebase&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

<br/>

**Deterministic finance. Grounded AI advisory. Bilingual, voice-first, and built for users banks currently can't see.**

</div>

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Our Solution](#2-our-solution)
3. [System Architecture](#3-system-architecture)
4. [Core Modules & Responsibilities](#4-core-modules--responsibilities)
5. [Why This Design — AI vs. Deterministic Logic](#5-why-this-design--ai-vs-deterministic-logic)
6. [Tech Stack](#6-tech-stack)
7. [Quick Start & Local Development](#7-quick-start--local-development)
8. [Automated Testing](#8-automated-testing)
9. [Environment Configuration](#9-environment-configuration)
10. [API Reference](#10-api-reference)
11. [Team](#11-team)

---

## 1. The Problem

Rural micro-entrepreneurs across India run real businesses — kirana stores, dairy and poultry units, small agri-processing units, tailoring and craft enterprises — almost entirely on instinct. There is no bookkeeping, no credit history, and no structured way to track pricing, cash flow, or profitability.

This isn't a knowledge gap that a generic app can fix. It's a structural exclusion problem:

- **Less than 22% of MSMEs in India have access to formal credit** — data scarcity, not creditworthiness, is the core barrier lenders cite. *(Source: TransUnion CIBIL–SIDBI MSME Pulse Report, July 2026)*
- **Existing advisory tools are generic and national-level.** They ignore the hyper-local factors that actually drive a rural business — local mandi prices, seasonal and festival demand, regional competition, and district-specific government schemes.
- **The result:** entrepreneurs can't access formal credit, can't plan expansion with any confidence, and can't even benchmark whether their own business is actually profitable.

Two problems compound each other here — no business advisory, and no financial structuring — and neither is solvable in isolation. Bad business decisions (over/under-stocking, mispricing) create cash-flow stress, which pushes entrepreneurs toward informal, high-interest lending, which leaves less capital for the business, which leads to worse decisions. Solving only one half of this loop treats a symptom, not the cause.

---

## 2. Our Solution

**RuralCred Advisor** is an AI-assisted advisory and financial-structuring platform that addresses both halves of that loop in one system — built specifically around the reality of a rural user: low or no literacy, vernacular-first communication, unreliable connectivity, and zero formal financial history.

### What it actually does

| Capability | What it means for the user |
|---|---|
| **Digital Logbook** | Converts voice, text, and handwritten ledger entries (via OCR) into structured business records — no behavior change required from the user |
| **AI Business Advisor** | Gives hyper-local pricing, demand, and timing recommendations, grounded in real local market and scheme data — not generic financial advice |
| **Deterministic Finance Engine** | Computes project cost, eligible loan amount, scheme routing, EMI, and full amortization schedules — using fixed, auditable formulas, not AI guesswork |
| **Financial Health Score** | A transparent 0–100 score built from logging consistency, profit trend, and expense-to-income discipline — explainable, not a black box |
| **Rule-Based Risk Engine** | Flags over-leverage, negative cash flow, and downward cash-flow trends before they become a crisis |
| **Scheme-Matching** | Matches the entrepreneur's actual profile against real government and NBFC schemes, instead of generic listings |
| **Bilingual, Voice-First Interface** | Full English/Telugu support with speech recognition and synthesis — literacy is never a barrier to using the core product |
| **Offline-Resilient Design** | Core functions remain usable without continuous connectivity |

### The core design principle

**Generative AI explains and advises. It never decides.** Every number that touches a user's money — project cost, loan eligibility, EMI, risk flags, the health score — is computed by deterministic, auditable logic. Gemini (via a RAG pipeline grounded in real local data) is responsible only for turning that grounded context into clear, conversational advice. This separation is deliberate: it means the system's financial decisions can always be explained and verified, and the AI is never the single point of failure for a recommendation that affects someone's livelihood.

---

## 3. System Architecture

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

**Data flow in one line:** user question → conversation context → embedding → ChromaDB retrieval → grounded context → Gemini → query-specific answer → frontend — while every financial number in that answer comes from the deterministic Finance and Risk engines, not from the language model.

---

## 4. Core Modules & Responsibilities

### Frontend — Next.js + React + TypeScript

- **Visual Design System** — Sora for headings, Inter for data/body text; custom RuralCred palette:
  `ink #12141C` · `indigo #1B2A4A` · `marigold #E3A857` · `growth #2F8F5B` · `alert #B23B3B` · `canvas #F7F8FA`
- **Bilingual Support** — instant toggle between English and Telugu (తెలుగు); one active language at a time, no mixed-language labels
- **Voice & Accessibility** — Web Speech API for Telugu/English speech recognition and synthesis; receipt/ledger OCR via Tesseract.js
- **Analytics Visualization** — Recharts-powered cash-flow, income vs. expense, and category cost views, with real-data entrance animations

### Backend — Python + FastAPI (Source of Truth)

**Deterministic Finance Engine**
- `Project Cost = Margin Capital ÷ 0.10`
- `Eligible Loan Amount = 90% of Project Cost`
- **Micro Finance Scheme** (Project Cost ≤ ₹1.40 Lakh): 6.5% p.a., 3-year tenure, 3-month moratorium
- **Term Loan Scheme** (₹1.40 Lakh < Project Cost ≤ ₹50 Lakh): 8.0% p.a., 7-year tenure, 6-month moratorium
- Quarterly reducing-balance EMI formula with full amortization schedule

**Rule-Based Risk Engine**
- `RULE_1` — Active loan + second loan simulation (over-leverage alert)
- `RULE_2` — Negative net cash flow (expenses exceed receipts)
- `RULE_3` — Downward net cash-flow trend (>30% drop from prior cycle)

**Financial Health Score (0–100)**
- 30% logging-habit consistency
- 40% net operating profit trend
- 30% expense-to-income discipline

**ChromaDB Vector Store & RAG Pipeline**
- Persistent semantic index of district demographics, mandi prices, and statutory schemes
- Repeatable ingestion via `python -m app.ingestion.ingest`
- Grounded context passed directly to the Gemini API (`gemini-2.5-flash`)
- A strict safety prompt ensures the generative layer never computes critical finance math or invents competitors/data that doesn't exist

---

## 5. Why This Design — AI vs. Deterministic Logic

| Layer | Type | Reasoning |
|---|---|---|
| Project cost, loan eligibility, EMI, amortization | **Deterministic** | These are facts, not predictions — there is no reason to introduce AI uncertainty into arithmetic that affects someone's loan |
| Financial Health Score | **Deterministic (weighted rules)** | Fully explainable to the user and to a judge/regulator — no black-box scoring |
| Risk flags (Rules 1–3) | **Deterministic** | A risk trigger needs to be reproducible and auditable, not probabilistic |
| Business & financial advisory language | **Generative AI (RAG + Gemini)** | Natural, conversational explanation genuinely benefits from an LLM — but only once grounded in real retrieved data |
| Scheme/context retrieval | **Vector similarity (ChromaDB)** | Ensures Gemini's advice is anchored to real local data, not memorized or hallucinated information |

This mixed-method approach is intentional: **AI where judgment and language matter, deterministic logic where facts and money are involved.**

---

## 6. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js + React + TypeScript | Web application, pages, components, state, routing, UI |
| Styling | Tailwind CSS | Responsive styling and the RuralCred visual system |
| Backend | Python + FastAPI | API layer, backend orchestration, business logic |
| Authentication | Supabase Auth | Login, registration, sessions, identity |
| Application database | Firebase Firestore | Persistent business/application data — profiles, logbook, state |
| AI vector database | ChromaDB | Embedding storage and retrieval for RAG |
| Generative AI | Gemini API (`gemini-2.5-flash`) | Natural-language advisory, explanations, conversation |
| AI architecture | RAG (Retrieval-Augmented Generation) | Retrieves relevant grounded knowledge before generation |
| Voice | Browser Web Speech API | Speech recognition (STT) and synthesis (TTS) |
| Charts | Recharts | Income/expense/cash-flow visualization |
| Icons | Lucide React | Professional vector icons — no emojis in the UI |
| OCR (optional) | Tesseract.js | Handwritten ledger/receipt text extraction |
| Deployment | Vercel (frontend); backend host TBD | Hosting and delivery |
| Version control | Git + GitHub | Source control and collaboration |

---

## 7. Quick Start & Local Development

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+

### Backend Setup (FastAPI + ChromaDB)

```powershell
# 1. Navigate to backend and create a virtual environment
cd backend
python -m venv venv

# Windows activation
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Ingest the local knowledge base into ChromaDB
$env:PYTHONPATH='backend'
python -m app.ingestion.ingest

# 4. Start the FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`

### Frontend Setup (Next.js)

```powershell
# From the repository root
npm install
npm run dev
```

Visit the application at `http://localhost:3000`

---

## 8. Automated Testing

### Backend Test Suite (Pytest)

```powershell
$env:PYTHONPATH='backend'
.\backend\venv\Scripts\pytest.exe backend/tests -v
```

Verifies:
- Micro Finance & Term Loan boundaries, quarterly EMI, zero-balance amortization schedules
- Deterministic 0–100 financial health scoring
- Risk detection rules (Rule 1, Rule 2, Rule 3)
- ChromaDB semantic similarity queries
- User isolation in logbook CRUD (User A never sees User B's entries)

### Frontend Typecheck & Build

```powershell
npx tsc --noEmit
npm run build
```

---

## 9. Environment Configuration

Create a `.env` or `.env.local` file with the following keys:

```env
# Gemini API Key (required for live AI generation; a resilient grounded local fallback is active when absent)
GEMINI_API_KEY=

# Supabase Authentication (optional — a resilient scoped local session is active by default)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Firebase Firestore (optional — resilient isolated local storage is active by default)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

---

## 10. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health status, ChromaDB connection, and Gemini configuration |
| `GET` | `/api/profile` | Retrieve the authenticated user's profile |
| `POST` | `/api/profile` | Create or update the user profile and onboarding status |
| `POST` | `/api/finance/calculate` | Compute deterministic project cost, scheme routing, EMI, amortization |
| `GET` | `/api/finance/health-score` | Compute the deterministic 0–100 financial health score |
| `POST` | `/api/risk/analyze` | Evaluate deterministic invariant financial risk rules |
| `GET` | `/api/logbook` | List user-scoped logbook transactions |
| `POST` | `/api/logbook` | Add an income or expense transaction |
| `DELETE` | `/api/logbook/{entry_id}` | Delete a transaction |
| `GET` | `/api/dashboard` | Aggregated dashboard — metrics, trends, risks, health score |
| `POST` | `/api/advisor/analyze` | ChromaDB RAG retrieval + Gemini-grounded business advisory |

---

## 11. Team

| Name | Role |
|---|---|
| Dhananjay Sharma | — |
| Rao Sankeerth | — |
| Granth Jigneshbhai Mangukiya | — |
| Medavarapu Saathvik | — |
| K. Akshith Kumar | — |

<div align="center">

**Team:** Pixel Scripters
**Repository:** [github.com/sankeerthrao026/ruralCred_Advisor](https://github.com/sankeerthrao026/ruralCred_Advisor)

</div>
