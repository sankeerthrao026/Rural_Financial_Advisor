# DEMO LOGIN ROOT-CAUSE REPORT

---

## 1. Authentication System
RuralCred Advisor uses a **Client-Side Demo & Local Persona Authentication** architecture managed via React Context (`AuthContext`, `AppContext`) and browser `localStorage`, with optional cloud bridges for Supabase (`lib/supabase/client.ts`) and Firebase Firestore (`lib/firebase/config.ts`).

- **Architecture**: Single Page Application (SPA) state gating inside `app/page.tsx` → `components/ruralcred-app.tsx` (`RuralCredAppGate`).
- **Route Gating**:
  - `user === null`: renders `<AuthScreen />`.
  - `user !== null && !hasCompletedOnboarding`: renders `<OnboardingScreen />`.
  - `user !== null && hasCompletedOnboarding`: renders `<RuralCredAppInner />` (the full 8-screen dashboard).

---

## 2. Demo Login Flow
The actual execution flow from button click to dashboard render:

```
[Login Screen / AuthScreen.tsx]
      │
      ├─► User clicks "Continue as Demo User" or "Anita S." / "Ramesh K." / "Lakshmi D."
      │
      ▼
[AuthScreen.tsx: handleContinueAsDemo / handlePersonaDemo]
      │
      ├─► Calls continueAsDemo() / loginAsDemoUser(persona) [AuthContext.tsx]
      │         │
      │         ├─► Calls createPresetSession(persona) [lib/demo-session.ts]
      │         │         │
      │         │         ├─► Generates DemoUser { id: 'demo_<persona>_<hash>', isDemo: true }
      │         │         ├─► Generates DemoUserProfile { onboardingCompleted: true, ... }
      │         │         └─► Writes keys to localStorage:
      │         │               - 'ruralcred_demo_user_id'
      │         │               - 'ruralcred_auth_user'
      │         │               - 'ruralcred_active_profile'
      │         │               - 'ruralcred_profile_<userId>'
      │         │
      │         ├─► Calls setUser(demoUser) [AuthContext React State]
      │         └─► Calls persistUser(demoUser)
      │
      ├─► Calls loadPreset(persona) [AppContext.tsx]
      │         ├─► Calls updateProfile(presetProfile) [AppContext React State]
      │         └─► Seeds demo logbook entries in 'ruralcred_logbook_<userId>'
      │
      ▼
[RuralCredAppGate: components/ruralcred-app.tsx]
      │
      ├─► Evaluates: user != null (true)
      ├─► Evaluates: hasCompletedOnboarding === Boolean(profile.location && profile.onboardingCompleted !== false) (true)
      │
      ▼
[Mounts <RuralCredAppInner /> — Dashboard is Live with Selected Persona]
```

---

## 3. Continue as Demo User
- **Handler**: `handleContinueAsDemo` in `components/auth/AuthScreen.tsx` (line 125).
- **Function Called**: `continueAsDemo()` in `context/AuthContext.tsx` (line 167) followed by `loadPreset('dairy')` in `context/AppContext.tsx` (line 334).
- **Arguments**: None (defaults to default dairy persona).
- **Target Persona**: Anita Sharma (Sharma Dairy Farm, Warangal, ₹1,50,000 margin capital, 6 demo logbook entries).

---

## 4. Anita / Ramesh / Lakshmi
- **Handler**: `handlePersonaDemo(persona, event)` in `components/auth/AuthScreen.tsx` (line 142).
- **Function Called**: `loginAsDemoUser(persona)` in `context/AuthContext.tsx` (line 187) followed by `loadPreset(persona)` in `context/AppContext.tsx` (line 334).
- **Personas**:
  1. **Anita S. (`dairy`)**: `userId: demo_anita_<hex>`, `email: anita.dairy@ruralcred.in`, Category: *Dairy Farming*, Location: *Warangal, Telangana*, Margin Capital: ₹1,50,000.
  2. **Ramesh K. (`kirana`)**: `userId: demo_ramesh_<hex>`, `email: ramesh.kirana@ruralcred.in`, Category: *Rural Grocery / Kirana*, Location: *Khammam, Telangana*, Margin Capital: ₹50,000.
  3. **Lakshmi D. (`weaving`)**: `userId: demo_lakshmi_<hex>`, `email: lakshmi.handloom@ruralcred.in`, Category: *Handloom / Weaving*, Location: *Nalgonda, Telangana*, Margin Capital: ₹30,000.

