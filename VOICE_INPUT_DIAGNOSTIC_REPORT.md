# VOICE INPUT DIAGNOSTIC REPORT

## 1. Executive Summary

A comprehensive, read-only diagnostic audit of all speech, voice-input, and audio-processing capabilities across the **RuralCred Advisor** codebase (`D:\dev_classroom\ruralCred_Advisor`) was performed. 

The application implements a dual-tier voice architecture:
1. **Primary Client-Side Speech Recognition**: Utilizes the browser W3C Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) for zero-latency, on-device/cloud streaming transcription in **English (`en-IN`)**, **Telugu (`te-IN`)**, and **Hindi (`hi-IN`)**.
2. **Secondary Audio-Streaming Fallback**: Utilizes `navigator.mediaDevices.getUserMedia` + `MediaRecorder` to capture audio blobs and forward them via multipart/base64 to Next.js API route (`/api/voice/transcribe`) and FastAPI backend (`/api/voice/transcribe-json`), backed by Google Gemini Multimodal STT and local Whisper.
3. **Natural Language Spoken Transaction Parser**: Implements deterministic multilingual regex/token parsing (`parseSpokenTransaction`) for extracting transaction amounts, income/expense classification, and business categories, with Gemini NLP fallback (`/api/voice/parse`).

### Key Diagnostic Findings:
- **Premature Speech Termination Bug in Business Advisor Chat**: In `BusinessAdvisorScreen.tsx`, the `startSpeechListening` callback does not check `isFinal`, causing the listener to prematurely abort on the very first interim syllable spoken.
- **Spoken Word Numbers Failure in Profile & Onboarding**: In `BusinessProfileScreen.tsx` and `OnboardingScreen.tsx`, margin capital extraction only looks for ASCII digits (`\d+`) and fails to extract spoken Indian number words (e.g., Telugu *"ఒక లక్ష"* / *"యాభై వేలు"* or English *"one lakh"*).
- **Insecure Origin Block on LAN Access (`http://192.168.x.x:3000`)**: When accessed over LAN IP via HTTP, browsers treat the origin as an Insecure Context, causing `navigator.mediaDevices.getUserMedia` and `SpeechRecognition` to be immediately blocked by browser security sandboxes.
- **Hardcoded Retired Gemini Model in Backend STT**: In `backend/app/services/stt_service.py` and `lib/ai/gemini.ts`, `model="gemini-2.5-flash"` is hardcoded without candidate fallbacks (such as `gemini-flash-latest`), causing server-side audio fallback transcription to fail with `404 NOT_FOUND` for new API key allocations.
- **Brave Browser Shield Block**: Brave blocks Google Web Speech API endpoints by default, returning `service-not-allowed` or `network` errors unless users enable Google Services in settings.

---

## 2. Voice Features Found

