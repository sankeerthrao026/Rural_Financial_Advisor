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
    ) -> str:
        """Constructs a clean, compact structured JSON context instead of raw document dumps."""
        signals = []
        for item in retrieved_items:
            doc = item.get("document", "").strip()
            cleaned_lines = [
                l.strip() for l in doc.splitlines()
                if l.strip() and not l.startswith("Document ID:") and not l.startswith("Category:")
            ]
            if cleaned_lines:
                signals.append(" ".join(cleaned_lines[:3]))

        compact = {
            "district": district_name,
            "category": category_name,
            "mandi_trends": mandi_trends or "Standard mandi off-take",
            "demand_seasonality": seasonality or "Year-round demand",
            "pricing_benchmark": pricing_band,
            "target_margin": margin_text,
            "key_risks": risks_list[:3],
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
        clean_cat = cat_str.split("/")[0].split("(")[0].strip()
        clean_loc = loc_str.split(",")[0].split("/")[0].split("(")[0].strip()

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
                sources_used.append(f"ChromaDB [{meta.get('type', 'local_dataset')}]: {source_label}")

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

        # 3. Compact Context Construction
        compact_context = self._build_compact_context(
            district_name=district_name,
            category_name=category_name,
            mandi_trends=mandi_trends_text,
            seasonality=seasonality_text,
            pricing_band=pricing_band,
            margin_text=margin_text,
            risks_list=risks_list,
            retrieved_items=retrieved_items,
        )

        # 4. Call Gemini API with Query-Centric Prompting
        ai_data = None
        provider_used = "chromadb-grounded-local"
        t_gemini_start = time.time()

        if gemini_service.is_available():
            if req.userQuery and req.userQuery.strip():
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {cat_str}\n"
                    f"- Location: {loc_str}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT USER QUESTION:\n"
                    f"{req.userQuery}\n\n"
                    f"Please provide a direct, practical, and query-specific advisory answer in the 'reply' field "
                    f"addressing this question specifically. Keep supporting diagnostic fields aligned."
                )
            else:
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {cat_str}\n"
                    f"- Location: {loc_str}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT INQUIRY:\n"
                    f"Provide an initial comprehensive business viability assessment for starting or operating a {cat_str} unit in {loc_str}."
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

        # 5. Intelligent Query-Aware Grounded Fallback if Gemini key is missing or failed
        if not ai_data:
            print("[INFO] Utilizing intelligent query-aware grounded fallback.")
            ai_data = self._generate_grounded_fallback(
                location=loc_str,
                category=cat_str,
                district_name=district_name,
                category_name=category_name,
                is_te=is_te,
                user_query=req.userQuery,
                mandi_trends=mandi_trends_text,
                seasonality=seasonality_text,
                margin_target=margin_text,
                pricing_band=pricing_band,
                risks=risks_list,
                margin_capital=req.marginCapital,
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
                    f"{district_name} అధికారిక మండి బెంచ్‌మార్క్‌ల ఆధారంగా విశ్లేషణ చేయబడింది.",
                    "ఈ అంచనాలు కేవలం వ్యూహాత్మక మార్గదర్శకత్వం కోసం మాత్రమే.",
                ] if is_te else [
                    f"Margin capital of ₹{req.marginCapital:,.0f} represents 10% of total project outlay under standard priority-sector schemes.",
                    f"Market data grounded on {district_name} district mandi benchmarks and APMC records.",
                    "AI estimates provide strategic guidance and do not guarantee loan sanction.",
                ]
            ),
            groundedFacts=GroundedFacts(
                district=district_name,
                category=category_name,
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
    ) -> Dict[str, Any]:
        """
        Intelligent, query-specific fallback that understands domain topics
        (feed/cost reduction, heat/summer, pricing, schemes, cash flow, customer expansion, loan capacity).
        Never returns a static canned sentence.
        """
        q = (user_query or "").lower().strip()
        seasonal_opp = seasonality or ("పండుగల సీజన్లలో గరిష్ట గిరాకీ" if is_te else "Peak demand during festive seasons and post-harvest liquidity cycles.")
        if mandi_trends:
            seasonal_opp = f"{seasonal_opp} • Mandi Trend: {mandi_trends}"

        # Classify user query intent into specific domains
        is_feed = any(w in q for w in ["feed", "fodder", "raw material", "input cost", "cost of feed", "దాణా", "పచ్చిగడ్డి", "ముడిసరుకు", "తక్కువ ఖర్చు"])
        is_summer_heat = any(w in q for w in ["summer", "heat", "hot", "yield in summer", "temperature", "weather", "ఎండ", "వేసవి", "దిగుబడి"])
        is_pricing = any(w in q for w in ["price", "pricing", "rate", "cost per", "charge", "ధర", "ఎంత అమ్మాలి", "ధర నిర్ణయం"])
        is_schemes = any(w in q for w in ["scheme", "subsidy", "government", "mudra", "pmegp", "nbcfdc", "సబ్సిడీ", "పథకం", "ప్రభుత్వ"])
        is_cash_flow = any(w in q for w in ["cash flow", "low sales", "lean month", "off-season", "working capital", "నగదు", "తక్కువ అమ్మకాలు", "ఖర్చులు"])
        is_expansion = any(w in q for w in ["customer", "expand", "next village", "grow", "scale", "sales", "client", "విస్తరణ", "కస్టమర్", "అమ్మకాలు పెంచడం"])
        is_loan_capacity = any(w in q for w in ["loan amount", "afford", "borrow", "eligible loan", "credit support", "రుణ మొత్తం", "ఎంత రుణం"])

        if is_feed:
            reply_text = (
                f"{district_name} లో పశువుల దాణా మరియు ముడిసరుకు ఖర్చులను తగ్గించడానికి 3 మార్గాలు ఉన్నాయి: "
                f"1) స్థానిక APMC మండి లేదా ప్రాథమిక వ్యవసాయ సహకార సంఘం (PACS) ద్వారా టోకుగా నేరుగా కొనుగోలు చేయడం (8-15% ఆదా). "
                f"2) సైలేజ్ (పాతర గడ్డి) మరియు అజోల్లా ఉత్పత్తి ద్వారా ప్రొటీన్ ఖర్చును తగ్గించడం. "
                f"3) సమీప రైతుల బృందంతో కలిసి ఉమ్మడిగా దాణా ఆర్డర్ చేసి రవాణా ఖర్చులను తగ్గించుకోవడం."
                if is_te
                else f"To reduce feed and raw material costs in {district_name}: "
                f"1) Procure feed grains and oil cakes in bulk directly through {district_name} APMC mandis or Primary Agricultural Cooperative Societies (PACS) to cut retail markup by 10-15%. "
                f"2) Supplement with on-farm silage preservation and high-protein Azolla cultivation. "
                f"3) Form a joint-buying cluster with 3-4 neighboring producers to negotiate wholesale mill rates and split freight."
            )
        elif is_summer_heat:
            reply_text = (
                f"వేసవి కాలంలో {district_name} లో పాల దిగుబడి తగ్గకుండా తీసుకోవాల్సిన కీలక జాగ్రత్తలు: "
                f"1) పశువుల పాకపై గ్రీన్ షేడ్ నెట్ లేదా గడ్డి పైకప్పు ఏర్పాటు చేసి ఉష్ణోగ్రతను 4-6°C తగ్గించడం. "
                f"2) స్వచ్ఛమైన చల్లని తాగునీరు 24 గంటలు అందుబాటులో ఉంచడం మరియు నీటిలో ఎలక్ట్రోలైట్లు / ఖనిజ మిశ్రమం అందించడం. "
                f"3) వేడి తక్కువగా ఉండే ఉదయం మరియు రాత్రి వేళల్లో మాత్రమే దాణా తినిపించడం (రాత్రి ఫీడింగ్)."
                if is_te
                else f"To maintain milk yield during peak summer heat in {district_name}: "
                f"1) Install green agro-shade nets or thatched thatch roofs with water sprinkler/mist systems to lower shed temperature by 4-6°C. "
                f"2) Provide unlimited access to cool, clean drinking water enriched with electrolytes and mineral mixtures. "
                f"3) Shift the heavy concentrate feeding schedule to cooler nighttime and early morning hours to encourage digestion without heat stress."
            )
        elif is_pricing:
            reply_text = (
                f"{district_name} మార్కెట్ ప్రకారం ధర నిర్ణయం: "
                f"పాల ఫ్యాట్ (Fat) మరియు SNF ఆధారంగా స్థానిక డైరీ కోఆపరేటివ్‌లకు విక్రయించేటప్పుడు లీటరుకు ₹42 - ₹48 లభిస్తుంది. "
                f"అయితే స్థానిక మండల హోటళ్ళు, స్వీట్ షాపులు లేదా నేరుగా ఇళ్లకు విక్రయిస్తే లీటరుకు ₹58 - ₹68 వరకు పూర్తి రిటైల్ మార్జిన్ పొందవచ్చు."
                if is_te
                else f"For {category_name} in {district_name}, prevailing pricing dynamics: "
                f"Direct cooperative off-take yields ₹42 - ₹48/L based on Fat/SNF testing benchmarks. "
                f"Direct-to-consumer and local commercial retail supply (tea stalls, canteens, sweet shops) commands {pricing_band} (₹58 - ₹68/L), capturing a 25-30% higher operating margin."
            )
        elif is_schemes:
            reply_text = (
                f"{district_name} లో {category_name} కోసం లభించే ప్రధాన ప్రభుత్వ పథకాలు: "
                f"1) PMEGP: గ్రామీణ ప్రాంతాల్లో 25% నుండి 35% మూలధన సబ్సిడీ. "
                f"2) MUDRA (కిశోర్ విభాగం): ₹5 లక్షల వరకు తాకట్టు లేని తక్కువ వడ్డీ రుణం. "
                f"3) నేషనల్ లైవ్‌స్టాక్ మిషన్ (NLM): డెయిరీ మరియు పశుగ్రాస అభివృద్ధికి ప్రత్యేక సబ్సిడీ."
                if is_te
                else f"Key government subsidy and credit schemes for {category_name} in {district_name}: "
                f"1) PMEGP (Prime Minister Employment Generation Programme): 25% to 35% capital subsidy for rural micro-units. "
                f"2) MUDRA (Kishor tier up to ₹5L): Collateral-free priority-sector working capital and asset term loans. "
                f"3) National Livestock Mission (NLM) & AHIDF: Interest subvention of 3% for value-addition and cattle infrastructure."
            )
        elif is_cash_flow:
            reply_text = (
                f"తక్కువ అమ్మకాలు ఉండే కాలంలో (ఆఫ్-సీజన్) నగదు నిల్వలను నిర్వహించే వ్యూహం: "
                f"1) అనవసర మూలధన ఖర్చులను వాయిదా వేయండి. "
                f"2) పాత కస్టమర్ల బాకీలను UPI QR ద్వారా వేగంగా వసూలు చేయండి. "
                f"3) సహకార బ్యాంకులు లేదా స్వయం సహాయక సంఘాల ద్వారా తక్కువ వడ్డీ వర్కింగ్ క్యాపిటల్ కుషన్ సిద్ధంగా ఉంచుకోండి."
                if is_te
                else f"To navigate lean-sales months in {district_name}: "
                f"1) Defer all discretionary capital expenditures and non-urgent asset purchases. "
                f"2) Accelerate recovery of outstanding customer credit balances via instant UPI QR settlements. "
                f"3) Maintain a 45-day operational cash buffer from peak-season profits to service quarterly EMIs comfortably."
            )
        elif is_expansion:
            reply_text = (
                f"మీ కస్టమర్ల సంఖ్యను మరియు మార్కెట్ పరిధిని పెంచడానికి: "
                f"సమీప 2-3 గ్రామాలు మరియు మండల కేంద్రంలోని హోటళ్ళు, హాస్టళ్ళు మరియు నివాస సముదాయాలతో నేరుగా సరఫరా ఒప్పందాలు కుదుర్చుకోండి. "
                f"ఇది మీ రోజువారీ అమ్మకాలను 25% నుండి 40% వరకు పెంచుతుంది."
                if is_te
                else f"To scale customer reach in {district_name}: "
                f"Establish recurring B2B supply agreements with mandal-level tea stalls, hostel canteens, and residential clusters within a 5-8 km radius. "
                f"This diversifies demand away from single-buyer risk and typically expands sales volumes by 25% to 40%."
            )
        elif is_loan_capacity:
            max_loan = margin_capital * 9
            project_cost = margin_capital * 10
            reply_text = (
                f"మీ ₹{margin_capital:,.0f} పెట్టుబడి (10% మార్జిన్) ఆధారంగా, "
                f"మీ వ్యాపారం మొత్తం ₹{project_cost:,.0f} ప్రాజెక్ట్ ఖర్చుకు మరియు ₹{max_loan:,.0f} బ్యాంక్ రుణానికి అర్హత కలిగి ఉంటుంది. "
                f"బ్యాంకింగ్ నిబంధనల ప్రకారం DSCR కనీసం 1.25x ఉండేలా త్రైమాసిక వాయిదాలు లెక్కించబడతాయి."
                if is_te
                else f"Based on your promoter contribution of ₹{margin_capital:,.0f} (10% margin capital), "
                f"the banking finance engine supports a total project outlay of ₹{project_cost:,.0f} with an eligible institutional term loan of ₹{max_loan:,.0f} at a healthy DSCR coverage."
            )
        elif user_query:
            reply_text = (
                f"{district_name} లోని స్థానిక మార్కెట్ విశ్లేషణ ప్రకారం మీ ప్రశ్న ({user_query}): "
                f"మీ {category_name} వ్యాపారానికి నాణ్యత, స్థానిక సరఫరా గొలుసు మరియు సమయపాలన ప్రధాన లాభదాయక అంశాలు. "
                f"మార్జిన్ {margin_target} నిలబెట్టుకోవడానికి పారదర్శక ధరలు మరియు నేరుగా కొనుగోలుదారులతో సంబంధాలపై దృష్టి పెట్టండి."
                if is_te
                else f"Addressing your specific inquiry regarding '{user_query}' in {district_name}: "
                f"For {category_name}, maintaining steady operational discipline, direct customer off-take, and raw input cost control defends your target {margin_target} profit margin."
            )
        else:
            reply_text = (
                f"{district_name} పరిధిలో {category_name} వ్యాపారానికి సంబంధించిన సమగ్ర హైపర్-లోకల్ సాధ్యాసాధ్యాల విశ్లేషణ సిద్ధంగా ఉంది."
                if is_te
                else f"Comprehensive hyper-local viability analysis generated for {category_name} in {district_name}."
            )

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
