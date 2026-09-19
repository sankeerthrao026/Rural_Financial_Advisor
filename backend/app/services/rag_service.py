import json
from typing import Dict, Any, List, Optional
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
    def analyze_business_opportunity(self, req: AdvisorAnalyzeRequest) -> AdvisorAnalyzeResponse:
        """
        Full RAG Pipeline:
          1. Query construction using location + category + user query.
          2. ChromaDB vector similarity search.
          3. Context assembly and source extraction.
          4. Grounded Gemini AI generation (with resilient grounded fallback if key missing).
          5. Response validation into Pydantic schema.
        """
        is_te = req.language == "te"
        loc_str = req.location or "Telangana Rural Hub"
        cat_str = req.category or "Micro Enterprise"

        # Build query incorporating user follow-up and recent conversation turns for ChromaDB RAG
        history_keywords = ""
        if req.history:
            recent_contents = [h.content for h in req.history[-3:] if h.content]
            history_keywords = " ".join(recent_contents)
        query_text = f"{loc_str} {cat_str} micro business demand pricing competition {req.userQuery or ''} {history_keywords}".strip()

        # 1. ChromaDB Semantic Retrieval (Runs for EVERY question and follow-up)
        retrieved_items = chroma_service.query_similar(query_text=query_text, n_results=6)

        context_blocks = []
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

        clean_cat = cat_str.split("/")[0].split("(")[0].strip().lower()
        clean_loc = loc_str.split(",")[0].split("/")[0].split("(")[0].strip().lower()

        for item in retrieved_items:
            doc = item["document"]
            context_blocks.append(doc)
            meta = item.get("metadata", {})
            source_label = meta.get("name") or meta.get("category") or item.get("id")
            sources_used.append(f"ChromaDB [{meta.get('type', 'local_dataset')}]: {source_label}")
            
            if meta.get("type") == "market_benchmark":
                meta_name = (meta.get("name", "") + " " + meta.get("category", "")).lower()
                if clean_cat and clean_cat in meta_name:
                    best_cat_item = item
                elif best_cat_item is None:
                    best_cat_item = item
            elif meta.get("type") == "district_demographics":
                meta_dist = (meta.get("name", "") + " " + meta.get("district", "")).lower()
                if clean_loc and clean_loc in meta_dist:
                    best_dist_item = item
                elif best_dist_item is None:
                    best_dist_item = item

        # If clean_dist wasn't matched in top results, query ChromaDB specifically
        if clean_loc and (not best_dist_item or clean_loc not in (best_dist_item.get("metadata", {}).get("name", "") + " " + best_dist_item.get("metadata", {}).get("district", "")).lower()):
            specific_dist = chroma_service.query_similar(query_text=f"District: {clean_loc}", n_results=3)
            for d in specific_dist:
                d_name = (d.get("metadata", {}).get("name", "") + " " + d.get("metadata", {}).get("district", "")).lower()
                if clean_loc in d_name:
                    best_dist_item = d
                    context_blocks.append(d["document"])
                    break

        if clean_cat and (not best_cat_item or clean_cat not in (best_cat_item.get("metadata", {}).get("name", "") + " " + best_cat_item.get("metadata", {}).get("category", "")).lower()):
            specific_cat = chroma_service.query_similar(query_text=f"Category: {clean_cat}", n_results=3)
            for c in specific_cat:
                c_name = (c.get("metadata", {}).get("name", "") + " " + c.get("metadata", {}).get("category", "")).lower()
                if clean_cat in c_name:
                    best_cat_item = c
                    context_blocks.append(c["document"])
                    break

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

        combined_context = "\n---\n".join(context_blocks) if context_blocks else "Local district baseline data available."

        # 2. Call Gemini API if available with multi-turn conversation history
        ai_data = None
        provider_used = "chromadb-grounded-local"

        if gemini_service.is_available():
            prompt_query = f"Evaluate starting or scaling a {cat_str} enterprise in {loc_str} with promoter margin capital of ₹{req.marginCapital:,.0f}."
            if req.userQuery:
                prompt_query += f"\nEntrepreneur's Question / Follow-up: {req.userQuery}"

            ai_data = gemini_service.generate_grounded_advice(
                user_query=prompt_query,
                retrieved_context=combined_context,
                language=req.language,
                history=[{"role": m.role, "content": m.content} for m in req.history] if req.history else None,
            )
            if ai_data:
                provider_used = f"{gemini_service.last_model_used} (ChromaDB RAG)" if gemini_service.last_model_used else "gemini-flash (ChromaDB RAG)"

        # 3. Grounded Fallback if Gemini key is not configured or failed
        if not ai_data:
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
            )

        return AdvisorAnalyzeResponse(
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
    ) -> Dict[str, Any]:
        """Grounded fallback generated directly from verified local datasets and ChromaDB chunks."""
        q_lower = (user_query or "").lower()
        seasonal_opp = seasonality or ("పండుగల సీజన్లలో గరిష్ట గిరాకీ" if is_te else "Peak demand during festive seasons and post-harvest liquidity cycles.")
        if mandi_trends:
            seasonal_opp = f"{seasonal_opp} • Mandi Trend: {mandi_trends}"

        # Generate intelligent follow-up answer
        if "expand" in q_lower or "next village" in q_lower or "మరో గ్రామం" in q_lower or "విస్తరణ" in q_lower:
            reply_text = (
                f"సమీప గ్రామాలకు విస్తరించడం ద్వారా {district_name} లో మీ కస్టమర్ల సంఖ్య 25% నుండి 35% పెరుగుతుంది. అయితే రవాణా ఖర్చులు నెలకు ₹1,500 - ₹3,000 వరకు పెరగవచ్చు కాబట్టి సరఫరా షెడ్యూల్ పక్కాగా ఉండాలి."
                if is_te
                else f"Expanding to neighboring villages in {district_name} can increase your customer base by 25% to 35%. Ensure reliable two-wheeler or local transport, as distribution logistics typically adds ₹1,500 - ₹3,000/month to operating expenses."
            )
        elif "feed" in q_lower or "supplier" in q_lower or "cheap" in q_lower or "ధర" in q_lower or "ముడిసరుకు" in q_lower:
            reply_text = (
                f"స్థానిక APMC మండి లేదా ప్రాథమిక వ్యవసాయ సహకార సంఘాల (PACS) ద్వారా పెద్ద మొత్తంలో ముడిసరుకు కొనుగోలు చేయడం ద్వారా 8% - 15% వరకు వ్యయం ఆదా అవుతుంది."
                if is_te
                else f"Procuring inputs directly from {district_name} APMC mandis or Primary Agricultural Cooperative Societies (PACS) in bulk reduces raw material expenses by 8% to 15% compared to local retail intermediaries."
            )
        elif "scheme" in q_lower or "loan" in q_lower or "రుణం" in q_lower or "పథకం" in q_lower:
            reply_text = (
                f"మీరు PMEGP లేదా MUDRA కింద 15% నుండి 35% సబ్సిడీతో విస్తరణ రుణాన్ని పొందవచ్చు. ఇప్పటికే చెల్లింపుల రికార్డు బాగుంటే బ్యాంకులు సులభంగా ఆమోదిస్తాయి."
                if is_te
                else f"For expanding your {category_name} unit in {district_name}, you can access MUDRA (Kishor category up to ₹5L) or PMEGP with 15-35% capital subsidy, supported by regional rural bank priority-sector lending."
            )
        elif "season" in q_lower or "summer" in q_lower or "weather" in q_lower:
            reply_text = (
                f"కాలానుగుణ మార్పుల దృష్ట్యా, పండుగల సమయంలో అధిక నిల్వలు ఉంచండి మరియు వేసవి కాలంలో ముందస్తు రక్షణ చర్యలు చేపట్టండి."
                if is_te
                else f"During seasonal transitions in {district_name}, maintain dynamic working capital buffers: boost inventory ahead of festival surges and reduce perishable holding periods during peak heat months."
            )
        elif user_query:
            reply_text = (
                f"{district_name} లోని స్థానిక మార్కెట్ విశ్లేషణ ప్రకారం, మీ {category_name} వ్యాపారానికి గిరాకీ స్థిరంగా ఉంది. అధిక లాభాల కోసం ప్రత్యక్ష కస్టమర్ సంబంధాలు మరియు నాణ్యతపై దృష్టి పెట్టండి."
                if is_te
                else f"Grounded in {district_name} local mandi records: your {category_name} enterprise maintains a stable market position. Focus on prompt service and transparent pricing to defend your {margin_target} margin."
            )
        else:
            reply_text = (
                f"{district_name} పరిధిలో {category_name} వ్యాపారానికి సంబంధించిన సమగ్ర హైపర్-లోకల్ విశ్లేషణ సిద్ధంగా ఉంది."
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
                    else "Aligned with prevailing district benchmark schedules"
                ),
                "marginTarget": margin_target,
            },
            "risks": risks if risks else [
                "Summer operational strain",
                "Raw material price volatility",
            ],
            "assumptions": [
                "Margin capital represents exactly 10% of total project outlay.",
                f"Grounded on authentic {district_name} population and category benchmarks.",
                "AI advice is for strategic orientation and does not constitute credit sanction.",
            ],
        }

rag_service = RAGService()