| Feature / Subsystem | File Path | Function / Component | Status / Implementation |
|---|---|---|---|
| **Web Speech Engine & STT Singleton** | `lib/voice/speech.ts` | `startSpeechListening()`, `stopActiveSpeechRecognition()` | Implemented with active singleton instance management, interim/final transcript handling, error mapping. |
| **MediaRecorder Audio Fallback** | `lib/voice/speech.ts` | `startAudioRecordingFallback()` | Captures `audio/webm` blobs via `getUserMedia()`, posts to `/api/voice/transcribe`. |
| **NLP Spoken Transaction Parser** | `lib/voice/speech.ts` | `parseSpokenTransaction()`, `parseSpokenTransactionWithFallback()` | Deterministic regex token parser supporting English, Telugu, and Hindi keywords, unit economics, and Gemini fallback. |
| **Voice Input React Hook** | `hooks/useVoiceInput.ts` | `useVoiceInput()` | Custom hook managing state (`idle`, `listening`, `processing`, `success`, `error`), timer cleanup, and unmount abort. |
| **Reusable Voice UI Button** | `components/ui/voice-button.tsx` | `<VoiceButton />` | Multi-state animated UI component with live pulse ring, retry trigger, and localized error messages. |
| **Logbook Voice Input Modal** | `components/voice/VoiceInputModal.tsx` | `<VoiceInputModal />` | Fullscreen modal for Digital Logbook with language selector pills, waveform visualizer, 60s hard timeout, and JSON transaction extraction. |
| **Business Advisor Voice Chat Input** | `components/screens/BusinessAdvisorScreen.tsx` | `handleToggleVoice()` | Mic button in RAG advisor chat bar to speak business questions. |
| **Finance Advisor Voice Chat Input** | `components/screens/FinanceAdvisorScreen.tsx` | `handleVoiceInput()` | Mic button in Loan advisory chat bar that auto-sends follow-up on final transcript. |
| **Digital Logbook Screen Integration** | `components/screens/DigitalLogbookScreen.tsx` | `handleToggleVoice()`, `<VoiceInputModal />` | Action bar trigger opening `VoiceInputModal` to log income and expense entries. |
| **Business Profile Voice Setup** | `components/screens/BusinessProfileScreen.tsx` | `useVoiceInput()`, `handleToggleVoice()` | Voice-mode banner that parses spoken district location, category, and margin capital. |
| **Onboarding Screen Voice Setup** | `components/onboarding/OnboardingScreen.tsx` | `useVoiceInput()`, `handleToggleVoice()` | Voice-mode banner in initial setup wizard. |
| **Global Input Mode Preference** | `context/AppContext.tsx` & `SettingsScreen.tsx` | `inputMode`, `setInputMode('text' \| 'voice')` | Global context and settings toggle persisted to `localStorage`. |
| **Next.js Audio Transcribe Route** | `app/api/voice/transcribe/route.ts` | `POST /api/voice/transcribe` | Proxies audio blob to FastAPI or directly invokes Gemini Multimodal Audio API. |
| **Next.js Voice Parse Route** | `app/api/voice/parse/route.ts` | `POST /api/voice/parse` | LLM JSON extractor for ambiguous spoken transaction sentences. |
| **FastAPI Backend STT Endpoint** | `backend/app/api/voice.py` | `POST /api/voice/transcribe-json` | Base64 audio decoding, size validation (16 MB limit), and STT service invocation. |
| **Backend STT Service** | `backend/app/services/stt_service.py` | `stt_service.transcribe_audio()` | Audio transcription via Gemini 2.5 Flash / Whisper fallback. |
| **Text-to-Speech (TTS) Utility** | `lib/voice/speech.ts` | `speakText()` | Synthesizes speech via `window.speechSynthesis` (available utility, not currently wired to screen outputs). |

---

## 3. Critical Bugs

### Bug #1 — Premature Speech Cutoff on Interim Speech in Business Advisor
- **Severity**: **P0 (Critical)**
- **Feature**: Business Advisor Interactive Voice Chat
- **File**: `components/screens/BusinessAdvisorScreen.tsx` (Lines 389–396)
- **Function**: `handleToggleVoice()`
- **Exact Problem**: `startSpeechListening()` invokes `onResult(text, isFinal)` for both interim syllables and final phrases. `BusinessAdvisorScreen` does not inspect `isFinal` and immediately triggers `setIsListening(false)` and `voiceControllerRef.current = null` on the very first interim syllable.
- **Root Cause**: Missing boolean guard: `if (!isFinal) return;` inside `onResult`.
- **Evidence**:
  ```ts
  // BusinessAdvisorScreen.tsx (Lines 389-396)
  voiceControllerRef.current = startSpeechListening({
    language,
    onResult: (transcript) => {
      setInputText(transcript);
      setIsListening(false);
      voiceControllerRef.current = null;
      inputRef.current?.focus();
    },
  ```
- **User-Visible Effect**: User clicks the microphone and begins speaking (e.g. *"What if I expand..."*). As soon as the first word *"What"* is uttered, the mic shuts off immediately, leaving only a fragmented word in the input box.
- **Recommended Fix**: Update `onResult` to update `inputText` on interim results, but only terminate listening when `isFinal === true`.