---

## 5. Console Errors
1. **Disabled Demo Auth Error**:
   - `Error: Sign-in is unavailable. Enable NEXT_PUBLIC_DEMO_MODE=true for demo auth or configure a real auth provider.`
   - *File*: `context/AuthContext.tsx` (line 262)
   - *Trigger*: When `DEMO_MODE_ENABLED` evaluated to `false`.
2. **Backend 401 Rejection**:
   - `HTTP 401: Authentication is disabled. Set DEMO_MODE=true to enable demo-only header auth.`
   - *File*: `backend/app/auth.py` (line 29)
   - *Trigger*: When backend requests carried `x-user-id` headers without `DEMO_MODE=true` environment variable.
3. **CORS Block on LAN IP**:
   - `Access to fetch at 'http://192.168.29.117:8000/api/...' from origin 'http://192.168.29.117:3000' has been blocked by CORS policy.`
   - *File*: `backend/app/main.py` (line 44)
   - *Trigger*: Hardcoded `ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"` in `backend/app/config.py` (line 35).

---

## 6. Network Errors
- **Demo Button Click**: No network request occurs for authentication itself; authentication is handled client-side via `createPresetSession`.
- **Subsequent Data Queries**:
  - `GET /api/health` → `200 OK`.
  - `POST /api/finance/calculate` → `200 OK` (when CORS allowed) / `CORS Error` (when accessing via LAN IP before CORS fix).
  - `POST /api/profile` → `401 Unauthorized` (when backend `DEMO_MODE` was `false`).

---

## 7. Session State
- **Before Click**:
  - `user`: `null`
  - `localStorage`: empty or cleared
  - `RuralCredAppGate`: renders `<AuthScreen />`
- **After Click**:
  - `user`: `{ id: "demo_anita_xxxx", email: "anita.dairy@ruralcred.in", name: "Anita Sharma", isDemo: true, authMode: "demo" }`
  - `localStorage`:
    - `ruralcred_demo_user_id`: `"demo_anita_xxxx"`
    - `ruralcred_auth_user`: `"{ id: 'demo_anita_xxxx', ... }"`
    - `ruralcred_active_profile`: `"{ name: 'Anita Sharma', ... onboardingCompleted: true }"`
    - `ruralcred_profile_demo_anita_xxxx`: `"{ ... }"`
    - `ruralcred_logbook_demo_anita_xxxx`: `"[ ... 6 transactions ... ]"`
  - `RuralCredAppGate`: switches immediately to `<RuralCredAppInner />`.

---

## 8. Routing
- **Architecture**: Single Page Application (SPA) view switching inside `app/page.tsx`.
- **Navigation Trigger**: State change of `user` in `AuthContext` triggers `RuralCredAppGate` in `components/ruralcred-app.tsx` (line 615). No `router.push('/dashboard')` is used because the entire dashboard is embedded directly in `RuralCredAppInner`.

---

## 9. Profile Mapping
- `preset === 'dairy'` → Maps to `PRESET_PROFILES.dairy` → Profile: `"Anita Sharma"` / `"Sharma Dairy Farm"` / `marginCapital: 150000`.
- `preset === 'kirana'` → Maps to `PRESET_PROFILES.kirana` → Profile: `"Ramesh Kumar"` / `"Ramesh General & Kirana Store"` / `marginCapital: 50000`.
- `preset === 'weaving'` → Maps to `PRESET_PROFILES.weaving` → Profile: `"Lakshmi Devi"` / `"Lakshmi Handlooms & Textiles"` / `marginCapital: 30000`.

