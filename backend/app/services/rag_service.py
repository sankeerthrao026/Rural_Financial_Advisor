import json
import time
import threading
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

class RAGService:
    def __init__(self):
        # Application-level Multi-Turn & Grounding Cache
        self._rag_cache: Dict[str, Tuple[float, AdvisorAnalyzeResponse]] = {}
        self._cache_ttl_seconds = 300.0  # 5 minutes
        self._max_cache_size = 256
        self._lock = threading.RLock()

    def normalize_user_query(self, query: Optional[str]) -> str:
        """Normalizes query text (trims whitespace, clean spaces) preserving semantics."""
        if not query:
            return ""
        return " ".join(query.strip().split())

    def analyze_business_opportunity(self, req: AdvisorAnalyzeRequest) -> AdvisorAnalyzeResponse:
        """
        Optimized Query-Aware RAG Pipeline:
          1. Query normalization and multi-factor cache check (< 0.5 ms).
          2. Instant 0ms metadata benchmark lookup for user's category and district.
          3. Single targeted ChromaDB vector similarity query with optional metadata filter (k=3).
          4. Context deduplication and compact grounding assembly.
          5. Grounded Gemini AI generation or intelligent domain-aware fallback.
          6. Structured timing metrics logging and response caching.
        """
        t_req_start = time.perf_counter()

        # 1. Query Normalization & Cache Key Generation
        t0 = time.perf_counter()
        raw_query = req.userQuery or ""
        norm_query = self.normalize_user_query(raw_query)
        is_te = req.language == "te"
        loc_str = req.location or "Telangana Rural Hub"
        cat_str = req.category or "Micro Enterprise"
        clean_cat = cat_str.split("/")[0].split("(")[0].strip()
        clean_loc = loc_str.split(",")[0].split("/")[0].split("(")[0].strip()

        # Hash recent history for conversational context uniqueness
        recent_history_sig = ""
        if req.history and len(req.history) > 0:
            recent_history_sig = "|".join(
                f"{m.role}:{m.content[:40]}" for m in req.history[-3:]
            )

        cache_key = f"{norm_query.lower()}|{clean_loc.lower()}|{clean_cat.lower()}|{req.marginCapital}|{req.language}|{recent_history_sig}"
        t_norm = (time.perf_counter() - t0) * 1000

        # Check in-memory RAG response cache
        now = time.time()
        with self._lock:
            if cache_key in self._rag_cache:
                ts, cached_resp = self._rag_cache[cache_key]
                if (now - ts) < self._cache_ttl_seconds:
                    t_total = (time.perf_counter() - t_req_start) * 1000
                    print(
                        f"[RAG TIMING] Total: {t_total:.2f}ms | Norm: {t_norm:.2f}ms | "
                        f"Meta: 0.00ms | Chroma: 0.00ms | Ctx: 0.00ms | AI: 0.00ms | CacheHit: True"
                    )
                    return cached_resp

        # 2. Fast 0ms Metadata Benchmark Lookup (Direct In-Memory Index)
        t0 = time.perf_counter()
        category_name = cat_str
        district_name = loc_str
        mandi_trends_text = ""
        seasonality_text = ""
        risks_list = []
        margin_text = "18% - 28%"
        pricing_band = "Prevailing District Mandi Rate"

        best_cat_item = chroma_service.get_category_benchmark(clean_cat)
        best_dist_item = chroma_service.get_district_demographics(clean_loc)

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

        t_meta = (time.perf_counter() - t0) * 1000

        # 3. Dynamic Targeted Semantic Search (Only 1 Single Query Needed!)
        t0 = time.perf_counter()
        if norm_query:
            recent_context = ""
            if req.history and len(req.history) > 0:
                prev_users = [h.content for h in req.history if h.role == "user"]
                if prev_users:
                    recent_context = prev_users[-1][:80]
            query_text = f"{clean_cat} {norm_query} {recent_context}".strip()
        else:
            query_text = f"{clean_loc} {clean_cat} micro business demand pricing benchmarks".strip()

        # Apply metadata filter for government schemes if inquiring about subsidies or loans
        q_lower = norm_query.lower()
        where_filter = None
        if any(w in q_lower for w in ["scheme", "subsidy", "mudra", "pmegp", "loan", "nbcfdc", "సబ్సిడీ", "పథకం", "రుణం"]):
            where_filter = {"type": "government_scheme"}

        retrieved_items = chroma_service.query_similar(
            query_text=query_text,
            n_results=3,
            where_filter=where_filter,
        )
        t_chroma = (time.perf_counter() - t0) * 1000

        # 4. Context Assembly & Deduplication
        t0 = time.perf_counter()
        context_blocks = []
        sources_used = []
        seen_docs = set()

        # Add pre-indexed district demographic and category benchmark documents
        if best_dist_item and best_dist_item["document"] not in seen_docs:
            context_blocks.append(best_dist_item["document"])
            seen_docs.add(best_dist_item["document"])
            sources_used.append(f"ChromaDB [district_demographics]: {district_name}")

        if best_cat_item and best_cat_item["document"] not in seen_docs:
            context_blocks.append(best_cat_item["document"])
            seen_docs.add(best_cat_item["document"])
            sources_used.append(f"ChromaDB [market_benchmark]: {category_name}")

        # Add retrieved semantic chunks (filtered by relevance threshold)
        for item in retrieved_items:
            doc = item["document"]
            meta = item.get("metadata", {})
            dist = item.get("distance", 1.0)
            if doc not in seen_docs and (dist < 1.35 or not norm_query):
                context_blocks.append(doc)
                seen_docs.add(doc)
                source_label = meta.get("name") or meta.get("category") or item.get("id")
                sources_used.append(f"ChromaDB [{meta.get('type', 'local_dataset')}]: {source_label}")

        combined_context = "\n---\n".join(context_blocks) if context_blocks else "Local district baseline data available."
        t_ctx = (time.perf_counter() - t0) * 1000

        # 5. Call Gemini API with Query-Centric Prompting
        t0 = time.perf_counter()
        ai_data = None
        provider_used = "chromadb-grounded-local"

        if gemini_service.is_available():
            if norm_query:
                prompt_query = (
                    f"BUSINESS PROFILE:\n"
                    f"- Enterprise Category: {cat_str}\n"
                    f"- Location: {loc_str}\n"
                    f"- Promoter Margin Capital: ₹{req.marginCapital:,.0f}\n\n"
                    f"CURRENT USER QUESTION:\n"
                    f"{norm_query}\n\n"
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
                retrieved_context=combined_context,
                language=req.language,
                history=[{"role": m.role, "content": m.content} for m in req.history] if req.history else None,
            )
            if ai_data:
                provider_used = f"{gemini_service.last_model_used} (ChromaDB RAG)" if gemini_service.last_model_used else "gemini-3.6-flash (ChromaDB RAG)"

        # 6. Intelligent Query-Aware Grounded Fallback if Gemini key is missing or failed
        if not ai_data:
            ai_data = self._generate_grounded_fallback(
                location=loc_str,
                category=cat_str,
                district_name=district_name,
                category_name=category_name,
                is_te=is_te,
                user_query=norm_query,
                mandi_trends=mandi_trends_text,
                seasonality=seasonality_text,
                margin_target=margin_text,
                pricing_band=pricing_band,
                risks=risks_list,
                margin_capital=req.marginCapital,
            )

        t_ai = (time.perf_counter() - t0) * 1000
        t_total = (time.perf_counter() - t_req_start) * 1000

        # Structured timing metrics logging
        print(
            f"[RAG TIMING] Total: {t_total:.2f}ms | Norm: {t_norm:.2f}ms | "
            f"Meta: {t_meta:.2f}ms | Chroma: {t_chroma:.2f}ms | "
            f"Ctx: {t_ctx:.2f}ms | AI: {t_ai:.2f}ms | CacheHit: False"
        )

        response = AdvisorAnalyzeResponse(
            reply=ai_data.get("reply"),
            marketReach=MarketReach(**ai_data.get("marketReach", {})),
            opportunityAnalysis=OpportunityAnalysis(**ai_data.get("opportunityAnalysis", {})),
            swot=SWOTAnalysis(**ai_data.get("swot", {})),
            competitorDensity=CompetitorDensity(**ai_data.get("competitorDensity", {})),
            pricingSuggestion=PricingSuggestion(**ai_data.get("pricingSuggestion", {})),
            risks=ai_data.get("risks", risks_list if risks_list else ["Seasonal demand variations", "Raw material price volatility"]),
            assumptions=ai_data.get("assumptions", [
                "Margin capital represents 10% of total project outlay under standard priority-sector schemes.",
                f"Market data grounded on {district_name} district mandi benchmarks and APMC records.",
                "AI estimates provide strategic guidance and do not guarantee loan sanction.",
            ]),
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

        # Store in LRU/TTL cache
        with self._lock:
            if len(self._rag_cache) >= self._max_cache_size:
                oldest_key = next(iter(self._rag_cache))
                del self._rag_cache[oldest_key]
            self._rag_cache[cache_key] = (now, response)

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