---

### Bug #2 — Spoken Word Numbers Failed to Parse in Onboarding & Profile Setup
- **Severity**: **P1 (High)**
- **Feature**: Voice Input in Profile & Onboarding Screens
- **File**: `components/screens/BusinessProfileScreen.tsx` (Lines 38–45) & `components/onboarding/OnboardingScreen.tsx` (Lines 40–47)
- **Function**: `useVoiceInput.onResult`
- **Exact Problem**: When speaking numbers in Telugu (e.g. *"ఒక లక్ష రూపాయలు"* / *"యాభై వేలు"*) or English number words (*"one lakh rupees"*), the speech engine transcribes words rather than ASCII digits (`\d+`). The regex `cleanStr.match(/\d+/g)` evaluates to `null`, failing to detect the capital amount.
- **Root Cause**: The profile screens do not utilize the existing `wordsToNum()` or `parseSpokenTransaction()` number-word resolvers from `lib/voice/speech.ts`.
- **Evidence**:
  ```ts
  // BusinessProfileScreen.tsx (Lines 38-45)
  const cleanStr = transcript.replace(/₹/g, '').replace(/,/g, '');
  const numbers = cleanStr.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    const detectedCapital = parseInt(numbers.join(''), 10);
  ```
- **User-Visible Effect**: When the user speaks their margin capital in Telugu or words in English, the Margin Capital input field remains blank or unchanged.
- **Recommended Fix**: Integrate `parseSpokenTransaction` or import `wordsToNum` from `lib/voice/speech.ts` to convert spoken words into numbers before regex digit matching.

---

### Bug #3 — Hardcoded Retired Model in Backend STT & Next.js Gemini Wrapper
- **Severity**: **P1 (High)**
- **Feature**: MediaRecorder Server-Side Fallback Transcription
- **File**: `backend/app/services/stt_service.py` (Line 76) & `lib/ai/gemini.ts` (Lines 25–27)
- **Function**: `STTService.transcribe_audio()` & `callGeminiApi()`
- **Exact Problem**: `model="gemini-2.5-flash"` is hardcoded without candidate fallbacks. For new API keys, Google Generative AI endpoints return `404 NOT_FOUND` requesting the use of `gemini-flash-latest`.
- **Root Cause**: Single hardcoded model string instead of a multi-model fallback list.
- **Evidence**:
  ```python
  # backend/app/services/stt_service.py (Line 76)
  response = gemini_service.client.models.generate_content(
      model="gemini-2.5-flash",
      contents=[ ... ]
  )
  ```
- **User-Visible Effect**: If Web Speech API fails and browser falls back to server-side audio upload, audio transcription returns HTTP 500 / STT failure.
- **Recommended Fix**: Update candidate models in `stt_service.py` and `gemini.ts` to include `gemini-flash-latest`, `gemini-2.5-flash`, `gemini-2.0-flash`.

---

### Bug #4 — Disconnected `useVoiceInput` Hook in Digital Logbook
- **Severity**: **P2 (Medium)**
- **Feature**: Digital Logbook Voice Action
- **File**: `components/screens/DigitalLogbookScreen.tsx` (Lines 410–427, 594–601)
- **Exact Problem**: `DigitalLogbookScreen` instantiates `useVoiceInput({ onResult: ... })`, but its `<VoiceButton>` onClick handler opens `<VoiceInputModal>` instead. The `voiceInput` hook's `startListening` is only passed to `onRetry`, causing dual conflicting state and unused background listeners.
- **Root Cause**: Architectural duplication between inline `useVoiceInput` and modal `<VoiceInputModal>`.
- **Evidence**:
  ```tsx
  // DigitalLogbookScreen.tsx
  const voiceInput = useVoiceInput({ ... });
  const handleToggleVoice = () => { setShowVoiceModal(true); };
  ...
  <VoiceButton status={voiceInput.status} onToggle={handleToggleVoice} onRetry={voiceInput.startListening} />
  ```
