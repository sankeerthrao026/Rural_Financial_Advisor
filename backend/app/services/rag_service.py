import hashlib
import json
import threading
import time
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional, Tuple

from app.models.schemas import (
    AdvisorAnalyzeRequest,
    AdvisorAnalyzeResponse,
    MarketReach,
    OpportunityAnalysis,
    SWOTAnalysis,
    CompetitorDensity,
    PricingSuggestion,
    GroundedFacts,
)
from app.services.chroma_service import chroma_service
from app.services.gemini_service import gemini_service
from app.services.business_calculator import business_calculator, detect_business_domain

DOMAIN_NAMES_EN = {
    "handloom_weaving": "Handloom & Powerloom Weaving",
    "dairy_farming": "Dairy Farming & Milk Production",
    "retail_shop": "Kirana & General Retail Shop",
    "poultry_farming": "Poultry Farming & Broiler Unit",
    "tailoring_garments": "Tailoring & Garment Boutique",
    "agri_processing": "Agri-Processing & Milling Unit",
    "agriculture_crop": "Crop Farming & Agriculture",
    "general_enterprise": "Micro Enterprise",
}

DOMAIN_NAMES_TE = {
    "handloom_weaving": "చేనేత & మగ్గం పరిశ్రమ",
    "dairy_farming": "పాడి పరిశ్రమ & పాల ఉత్పత్తి",
    "retail_shop": "కిరాణా & జనరల్ స్టోర్",
    "poultry_farming": "పౌల్ట్రీ & బ్రాయిలర్ ఫామ్",
    "tailoring_garments": "టైలరింగ్ & రెడీమేడ్ దుస్తులు",
    "agri_processing": "వ్యవసాయ ప్రాసెసింగ్ & మిల్లు",
    "agriculture_crop": "వ్యవసాయం & పంటలు",
    "general_enterprise": "సూక్ష్మ వ్యాపారం",
}

def clean_for_english(text: str) -> str:
    """Removes Telugu, Hindi, Devanagari, Kannada scripts and bilingual parentheticals for English mode."""
    if not text:
        return ""
    # Remove parenthetical regional language annotations like (పాడి పరిశ్రమ / दुग्ध व्यवसाय) or (గుంటూరు) or (వరంగల్)
    t = re.sub(r'\s*\([^)]*[\u0900-\u0D7F][^)]*\)', '', text)
    # Remove slash regional language annotations like / दुग्ध व्यवसाय or / నాటు కోళ్ల
    t = re.sub(r'\s*/\s*[\u0900-\u0D7F\s/]+', '', t)
    # Remove any stray Indic characters (Devanagari, Telugu, Kannada, Tamil, etc.)
    t = re.sub(r'[\u0900-\u0D7F]', '', t)
    # Clean up double slashes or trailing slashes
    t = re.sub(r'\s*/\s*$', '', t)
    # Normalize multiple whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def clean_for_telugu(text: str) -> str:
    """Extracts pure Telugu script representation without English or Hindi parentheticals."""
    if not text:
        return ""
    # Look for Telugu segment in parentheses
    te_paren = re.search(r'\(([^)]*[\u0C00-\u0C7F][^)]*)\)', text)
    if te_paren:
        inner = te_paren.group(1)
        parts = [p.strip() for p in inner.split('/')]
        for p in parts:
            if re.search(r'[\u0C00-\u0C7F]', p):
                cleaned = re.sub(r'[^\u0C00-\u0C7F\s&/]', '', p).strip()
                if cleaned:
                    return cleaned

    # Look for direct Telugu segment in text
    if re.search(r'[\u0C00-\u0C7F]', text):
        parts = [p.strip() for p in text.split('/')]
        for p in parts:
            if re.search(r'[\u0C00-\u0C7F]', p):
                cleaned = re.sub(r'[^\u0C00-\u0C7F\s&/]', '', p).strip()
                if cleaned:
                    return cleaned

    # Common English terms mapping to standard Telugu
    mapping = {
        "dairy": "పాడి పరిశ్రమ",
        "poultry": "పౌల్ట్రీ పరిశ్రమ",
        "weaving": "చేనేత పరిశ్రమ",
        "kirana": "కిరాణా వ్యాపారం",
        "tailoring": "టైలరింగ్ వ్యాపారం",
        "agro": "వ్యవసాయ ప్రాసెసింగ్",
        "warangal": "వరంగల్",
        "guntur": "గుంటూరు",
        "mandya": "మండ్య",
        "west godavari": "పశ్చిమ గోదావరి",
        "east godavari": "తూర్పు గోదావరి",
        "khammam": "ఖమ్మం",
        "karimnagar": "కరీంనగర్",
        "nalgonda": "నల్గొండ",
        "mahbubnagar": "మహబూబ్‌నగర్",
        "nizamabad": "నిజామాబాద్",
        "medak": "మెదక్",
        "adilabad": "ఆదిలాబాద్",
        "krishna": "కృష్ణా",
        "visakhapatnam": "విశాఖపట్నం",
        "chittoor": "చిత్తూరు",
        "rangareddy": "రంగారెడ్డి",
    }
    low = text.lower()
    for k, v in mapping.items():
        if k in low:
            return v
    return text

def has_cross_domain_contamination(text: str, domain: str, is_te: bool) -> bool:
    """Checks if text contains unwanted dairy/cow keywords when the active domain is NOT dairy."""
    if not text or domain == "dairy_farming":
        return False

    dairy_patterns_en = [
        r"\b(?:milch|cow|cows|buffalo|buffaloes|milking|lactation|cattle)\b",
        r"\b2-cow\s*unit\b",
        r"\bmilk\s*yield\b",
        r"\blitres?\s*of\s*milk\b",
    ]
    dairy_patterns_te = [
        r"పాడి\s*ఆవు", r"ఆవులు", r"గేదెలు", r"గేదె", r"పాల\s*దిగుబడి", r"మిల్చ్"
    ]
    patterns = dairy_patterns_te if is_te else dairy_patterns_en
    for pat in patterns:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False

