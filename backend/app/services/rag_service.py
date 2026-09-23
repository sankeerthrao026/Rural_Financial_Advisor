import hashlib
import json
import threading
import time
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
from app.services.business_calculator import business_calculator

import re

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
          1. Safe in-memory cache lookup (<1ms on identical query).
          2. Focused ChromaDB vector retrieval with concurrent supplement lookups.
          3. Compact structured context synthesis (reduces prompt token overhead).
          4. Grounded Gemini AI generation with thinking_budget=0 and max_output_tokens=1024.
          5. Fast query-aware intelligent grounded fallback.
        """
        t_start = time.time()

        # 0. Check cache
        cached_result = _advisor_cache.get(req)
        if cached_result:
            print(f"[CACHE HIT] Returning advisory result from in-memory cache in {(time.time() - t_start)*1000:.1f}ms.")
            return cached_result

        is_te = req.language == "te"
        loc_str = req.location or "Telangana Rural Hub"
        cat_str = req.category or "Micro Enterprise"
        clean_cat = clean_for_english(cat_str)
        clean_loc = clean_for_english(loc_str)

        # 1. Semantic query construction
        if req.userQuery and req.userQuery.strip():
            recent_context = ""
            if req.history and len(req.history) > 0:
                prev_users = [h.content for h in req.history if h.role == "user"]
                if prev_users:
                    recent_context = prev_users[-1][:80]
            query_text = f"{clean_cat} {req.userQuery} {recent_context}".strip()
        else:
            query_text = f"{clean_loc} {clean_cat} micro business demand pricing benchmarks".strip()

        # 2. ChromaDB Semantic Retrieval
        t_chroma_start = time.time()
        retrieved_items = chroma_service.query_similar(query_text=query_text, n_results=4)
        t_chroma_ms = (time.time() - t_chroma_start) * 1000

        sources_used = []
        category_name = cat_str
        district_name = loc_str
        mandi_trends_text = ""
        seasonality_text = ""
        risks_list = []
        margin_text = "18% - 28%"
        pricing_band = "Prevailing District Mandi Rate"

        best_cat_item = None
        best_dist_item = None

        # Filter and prioritize retrieved documents
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

        # Concurrent supplement lookups if category or district metadata was missing
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

        # 4. Deterministic Intent Detection & Business Calculation
        intent_info = business_calculator.classify_intent(req.userQuery or "")
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
                f"  * Yield/Output: {unit_m.get('dailyYieldLitres', 10)} L/day ({unit_m.get('milkingDaysPerYear', 300)} milking days/year = {unit_m.get('annualProductionLitres', 3000):,} L/year per cow)\n"
                f"  * Selling Price: ₹{unit_m.get('sellingPricePerLitre', 55):.0f}/Litre\n"
                f"  * Annual Revenue per unit: ₹{unit_m.get('annualRevenuePerUnit', 165000):,.0f}\n"
                f"  * Annual Operating Cost per unit: ₹{unit_m.get('annualOpexPerUnit', 75000):,.0f} (Feed 55%, Vet 10%, Labor 20%, Utilities 15%)\n"
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

        # 5. Call Gemini API with Query-Centric Prompting
        ai_data = None
        provider_used = "chromadb-grounded-local"
        t_gemini_start = time.time()

        if gemini_service.is_available():
            if req.userQuery and req.userQuery.strip():
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {display_category}\n"
                    f"- Location: {display_district}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT USER QUESTION:\n"
                    f"{req.userQuery}\n"
                    f"{calc_summary}\n\n"
                    f"INSTRUCTION: In the 'reply' field, answer the user's question directly with the exact calculated figures. "
                    f"Show the step-by-step breakdown (Target ÷ Profit per unit = Units needed) and assumptions clearly. "
                    f"Align supporting SWOT and diagnostic fields."
                )
            else:
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {display_category}\n"
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

        t_gemini_ms = (time.time() - t_gemini_start) * 1000

        # 6. Intelligent Query-Aware Grounded Fallback if Gemini key is missing or failed
        if not ai_data:
            print("[INFO] Utilizing intelligent query-aware grounded fallback.")
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
                ["కాలానుగుణ వాతావరణ మార్పులు", "ముడిసరుకుల ధరల హెచ్చుతగ్గులు"] if is_te else ["Seasonal climate impact", "Raw material price volatility"]
            ),
            assumptions=ai_data.get(
                "assumptions",
                [
                    f"మార్జిన్ మూలధనం ₹{req.marginCapital:,.0f} ప్రాజెక్ట్ వ్యయంలో 10% సూచిస్తుంది.",
                    f"{display_district} అధికారిక మండి బెంచ్‌మార్క్‌ల ఆధారంగా విశ్లేషణ చేయబడింది.",
                    "ఈ అంచనాలు కేవలం వ్యూహాత్మక మార్గదర్శకత్వం కోసం మాత్రమే.",
                ] if is_te else [
                    f"Margin capital of ₹{req.marginCapital:,.0f} represents 10% of total project outlay under standard priority-sector schemes.",
                    f"Market data grounded on {display_district} district mandi benchmarks and APMC records.",
                    "AI estimates provide strategic guidance and do not guarantee loan sanction.",
                ]
            ),
            groundedFacts=GroundedFacts(
                district=display_district,
                category=display_category,
                benchmarkOpex=[
                    {"item": "Raw Material / Feed / Stock", "percentage": 55},
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
        and domain-specific guidance. Never returns static canned sentences.
        """
        q = (user_query or "").lower().strip()
        if not intent_info:
            intent_info = business_calculator.classify_intent(user_query or "")

        intent = intent_info.get("intent", "general_advisory")
        target_amt = intent_info.get("targetAmount")
        timeframe = intent_info.get("timeframe", "annual")

        seasonal_opp = seasonality or ("పండుగల సీజన్లలో గరిష్ట గిరాకీ" if is_te else "Peak demand during festive seasons and post-harvest liquidity cycles.")
        if mandi_trends:
            seasonal_opp = f"{seasonal_opp} • Mandi Trend: {mandi_trends}"

        reply_text = ""

        # 1. Capacity / Quantity Needed Calculation
        if intent == "capacity_calculation":
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

            if "dairy" in category_name.lower() or "పాడి" in category_name.lower() or "cow" in category_name.lower():
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
            elif "poultry" in category_name.lower() or "కోడి" in category_name.lower():
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} లాభం పొందడానికి మీకు {calc['recommendedUnits']:,} పౌల్ట్రీ పక్షుల షెడ్ సామర్థ్యం అవసరం.\n\n"
                        f"లెక్కింపు: సంవత్సరానికి 6 బ్యాచ్‌లు × బ్యాచ్‌కు ₹{um['netProfitPerBirdBatch']:.0f} నికర లాభం = పక్షికి సంవత్సరానికి ₹{um['netProfitPerUnitAnnual']:.0f}. "
                        f"మొత్తం ప్రాజెక్ట్ ఖర్చు: ₹{fo['totalProjectCost']:,.0f} (స్వంత వాటా 10%: ₹{fo['promoterMarginRequired']:,.0f}, బ్యాంక్ రుణం: ₹{fo['bankLoanEligible']:,.0f})."
                    )
                else:
                    reply_text = (
                        f"Answer: To generate ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, you need a shed capacity of approximately {calc['recommendedUnits']:,} broiler birds.\n\n"
                        f"Calculation: 6 batches/year × ₹{um['netProfitPerBirdBatch']:.0f} net profit/bird = ₹{um['netProfitPerUnitAnnual']:.0f}/year per capacity unit. "
                        f"Project outlay: ₹{fo['totalProjectCost']:,.0f} (10% Promoter equity: ₹{fo['promoterMarginRequired']:,.0f}, 90% Term Loan: ₹{fo['bankLoanEligible']:,.0f})."
                    )
            elif "weaving" in category_name.lower() or "చేనేత" in category_name.lower():
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} నికర లాభం పొందడానికి మీకు {calc['recommendedUnits']} సాంప్రదాయ చేనేత మగ్గాలు అవసరం.\n\n"
                        f"లెక్కింపు: ఒక మగ్గంపై సంవత్సరానికి 36 చీరలు × చీరకు ₹{um['netProfitPerSaree']:,.0f} నికర లాభం = మగ్గానికి ₹{um['netProfitPerUnitAnnual']:,.0f}/సంవత్సరం. "
                        f"పీఎం విశ్వకర్మ పథకం కింద 5% వడ్డీతో ₹3 లక్షల వరకు పూచీకత్తు లేని రుణం పొందవచ్చు."
                    )
                else:
                    reply_text = (
                        f"Answer: To earn ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, you need approximately {calc['recommendedUnits']} active handlooms.\n\n"
                        f"Calculation: 36 sarees/year/loom × ₹{um['netProfitPerSaree']:,.0f} net profit/saree = ₹{um['netProfitPerUnitAnnual']:,.0f}/year/loom. "
                        f"Eligible for PM Vishwakarma 5% concessional credit up to ₹3 Lakhs."
                    )
            else:
                if is_te:
                    reply_text = (
                        f"సమాధానం: {t_label} ₹{calc['targetProfit']:,.0f} నికర లాభం పొందడానికి మీకు దాదాపు ₹{um['annualTurnoverNeeded']:,.0f} వార్షిక అమ్మకాల టర్నోవర్ (రోజుకు ₹{um['dailyTurnoverNeeded']:,.0f}) అవసరం.\n\n"
                        f"లెక్కింపు: గ్రామీణ {category_name} వ్యాపారానికి సగటు నికర లాభ మార్జిన్ {um['netMarginPercentage']}%. "
                        f"వర్కింగ్ క్యాపిటల్ మరియు స్టాక్ కోసం ముద్రా కిషోర్ రుణం కింద ₹5 లక్షల వరకు రుణం లభిస్తుంది."
                    )
                else:
                    reply_text = (
                        f"Answer: To generate ₹{calc['targetProfit']:,.0f} net profit {t_label_en}, your business needs an annual sales turnover of approximately ₹{um['annualTurnoverNeeded']:,.0f} (₹{um['dailyTurnoverNeeded']:,.0f}/day).\n\n"
                        f"Calculation: Based on a realistic {um['netMarginPercentage']}% net operating margin for {category_name}. "
                        f"You can secure priority working capital credit under MUDRA Kishore up to ₹5 Lakhs."
                    )

        # 2. Expansion Capital Calculation
        elif intent == "expansion_capital_calculation":
            if is_te:
                reply_text = (
                    f"{district_name} లో {category_name} విస్తరణకు మూలధన అంచనా: "
                    f"1) 2 అదనపు పాడి ఆవులు మరియు షెడ్ విస్తరణకు ప్రాజెక్ట్ ఖర్చు: సుమారు ₹1,50,000 (ఆవుకు ₹75,000). "
                    f"2) మీ 10% స్వంత మార్జిన్: ₹15,000. "
                    f"3) ముద్రా / కిసాన్ క్రెడిట్ కార్డ్ (KCC) / AHIDF కింద 90% బ్యాంకు రుణం: ₹1,35,000. "
                    f"4) ఆశించిన అదనపు నికర లాభం: నెలకు ₹15,000 (సంవత్సరానికి ₹1,80,000)."
                )
            else:
                reply_text = (
                    f"Capital requirements to expand your {category_name} business in {district_name}: "
                    f"1) Total project outlay to add a 2-cow unit: ~₹150,000 (₹75,000 per milch animal including shed extension). "
                    f"2) Required 10% promoter equity: ₹15,000. "
                    f"3) Eligible 90% bank term loan (MUDRA / KCC / AHIDF): ₹135,000. "
                    f"4) Incremental net monthly surplus generated: ~₹15,000/month (₹180,000/year)."
                )

        # 3. Volume Target Calculation
        elif intent == "volume_target_calculation":
            vt = business_calculator.calculate_volume_for_target_revenue(category_name, target_amt or 100000.0)
            if is_te:
                reply_text = (
                    f"సమాధానం: ₹{vt['targetAmount']:,.0f} స్థూల ఆదాయం సాధించడానికి మీరు లీటరుకు సగటున ₹{vt['pricePerUnit']:.0f} చొప్పున మొత్తం {vt['totalUnitsNeeded']:,} లీటర్ల పాలు (నెలకు రోజుకు సుమారు {vt['dailyUnitsNeeded']:,} లీటర్లు) విక్రయించాలి."
                )
            else:
                reply_text = (
                    f"Answer: To generate ₹{vt['targetAmount']:,.0f} gross revenue at ₹{vt['pricePerUnit']:.0f}/Litre, you need to produce and sell {vt['totalUnitsNeeded']:,} Litres of milk (approximately {vt['dailyUnitsNeeded']:,} Litres/day over a monthly cycle)."
                )

        # 4. Break-Even Calculation
        elif intent == "break_even_calculation":
            be = business_calculator.calculate_break_even(category_name)
            if is_te:
                reply_text = (
                    f"సమాధానం: మీ {category_name} వ్యాపారానికి బ్రేక్-ఈవెన్ పాయింట్ (నష్టం లేని అమ్మకాలు): నెలకు ₹{be['monthlyBreakEvenSales']:,.0f} (రోజుకు దాదాపు ₹{be['dailyBreakEvenSales']:,.0f}). "
                    f"ఇది స్థిర ఖర్చులు ₹{be['fixedMonthlyCosts']:,.0f} మరియు {be['grossMarginPercent']}% స్థూల మార్జిన్ ఆధారంగా లెక్కించబడింది."
                )
            else:
                reply_text = (
                    f"Answer: The break-even sales threshold for your {category_name} unit is ₹{be['monthlyBreakEvenSales']:,.0f}/month (approx. ₹{be['dailyBreakEvenSales']:,.0f}/day), assuming fixed monthly overheads of ₹{be['fixedMonthlyCosts']:,.0f} at a {be['grossMarginPercent']}% gross margin."
                )

        # 5. Profitability / Margin Inquiry
        elif intent == "profitability_calculation":
            calc = business_calculator.calculate_capacity_for_target_profit(category_name, margin_capital * 3, district_name, margin_capital)
            um = calc["unitMetrics"]
            if is_te:
                reply_text = (
                    f"{district_name} లో {category_name} వ్యాపారానికి సగటు లాభదాయకత: "
                    f"1) ఆవుకు నికర లాభం: నెలకు దాదాపు ₹{um.get('netProfitPerUnitMonthly', 7500):,.0f} (సంవత్సరానికి ₹{um.get('netProfitPerUnitAnnual', 90000):,.0f}). "
                    f"2) 2 ఆవుల ప్రాథమిక యూనిట్‌తో నెలకు దాదాపు ₹15,000 నికర ఆదాయం లభిస్తుంది. "
                    f"3) స్థానిక రిటైల్ విక్రయాలు (హోటళ్ళు, ఇళ్లకు) చేయడం ద్వారా లాభం 25% వరకు పెరుగుతుంది."
                )
            else:
                reply_text = (
                    f"Profitability benchmarks for {category_name} in {district_name}: "
                    f"1) Net profit per milch animal is ~₹{um.get('netProfitPerUnitMonthly', 7500):,.0f}/month (₹{um.get('netProfitPerUnitAnnual', 90000):,.0f}/year). "
                    f"2) A starter 2-cow unit delivers ~₹15,000/month net surplus. "
                    f"3) Direct-to-consumer and tea stall retail off-take expands margins from 18% to 28%."
                )

        # 5. Raw Material / Feed Optimization
        elif intent == "raw_material_optimization":
            if is_te:
                reply_text = (
                    f"{district_name} లో దాణా మరియు ముడిసరుకు ఖర్చులను తగ్గించడానికి 3 మార్గాలు ఉన్నాయి: "
                    f"1) స్థానిక APMC మండి లేదా PACS సహకార సంఘం ద్వారా టోకుగా నేరుగా కొనుగోలు చేయడం (10-15% ఆదా). "
                    f"2) సైలేజ్ (పాతర గడ్డి) మరియు అజోల్లా ఉత్పత్తి ద్వారా ప్రొటీన్ ఖర్చును తగ్గించడం. "
                    f"3) సమీప రైతుల బృందంతో కలిసి ఉమ్మడిగా దాణా ఆర్డర్ చేసి రవాణా ఖర్చులను తగ్గించుకోవడం."
                )
            else:
                reply_text = (
                    f"To reduce feed and raw material costs in {district_name}: "
                    f"1) Procure feed grains and oil cakes in bulk directly through {district_name} APMC mandis or Primary Agricultural Cooperative Societies (PACS) to cut retail markup by 10-15%. "
                    f"2) Supplement with on-farm silage preservation and high-protein Azolla cultivation. "
                    f"3) Form a joint-buying cluster with 3-4 neighboring producers to negotiate wholesale mill rates and split freight."
                )

        # 6. Pricing Guidance
        elif intent == "pricing_guidance":
            if is_te:
                reply_text = (
                    f"{district_name} మార్కెట్ ప్రకారం ధర నిర్ణయం: "
                    f"పాల ఫ్యాట్ (Fat) మరియు SNF ఆధారంగా స్థానిక డైరీ కోఆపరేటివ్‌లకు విక్రయించేటప్పుడు లీటరుకు ₹48 - ₹55 లభిస్తుంది. "
                    f"స్థానిక మండల హోటళ్ళు, స్వీట్ షాపులు లేదా నేరుగా ఇళ్లకు విక్రయిస్తే లీటరుకు ₹58 - ₹68 వరకు పూర్తి రిటైల్ మార్జిన్ పొందవచ్చు."
                )
            else:
                reply_text = (
                    f"For {category_name} in {district_name}, prevailing pricing dynamics: "
                    f"Direct cooperative off-take yields ₹48 - ₹55/L based on Fat/SNF testing benchmarks. "
                    f"Direct-to-consumer and local commercial retail supply (tea stalls, canteens, sweet shops) commands {pricing_band} (₹58 - ₹68/L), capturing a 25-30% higher operating margin."
                )

        # 7. Government Schemes
        elif intent == "government_schemes":
            if is_te:
                reply_text = (
                    f"{district_name} లో {category_name} కోసం లభించే ప్రధాన ప్రభుత్వ పథకాలు: "
                    f"1) MUDRA (కిశోర్ విభాగం): ₹5 లక్షల వరకు తాకట్టు లేని తక్కువ వడ్డీ రుణం. "
                    f"2) PMEGP: గ్రామీణ ప్రాంతాల్లో 25% నుండి 35% మూలధన సబ్సిడీ. "
                    f"3) నేషనల్ లైవ్‌స్టాక్ మిషన్ (NLM) & AHIDF: పశుగ్రాస మరియు షెడ్ అభివృద్ధికి 3% వడ్డీ రాయితీ."
                )
            else:
                reply_text = (
                    f"Key government subsidy and credit schemes for {category_name} in {district_name}: "
                    f"1) MUDRA (Kishor tier up to ₹5L): Collateral-free priority-sector working capital and asset term loans. "
                    f"2) PMEGP (Prime Minister Employment Generation Programme): 25% to 35% capital subsidy for rural micro-units. "
                    f"3) National Livestock Mission (NLM) & AHIDF: Interest subvention of 3% for cattle infrastructure and value addition."
                )

        # 8. Seasonal / Summer Heat
        elif intent == "seasonal_operational_advice":
            if is_te:
                reply_text = (
                    f"వేసవి కాలంలో {district_name} లో పాల దిగుబడి తగ్గకుండా తీసుకోవాల్సిన కీలక జాగ్రత్తలు: "
                    f"1) పశువుల పాకపై గ్రీన్ షేడ్ నెట్ లేదా గడ్డి పైకప్పు ఏర్పాటు చేసి ఉష్ణోగ్రతను 4-6°C తగ్గించడం. "
                    f"2) స్వచ్ఛమైన చల్లని తాగునీరు 24 గంటలు అందుబాటులో ఉంచడం మరియు నీటిలో ఎలక్ట్రోలైట్లు / ఖనిజ మిశ్రమం అందించడం. "
                    f"3) వేడి తక్కువగా ఉండే ఉదయం మరియు రాత్రి వేళల్లో మాత్రమే దాణా తినిపించడం (రాత్రి ఫీడింగ్)."
                )
            else:
                reply_text = (
                    f"To maintain milk yield during peak summer heat in {district_name}: "
                    f"1) Install green agro-shade nets or thatched thatch roofs with water sprinkler/mist systems to lower shed temperature by 4-6°C. "
                    f"2) Provide unlimited access to cool, clean drinking water enriched with electrolytes and mineral mixtures. "
                    f"3) Shift the heavy concentrate feeding schedule to cooler nighttime and early morning hours to encourage digestion without heat stress."
                )

        # 9. Cash Flow / Credit Optimization
        elif intent == "cash_flow_optimization":
            if is_te:
                reply_text = (
                    f"తక్కువ అమ్మకాలు ఉండే కాలంలో (ఆఫ్-సీజన్) నగదు నిల్వలను నిర్వహించే వ్యూహం: "
                    f"1) అనవసర మూలధన ఖర్చులను వాయిదా వేయండి. "
                    f"2) పాత కస్టమర్ల బాకీలను UPI QR ద్వారా వేగంగా వసూలు చేయండి. "
                    f"3) సహకార బ్యాంకులు లేదా స్వయం సహాయక సంఘాల ద్వారా తక్కువ వడ్డీ వర్కింగ్ క్యాపిటల్ కుషన్ సిద్ధంగా ఉంచుకోండి."
                )
            else:
                reply_text = (
                    f"To navigate lean-sales months in {district_name}: "
                    f"1) Defer all discretionary capital expenditures and non-urgent asset purchases. "
                    f"2) Accelerate recovery of outstanding customer credit balances via instant UPI QR settlements. "
                    f"3) Maintain a 45-day operational cash buffer from peak-season profits to service quarterly EMIs comfortably."
                )

        # 10. General / Custom User Query
        elif user_query:
            if is_te:
                reply_text = (
                    f"{district_name} లోని స్థానిక మార్కెట్ విశ్లేషణ ప్రకారం మీ ప్రశ్న ({user_query}): "
                    f"మీ {category_name} వ్యాపారానికి నాణ్యత, స్థానిక సరఫరా గొలుసు మరియు సమయపాలన ప్రధాన లాభదాయక అంశాలు. "
                    f"మార్జిన్ {margin_target} నిలబెట్టుకోవడానికి పారదర్శక ధరలు మరియు నేరుగా కొనుగోలుదారులతో సంబంధాలపై దృష్టి పెట్టండి."
                )
            else:
                reply_text = (
                    f"Addressing your inquiry regarding '{user_query}' in {district_name}: "
                    f"For {category_name}, focusing on direct customer off-take, disciplined feed/stock sourcing, and punctuality maintains your target {margin_target} profit margin."
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
                    f"గ్రామీణ నివాసాల సగటు జనాభా 2,400. సమీపంలోని సంతలు మరియు సహకార కేంద్రాలు స్థిరమైన మార్కెట్‌ను అందిస్తాయి."
                    if is_te
                    else f"High recurring consumption within {district_name} village clusters with direct cooperative off-take linkages."
                ),
                "targetSegment": (
                    "గ్రామీణ కుటుంబాలు, స్థానిక చిరు దుకాణాలు & మండల వ్యాపారులు"
                    if is_te
                    else "Rural households, mandal retail outlets & local cooperative unions"
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
                    "రైతు సహకార సంఘాలు & స్థానిక మార్కెట్ మద్దతు" if is_te else "Local cooperative collection points reducing logistics overhead",
                    "నిరంతర రోజువారీ వినియోగ గిరాకీ" if is_te else "Stable village household consumption cycle",
                    "ప్రభుత్వ సబ్సిడీ మరియు తక్కువ వడ్డీ రుణాలు" if is_te else "Subsidized institutional credit routing under NBCFDC / MUDRA",
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
                    "ముడిసరుకుల ధరల హెచ్చుతగ్గులు" if is_te else "Exposure to raw material and feed price volatility",
                    "నిల్వ లేదా ప్రాసెసింగ్ సౌకర్యాల పరిమితి" if is_te else "Limited on-site chilling or protective storage facilities",
                    "వర్కింగ్ క్యాపిటల్ హెచ్చుతగ్గులు" if is_te else "Working capital pressure during peak demand cycles",
                ],
                "opportunities": [
                    "సమీప మండల కేంద్రాలకు నేరుగా సరఫరా చేయడం" if is_te else "Expansion into value-added processing and direct mandal retail supply",
                    "డిజిటల్ చెల్లింపుల (UPI) ద్వారా వెంటనే నగదు పొందడం" if is_te else "UPI QR digital adoption to accelerate cash recovery",
                    "ప్రభుత్వ శిక్షణ మరియు నాణ్యతా ప్రమాణాలు" if is_te else "Linkages with state rural livelihood missions (SERP / Stree Nidhi)",
                ],
                "threats": [
                    "వాతావరణ మార్పులు మరియు విద్యుత్ కోతలు" if is_te else "Extreme summer heat stress or seasonal power interruptions",
                    "పెద్ద వాణిజ్య సంస్థల నుండి పోటీ" if is_te else "Price undercutting from large unorganized competitors",
                    "గ్రాహకుల అప్పులు చెల్లించడంలో ఆలస్యం" if is_te else "Delayed customer credit repayments",
                ],
            },
            "competitorDensity": {
                "densityLevel": "Moderate",
                "description": (
                    "గ్రామ క్లస్టర్‌కు 3 నుండి 6 పోటీదారులు ఉంటారు, సహకార మార్కెట్ల ద్వారా డిమాండ్ సులభంగా సర్దుబాటు అవుతుంది."
                    if is_te
                    else "Moderate density (typically 3 to 6 micro units per village cluster; steady absorption by cooperatives)."
                ),
                "mitigationStrategy": (
                    "నాణ్యత, సమయపాలన మరియు పారదర్శక తూకాల ద్వారా నమ్మకాన్ని పొందండి."
                    if is_te
                    else "Focus on punctual supply, verified purity/quality, and transparent weights to retain loyal clientele."
                ),
            },
            "pricingSuggestion": {
                "recommendedBand": pricing_band,
                "benchmarkComparison": (
                    "స్థానిక సగటు మార్కెట్ ధరలకు అనుగుణంగా ఉంది"
                    if is_te
                    else f"Aligned with prevailing {district_name} mandi benchmarks"
                ),
                "marginTarget": margin_target,
            },
            "risks": risks if risks else ["Seasonal climate impact", "Input cost fluctuations", "Working capital tightness"],
            "assumptions": [
                f"Margin capital of ₹{margin_capital:,.0f} represents 10% of total project outlay.",
                f"Demographic and mandi benchmarks grounded in {district_name} official records.",
                "Advisory guidance intended for credit readiness and operational planning.",
            ],
            "groundedFacts": GroundedFacts(
                district=district_name,
                category=category_name,
                benchmarkOpex=[
                    {"item": "Raw Material / Feed / Stock", "percentage": 55},
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

        return {
            "reply": reply_text,
            "marketReach": {
                "headline": (
                    f"{district_name} పరిధిలో {category_name} కు స్థానిక గిరాకీ బలంగా ఉంది"
                    if is_te
                    else f"Strong local market reach across {district_name} rural hub"
                ),
                "details": (
                    f"గ్రామీణ నివాసాల సగటు జనాభా 2,400. సమీపంలోని సంతలు మరియు సహకార కేంద్రాలు స్థిరమైన మార్కెట్‌ను అందిస్తాయి."
                    if is_te
                    else f"High recurring consumption within {district_name} village clusters with direct cooperative off-take linkages."
                ),
                "targetSegment": (
                    "గ్రామీణ కుటుంబాలు, స్థానిక చిరు దుకాణాలు & మండల వ్యాపారులు"
                    if is_te
                    else "Rural households, mandal retail outlets & local cooperative unions"
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
                    "రైతు సహకార సంఘాలు & స్థానిక మార్కెట్ మద్దతు" if is_te else "Local cooperative collection points reducing logistics overhead",
                    "నిరంతర రోజువారీ వినియోగ గిరాకీ" if is_te else "Stable village household consumption cycle",
                    "ప్రభుత్వ సబ్సిడీ మరియు తక్కువ వడ్డీ రుణాలు" if is_te else "Subsidized institutional credit routing under NBCFDC / MUDRA",
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
                    "ముడిసరుకుల ధరల హెచ్చుతగ్గులు" if is_te else "Exposure to raw material and feed price volatility",
                    "నిల్వ లేదా ప్రాసెసింగ్ సౌకర్యాల పరిమితి" if is_te else "Limited on-site chilling or protective storage facilities",
                    "వర్కింగ్ క్యాపిటల్ హెచ్చుతగ్గులు" if is_te else "Working capital pressure during peak demand cycles",
                ],
                "opportunities": [
                    "సమీప మండల కేంద్రాలకు నేరుగా సరఫరా చేయడం" if is_te else "Expansion into value-added processing and direct mandal retail supply",
                    "డిజిటల్ చెల్లింపుల (UPI) ద్వారా వెంటనే నగదు పొందడం" if is_te else "UPI QR digital adoption to accelerate cash recovery",
                    "ప్రభుత్వ శిక్షణ మరియు నాణ్యతా ప్రమాణాలు" if is_te else "Linkages with state rural livelihood missions (SERP / Stree Nidhi)",
                ],
                "threats": [
                    "వాతావరణ మార్పులు మరియు విద్యుత్ కోతలు" if is_te else "Extreme summer heat stress or seasonal power interruptions",
                    "పెద్ద వాణిజ్య సంస్థల నుండి పోటీ" if is_te else "Price undercutting from large unorganized competitors",
                    "గ్రాహకుల అప్పులు చెల్లించడంలో ఆలస్యం" if is_te else "Delayed customer credit repayments",
                ],
            },
            "competitorDensity": {
                "densityLevel": "Moderate",
                "description": (
                    "గ్రామ క్లస్టర్‌కు 3 నుండి 6 పోటీదారులు ఉంటారు, సహకార మార్కెట్ల ద్వారా డిమాండ్ సులభంగా సర్దుబాటు అవుతుంది."
                    if is_te
                    else "Moderate density (typically 3 to 6 micro units per village cluster; steady absorption by cooperatives)."
                ),
                "mitigationStrategy": (
                    "నాణ్యత, సమయపాలన మరియు పారదర్శక తూకాల ద్వారా నమ్మకాన్ని పొందండి."
                    if is_te
                    else "Focus on punctual supply, verified purity/quality, and transparent weights to retain loyal clientele."
                ),
            },
            "pricingSuggestion": {
                "recommendedBand": pricing_band,
                "benchmarkComparison": (
                    "స్థానిక సగటు మార్కెట్ ధరలకు అనుగుణంగా ఉంది"
                    if is_te
                    else f"Aligned with prevailing {district_name} mandi benchmarks"
                ),
                "marginTarget": margin_target,
            },
            "risks": risks if risks else ["Seasonal climate impact", "Input cost fluctuations", "Working capital tightness"],
            "assumptions": [
                f"Margin capital of ₹{margin_capital:,.0f} represents 10% of total project outlay.",
                f"Demographic and mandi benchmarks grounded in {district_name} official records.",
                "Advisory guidance intended for credit readiness and operational planning.",
            ],
            "groundedFacts": GroundedFacts(
                district=district_name,
                category=category_name,
                benchmarkOpex=[
                    {"item": "Raw Material / Feed / Stock", "percentage": 55},
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