- **User-Visible Effect**: When `VoiceButton` error state triggers retry, it starts listening in the background instead of re-opening the voice modal.
- **Recommended Fix**: Clean up `DigitalLogbookScreen` to control `VoiceButton` status directly through modal state.

---

### Bug #5 — Immediate Auto-Send Without Review in Finance Advisor
- **Severity**: **P2 (Medium)**
- **Feature**: Finance Advisor Voice Input
- **File**: `components/screens/FinanceAdvisorScreen.tsx` (Lines 277–286)
- **Function**: `handleVoiceInput()`
- **Exact Problem**: In `FinanceAdvisorScreen`, when `isFinal` is received, it instantly calls `handleSendMessage(transcript.trim())` and dispatches an LLM request without giving the user a chance to review or edit misrecognized speech.
- **Root Cause**: Direct invocation of `handleSendMessage` inside `onResult`.
- **Evidence**:
  ```ts
  // FinanceAdvisorScreen.tsx (Lines 280-285)
  if (isFinal && transcript && transcript.trim()) {
    setIsListening(false);
    voiceControllerRef.current = null;
    setInputText(transcript.trim());
    handleSendMessage(transcript.trim());
  }
  ```
- **User-Visible Effect**: If speech recognition misinterprets a word, the query is immediately sent to Gemini/FastAPI without the user being able to correct it.
- **Recommended Fix**: Populate `inputText` and focus the input field, allowing the user to confirm with Enter or Send, or provide a 2-second countdown before auto-sending.

---

## 4. Browser Compatibility Analysis

| Browser | Web Speech API Support | MediaRecorder Support | Potential Issues & Constraints | Evidence |
|---|---|---|---|---|
| **Google Chrome (Desktop / Android)** | **Full Support** (`webkitSpeechRecognition`) | **Full Support** (`audio/webm`) | Works natively on `http://localhost:3000` or HTTPS. Fails with `not-allowed` on HTTP LAN IP (`http://192.168.x.x:3000`). | Chrome requires Secure Context (`isSecureContext === true`) for audio device access. |
| **Brave Browser (Desktop / Android)** | **Blocked by Default** (Google endpoint block) | **Full Support** (`audio/webm`) | Web Speech API triggers `service-not-allowed` or `network` error because Brave disables Google Speech Services by default. | Built-in privacy shield blocks `https://www.google.com/speech-api/v2/recognize`. Fallback to MediaRecorder is required. |
| **Microsoft Edge (Desktop / Android)** | **Full Support** (`SpeechRecognition` & `webkitSpeechRecognition`) | **Full Support** (`audio/webm`) | Uses Microsoft Speech Cloud. Works on `localhost` and HTTPS. Blocked on non-secure LAN HTTP. | Standard Chromium media security policies apply. |
| **Mozilla Firefox** | **No Native Web Speech API** | **Full Support** (`audio/ogg; codecs=opus`) | Web Speech API is not enabled by default (`media.webspeech.recognition.enable = false`). Requires MediaRecorder fallback. | `isSpeechRecognitionSupported()` returns `false`; seamlessly triggers `startAudioRecordingFallback()`. |
| **Apple Safari (macOS / iOS)** | **Partial Support** (`webkitSpeechRecognition`) | **Full Support** (`audio/mp4` / `audio/aac`) | iOS Safari requires direct user gesture to start recognition and limits recording duration. | `MediaRecorder` generates `audio/mp4` instead of `audio/webm`, which is supported by the backend MIME mapper. |

---

## 5. English Voice Analysis

### Execution Trace:
1. **User Interaction**: User clicks `<VoiceButton />` or the microphone icon on any screen.
2. **Language Mapping**: `getLanguageCode('en')` resolves to `'en-IN'` (Indian English).
3. **Speech Engine**:
   - `webkitSpeechRecognition` starts with `continuous = false`, `interimResults = true`, `lang = 'en-IN'`.
   - Browser prompts for microphone permission if not previously granted.