class AdvisorCache:
    """Thread-safe, in-memory LRU/TTL cache for deterministic SWOT advisory results."""
    def __init__(self, max_size: int = 256, ttl_seconds: int = 900):
        self._cache: Dict[str, Tuple[float, AdvisorAnalyzeResponse]] = {}
        self._lock = threading.Lock()
        self._max_size = max_size
        self._ttl = ttl_seconds

    def _generate_key(self, req: AdvisorAnalyzeRequest) -> str:
        hist_str = ""
        if req.history:
            hist_str = "|".join(f"{h.role}:{h.content}" for h in req.history[-4:])
        raw = f"{req.location}|{req.category}|{req.marginCapital}|{req.language}|{req.userQuery or ''}|{hist_str}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, req: AdvisorAnalyzeRequest) -> Optional[AdvisorAnalyzeResponse]:
        key = self._generate_key(req)
        now = time.time()
        with self._lock:
            if key in self._cache:
                timestamp, data = self._cache[key]
                if now - timestamp < self._ttl:
                    return data
                del self._cache[key]
        return None

    def set(self, req: AdvisorAnalyzeRequest, data: AdvisorAnalyzeResponse):
        key = self._generate_key(req)
        now = time.time()
        with self._lock:
            if len(self._cache) >= self._max_size:
                oldest_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k][0])[:max(1, self._max_size // 5)]
                for k in oldest_keys:
                    del self._cache[k]
            self._cache[key] = (now, data)

_advisor_cache = AdvisorCache()

class RAGService:
    def _build_compact_context(
        self,
        district_name: str,
        category_name: str,
        mandi_trends: str,
        seasonality: str,
        pricing_band: str,
        margin_text: str,
        risks_list: List[str],
        retrieved_items: List[Dict[str, Any]],
        language: str = "en",
    ) -> str:
        """Constructs a clean, compact structured JSON context instead of raw document dumps."""
        is_te = language == "te"
        signals = []
        for item in retrieved_items:
            doc = item.get("document", "").strip()
            cleaned_lines = [
                l.strip() for l in doc.splitlines()
                if l.strip() and not l.startswith("Document ID:") and not l.startswith("Category:")
            ]
            if cleaned_lines:
                sig = " ".join(cleaned_lines[:3])
                if not is_te:
                    sig = clean_for_english(sig)
                signals.append(sig)

        clean_dist = clean_for_telugu(district_name) if is_te else clean_for_english(district_name)
        clean_cat = clean_for_telugu(category_name) if is_te else clean_for_english(category_name)
        clean_mandi = mandi_trends if is_te else clean_for_english(mandi_trends)
        clean_pricing = pricing_band if is_te else clean_for_english(pricing_band)
        clean_margin = margin_text if is_te else clean_for_english(margin_text)
        clean_risks = risks_list if is_te else [clean_for_english(r) for r in risks_list]

        compact = {
            "district": clean_dist,
            "category": clean_cat,
            "mandi_trends": clean_mandi or "Standard mandi off-take",
            "demand_seasonality": seasonality or "Year-round demand",
            "pricing_benchmark": clean_pricing,
            "target_margin": clean_margin,
            "key_risks": clean_risks[:3],
            "relevant_signals": signals[:3],
        }
        return json.dumps(compact, ensure_ascii=False)

    def analyze_business_opportunity(self, req: AdvisorAnalyzeRequest) -> AdvisorAnalyzeResponse:
        """
        Optimized Low-Latency Query-Aware RAG Pipeline:
          1. Safe in-memory cache lookup.
          2. Multi-turn domain & intent classification (Priority: query > history > profile category).
          3. Focused ChromaDB vector retrieval for the active domain.
          4. Compact structured context synthesis.
          5. Grounded Gemini AI generation with strict anti-contamination prompt & validation.
          6. High-fidelity domain-grounded fallback.
        """
        t_start = time.time()

        # 0. Check cache
        cached_result = _advisor_cache.get(req)
        if cached_result:
            print(f"[CACHE HIT] Returning advisory result from in-memory cache in {(time.time() - t_start)*1000:.1f}ms.")
            return cached_result

        is_te = req.language == "te"
        loc_str = req.location or "Warangal"
        clean_loc = clean_for_english(loc_str)

        # 1. Multi-turn Domain & Intent Detection (Current query has HIGHEST priority)
        history_dicts = [{"role": h.role, "content": h.content} for h in req.history] if req.history else []
        intent_info = business_calculator.classify_intent(
            query=req.userQuery or "",
            history=history_dicts,
            fallback_category=req.category or "Dairy Farming"
        )
        detected_domain = intent_info.get("domain", "general_enterprise")

        # Resolve active category name according to detected domain
        if detected_domain in DOMAIN_NAMES_EN and detected_domain != "general_enterprise":
            clean_cat = DOMAIN_NAMES_EN[detected_domain]
            base_cat_display = DOMAIN_NAMES_TE[detected_domain] if is_te else DOMAIN_NAMES_EN[detected_domain]
        else:
            cat_str = req.category or "Micro Enterprise"
            clean_cat = clean_for_english(cat_str)
            base_cat_display = clean_for_telugu(cat_str) if is_te else clean_cat

        print(f"[ADVISOR DIAGNOSTICS] Query: '{req.userQuery}' | Detected Domain: '{detected_domain}' | Intent: '{intent_info['intent']}' | Target: {intent_info.get('targetAmount')} | District: '{clean_loc}' | Category: '{clean_cat}'")

        # 2. Semantic ChromaDB Query Construction for Active Domain
        if req.userQuery and req.userQuery.strip():
            query_text = f"{clean_loc} {clean_cat} {req.userQuery}".strip()
        else:
            query_text = f"{clean_loc} {clean_cat} micro business demand pricing benchmarks".strip()

        t_chroma_start = time.time()
        retrieved_items = chroma_service.query_similar(query_text=query_text, n_results=4)
        t_chroma_ms = (time.time() - t_chroma_start) * 1000

        sources_used = []
        category_name = base_cat_display
        district_name = loc_str
        mandi_trends_text = ""
        seasonality_text = ""
        risks_list = []
        margin_text = "18% - 28%"
        pricing_band = "Prevailing District Mandi Rate"

        best_cat_item = None
        best_dist_item = None

        # Filter retrieved documents matching active domain & district
        for item in retrieved_items:
            meta = item.get("metadata", {})
            dist = item.get("distance", 1.0)
            
            if dist < 1.35 or not req.userQuery:
                source_label = meta.get("name") or meta.get("category") or item.get("id")
                clean_label = source_label if is_te else clean_for_english(str(source_label))
                sources_used.append(f"ChromaDB [{meta.get('type', 'local_dataset')}]: {clean_label}")

            if meta.get("type") == "market_benchmark":
                meta_name = (meta.get("name", "") + " " + meta.get("category", "")).lower()
                if clean_cat.lower() in meta_name:
                    best_cat_item = item
                elif best_cat_item is None:
                    best_cat_item = item
            elif meta.get("type") == "district_demographics":
                meta_dist = (meta.get("name", "") + " " + meta.get("district", "")).lower()
                if clean_loc.lower() in meta_dist:
                    best_dist_item = item
                elif best_dist_item is None:
                    best_dist_item = item

        # Supplement lookups if needed
        if (clean_cat and not best_cat_item) or (clean_loc and not best_dist_item):
            with ThreadPoolExecutor(max_workers=2) as executor:
                cat_future = executor.submit(chroma_service.query_similar, f"Category benchmark: {clean_cat}", 2) if clean_cat and not best_cat_item else None
                dist_future = executor.submit(chroma_service.query_similar, f"District demographics: {clean_loc}", 2) if clean_loc and not best_dist_item else None
                if cat_future:
                    spec_cat = cat_future.result()
                    if spec_cat:
                        best_cat_item = spec_cat[0]
                if dist_future:
                    spec_dist = dist_future.result()
                    if spec_dist:
                        best_dist_item = spec_dist[0]

        if best_cat_item:
            c_meta = best_cat_item.get("metadata", {})
            category_name = c_meta.get("name", category_name)
            for line in best_cat_item["document"].splitlines():
                if line.startswith("Hyper-Local Mandi Price Trends & Seasonality:"):
                    mandi_trends_text = line.replace("Hyper-Local Mandi Price Trends & Seasonality:", "").strip()
                elif line.startswith("Demand Seasonality:"):
                    seasonality_text = line.replace("Demand Seasonality:", "").strip()
                elif line.startswith("Expected Profit Margin:"):
                    margin_text = line.replace("Expected Profit Margin:", "").strip()
                elif line.startswith("Pricing Benchmarks:"):
                    pricing_band = line.replace("Pricing Benchmarks:", "").strip()
                elif line.startswith("Locality Operating Risks:"):
                    risks_raw = line.replace("Locality Operating Risks:", "").strip()
                    risks_list = [r.strip() for r in risks_raw.split(";") if r.strip()]

        if best_dist_item:
            d_meta = best_dist_item.get("metadata", {})
            district_name = d_meta.get("name", district_name)

        # Clean names based on target language
        display_category = clean_for_telugu(category_name) if is_te else clean_for_english(category_name)
        display_district = clean_for_telugu(district_name) if is_te else clean_for_english(district_name)
        display_pricing = pricing_band if is_te else clean_for_english(pricing_band)
        display_margin = margin_text if is_te else clean_for_english(margin_text)
        display_mandi = mandi_trends_text if is_te else clean_for_english(mandi_trends_text)
        display_risks = risks_list if is_te else [clean_for_english(r) for r in risks_list]

        # 3. Compact Context Construction
        compact_context = self._build_compact_context(
            district_name=display_district,
            category_name=display_category,
            mandi_trends=display_mandi,
            seasonality=seasonality_text,
            pricing_band=display_pricing,
            margin_text=display_margin,
            risks_list=display_risks,
            retrieved_items=retrieved_items,
            language=req.language,
        )

        # 4. Deterministic Calculation Summary if applicable
        calc_summary = ""
        if intent_info["intent"] == "capacity_calculation" or (intent_info["isNumerical"] and intent_info["targetAmount"]):
            calc_data = business_calculator.calculate_capacity_for_target_profit(
                category=display_category,
                target_profit=intent_info.get("targetAmount") or 500000.0,
                location=display_district,
                promoter_margin_capital=req.marginCapital,
                timeframe=intent_info.get("timeframe", "annual"),
            )
            unit_m = calc_data["unitMetrics"]
            fin = calc_data["financialOutlay"]
            u_name = calc_data["unitNameTe"] if is_te else calc_data["unitNameEn"]
            calc_summary = (
                f"\n\n[DETERMINISTIC BUSINESS CALCULATION ENGINE RESULT]:\n"
                f"- Target Profit: ₹{calc_data['targetProfit']:,.0f} ({intent_info['timeframe']})\n"
                f"- Unit Economics for {calc_data['category']} ({display_district}):\n"
                f"  * Yield/Output: {unit_m.get('dailyYieldLitres', 10) if detected_domain == 'dairy_farming' else unit_m.get('annualSareesProduced', 36)}\n"
                f"  * Net Profit per unit: ₹{unit_m.get('netProfitPerUnitAnnual', 90000):,.0f}/year (₹{unit_m.get('netProfitPerUnitMonthly', 7500):,.0f}/month)\n"
                f"- Exact Units Required: {calc_data['exactUnitsNeeded']} {u_name} (Recommended: {calc_data['recommendedUnits']} {u_name})\n"
                f"- Total Capital Outlay Required: ₹{fin['totalProjectCost']:,.0f} (10% Promoter Margin: ₹{fin['promoterMarginRequired']:,.0f}, 90% Bank Loan: ₹{fin['bankLoanEligible']:,.0f})\n"
                f"- Mandatory Directive: State the calculated answer ({calc_data['recommendedUnits']} {u_name}) immediately and explain the step-by-step numbers clearly."
            )
        elif intent_info["intent"] == "break_even_calculation":
            be_data = business_calculator.calculate_break_even(display_category)
            calc_summary = (
                f"\n\n[DETERMINISTIC BREAK-EVEN CALCULATION RESULT]:\n"
                f"- Fixed Monthly Operating Costs: ₹{be_data['fixedMonthlyCosts']:,.0f}\n"
                f"- Gross Margin: {be_data['grossMarginPercent']}%\n"
                f"- Monthly Break-Even Sales: ₹{be_data['monthlyBreakEvenSales']:,.0f}\n"
                f"- Daily Break-Even Sales: ₹{be_data['dailyBreakEvenSales']:,.0f}\n"
            )

        # 5. Call Gemini API with Query-Centric Domain-Guarded Prompting
        ai_data = None
        provider_used = "chromadb-grounded-local"
        t_gemini_start = time.time()

        if gemini_service.is_available():
            if req.userQuery and req.userQuery.strip():
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {display_category} (Domain: {detected_domain})\n"
                    f"- Location: {display_district}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT USER QUESTION:\n"
                    f"{req.userQuery}\n"
                    f"{calc_summary}\n\n"
                    f"STRICT INSTRUCTION: In the 'reply' field, answer the user's current question directly. "
                    f"Focus 100% on {display_category} ({detected_domain}). DO NOT mention any other unrelated business domains (e.g. if category is Handloom, do NOT mention cows/dairy/milk). "
                    f"Provide domain-grounded actionable facts."
                )
            else:
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {display_category} (Domain: {detected_domain})\n"
                    f"- Location: {display_district}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT INQUIRY:\n"
                    f"Provide an initial comprehensive business viability assessment for starting or operating a {display_category} unit in {display_district}."
                )

            ai_data = gemini_service.generate_grounded_advice(
                user_query=prompt_query,
                retrieved_context=compact_context,
                language=req.language,
                history=[{"role": m.role, "content": m.content} for m in req.history] if req.history else None,
            )
            if ai_data:
                provider_used = f"{gemini_service.last_model_used} (ChromaDB RAG)" if gemini_service.last_model_used else "gemini-2.5-flash (ChromaDB RAG)"
                # Anti-Contamination Verification on LLM output
                if has_cross_domain_contamination(ai_data.get("reply", ""), detected_domain, is_te):
                    print(f"[GUARD TRIGGERED] Gemini reply contained cross-domain contamination for domain '{detected_domain}'. Using grounded domain fallback.")
                    ai_data = None

        t_gemini_ms = (time.time() - t_gemini_start) * 1000

        # 6. Intelligent Query-Aware Grounded Fallback if Gemini is unavailable or failed validation
        if not ai_data:
            ai_data = self._generate_grounded_fallback(
                location=clean_loc,
                category=clean_cat,
                district_name=display_district,
                category_name=display_category,
                is_te=is_te,
                user_query=req.userQuery,
                mandi_trends=display_mandi,
                seasonality=seasonality_text,
                margin_target=display_margin,
                pricing_band=display_pricing,
                risks=display_risks,
                margin_capital=req.marginCapital,
                intent_info=intent_info,
            )

        response = AdvisorAnalyzeResponse(
            reply=ai_data.get("reply"),
            marketReach=MarketReach(**ai_data.get("marketReach", {})),
            opportunityAnalysis=OpportunityAnalysis(**ai_data.get("opportunityAnalysis", {})),
            swot=SWOTAnalysis(**ai_data.get("swot", {})),
            competitorDensity=CompetitorDensity(**ai_data.get("competitorDensity", {})),
            pricingSuggestion=PricingSuggestion(**ai_data.get("pricingSuggestion", {})),
            risks=ai_data.get(
                "risks",
                ["కాలానుగుణ మార్కెట్ హెచ్చుతగ్గులు", "ముడిసరుకుల ధరల మార్పులు"] if is_te else ["Seasonal market volatility", "Raw material price fluctuations"]
            ),
            assumptions=ai_data.get(
                "assumptions",
                [
                    f"మార్జిన్ మూలధనం ₹{req.marginCapital:,.0f} ప్రాజెక్ట్ వ్యయంలో 10% సూచిస్తుంది.",
                    f"{display_district} అధికారిక మార్కెట్ బెంచ్‌మార్క్‌ల ఆధారంగా విశ్లేషణ చేయబడింది.",
                    "ఈ అంచనాలు కేవలం వ్యూహాత్మక మార్గదర్శకత్వం కోసం మాత్రమే.",
                ] if is_te else [
                    f"Margin capital of ₹{req.marginCapital:,.0f} represents 10% of total project outlay under standard priority-sector schemes.",
                    f"Market data grounded on {display_district} district benchmarks and APMC records.",
                    "AI estimates provide strategic guidance and do not guarantee loan sanction.",
                ]
            ),
            groundedFacts=GroundedFacts(
                district=display_district,
                category=display_category,
                benchmarkOpex=[
                    {"item": "Raw Material / Stock / Inputs", "percentage": 55},
                    {"item": "Labor & Maintenance", "percentage": 25},
                    {"item": "Utilities & Logistics", "percentage": 20},
                ],
            ),
            sourcesUsed=sources_used if sources_used else ["ChromaDB: Bundled District Benchmarks"],
            providerUsed=provider_used,
        )

        t_total_ms = (time.time() - t_start) * 1000
        print(f"[TIMING] ChromaDB: {t_chroma_ms:.1f}ms | Gemini SWOT: {t_gemini_ms:.1f}ms | Total: {t_total_ms:.1f}ms")

        # Save in cache
        _advisor_cache.set(req, response)
        return response

    def _generate_grounded_fallback(
        self,
        location: str,
        category: str,
        district_name: str,
        category_name: str,
        is_te: bool,
        user_query: Optional[str] = None,
        mandi_trends: str = "",
        seasonality: str = "",
        margin_target: str = "18% - 28%",
        pricing_band: str = "Prevailing District Mandi Rate",
        risks: Optional[List[str]] = None,
        margin_capital: float = 100000.0,
        intent_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Intelligent, calculation-aware grounded fallback that produces exact mathematical answers
        and domain-specific guidance without cross-domain contamination.
        """
        if not intent_info:
            intent_info = business_calculator.classify_intent(user_query or "", fallback_category=category)

        intent = intent_info.get("intent", "general_advisory")
        target_amt = intent_info.get("targetAmount")
        timeframe = intent_info.get("timeframe", "annual")
        domain = intent_info.get("domain", "general_enterprise")

        seasonal_opp = seasonality or ("పండుగల సీజన్లలో గరిష్ట గిరాకీ" if is_te else "Peak demand during festive seasons and post-harvest liquidity cycles.")
        if mandi_trends:
            seasonal_opp = f"{seasonal_opp} • Mandi Trend: {mandi_trends}"

        reply_text = ""

        # 1. Location Selection / Cluster & Placement Guidance
        if intent == "location_selection":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} లో చేనేత దుకాణం (Handloom Shop) ప్రారంభించడానికి అనువైన స్థలాలు మరియు మార్గదర్శకాలు:\n\n"
                        f"1. {district_name} లోని ప్రధాన క్లస్టర్లు:\n"
                        f"• పెంబర్తి & జనగామ కారిడార్: నేత కార్మికులు, మాస్టర్ వీవర్స్ మరియు నూలు డిపోలు ఎక్కువగా ఉండే ప్రసిద్ధ చేనేత ప్రాంతాలు.\n"
                        f"• హనుమకొండ (చౌరస్తా / సుబేదారి) & పరకాల: వివాహాలు మరియు పండుగల షాపింగ్ కోసం అధిక సంఖ్యలో కస్టమర్లు వచ్చే ప్రధాన వాణిజ్య కేంద్రాలు.\n"
                        f"• పర్యాటక & దేవాలయ మార్గాలు (వేయి స్తంభాల గుడి / భద్రకాళి పరిసరాలు): పర్యాటకులు నేరుగా నాణ్యమైన చేనేత వస్త్రాలు, చీరలు కొనుగోలు చేయడానికి అనుకూలం.\n\n"
                        f"2. స్థల ఎంపికకు 4 కీలక అంశాలు:\n"
                        f"• ముడిసరుకు లభ్యత: నూలు డిపోలకు దగ్గరగా ఉండటం వల్ల రవాణా ఖర్చు 8-12% ఆదా అవుతుంది.\n"
                        f"• కస్టమర్ రద్దీ: బట్టల దుకాణాలు మరియు నగల షాపులు ఉన్న ప్రధాన మార్కెట్ లైన్‌లో గ్రౌండ్ ఫ్లోర్ ఎంచుకోండి.\n"
                        f"• తక్కువ అద్దె: నెలవారీ అద్దె ₹6,000 - ₹10,000 లోపు ఉండేలా చూసుకోండి (అమ్మకాలలో 10% మించకూడదు).\n"
                        f"• తేమ రహిత నిల్వ: వర్షాకాలంలో పట్టు మరియు నూలు రంగు మారకుండా పొడి వాతావరణం ఉన్న గదిని ఎంచుకోండి."
                    )
                else:
                    reply_text = (
                        f"Strategic location recommendations for establishing a Handloom & Weaving shop in {district_name}:\n\n"
                        f"1. High-Potential Clusters in {district_name}:\n"
                        f"• Pembarti & Jangaon belt: Established craft and artisan corridors with direct access to skilled master weavers and raw yarn depots.\n"
                        f"• Hanamkonda (Subedari / Chowrasta commercial core) & Parkal: Major retail trading hubs with high footfall for festive and wedding saree shopping.\n"
                        f"• Temple & Heritage Tourist Routes (e.g., Thousand Pillar / Bhadrakali access roads): Excellent for high-margin direct-to-consumer handloom silk and cotton sales.\n\n"
                        f"2. Four Critical Site Selection Criteria:\n"
                        f"• Raw Material Logistics: Proximity to APCO/NHDC yarn collection centers saves 8-12% on transportation.\n"
                        f"• Footfall & Visibility: Ground-floor shop facing main market thoroughfare near apparel/jewellery clusters.\n"
                        f"• Commercial Overhead: Target monthly rent under ₹6,000–₹10,000 to keep fixed overhead within 10% of monthly sales.\n"
                        f"• Storage Integrity: Dry, well-ventilated space protected against monsoon moisture to prevent yarn and silk discoloration."
                    )
            elif domain == "retail_shop":
                if is_te:
                    reply_text = (
                        f"{district_name} లో కిరాణా / జనరల్ స్టోర్ కోసం అనువైన స్థలాలు:\n\n"
                        f"1. బస్టాండ్ జంక్షన్ & గ్రామ పంచాయతీ కేంద్రం: నిరంతర ప్రయాణికులు మరియు స్థానికుల రాకపోకలు ఉంటాయి.\n"
                        f"2. ప్రధాన నివాస కాలనీ ప్రవేశ ద్వారం: ఉదయం మరియు సాయంత్రం వేళల్లో పాల, కిరాణా కొనుగోళ్లకు అనుకూలం.\n"
                        f"3. స్థల ఎంపిక నియమం: ఇప్పటికే ఉన్న పెద్ద కిరాణా దుకాణానికి కనీసం 150 మీటర్ల దూరంలో షాపును ఏర్పాటు చేయండి."
                    )
                else:
                    reply_text = (
                        f"Prime location strategy for a Kirana & General Store in {district_name}:\n\n"
                        f"1. Mandal Bus Stand Junction / Gram Panchayat Center: Highest daily pedestrian footfall and morning/evening commuters.\n"
                        f"2. Residential Colony Entrance / Main Village Thorougfare: Steady recurring household purchases for daily provisions.\n"
                        f"3. Site Evaluation Rule: Ensure at least 150-200 meters separation from established wholesale general stores to protect pricing power."
                    )
            elif domain == "poultry_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పౌల్ట్రీ ఫామ్ ఏర్పాటుకు అనువైన స్థలం:\n\n"
                        f"1. నివాస ప్రాంతాలకు కనీసం 500 మీటర్ల దూరంలో ఉన్న వ్యవసాయ భూమి (జీవ భద్రత మరియు కాలుష్య నిబంధనల ప్రకారం).\n"
                        f"2. మేత రవాణా మరియు కోళ్ల పికప్ వ్యాన్ల కోసం వర్షాకాలంలో కూడా అనుకూలమైన పక్కా రోడ్డు కనెక్టివిటీ.\n"
                        f"3. 24 గంటల నిరంతర నీటి సరఫరా మరియు సింగిల్/త్రీ-ఫేజ్ విద్యుత్ కనెక్షన్."
                    )
                else:
                    reply_text = (
                        f"Site selection guidelines for a Poultry Broiler Unit in {district_name}:\n\n"
                        f"1. Elevated agricultural parcel located at least 500 meters away from dense residential habitations for bio-security.\n"
                        f"2. All-weather motorable approach road to facilitate feed supply trucks and live bird off-take vehicles.\n"
                        f"3. Dependable 24/7 groundwater source and reliable electricity connection for ventilation and cooling fans."
                    )
            elif domain == "tailoring_garments":
                if is_te:
                    reply_text = (
                        f"{district_name} లో టైలరింగ్ & బోటిక్ షాప్ కోసం ఉత్తమ స్థలాలు:\n\n"
                        f"1. ప్రధాన బట్టల మార్కెట్ లైన్: కస్టమర్లు బట్టలు కొనుగోలు చేసిన వెంటనే కుట్టించడానికి వస్తారు.\n"
                        f"2. మహిళా కళాశాలలు లేదా రెడీమేడ్ షోరూమ్‌ల సమీపంలోని జంక్షన్.\n"
                        f"3. కస్టమర్ ట్రయల్స్ మరియు మగ్గం వర్క్ కోసం తగినంత స్థలం ఉండే గ్రౌండ్ లేదా ఫస్ట్ ఫ్లోర్ షాప్."
                    )
                else:
                    reply_text = (
                        f"Location recommendations for a Tailoring & Boutique setup in {district_name}:\n\n"
                        f"1. Main Bazaar Textile Lane: Captures immediate conversion from customers purchasing unstitched dress materials and saree fabrics.\n"
                        f"2. Proximity to Women's Degree Colleges / Commercial Shopping Centers with high female pedestrian traffic.\n"
                        f"3. Adequate space for dedicated trial rooms and Maggam embroidery worktables."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పాడి పరిశ్రమ ఏర్పాటుకు అనువైన స్థలం:\n\n"
                        f"1. డైరీ కోఆపరేటివ్ సొసైటీ లేదా బల్క్ మిల్క్ కూలర్ (BMC) మార్గానికి 2-3 కి.మీ పరిధిలో ఉండాలి.\n"
                        f"2. పచ్చిగడ్డి సాగుకు అనువైన నీటి వనరు మరియు సులభమైన రవాణా రోడ్డు ఉండాలి.\n"
                        f"3. గాలి, వెలుతురు ధారాళంగా వచ్చే ఎత్తైన ప్రదేశం షెడ్ నిర్మాణానికి అనుకూలం."
                    )
                else:
                    reply_text = (
                        f"Location criteria for setting up a Dairy Farm in {district_name}:\n\n"
                        f"1. Proximity to Bulk Milk Coolers (BMC) or cooperative milk route (within 2-3 km) to minimize spoilage and transport overhead.\n"
                        f"2. Reliable perennial water source for green fodder irrigation (Super Napier/Co-4) and cattle drinking.\n"
                        f"3. Elevated, well-drained terrain with east-west orientation for optimal shed ventilation."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} వ్యాపారానికి అనువైన స్థలం:\n\n"
                        f"1. మండల ప్రధాన కూడలి లేదా వాణిజ్య మార్కెట్ యార్డ్ పరిసరాలు.\n"
                        f"2. రవాణా సౌకర్యం, విద్యుత్ లభ్యత మరియు తక్కువ అద్దె ఉండే ప్రాంతాన్ని ఎంచుకోండి.\n"
                        f"3. కస్టమర్ రద్దీ మరియు సరుకు రవాణా రెండింటికీ అనుకూలంగా ఉండాలి."
                    )
                else:
                    reply_text = (
                        f"Location selection strategy for {category_name} in {district_name}:\n\n"
                        f"1. Mandal Commercial Center / Market Yard corridor with high consumer density.\n"
                        f"2. Assure multi-modal transport accessibility, reliable utility connections, and reasonable shop rentals.\n"
                        f"3. Prioritize customer visibility while keeping fixed overhead under 10% of gross margin."
                    )

        # 2. Investment Decision Evaluation (e.g., AC, Jacquard, Freezer)
        elif intent == "investment_decision":
            if domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"పాడి పరిశ్రమకు ఎయిర్ కండీషనర్ (AC) కొనుగోలుపై ఆర్థిక విశ్లేషణ:\n\n"
                        f"1. ఆర్థిక సాధ్యాసాధ్యం: పశువుల పాకలో రెసిడెన్షియల్ AC ఏర్పాటు చేయడం లాభదాయకం కాదు. నెలకు కరెంట్ బిల్లు ₹12,000 పైగా వస్తుంది మరియు పెట్టుబడి తిరిగి రావడానికి 8 సంవత్సరాలు పడుతుంది.\n"
                        f"2. ప్రత్యామ్నాయ తక్కువ ఖర్చు పరిష్కారం: గ్రీన్ షేడ్ నెట్ (75% షేడ్), స్ప్రింక్లర్ ఫాగర్లు (Misting Nozzles) మరియు రూఫ్ ఎగ్జాస్ట్ ఫ్యాన్లు ఏర్పాటు చేయండి. మొత్తం ఖర్చు ₹25,000 మాత్రమే.\n"
                        f"3. ఫలితం: ఇది పాక ఉష్ణోగ్రతను 4-6°C తగ్గిస్తుంది, పాల దిగుబడిని 95% కాపాడుతుంది మరియు నెలకు విద్యుత్ ఖర్చు కేవలం ₹1,500 లోపే ఉంటుంది."
                    )
                else:
                    reply_text = (
                        f"Financial evaluation of purchasing an Air Conditioner (AC) for your Dairy Farm:\n\n"
                        f"1. Financial Viability: Installing a residential AC in open/semi-open dairy sheds is financially unfeasible. High monthly power costs (₹12,000+) result in an unviable payback period (>8 years).\n"
                        f"2. Recommended Cost-Effective Alternative: Install high-density green agro-shade nets (75% shade), low-pressure misting/fogger nozzles, and heavy-duty ceiling fans. Total outlay is ~₹25,000.\n"
                        f"3. Operating Impact: Lowers shed temperature by 4-6°C, preserves 95% of summer milk yield, and consumes less than ₹1,500/month in power."
                    )
            elif domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"చేనేత వ్యాపారంలో ఎలక్ట్రానిక్ జకార్డ్ / ఆధునిక అమరిక పెట్టుబడి విశ్లేషణ:\n\n"
                        f"1. పెట్టుబడి ఖర్చు: ఎలక్ట్రానిక్ జకార్డ్ బాక్స్ మరియు మోటరైజ్డ్ సెటప్ ఖర్చు సుమారు ₹45,000 - ₹60,000.\n"
                        f"2. లాభం & పేబ్యాక్: ఇది సంక్లిష్ట డిజైన్ల నేత వేగాన్ని 35% పెంచుతుంది, ప్రతి చీరకు ₹1,500 అదనపు మార్జిన్ అందిస్తుంది. 8-10 నెలల్లో పెట్టుబడి రికవర్ అవుతుంది.\n"
                        f"3. ప్రభుత్వ సహకారం: పీఎం విశ్వకర్మ పథకం కింద 5% రాయితీ వడ్డీతో ఈ కొనుగోలుకు రుణం పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"Investment evaluation for Electronic Jacquard / Loom Upgrades in Handloom Weaving:\n\n"
                        f"1. Capital Outlay: Electronic Jacquard conversion setup costs ~₹45,000 - ₹60,000 per loom.\n"
                        f"2. Productivity & Payback: Increases complex pattern weaving output by 35%, commanding ₹1,500 higher value-add per saree. Full payback achieved in 8-10 months.\n"
                        f"3. Scheme Linkage: Eligible for 5% concessional credit under PM Vishwakarma / Weavers MUDRA scheme."
                    )
            elif domain == "retail_shop":
                if is_te:
                    reply_text = (
                        f"కిరాణా దుకాణానికి కమర్షియల్ డీప్ ఫ్రీజర్ / రిఫ్రిజిరేటర్ పెట్టుబడి విశ్లేషణ:\n\n"
                        f"1. పెట్టుబడి ఖర్చు: 300L డీప్ ఫ్రీజర్ కొనుగోలు ఖర్చు సుమారు ₹25,000 - ₹32,000.\n"
                        f"2. అదనపు ఆదాయం: ఐస్ క్రీమ్‌లు, పాల ప్యాకెట్లు, శీతల పానీయాలు విక్రయించడం ద్వారా నెలకు ₹4,000 - ₹6,000 అదనపు మార్జిన్ లభిస్తుంది.\n"
                        f"3. పేబ్యాక్ పిరియడ్: కేవలం 6-7 నెలల్లో పెట్టుబడి రికవర్ అవుతుంది."
                    )
                else:
                    reply_text = (
                        f"Investment feasibility of a Commercial Deep Freezer / Chiller for Kirana Store:\n\n"
                        f"1. Capital Outlay: Standard 300L commercial deep freezer costs ~₹25,000 - ₹32,000.\n"
                        f"2. Incremental Revenue: Enables storage and sale of dairy packets, beverages, and frozen foods, generating ₹4,000 - ₹6,000 monthly incremental gross margin.\n"
                        f"3. Payback Period: Strong investment ROI with complete capital payback in 6 to 7 months."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} కోసం ప్రతిపాదిత పరికరాల పెట్టుబడి విశ్లేషణ:\n\n"
                        f"1. యంత్రం/పరికరాల కొనుగోలు నిర్వహణ వ్యయాన్ని తగ్గించి రోజువారీ ఉత్పాదకతను 25-30% పెంచుతుంది.\n"
                        f"2. పేబ్యాక్ పిరియడ్ సుమారు 10-14 నెలలుగా అంచనా వేయబడింది.\n"
                        f"3. ముద్రా కిశోర్ లేదా పీఎంఈజీపీ ద్వారా 10% స్వంత మార్జిన్‌తో 90% రుణం పొందడం సురక్షితం."
                    )
                else:
                    reply_text = (
                        f"Financial evaluation for proposed equipment investment in {category_name} ({district_name}):\n\n"
                        f"1. Productivity Gain: Modern machinery expands throughput by 25-30% while trimming unit labor expenses.\n"
                        f"2. Capital Payback: Estimated break-even on the capital asset is achieved within 10 to 14 months.\n"
                        f"3. Financing Structure: Fund with 10% promoter equity and 90% MUDRA/PMEGP term loan to protect liquidity."
                    )

        # 3. Capacity / Quantity Needed Calculation
        elif intent == "capacity_calculation":
            calc = business_calculator.calculate_capacity_for_target_profit(
                category_name,
                target_amt or 500000.0,
                district_name,
                margin_capital,
                timeframe,
            )
            um = calc["unitMetrics"]
            fo = calc["financialOutlay"]
            t_label = "సంవత్సరానికి" if timeframe == "annual" else "నెలకు"
            t_label_en = "per year" if timeframe == "annual" else "per month"

            if domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} నికర లాభం పొందడానికి మీకు సుమారు {calc['recommendedUnits']} పాడి ఆవులు (ఖచ్చితంగా {calc['exactUnitsNeeded']}) అవసరం.\n\n"
                        f"లెక్కింపు వివరాలు:\n"
                        f"• పాల దిగుబడి: రోజుకు 10 లీటర్లు × 300 పాల రోజులు = ఒక ఆవుకు సంవత్సరానికి 3,000 లీటర్లు.\n"
                        f"• విక్రయ ధర: లీటరుకు ₹{um['sellingPricePerLitre']:.0f} (మండి & స్థానిక రిటైల్ సగటు).\n"
                        f"• స్థూల ఆదాయం: ఒక ఆవుకు సంవత్సరానికి ₹{um['annualRevenuePerUnit']:,.0f}.\n"
                        f"• నిర్వహణ ఖర్చులు: ఒక ఆవుకు సంవత్సరానికి దాదాపు ₹{um['annualOpexPerUnit']:,.0f} (దాణా 55%, పశువైద్యం 10%, శ్రమ 20%, రవాణా/విద్యుత్ 15%).\n"
                        f"• నికర లాభం: ఒక ఆవుకు సంవత్సరానికి ₹{um['netProfitPerUnitAnnual']:,.0f} (నెలకు ₹{um['netProfitPerUnitMonthly']:,.0f}).\n"
                        f"• అవసరమైన ఆవులు: ₹{calc['annualTargetProfit']:,.0f} ÷ ₹{um['netProfitPerUnitAnnual']:,.0f} ≈ {calc['recommendedUnits']} ఆవులు.\n\n"
                        f"మూలధనం & బ్యాంక్ రుణం:\n"
                        f"• మొత్తం ప్రాజెక్ట్ ఖర్చు: ₹{fo['totalProjectCost']:,.0f} ({calc['recommendedUnits']} ఆవులు + షెడ్ వాటా).\n"
                        f"• మీ 10% స్వంత వాటా: ₹{fo['promoterMarginRequired']:,.0f}.\n"
                        f"• 90% ముద్రా/టర్మ్ లోన్ అర్హత: ₹{fo['bankLoanEligible']:,.0f}."
                    )
                else:
                    reply_text = (
                        f"Answer: To achieve a net profit of ₹{calc['targetProfit']:,.0f} {t_label_en}, you will need approximately {calc['recommendedUnits']} milch cows (exact: {calc['exactUnitsNeeded']}).\n\n"
                        f"Calculation Breakdown:\n"
                        f"• Milk Yield: 10 Litres/day × 300 lactation days = 3,000 Litres/year per cow.\n"
                        f"• Selling Price: ₹{um['sellingPricePerLitre']:.0f}/Litre (prevailing {district_name} APMC & direct retail rate).\n"
                        f"• Annual Revenue: ₹{um['annualRevenuePerUnit']:,.0f} per cow.\n"
                        f"• Annual Operating Cost: ~₹{um['annualOpexPerUnit']:,.0f} per cow (Feed & Fodder 55%, Vet/AI 10%, Labor 20%, Utilities 15%).\n"
                        f"• Net Profit per Cow: ₹{um['netProfitPerUnitAnnual']:,.0f}/year (~₹{um['netProfitPerUnitMonthly']:,.0f}/month).\n"
                        f"• Required Animals: ₹{calc['annualTargetProfit']:,.0f} ÷ ₹{um['netProfitPerUnitAnnual']:,.0f} ≈ {calc['recommendedUnits']} cows.\n\n"
                        f"Capital & Financing Outlay:\n"
                        f"• Total Project Outlay: ₹{fo['totalProjectCost']:,.0f} (for {calc['recommendedUnits']} animals + shed infrastructure).\n"
                        f"• Your 10% Promoter Margin: ₹{fo['promoterMarginRequired']:,.0f}.\n"
                        f"• 90% MUDRA / Institutional Term Loan: ₹{fo['bankLoanEligible']:,.0f}."
                    )
            elif domain == "poultry_farming":
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} లాభం పొందడానికి మీకు {calc['recommendedUnits']:,} పౌల్ట్రీ పక్షుల షెడ్ సామర్థ్యం అవసరం.\n\n"
                        f"లెక్కింపు: సంవత్సరానికి 6 బ్యాచ్‌లు × బ్యాచ్‌కు ₹{um.get('netProfitPerBirdBatch', 15):.0f} నికర లాభం = పక్షికి సంవత్సరానికి ₹{um['netProfitPerUnitAnnual']:,.0f}. "
                        f"మొత్తం ప్రాజెక్ట్ ఖర్చు: ₹{fo['totalProjectCost']:,.0f} (స్వంత వాటా 10%: ₹{fo['promoterMarginRequired']:,.0f}, బ్యాంక్ రుణం: ₹{fo['bankLoanEligible']:,.0f})."
                    )
                else:
                    reply_text = (
                        f"Answer: To generate ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, you need a shed capacity of approximately {calc['recommendedUnits']:,} broiler birds.\n\n"
                        f"Calculation: 6 batches/year × ₹{um.get('netProfitPerBirdBatch', 15):.0f} net profit/bird = ₹{um['netProfitPerUnitAnnual']:,.0f}/year per capacity unit. "
                        f"Project outlay: ₹{fo['totalProjectCost']:,.0f} (10% Promoter equity: ₹{fo['promoterMarginRequired']:,.0f}, 90% Term Loan: ₹{fo['bankLoanEligible']:,.0f})."
                    )
            elif domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} నికర లాభం పొందడానికి మీకు {calc['recommendedUnits']} చేనేత మగ్గాలు అవసరం.\n\n"
                        f"లెక్కింపు: ఒక మగ్గంపై సంవత్సరానికి 36 చీరలు × చీరకు ₹{um.get('netProfitPerSaree', 2500):,.0f} నికర లాభం = మగ్గానికి ₹{um['netProfitPerUnitAnnual']:,.0f}/సంవత్సరం. "
                        f"పీఎం విశ్వకర్మ పథకం కింద 5% వడ్డీతో ₹3 లక్షల వరకు పూచీకత్తు లేని రుణం పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"Answer: To earn ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, you need approximately {calc['recommendedUnits']} active handlooms.\n\n"
                        f"Calculation: 36 sarees/year/loom × ₹{um.get('netProfitPerSaree', 2500):,.0f} net profit/saree = ₹{um['netProfitPerUnitAnnual']:,.0f}/year/loom. "
                        f"Eligible for PM Vishwakarma 5% concessional credit up to ₹3 Lakhs."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} నికర లాభం పొందడానికి మీకు దాదాపు ₹{um.get('annualTurnoverNeeded', 2500000):,.0f} వార్షిక అమ్మకాల టర్నోవర్ (రోజుకు ₹{um.get('dailyTurnoverNeeded', 8000):,.0f}) అవసరం.\n\n"
                        f"లెక్కింపు: గ్రామీణ {category_name} వ్యాపారానికి సగటు నికర లాభ మార్జిన్ {um.get('netMarginPercentage', 20)}%. "
                        f"వర్కింగ్ క్యాపిటల్ మరియు స్టాక్ కోసం ముద్రా కిషోర్ రుణం కింద ₹5 లక్షల వరకు రుణం లభిస్తుంది."
                    )
                else:
                    reply_text = (
                        f"Answer: To generate ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, your business needs an annual sales turnover of approximately ₹{um.get('annualTurnoverNeeded', 2500000):,.0f} (₹{um.get('dailyTurnoverNeeded', 8000):,.0f}/day).\n\n"
                        f"Calculation: Based on a realistic {um.get('netMarginPercentage', 20)}% net operating margin for {category_name}. "
                        f"You can secure priority working capital credit under MUDRA Kishore up to ₹5 Lakhs."
                    )

        # 4. Expansion Capital Calculation
        elif intent == "expansion_capital_calculation":
            if domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పాడి పరిశ్రమ విస్తరణకు మూలధన అంచనా: "
                        f"1) 2 అదనపు పాడి ఆవులు మరియు షెడ్ విస్తరణకు ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,50,000 (ఆవుకు ₹75,000). "
                        f"2) మీ 10% స్వంత మార్జిన్: ₹15,000. "
                        f"3) ముద్రా / కిసాన్ క్రెడిట్ కార్డ్ (KCC) / AHIDF కింద 90% బ్యాంకు రుణం: ₹1,35,000. "
                        f"4) ఆశించిన అదనపు నికర లాభం: నెలకు ₹15,000 (సంవత్సరానికి ₹1,80,000)."
                    )
                else:
                    reply_text = (
                        f"Capital requirements to expand your dairy farm in {district_name}: "
                        f"1) Total project outlay to add a 2-cow unit: ~₹150,000 (₹75,000 per animal including shed extension). "
                        f"2) Required 10% promoter equity: ₹15,000. "
                        f"3) Eligible 90% bank term loan (MUDRA / KCC / AHIDF): ₹135,000. "
                        f"4) Incremental net monthly surplus generated: ~₹15,000/month (₹180,000/year)."
                    )
            elif domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} లో చేనేత మగ్గాల విస్తరణకు మూలధన అంచనా: "
                        f"1) 2 అదనపు జకార్డ్ పిట్ మగ్గాలు మరియు వార్పింగ్ అమరిక ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,20,000. "
                        f"2) మీ 10% స్వంత మార్జిన్: ₹12,000. "
                        f"3) పీఎం విశ్వకర్మ / వీవర్స్ ముద్రా కింద 90% రుణం: ₹1,08,000. "
                        f"4) ఆశించిన అదనపు నికర లాభం: నెలకు ₹14,000 (సంవత్సరానికి ₹1,68,000)."
                    )
                else:
                    reply_text = (
                        f"Capital requirements to expand your Handloom setup in {district_name}: "
                        f"1) Total project outlay for 2 additional Jacquard pit looms: ~₹120,000. "
                        f"2) Required 10% promoter equity: ₹12,000. "
                        f"3) Eligible 90% loan (PM Vishwakarma / Weavers MUDRA): ₹108,000. "
                        f"4) Incremental net monthly surplus: ~₹14,000/month (₹168,000/year)."
                    )
            elif domain == "retail_shop":
                if is_te:
                    reply_text = (
                        f"{district_name} లో కిరాణా దుకాణం విస్తరణకు మూలధన అంచనా: "
                        f"1) అదనపు సరుకుల స్టాక్ మరియు ర్యాక్స్ ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,00,000. "
                        f"2) మీ 10% స్వంత మార్జిన్: ₹10,000. "
                        f"3) ముద్రా కిశోర్ కింద 90% వర్కింగ్ క్యాపిటల్ రుణం: ₹90,000. "
                        f"4) ఆశించిన అదనపు నికర లాభం: నెలకు ₹12,000."
                    )
                else:
                    reply_text = (
                        f"Capital requirements to expand your Kirana Store in {district_name}: "
                        f"1) Total inventory and display expansion outlay: ~₹100,000. "
                        f"2) Required 10% promoter equity: ₹10,000. "
                        f"3) Eligible 90% working capital loan (MUDRA Kishor): ₹90,000. "
                        f"4) Incremental net monthly profit generated: ~₹12,000/month."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} విస్తరణకు మూలధన అంచనా: "
                        f"1) అదనపు యూనిట్ / సామర్థ్యం విస్తరణ ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,20,000. "
                        f"2) మీ 10% స్వంత వాటా: ₹12,000. "
                        f"3) 90% బ్యాంకు రుణం (ముద్రా): ₹1,08,000. "
                        f"4) అదనపు నెలవారీ నికర మిగులు: ~₹12,000 - ₹15,000/నెల."
                    )
                else:
                    reply_text = (
                        f"Capital outlay required to expand your {category_name} business in {district_name}: "
                        f"1) Total project expansion cost: ~₹120,000. "
                        f"2) Required 10% promoter equity: ₹12,000. "
                        f"3) Eligible 90% MUDRA / institutional bank term loan: ₹108,000. "
                        f"4) Incremental net monthly surplus: ~₹12,000 to ₹15,000/month."
                    )

        # 5. Profitability / Margin Inquiry
        elif intent == "profitability_calculation":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} లో చేనేత (Handloom) వ్యాపార లాభదాయకత వివరాలు: "
                        f"1) ఒక మగ్గానికి నికర లాభం: నెలకు దాదాపు ₹7,000 (సంవత్సరానికి ₹84,000). "
                        f"2) 2 మగ్గాల సెటప్‌తో నెలకు ₹14,000 నికర ఆదాయం లభిస్తుంది. "
                        f"3) వివాహ మరియు పండుగల సీజన్లలో పట్టు చీరల నేరుగా విక్రయించడం ద్వారా లాభ మార్జిన్ 35% వరకు పెరుగుతుంది."
                    )
                else:
                    reply_text = (
                        f"Profitability benchmarks for Handloom Weaving in {district_name}: "
                        f"1) Net profit per active loom is ~₹7,000/month (₹84,000/year). "
                        f"2) A standard 2-loom family unit delivers ~₹14,000/month net surplus. "
                        f"3) Direct retail sales of silk and festive sarees expand operating margins to 30%–35%."
                    )
            elif domain == "retail_shop":
                if is_te:
                    reply_text = (
                        f"{district_name} లో కిరాణా దుకాణం లాభదాయకత: "
                        f"1) సగటు స్థూల మార్జిన్ 14% నుండి 18%. "
                        f"2) రోజుకు ₹10,000 టర్నోవర్‌తో నెలకు దాదాపు ₹25,000 - ₹30,000 నికర లాభం లభిస్తుంది. "
                        f"3) ప్యాక్ చేసిన వస్తువుల కంటే లూజ్ సరుకులు, సుగంధ ద్రవ్యాలపై మార్జిన్ 22% వరకు ఉంటుంది."
                    )
                else:
                    reply_text = (
                        f"Profitability benchmarks for Kirana & Retail in {district_name}: "
                        f"1) Average gross operating margin is 14% to 18%. "
                        f"2) Daily turnover of ₹10,000 delivers ~₹25,000 to ₹30,000 net monthly surplus after rent and electricity. "
                        f"3) Loose staples and seasonal commodities yield higher margins (20%–24%)."
                    )
            elif domain == "poultry_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పౌల్ట్రీ బ్రాయిలర్ ఫామ్ లాభదాయకత: "
                        f"1) పక్షికి బ్యాచ్‌కు నికర లాభం ₹15 - ₹18 (సంవత్సరానికి 6 బ్యాచ్‌లు). "
                        f"2) 1,000 పక్షుల షెడ్‌తో నెలకు దాదాపు ₹15,000 - ₹18,000 నికర ఆదాయం లభిస్తుంది."
                    )
                else:
                    reply_text = (
                        f"Profitability benchmarks for Poultry Broiler farming in {district_name}: "
                        f"1) Net profit per bird per batch is ₹15 to ₹18 (across 6 batches per year). "
                        f"2) A 1,000-bird capacity unit delivers ~₹15,000 to ₹18,000 net monthly surplus."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పాడి పరిశ్రమ లాభదాయకత: "
                        f"1) ఆవుకు నికర లాభం: నెలకు దాదాపు ₹7,500 (సంవత్సరానికి ₹90,000). "
                        f"2) 2 ఆవుల ప్రాథమిక యూనిట్‌తో నెలకు దాదాపు ₹15,000 నికర ఆదాయం లభిస్తుంది. "
                        f"3) స్థానిక రిటైల్ విక్రయాలు చేయడం ద్వారా లాభం 25% వరకు పెరుగుతుంది."
                    )
                else:
                    reply_text = (
                        f"Profitability benchmarks for Dairy Farming in {district_name}: "
                        f"1) Net profit per milch animal is ~₹7,500/month (₹90,000/year). "
                        f"2) A starter 2-cow unit delivers ~₹15,000/month net surplus. "
                        f"3) Direct-to-consumer and tea stall retail off-take expands margins from 18% to 28%."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} లాభదాయకత: "
                        f"గ్రామీణ సూక్ష్మ యూనిట్లకు సగటు నికర లాభ మార్జిన్ 18% నుండి 25%. క్రమబద్ధమైన స్టాక్ నిర్వహణ ద్వారా స్థిరమైన మిగులు పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"Profitability benchmarks for {category_name} in {district_name}: "
                        f"Average net profit margin ranges from 18% to 25% based on direct customer off-take and disciplined cost control."
                    )

        # 6. Raw Material / Sourcing Optimization
        elif intent == "raw_material_optimization":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} లో చేనేత ముడిసరుకు (నూలు & జరీ) ఖర్చులను తగ్గించే వ్యూహాలు: "
                        f"1) నేషనల్ హ్యాండ్‌లూమ్ డెవలప్‌మెంట్ కార్పొరేషన్ (NHDC) లేదా APCO నూలు డిపోల ద్వారా నేరుగా కొనుగోలు చేయడం (10% రవాణా రాయితీ). "
                        f"2) సహకార సొసైటీ ద్వారా ఇతర నేత కార్మికులతో కలిసి ఉమ్మడిగా బల్క్ యార్న్ ఆర్డర్ చేయడం. "
                        f"3) సహజ రంగులు మరియు నాణ్యమైన టెస్టింగ్ ఉన్న ముడిసరుకును ఎంచుకుని వృథాను తగ్గించడం."
                    )
                else:
                    reply_text = (
                        f"Raw material (yarn and zari) cost optimization in {district_name}: "
                        f"1) Procure hank yarn directly through National Handloom Development Corporation (NHDC) depots with 10% freight subsidy. "
                        f"2) Form cluster purchasing groups with local weaver societies to negotiate mill-gate prices on silk and cotton counts. "
                        f"3) Utilize precision warping to eliminate end-breakage wastage by 5%–8%."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పశువుల దాణా మరియు ముడిసరుకు ఖర్చులను తగ్గించడానికి: "
                        f"1) స్థానిక APMC మండి లేదా PACS సహకార సంఘం ద్వారా టోకుగా నేరుగా కొనుగోలు చేయడం (10-15% ఆదా). "
                        f"2) సైలేజ్ (పాతర గడ్డి) మరియు అజోల్లా ఉత్పత్తి ద్వారా ప్రొటీన్ ఖర్చును తగ్గించడం. "
                        f"3) సమీప రైతులతో కలిసి ఉమ్మడిగా దాణా ఆర్డర్ చేసి రవాణా ఖర్చులను తగ్గించుకోవడం."
                    )
                else:
                    reply_text = (
                        f"To reduce feed and raw material costs in {district_name}: "
                        f"1) Procure feed grains and oil cakes in bulk directly through {district_name} APMC mandis or Primary Agricultural Cooperative Societies (PACS) to cut retail markup by 10-15%. "
                        f"2) Supplement with on-farm silage preservation and high-protein Azolla cultivation. "
                        f"3) Form a joint-buying cluster with neighboring producers to negotiate wholesale mill rates and split freight."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} ముడిసరుకు ఖర్చులను తగ్గించడానికి టోకు వ్యాపారుల నుండి నేరుగా కొనుగోలు చేయండి మరియు 7-రోజుల క్రెడిట్ నిబంధనలను సద్వినియోగం చేసుకోండి."
                    )
                else:
                    reply_text = (
                        f"To optimize raw material procurement for {category_name} in {district_name}: Procure directly from wholesale mandis and establish 7-day revolving trade credit."
                    )

        # 7. Pricing Guidance
        elif intent == "pricing_guidance":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} చేనేత మార్కెట్ ధరల విశ్లేషణ: "
                        f"చేనేత కాటన్ చీరలకు ₹1,800 - ₹3,500, పట్టు మరియు జరీ చీరలకు ₹4,500 - ₹12,000 వరకు ధర లభిస్తుంది. "
                        f"నేరుగా షోరూమ్‌లు లేదా ఎగ్జిబిషన్లలో విక్రయిస్తే మధ్యవర్తులు లేకుండా 30-35% పూర్తి లాభ మార్జిన్ పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"Pricing benchmarks for Handloom & Weaving products in {district_name}: "
                        f"Handloom cotton sarees command ₹1,800 to ₹3,500, while fine silk/zari sarees fetch ₹4,500 to ₹12,000 based on weave complexity. "
                        f"Direct exhibition and boutique retail sales secure a full 30%–35% gross artisan margin."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} మార్కెట్ ప్రకారం పాల ధర నిర్ణయం: "
                        f"డైరీ కోఆపరేటివ్‌లకు లీటరుకు ₹48 - ₹55 లభిస్తుంది. హోటళ్ళు లేదా ఇళ్లకు నేరుగా విక్రయిస్తే లీటరుకు ₹58 - ₹68 వరకు పూర్తి రిటైల్ మార్జిన్ పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"For Dairy in {district_name}, prevailing pricing dynamics: "
                        f"Cooperative off-take yields ₹48 - ₹55/L based on Fat/SNF testing. Direct-to-consumer and retail supply commands ₹58 - ₹68/L, capturing a 25% higher operating margin."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} మార్కెట్ ప్రకారం {category_name} ధరల సరళి: స్థానిక నాణ్యత మరియు గిరాకీ ఆధారంగా ధర నిర్ణయించి 20-25% మార్జిన్ సాధించండి."
                    )
                else:
                    reply_text = (
                        f"For {category_name} in {district_name}: Maintain transparent unit pricing aligned with {pricing_band} to protect a 20%–25% profit margin."
                    )

        # 8. Government Schemes
        elif intent == "government_schemes":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"{district_name} లో చేనేత కార్మికుల కోసం ప్రధాన ప్రభుత్వ పథకాలు: "
                        f"1) పీఎం విశ్వకర్మ యోజన: 5% రాయితీ వడ్డీతో ₹3 లక్షల వరకు తాకట్టు లేని రుణం మరియు ఆధునిక టూల్‌కిట్. "
                        f"2) వీవర్స్ ముద్రా స్కీమ్: ₹2 లక్షల వరకు 7% వడ్డీ రాయితీతో వర్కింగ్ క్యాపిటల్ రుణం. "
                        f"3) నేషనల్ హ్యాండ్‌లూమ్ డెవలప్‌మెంట్ ప్రోగ్రామ్ (NHDP): నూలుపై 10% సబ్సిడీ మరియు వర్క్‌షెడ్ గ్రాంట్."
                    )
                else:
                    reply_text = (
                        f"Key government schemes for Handloom & Weaving in {district_name}: "
                        f"1) PM Vishwakarma Scheme: Collateral-free credit up to ₹3 Lakhs at 5% concessional interest with skill toolkit support. "
                        f"2) Weavers MUDRA Scheme: Working capital and equipment credit up to ₹2 Lakhs with 7% interest subvention. "
                        f"3) National Handloom Development Programme (NHDP): 10% raw yarn subsidy and work-shed infrastructure assistance."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"{district_name} లో పాడి పరిశ్రమ కోసం ప్రధాన ప్రభుత్వ పథకాలు: "
                        f"1) MUDRA (కిశోర్ విభాగం): ₹5 లక్షల వరకు తాకట్టు లేని రుణం. "
                        f"2) PMEGP: గ్రామీణ ప్రాంతాల్లో 25% నుండి 35% మూలధన సబ్సిడీ. "
                        f"3) AHIDF & KCC Dairy: 3% వడ్డీ రాయితీతో షెడ్ మరియు దాణా అభివృద్ధి రుణాలు."
                    )
                else:
                    reply_text = (
                        f"Key government schemes for Dairy in {district_name}: "
                        f"1) MUDRA (Kishor tier up to ₹5L): Collateral-free priority-sector loans. "
                        f"2) PMEGP: 25% to 35% capital subsidy for rural micro-units. "
                        f"3) AHIDF & KCC Animal Husbandry: 3% interest subvention for cattle and dairy infrastructure."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} కోసం లభించే ప్రధాన పథకాలు: 1) PMEGP (25-35% సబ్సిడీ). 2) ముద్రా లోన్ (₹50,000 నుండి ₹10 లక్షల వరకు). 3) స్టాండప్ ఇండియా."
                    )
                else:
                    reply_text = (
                        f"Key government schemes for {category_name} in {district_name}: 1) PMEGP (25%–35% capital subsidy). 2) MUDRA loan scheme (Shishu/Kishor/Tarun up to ₹10L). 3) Stand-Up India."
                    )

        # 9. Seasonal Operational Advice
        elif intent == "seasonal_operational_advice":
            if domain == "handloom_weaving":
                if is_te:
                    reply_text = (
                        f"చేనేత వ్యాపారంలో కాలానుగుణ నిర్వహణ జాగ్రత్తలు ({district_name}): "
                        f"1) వర్షాకాలంలో గాలిలో తేమ వల్ల పట్టు, నూలు దారాలు పాడవకుండా డ్రై స్టోరేజ్ మరియు సిలికా జెల్ వాడండి. "
                        f"2) దసరా, దీపావళి మరియు వివాహాల సీజన్ల కోసం 2 నెలల ముందే స్టాక్ సిద్ధం చేసుకోండి. "
                        f"3) వేసవి కాలంలో సహజ రంగుల అద్దకం పనులను వేగవంతం చేయండి."
                    )
                else:
                    reply_text = (
                        f"Seasonal operational guidance for Handloom Weaving in {district_name}: "
                        f"1) Protect silk and cotton yarn from monsoon humidity using elevated dry shelving and moisture absorbents. "
                        f"2) Build up inventory 60 days in advance of the festive (Dussehra/Diwali) and wedding seasons. "
                        f"3) Accelerate outdoor yarn dyeing and drying workflows during sunny pre-monsoon months."
                    )
            elif domain == "dairy_farming":
                if is_te:
                    reply_text = (
                        f"వేసవి కాలంలో {district_name} లో పాల దిగుబడి తగ్గకుండా జాగ్రత్తలు: "
                        f"1) పశువుల పాకపై గ్రీన్ షేడ్ నెట్ లేదా గడ్డి పైకప్పు ఏర్పాటు చేయడం. "
                        f"2) చల్లని తాగునీరు మరియు ఎలక్ట్రోలైట్లు అందించడం. "
                        f"3) రాత్రి వేళల్లో మాత్రమే దాణా తినిపించడం."
                    )
                else:
                    reply_text = (
                        f"To maintain milk yield during peak summer heat in {district_name}: "
                        f"1) Install green agro-shade nets with misting nozzles to lower shed temperature by 4-6°C. "
                        f"2) Provide clean drinking water enriched with electrolytes. "
                        f"3) Shift heavy concentrate feeding to cooler evening and early morning hours."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"{district_name} లో {category_name} కోసం కాలానుగుణ ప్రణాళిక: స్థానిక పండుగలు మరియు పంటల కాలానికి అనుగుణంగా వర్కింగ్ క్యాపిటల్ సర్దుబాటు చేసుకోండి."
                    )
                else:
                    reply_text = (
                        f"Seasonal operational advice for {category_name} in {district_name}: Align inventory buildup with festive liquidity and maintain a 45-day operational cash buffer."
                    )

        # 10. Cash Flow / Credit Optimization
        elif intent == "cash_flow_optimization":
            if is_te:
                reply_text = (
                    f"తక్కువ అమ్మకాలు ఉండే కాలంలో నగదు నిల్వలను నిర్వహించే వ్యూహం ({district_name}): "
                    f"1) అనవసర మూలధన ఖర్చులను వాయిదా వేయండి. "
                    f"2) పాత కస్టమర్ల బాకీలను UPI QR ద్వారా వేగంగా వసూలు చేయండి. "
                    f"3) పీక్ సీజన్ లాభాల నుండి కనీసం 45 రోజుల నిర్వహణ నగదు నిల్వను ఉంచుకోండి."
                )
            else:
                reply_text = (
                    f"To navigate lean cash flow periods in {district_name}: "
                    f"1) Defer discretionary capital expenditures and non-essential asset purchases. "
                    f"2) Accelerate recovery of outstanding customer credit balances via instant UPI QR settlements. "
                    f"3) Maintain a 45-day operational cash buffer from peak-season profits to service quarterly EMIs comfortably."
                )

        # 11. General User Query
        elif user_query:
            if is_te:
                reply_text = (
                    f"{district_name} లోని స్థానిక మార్కెట్ విశ్లేషణ ప్రకారం మీ ప్రశ్న ({user_query}): "
                    f"మీ {category_name} వ్యాపారానికి నాణ్యత, స్థానిక సరఫరా గొలుసు మరియు క్రమశిక్షణతో కూడిన నిర్వహణ ప్రధాన లాభదాయక అంశాలు. "
                    f"మార్జిన్ {margin_target} నిలబెట్టుకోవడానికి పారదర్శక ధరలు మరియు నేరుగా కొనుగోలుదారులతో సంబంధాలపై దృష్టి పెట్టండి."
                )
            else:
                reply_text = (
                    f"Addressing your inquiry regarding '{user_query}' in {district_name}: "
                    f"For {category_name}, focusing on direct customer off-take, disciplined input sourcing, and quality control maintains your target {margin_target} profit margin."
                )
        else:
            if is_te:
                reply_text = f"{district_name} పరిధిలో {category_name} వ్యాపారానికి సంబంధించిన సమగ్ర హైపర్-లోకల్ సాధ్యాసాధ్యాల విశ్లేషణ సిద్ధంగా ఉంది."
            else:
                reply_text = f"Comprehensive hyper-local viability analysis generated for {category_name} in {district_name}."

        return {
            "reply": reply_text,
            "marketReach": {
                "headline": (
                    f"{district_name} పరిధిలో {category_name} కు స్థానిక గిరాకీ బలంగా ఉంది"
                    if is_te
                    else f"Strong local market reach across {district_name} rural hub"
                ),
                "details": (
                    f"గ్రామీణ నివాసాల సగటు జనాభా 2,400. సమీపంలోని సంతలు మరియు మార్కెట్ కేంద్రాలు స్థిరమైన డిమాండ్‌ను అందిస్తాయి."
                    if is_te
                    else f"High recurring consumption within {district_name} village clusters with direct commercial market linkages."
                ),
                "targetSegment": (
                    "గ్రామీణ కుటుంబాలు, స్థానిక చిరు దుకాణాలు & మండల వినియోగదారులు"
                    if is_te
                    else "Rural households, mandal retail outlets & local consumers"
                ),
                "estimatedLocalDemand": (
                    "స్థిరమైన రోజువారీ గిరాకీ (Daily Active Demand)"
                    if is_te
                    else "High daily recurring consumption"
                ),
            },
            "opportunityAnalysis": {
                "overview": (
                    f"స్థానిక వనరుల లభ్యత మరియు ప్రభుత్వ పథకాల సహకారంతో {category_name} లాభదాయకమైనది."
                    if is_te
                    else f"Favorable rural micro-climate, localized value chain aggregation, and statutory priority-sector credit support in {district_name}."
                ),
                "primaryDrivers": [
                    "స్థానిక మార్కెట్ మద్దతు మరియు అనుకూల సరఫరా గొలుసు" if is_te else "Local commercial off-take reducing logistics overhead",
                    "నిరంతర రోజువారీ వినియోగ గిరాకీ" if is_te else "Stable household consumption cycle",
                    "ప్రభుత్వ సబ్సిడీ మరియు తక్కువ వడ్డీ రుణాలు" if is_te else "Subsidized institutional credit routing under NBCFDC / MUDRA / PM Vishwakarma",
                ],
                "seasonalOpportunity": seasonal_opp,
            },
            "swot": {
                "strengths": [
                    "స్వల్ప నిర్వహణ ఖర్చులు మరియు స్వయం ఉపాధి" if is_te else "Low overhead costs with direct owner-operator management",
                    "రోజువారీ లేదా వారపు స్థిరమైన నగదు రాబడి" if is_te else "Fast daily/weekly cash turnaround cycle",
                    "స్థానిక మార్కెట్ నమ్మకం మరియు అనుభవం" if is_te else "Direct customer relationships without intermediary brokers",
                ],
                "weaknesses": [
                    "ముడిసరుకుల ధరల హెచ్చుతగ్గులు" if is_te else "Exposure to raw material and input price volatility",
                    "నిల్వ లేదా వర్కింగ్ స్పేస్ పరిమితులు" if is_te else "Limited on-site protective storage facilities",
                    "వర్కింగ్ క్యాపిటల్ హెచ్చుతగ్గులు" if is_te else "Working capital pressure during peak demand cycles",
                ],
                "opportunities": [
                    "సమీప మండల కేంద్రాలకు నేరుగా సరఫరా చేయడం" if is_te else "Expansion into direct mandal retail supply and online/cooperative platforms",
                    "డిజిటల్ చెల్లింపుల (UPI) ద్వారా వెంటనే నగదు పొందడం" if is_te else "UPI QR digital adoption to accelerate cash recovery",
                    "ప్రభుత్వ శిక్షణ మరియు నాణ్యతా ప్రమాణాలు" if is_te else "Linkages with state rural livelihood missions (SERP / Stree Nidhi)",
                ],
                "threats": [
                    "వాతావరణ మార్పులు మరియు విద్యుత్ కోతలు" if is_te else "Seasonal climate impact or utility interruptions",
                    "పెద్ద వాణిజ్య సంస్థల నుండి పోటీ" if is_te else "Price undercutting from unorganized competitors",
                    "గ్రాహకుల అప్పులు చెల్లించడంలో ఆలస్యం" if is_te else "Delayed customer credit repayments",
                ],
            },
            "competitorDensity": {
                "densityLevel": "Moderate",
                "description": (
                    "గ్రామ క్లస్టర్‌కు 3 నుండి 6 యూనిట్లు ఉంటాయి, స్థానిక మార్కెట్ల ద్వారా డిమాండ్ సులభంగా సర్దుబాటు అవుతుంది."
                    if is_te
                    else "Moderate density (typically 3 to 6 micro units per cluster; steady absorption by local market)."
                ),
                "mitigationStrategy": (
                    "నాణ్యత, సమయపాలన మరియు పారదర్శక తూకాల ద్వారా నమ్మకాన్ని పొందండి."
                    if is_te
                    else "Focus on punctual supply, verified purity/quality, and transparent pricing to retain loyal clientele."
                ),
            },
            "pricingSuggestion": {
                "recommendedBand": pricing_band,
                "benchmarkComparison": (
                    "స్థానిక సగటు మార్కెట్ ధరలకు అనుగుణంగా ఉంది"
                    if is_te
                    else f"Aligned with prevailing {district_name} market benchmarks"
                ),
                "marginTarget": margin_target,
            },
            "risks": risks if risks else ["Seasonal climate impact", "Input cost fluctuations", "Working capital tightness"],
            "assumptions": [
                f"Margin capital of ₹{margin_capital:,.0f} represents 10% of total project outlay.",
                f"Demographic and market benchmarks grounded in {district_name} official records.",
                "Advisory guidance intended for credit readiness and operational planning.",
            ],
            "groundedFacts": GroundedFacts(
                district=district_name,
                category=category_name,
                benchmarkOpex=[
                    {"item": "Raw Material / Stock / Inputs", "percentage": 55},
                    {"item": "Labor & Maintenance", "percentage": 25},
                    {"item": "Utilities & Logistics", "percentage": 20},
                ],
            ),
            "sourcesUsed": [
                f"ChromaDB Local Knowledge Store: {district_name}",
                f"APMC Mandi Price Indices: {category_name}",
                "NBCFDC Category Benchmarks",
            ],
            "providerUsed": "grounded-local-fallback",
        }

rag_service = RAGService()