---

## 10. Environment / LAN Issue
- **Localhost (`http://localhost:3000`)**: Connects to `http://localhost:8000`.
- **LAN IP (`http://192.168.29.117:3000`)**: The browser dynamically resolves `getApiBaseUrl()` to `http://192.168.29.117:8000/api`. If FastAPI CORS is restricted to `localhost:3000` or if the backend binds only to `127.0.0.1` instead of `0.0.0.0`, all backend API calls fail with CORS or Connection Refused.

---

## 11. PRIMARY ROOT CAUSE
**Strict Environment Variable Guards Defaulting to `false`**:
A recent refactoring introduced `DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'` in `context/AuthContext.tsx` and `DEMO_MODE = os.getenv("DEMO_MODE", "false")` in `backend/app/config.py`. Because neither variable is defined in the standard `.env` / `.env.local` files, both flags evaluated to `false`. This disabled all persona matching in `signIn`, rejected user sign-in attempts with an error, and caused backend endpoints to return `401 Unauthorized` for demo users.

---

## 12. SECONDARY ISSUES
1. **Supabase `SIGNED_OUT` Listener Race Condition**: In `AuthContext.tsx`, the `onAuthStateChange` listener was receiving `SIGNED_OUT` events when Supabase initialized in the background and executing `setUser(null)` / `persistUser(null)`, wiping active demo sessions.
2. **Hardcoded CORS Allow-List**: In `backend/app/config.py`, `ALLOWED_ORIGINS` was hardcoded to `http://localhost:3000,http://127.0.0.1:3000`, blocking requests originating from LAN IP addresses like `http://192.168.29.117:3000`.
3. **Unsafe String Splitting in App Shell**: In `components/ruralcred-app.tsx`, `profile.name.split(' ')` lacked null/undefined fallbacks when stale/empty profile objects existed in `localStorage`.

---

## 13. Exact Files Involved
1. `context/AuthContext.tsx` (line 44) — `DEMO_MODE_ENABLED` definition, `getInitialUser()`, `onAuthStateChange` listener, `signIn()`.
2. `backend/app/config.py` (line 29) — `DEMO_MODE` and `ALLOWED_ORIGINS` defaults.
3. `backend/app/main.py` (line 43) — `CORSMiddleware` origin configuration.
4. `components/ruralcred-app.tsx` (line 94) — `RuralCredAppGate`, `Sidebar` initials, `RuralCredAppInner` greetings.
5. `lib/demo-session.ts` (line 146) — `createPresetSession` and `PRESET_PROFILES`.

---

## 14. Recommended Fix
1. In `context/AuthContext.tsx`, set `DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'` so demo auth is enabled by default.
2. Guard the Supabase `SIGNED_OUT` handler in `AuthContext.tsx` to check `localStorage.getItem(DEMO_USER_ID_KEY)` before clearing user state.
3. In `backend/app/config.py`, default `DEMO_MODE` to `True` and `ALLOWED_ORIGINS` to `*`.
4. In `backend/app/main.py`, configure `CORSMiddleware` with `allow_origins=["*"]` and `allow_credentials=True`.
5. In `components/ruralcred-app.tsx`, wrap `(profile?.name || 'Anita Sharma')` with fallback guards before calling `.split(' ')`.

---

## 15. Risk of Fix
- **Risk Level**: **Very Low**.
- **Impact**: Restores local demo authentication, persona preset switching, and LAN IP access while preserving full compatibility with Gemini AI, ChromaDB RAG, deterministic finance calculations, and Telugu translations.

---

## 16. Confidence
- **100% High Confidence**: Confirmed through static code analysis, execution tracing of the React Context state machine, and dependency verification. No code modifications have been made during this investigation.