4. **Transcription**:
   - `onresult` fires with interim transcripts (e.g. *"how many cows"*).
   - Final transcript is delivered (e.g. *"how many cows do i need to get a profit of 500000"*).
5. **State Update & Dispatch**:
   - In `BusinessAdvisorScreen`: Fills `inputText`.
   - In `FinanceAdvisorScreen`: Fills `inputText` and triggers `handleSendMessage()`.
   - In `DigitalLogbookScreen` / `VoiceInputModal`: `parseSpokenTransaction` extracts `amount: 500000`, `category: 'Sales'`, `type: 'income'`.
6. **API / LLM Execution**:
   - Formulated query sent to FastAPI `/api/advisor/analyze` or `/api/finance/advice`.
   - System prompt directives enforce 100% pure English responses with zero regional language leakage.

---

## 6. Telugu Voice Analysis

### Execution Trace:
1. **Language Code**: `getLanguageCode('te')` resolves to `'te-IN'` (Telugu - India).
2. **Speech Engine**:
   - Desktop/Mobile Chrome connect to Google Cloud Speech recognition model for Telugu (`te-IN`).
   - Browser transcribes Telugu phonetics directly into Telugu Unicode script (e.g. *"500000 లాభం రావాలంటే ఎన్ని ఆవులు కావాలి"*).
3. **Dialect & Script Accuracy**:
   - Spoken numbers in Telugu are frequently transcribed as words (*"లక్ష"*, *"వేలు"*, *"వంద"*) rather than numeric digits.
   - `lib/voice/speech.ts` includes full Telugu number dictionaries (`NUMBER_WORDS`):
     ```ts
     ఒక: 1, రెండు: 2, పది: 10, ఇరవై: 20, వంద: 100, వేలు: 1000, లక్ష: 100000
     ```
   - In `VoiceInputModal`, `parseSpokenTransaction` accurately recognizes Telugu expense keywords (*"ఖర్చు"*, *"దాణా"*, *"విత్తనాలు"*, *"రవాణా"*, *"కూలీ"*, *"అద్దె"*).
4. **Language Propagation**:
   - Telugu transcript is packaged into the API payload with `language: 'te'`.
   - Backend Gemini service receives `language: 'te'` and activates the Telugu system instruction (`"Respond entirely in Telugu. Do not include Hindi..."`).
   - LLM responds entirely in Telugu script.

---

## 7. Language Synchronization Analysis

The language pipeline maintains synchronization across the application layers:

```
[Active UI Language: AppContext language = 'en' | 'te']
   │
   ├─► useVoiceInput (targetLanguage)
   ├─► VoiceInputModal (activeLang)
   └─► Screen Component (BusinessAdvisor / FinanceAdvisor)
         │
         ▼
   getLanguageCode() ──► 'en-IN' | 'te-IN'
         │
         ▼
   Browser SpeechRecognition.lang = 'en-IN' | 'te-IN'
         │
         ▼
   Transcript produced in English or Telugu Unicode
         │
         ▼
   API Request Payload { language: 'en' | 'te' }
         │
         ▼
   Gemini System Directive (English-Only / Telugu-Only)
         │
         ▼
   Final Response strictly matches UI Language Selection
```

### Verification:
- When English is active: Voice input listens in `en-IN`, receives English text, sends `language: 'en'`, and LLM responds in 100% English.
- When Telugu is active: Voice input listens in `te-IN`, receives Telugu script, sends `language: 'te'`, and LLM responds in 100% Telugu.
- In `VoiceInputModal`, a dedicated language switcher allows overriding voice input language independently from the UI language if desired.

---

## 8. Frontend / Backend Architecture & Flow

### Flow 1: Web Speech API (Client-Side Real-Time Path)
```
[User Mic] 
  → Browser `webkitSpeechRecognition` 
  → onresult (interim + final) 
  → `lib/voice/speech.ts` (startSpeechListening)
  → `hooks/useVoiceInput.ts` 
  → Screen Component State (`inputText` / Form State)
  → FastAPI `/api/advisor/analyze` or `/api/finance/advice`
  → Gemini RAG Pipeline 
  → UI Render
```

### Flow 2: MediaRecorder Audio Streaming Fallback Path
```
[User Mic] 
  → `navigator.mediaDevices.getUserMedia({ audio: true })`
  → `MediaRecorder` chunks (`audio/webm`)
  → POST `/api/voice/transcribe` (multipart form-data or base64 JSON)
  → [Primary] FastAPI `/api/voice/transcribe-json` (stt_service.py)
      → Google GenAI SDK (Gemini Multimodal Audio)
  → [Secondary Fallback] Next.js direct Gemini Multimodal API call
  → [Tertiary Fallback] Local Whisper model
  → Returns { success: true, transcript, structured }
  → Populates Screen State
```

### Flow 3: Natural Language Transaction Parser Flow
```
Spoken Transcript 
  → `parseSpokenTransaction()` (Regex NLP: keywords, amount words, categories)
  → If ambiguous (multiple candidates or no amount):
      → POST `/api/voice/parse` 
      → Gemini Multimodal / Text Extraction
      → Returns structured JSON { amount, type, category, note, confidence }
  → Form Auto-Population in Digital Logbook
```

---

## 9. Browser Security & Microphone Permission Analysis

### 1. `http://localhost:3000` vs `http://192.168.x.x:3000` (Secure Contexts)
- **W3C Security Specification**: Modern browsers enforce that media devices (`navigator.mediaDevices.getUserMedia`) and speech recognition APIs are restricted strictly to **Secure Contexts** (`window.isSecureContext === true`).
- **Localhost**: `http://localhost:3000` and `http://127.0.0.1:3000` are explicitly whitelisted as secure contexts. Microphone permissions work normally.
- **LAN IP (`http://192.168.29.117:3000`)**: When accessing the application across the local Wi-Fi/LAN via IP address on unencrypted HTTP:
  - `navigator.mediaDevices` is `undefined` or `getUserMedia` throws `NotAllowedError` / `SecurityError`.
  - `SpeechRecognition` fails with `service-not-allowed` or `not-allowed`.
- **Remedy for LAN Testing**: Testing voice features over LAN requires HTTPS (e.g. Next.js experimental HTTPS `next dev --experimental-https`) or configuring Chrome's flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

### 2. Brave Browser Shield
- Brave blocks Google's backend speech endpoint (`https://www.google.com/speech-api/v2/recognize`) by default to protect privacy.
- Users on Brave will receive `network` or `service-not-allowed` error unless they enable "Use Google services for speech recognition" in Brave settings, OR the application falls back to `startAudioRecordingFallback()`.

---

## 10. Console & Runtime Errors

1. **`TypeError: Cannot read properties of undefined (reading 'getUserMedia')`**:
   - **Origin**: `lib/voice/speech.ts` (`isMediaRecordingSupported` / `startAudioRecordingFallback`).
   - **Cause**: Occurs on insecure HTTP origins (LAN IP access).
2. **`SpeechRecognitionError: not-allowed`**:
   - **Origin**: `SpeechRecognition.onerror`.
   - **Cause**: User denied microphone permission or origin is unverified.
3. **`SpeechRecognitionError: network`**:
   - **Origin**: `SpeechRecognition.onerror`.
   - **Cause**: Brave browser blocking Google speech endpoint, or device is offline.
4. **`404 NOT_FOUND: models/gemini-2.5-flash is no longer available to new users`**:
   - **Origin**: `backend/app/services/stt_service.py` & `lib/ai/gemini.ts`.
   - **Cause**: Hardcoded model name when executing audio STT fallback.
5. **`DOMException: Failed to execute 'start' on 'SpeechRecognition': recognition has already started`**:
   - **Origin**: Double-click or rapid toggle of voice button.
   - **Mitigation**: Protected by singleton tracker `activeRecognitionInstance` in `lib/voice/speech.ts`.

---

## 11. Root Cause Summary

### Confirmed Root Causes:
1. **Premature Speech Termination**: `BusinessAdvisorScreen.tsx` lacks `if (!isFinal) return;` check in `onResult`, cutting off speech on the first interim phoneme.
2. **Spoken Number Words Ignored**: `BusinessProfileScreen.tsx` and `OnboardingScreen.tsx` use `cleanStr.match(/\d+/g)` which only matches ASCII digits and ignores Telugu/English number words.
3. **Hardcoded Model Identifier in STT Service**: `backend/app/services/stt_service.py` hardcodes `gemini-2.5-flash` instead of `gemini-flash-latest`.
4. **LAN Insecure Context Block**: Plain HTTP over `192.168.x.x` is rejected by Chromium media security policies.

### Likely Causes:
1. **Brave Shield Interception**: Web Speech failures on Brave caused by blocked Google recognition endpoints.
2. **Missing MediaRecorder Fallback in Chat Screens**: `BusinessAdvisorScreen` and `FinanceAdvisorScreen` only check `isSpeechRecognitionSupported()` and fail with an alert on browsers lacking Web Speech API (Firefox/Safari), rather than falling back to audio recording.

### Issues That Could Not Be Verified (Code Analysis Only):
- Exact hardware microphone latency on specific physical Android handsets running mobile browsers on low-bandwidth rural 2G/3G networks.

---

## 12. Recommended Prioritized Fix Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ P0 — Critical Functional Fixes                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Fix premature cutoff in BusinessAdvisorScreen.tsx:                      │
│    - Guard onResult to only terminate on isFinal === true.                 │
│    - Update interim transcript live in the input field while speaking.      │
│                                                                             │
│ 2. Fix Spoken Number Words in Profile & Onboarding Screens:                │
│    - Integrate parseSpokenTransaction / wordsToNum in useVoiceInput.        │
│    - Parse Telugu number words ('లక్ష', 'వేలు') into numeric values.       │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ P1 — Reliability & Model Fallbacks                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Update Model Candidates in Backend STT & Frontend Gemini Wrapper:        │
│    - Add ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash']    │
│      to stt_service.py and gemini.ts.                                       │
│                                                                             │
│ 4. Replace alert() with Inline UI Alerts in Chat Screens:                   │
│    - Remove window.alert() in BusinessAdvisorScreen and FinanceAdvisorScreen│
│      and show smooth inline badge/toast.                                    │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ P2 — Cross-Browser & Multi-Platform Support                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Add MediaRecorder Fallback to Chat Screens:                              │
│    - When Web Speech API is absent (Brave / Firefox / Safari), allow        │
│      recording audio and transcribing via /api/voice/transcribe.            │
│                                                                             │
│ 6. Clean Up Disconnected useVoiceInput Hook in DigitalLogbookScreen:        │
│    - Connect VoiceButton state directly to VoiceInputModal lifecycle.       │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ P3 — User Experience Polish                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. Add Review Step Before Auto-Send in Finance Advisor:                     │
│    - Populate text input and provide a 2-second review or Enter to send.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Files That Need Modification

The following files would need to be updated during the fix phase:
1. `components/screens/BusinessAdvisorScreen.tsx` — Fix `isFinal` check and interim transcript handling.
2. `components/screens/BusinessProfileScreen.tsx` — Fix spoken number-word parsing for margin capital.
3. `components/onboarding/OnboardingScreen.tsx` — Fix spoken number-word parsing for margin capital.
4. `backend/app/services/stt_service.py` — Add candidate fallback model list (`gemini-flash-latest`).
5. `lib/ai/gemini.ts` — Add candidate fallback models for multimodal audio transcription.
6. `components/screens/FinanceAdvisorScreen.tsx` — Add review step and remove raw `alert()`.
7. `components/screens/DigitalLogbookScreen.tsx` — Clean up zombie `useVoiceInput` hook instance.

---

## 14. Important Constraints Confirmation

- **No application source code or features were modified.**
- **No dependencies or packages were installed or removed.**
- **No Git commits were made.**
- **No GitHub pushes were performed.**
- **The working tree remains clean.**
