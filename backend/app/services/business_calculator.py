import re
import math
from typing import Dict, Any, Optional, Tuple, List

def parse_target_amount(text: str) -> Optional[float]:
    """
    Extracts numeric financial targets from natural language queries in English or Telugu.
    Supports formats:
      - ₹5,00,000 / Rs 500000 / 500000 / 5,00,000
      - 5 lakh / 5 lakhs / 5 lac / 5L / 5 లక్షలు / 5 లక్ష
      - 1 crore / 1 cr / 1 కోటి
      - 50k / 50 thousand / 50 వేలు
    """
    if not text:
        return None

    clean = text.lower().replace(",", "").strip()

    # 1. Look for lakh/crore/k suffix patterns
    # e.g. "5 lakh", "5.5 lakhs", "5లక్షలు", "5 లక్షల", "1 crore", "50k", "50 thousand"
    lakh_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|lac|l|లక్షలు|లక్షల|లక్ష)(?:\b|\s|$|[^\w])', clean)
    if lakh_match:
        try:
            return float(lakh_match.group(1)) * 100000.0
        except ValueError:
            pass

    cr_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|crs?|cr|కోట్లు|కోట్ల|కోటి)(?:\b|\s|$|[^\w])', clean)
    if cr_match:
        try:
            return float(cr_match.group(1)) * 10000000.0
        except ValueError:
            pass

    k_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|వేలు|వేల)(?:\b|\s|$|[^\w])', clean)
    if k_match:
        try:
            return float(k_match.group(1)) * 1000.0
        except ValueError:
            pass

    # 2. Look for direct numbers with currency or plain >= 3 digits
    # e.g. "₹500000", "500000", "100000"
    num_match = re.search(r'(?:₹|rs\.?|inr\s*)?\s*(\d{4,9})(?:\.\d+)?', clean)
    if num_match:
        try:
            val = float(num_match.group(1))
            # If value is >= 1000, treat as currency/financial target
            if val >= 1000:
                return val
        except ValueError:
            pass

    return None

def detect_business_domain(
    query: str = "",
    history: Optional[List[Any]] = None,
    fallback_category: str = "Dairy Farming"
) -> str:
    """
    Dynamically extracts the active business domain from the user's current query, recent history, or fallback.
    Returns:
      - "handloom_weaving"
      - "dairy_farming"
      - "retail_shop"
      - "poultry_farming"
      - "tailoring_garments"
      - "agri_processing"
      - "agriculture_crop"
      - "general_enterprise"
    """
    def check_text(text: str) -> Optional[str]:
        if not text:
            return None
        t = text.lower()
        # Handloom / Weaving
        if any(w in t for w in [
            "handloom", "weaving", "powerloom", "loom", "looms", "saree", "sarees", "ikat",
            "pochampally", "yarn", "fabric", "textile", "textiles", "weaver", "weavers",
            "చేనేత", "మగ్గం", "మగ్గాలు", "చీరలు", "నూలు", "వస్త్రాలు", "పవర్లూమ్", "हथकरघा", "बुनकर"
        ]):
            return "handloom_weaving"
        # Dairy Farming
        if any(w in t for w in [
            "dairy", "cow", "cows", "buffalo", "buffaloes", "milch", "milk", "fodder", "cattle",
            "butter", "ghee", "curd", "lactation", "dairy farm", "పాడి", "ఆవు", "ఆవులు", "బర్రె",
            "గేదె", "గేదెలు", "పాలు", "దాణా", "పశువులు", "డెయిరీ", "दुग्ध", "गाय", "भैंस"
        ]):
            return "dairy_farming"
        # Retail / Kirana Shop
        if any(w in t for w in [
            "kirana", "grocery", "provision", "shop", "retail", "store", "supermarket", "general store",
            "fmcg", "కిరాణా", "షాప్", "దుకాణం", "జనరల్ స్టోర్", "స్టోర్", "కిరాణా దుకాణం", "किराना"
        ]):
            return "retail_shop"
        # Poultry Farming
        if any(w in t for w in [
            "poultry", "chicken", "broiler", "layers", "egg", "eggs", "bird", "birds", "natukodi",
            "desi murgi", "hatchery", "కోళ్లు", "పౌల్ట్రీ", "కోడి", "గుడ్లు", "నాటు కోడి", "కుక్కుట"
        ]):
            return "poultry_farming"
        # Tailoring & Boutique
        if any(w in t for w in [
            "tailor", "tailoring", "boutique", "stitching", "garment", "garments", "blouse", "embroidery",
            "maggam work", "sewing", "టైలరింగ్", "కుట్లు", "బోటిక్", "రవికె", "మగ్గం వర్క్", "సంచులు"
        ]):
            return "tailoring_garments"
        # Agri-Processing & Flour/Spice Mill
        if any(w in t for w in [
            "flour mill", "spice mill", "rice mill", "chilli powder", "milling", "processing mill",
            "పిండి మిల్లు", "మిర్చి మిల్లు", "వరి మిల్లు", "మసాలా మిల్లు"
        ]):
            return "agri_processing"
        # Agriculture / Crops
        if any(w in t for w in [
            "crop", "farming", "cotton", "paddy", "chilli", "turmeric", "horticulture", "seeds",
            "fertilizer", "pesticide", "harvest", "వ్యవసాయం", "పంట", "పత్తి", "వరి", "మిర్చి", "పసుపు"
        ]):
            return "agriculture_crop"
        return None

    # Priority 1: Current query
    if query:
        dom = check_text(query)
        if dom:
            return dom

    # Priority 2: Recent history (newest user messages first)
    if history:
        for msg in reversed(history):
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
            role = msg.get("role", "") if isinstance(msg, dict) else getattr(msg, "role", "")
            if role == "user" and content:
                dom = check_text(content)
                if dom:
                    return dom

    # Priority 3: Fallback category from profile
    fb_dom = check_text(fallback_category)
    if fb_dom:
        return fb_dom

    fb_lower = fallback_category.lower()
    if "weave" in fb_lower or "handloom" in fb_lower or "textile" in fb_lower:
        return "handloom_weaving"
    if "dairy" in fb_lower or "milk" in fb_lower or "cow" in fb_lower:
        return "dairy_farming"
    if "kirana" in fb_lower or "grocery" in fb_lower or "retail" in fb_lower or "shop" in fb_lower:
        return "retail_shop"
    if "poultry" in fb_lower or "chicken" in fb_lower or "bird" in fb_lower:
        return "poultry_farming"
    if "tailor" in fb_lower or "garment" in fb_lower:
        return "tailoring_garments"
    if "mill" in fb_lower or "agri" in fb_lower:
        return "agri_processing"

    return "general_enterprise"

class BusinessCalculationEngine:
    """
    Deterministic business calculation and intent classification engine.
    Uses official APMC Mandi, NABARD, and NBCFDC category unit economics.
    """

    @staticmethod
    def classify_intent(
        query: str,
        history: Optional[List[Any]] = None,
        fallback_category: str = "Dairy Farming"
    ) -> Dict[str, Any]:
        """
        Classifies query intent deterministically.
        Returns:
          {
            "intent": str,
            "targetAmount": Optional[float],
            "isNumerical": bool,
            "entity": Optional[str],
            "timeframe": str ("annual" | "monthly" | "daily"),
            "domain": str
          }
        """
        detected_domain = detect_business_domain(
            query=query,
            history=history,
            fallback_category=fallback_category
        )

        if not query:
            return {
                "intent": "general_advisory",
                "targetAmount": None,
                "isNumerical": False,
                "entity": None,
                "timeframe": "annual",
                "domain": detected_domain,
            }

        q = query.lower().strip()
        target_amt = parse_target_amount(q)

        # Detect timeframe
        is_monthly = any(w in q for w in ["month", "monthly", "నెల", "నెలకు", "మాసం", "प्रति माह"])
        is_daily = any(w in q for w in ["day", "daily", "రోజు", "రోజుకు", "రోజూ", "प्रति दिन"])
        timeframe = "daily" if is_daily else ("monthly" if is_monthly else "annual")

        # 1. Location Selection / Business Location Analysis (HIGH PRIORITY)
        # e.g. "Suggest me places where if I establish my handloom shop I can get great profits",
        # "which localities can give me the best profits", "where should I open my shop"
        is_location_selection = any(w in q for w in [
            "where should i establish", "where can i establish", "where should i open", "where can i open",
            "where should i start", "where to establish", "where to open", "where to set up", "where to start",
            "suggest me places", "suggest places", "suggest some places", "which localities", "which locality",
            "which area", "which location", "best locations", "best location", "best localities", "best place",
            "best places", "good location", "good place", "profitable location", "where i can get great profits",
            "where if i establish", "which area is better", "suitable location", "cluster", "location for my",
            "place for my", "where to locate", "area for my", "localities can give", "places where",
            "ఎక్కడ ప్రారంభించాలి", "ఎక్కడ పెట్టాలి", "ఎక్కడ స్థాపించాలి", "ఏ ప్రాంతం", "ఏ ప్రదేశాలు",
            "స్థలాలు", "మంచి ప్రదేశం", "లొకేషన్", "ఏ ఊరు", "ప్రదేశం", "స్థలం ఎంపిక", "ఏ ఏరియా", "ప్రదేశాలు"
        ])

        # 2. Feed / Raw Material / Input Sourcing (Check before generic buy/invest)
        is_feed = any(w in q for w in [
            "feed", "fodder", "raw material", "input cost", "cost of feed", "yarn", "fabric", "daana", "దాణా",
            "పచ్చిగడ్డి", "ముడిసరుకు", "తక్కువ ఖర్చు", "నూలు", "చౌకగా", "buy feed", "cheaper"
        ])

        # 3. Investment Decision / Asset Purchase (e.g. AC, machine, equipment, vehicle)
        is_investment_decision = (not is_feed) and any(w in q for w in [
            "should i buy", "can i buy", "want to buy", "is that a good investment", "good investment",
            "is it safe to buy", "safe for me to buy", "is it safe to invest", "worth buying", "worth investing",
            "air conditioner", "buy an ac", "buy a machine", "buy equipment", "కొనవచ్చా", "మంచి పెట్టుబడేనా"
        ])

        # 4. Capacity / Quantity needed calculation
        is_quantity_calc = any(w in q for w in [
            "how many", "how much animal", "number of", "ఎన్ని ఆవులు", "ఎన్ని బర్రెలు", "ఎన్ని కోళ్లు", "ఎన్ని మగ్గాలు",
            "ఎన్ని", "కౌస్", "ఆవులు కావాలి", "బర్రెలు కావాలి", "how many cows", "how many buffalo", "how many birds",
            "how many looms", "how much capacity", "cows do i need", "buffaloes do i need"
        ])

        # 5. Profitability / Expected profit
        is_profit_inquiry = any(w in q for w in [
            "how much profit", "my profit", "expected profit", "profit margin", "what profit",
            "net profit", "income of", "earning", "earnings", "లాభం ఎంత", "నికర లాభం", "ఎంత లాభం",
            "సంపాదన", "मुनाफा कितना"
        ])

        # 6. Break-even calculation
        is_break_even = any(w in q for w in [
            "break even", "break-even", "breakeven", "నో లాస్ నో ప్రాఫిట్", "బ్రేక్ ఈవెన్", "ఖర్చులు రాబట్టడం", "समविच्छेद"
        ])

        # 7. Revenue / Volume target calculation
        is_volume_target = any(w in q for w in [
            "how much milk", "milk do i need to sell", "how much sales", "volume to sell", "how much turnover",
            "ఎంత పాలు", "ఎన్ని లీటర్లు", "ఎంత అమ్మాలి", "అమ్మకాలు ఎంత చేయాలి"
        ])

        # 8. Capital / Expansion requirements
        is_expansion_calc = any(w in q for w in [
            "expand", "expansion", "expanding", "next village", "scale up", "capital do i need",
            "cost to expand", "investment to expand", "how much capital", "విస్తరణ ఖర్చు",
            "పెట్టుబడి ఎంత కావాలి", "మరో 2 ఆవులు కొనడానికి", "ఎంత పెట్టుబడి", "విస్తరించడానికి", "విస్తరణ"
        ])

        # 9. Pricing guidance
        is_pricing = any(w in q for w in [
            "pricing", "selling price", "rate per", "cost per", "ధర", "ఎంత అమ్మాలి", "ధర నిర్ణయం", "రేటు", "కిలో ధర"
        ])

        # 10. Government schemes
        is_schemes = any(w in q for w in [
            "scheme", "subsidy", "subsidies", "government", "mudra", "pmegp", "nbcfdc", "vishwakarma", "stand-up",
            "సబ్సిడీ", "పథకం", "ప్రభుత్వ పథకాలు", "రాయితీ"
        ])

        # 11. Summer heat / Seasonal operational advice
        is_summer_heat = any(w in q for w in [
            "summer", "heat", "hot", "yield in summer", "temperature", "weather", "lean season", "flush season",
            "ఎండ", "వేసవి", "దిగుబడి", "గ్రామాలలో"
        ])

        # 12. Cash flow / Customer credit management
        is_cash_flow = any(w in q for w in [
            "cash flow", "low sales", "lean month", "off-season", "working capital", "udhaari", "credit", "బాకీలు",
            "నగదు", "తక్కువ అమ్మకాలు", "ఖర్చులు"
        ])

        # Intent resolution priority
        if is_location_selection:
            intent = "location_selection"
            is_num = False
        elif is_investment_decision:
            intent = "investment_decision"
            is_num = False
        elif is_quantity_calc and (target_amt or is_profit_inquiry):
            intent = "capacity_calculation"
            is_num = True
        elif is_volume_target and target_amt:
            intent = "volume_target_calculation"
            is_num = True
        elif is_break_even:
            intent = "break_even_calculation"
            is_num = True
        elif is_expansion_calc:
            intent = "expansion_capital_calculation"
            is_num = True
        elif is_profit_inquiry and target_amt:
            intent = "capacity_calculation"
            is_num = True
        elif is_profit_inquiry:
            intent = "profitability_calculation"
            is_num = True
        elif is_feed:
            intent = "raw_material_optimization"
            is_num = False
        elif is_pricing:
            intent = "pricing_guidance"
            is_num = False
        elif is_schemes:
            intent = "government_schemes"
            is_num = False
        elif is_summer_heat:
            intent = "seasonal_operational_advice"
            is_num = False
        elif is_cash_flow:
            intent = "cash_flow_optimization"
            is_num = False
        elif target_amt:
            intent = "capacity_calculation"
            is_num = True
        else:
            intent = "general_advisory"
            is_num = False

        # Entity identification
        entity = None
        if any(w in q for w in ["cow", "cows", "ఆవు", "ఆవులు"]):
            entity = "cow"
        elif any(w in q for w in ["buffalo", "buffaloes", "బర్రె", "గేదె", "బర్రెలు"]):
            entity = "buffalo"
        elif any(w in q for w in ["bird", "birds", "hen", "hens", "chicken", "కోళ్లు", "కోడి"]):
            entity = "bird"
        elif any(w in q for w in ["loom", "looms", "మగ్గం", "మగ్గాలు"]):
            entity = "loom"
        elif any(w in q for w in ["milk", "litre", "litres", "పాలు", "లీటర్లు"]):
            entity = "milk_litre"

        return {
            "intent": intent,
            "targetAmount": target_amt,
            "isNumerical": is_num,
            "entity": entity,
            "timeframe": timeframe,
            "domain": detected_domain,
        }

    @staticmethod
    def calculate_capacity_for_target_profit(
        category: str,
        target_profit: float,
        location: str = "Telangana",
        promoter_margin_capital: float = 100000.0,
        timeframe: str = "annual",
    ) -> Dict[str, Any]:
        """
        Deterministically calculates the exact capacity (cows, birds, looms, inventory)
        needed to generate the specified net profit target.
        """
        cat_lower = (category or "").lower()
        target = float(target_profit if target_profit and target_profit > 0 else 500000.0)

        # Convert monthly target to annual if specified
        annual_target = target * 12.0 if timeframe == "monthly" else target

        if "dairy" in cat_lower or "పాడి" in cat_lower or "cow" in cat_lower or "milk" in cat_lower:
            # --- DAIRY FARMING BENCHMARK (NABARD / District APMC Standards) ---
            # Crossbred Cow (HF/Jersey Cross):
            # - Average milk yield: 10 Litres / day
            # - Active lactation / milking days per year: 300 days (65 dry days)
            # - Annual milk production per cow: 3,000 Litres / year
            # - Mandi & Local Retail Selling Price: ₹55.00 / Litre (Co-op ₹48/L, Retail/Direct ₹62/L)
            # - Annual Gross Revenue per cow = 3,000 L * ₹55 = ₹1,65,000 / year (₹13,750 / month)
            #
            # Operating Expenses per cow per year:
            # - Cattle Feed (Green/Dry Fodder + Concentrate 55%): ₹41,250 / year (~₹137/day)
            # - Veterinary, AI & Vaccines (10%): ₹7,500 / year
            # - Labour, Maintenance & Shed upkeep (20%): ₹15,000 / year
            # - Electricity, Water & Transport (15%): ₹11,250 / year
            # - Total Operating Cost per cow = ₹75,000 / year (₹6,250 / month)
            #
            # Net Profit per cow per year:
            # - Net Profit per cow = ₹1,65,000 - ₹75,000 = ₹90,000 / year (₹7,500 / month)
            # - Profit Margin: (90,000 / 165,000) = 54.5% on direct sales or ~22-26% fully burdened.
            #
            # Capital Outlay:
            # - Milch cow purchase (crossbred 2nd lactation) + shed share = ₹75,000 per animal

            yield_per_day = 10.0
            milking_days = 300
            annual_litres_per_cow = yield_per_day * milking_days  # 3,000 L
            selling_price_per_l = 55.0
            annual_rev_per_cow = annual_litres_per_cow * selling_price_per_l  # 1,65,000
            annual_opex_per_cow = 75000.0  # 75,000
            net_profit_per_cow_annual = annual_rev_per_cow - annual_opex_per_cow  # 90,000
            net_profit_per_cow_monthly = net_profit_per_cow_annual / 12.0  # 7,500

            exact_units = annual_target / net_profit_per_cow_annual
            recommended_units = max(1, math.ceil(exact_units))
            capex_per_unit = 75000.0
            total_project_outlay = recommended_units * capex_per_unit
            required_margin_10 = total_project_outlay * 0.10
            eligible_loan_90 = total_project_outlay * 0.90

            return {
                "category": "Dairy Farming",
                "unitNameEn": "milch cows",
                "unitNameTe": "పాడి ఆవులు",
                "targetProfit": target,
                "annualTargetProfit": annual_target,
                "exactUnitsNeeded": round(exact_units, 2),
                "recommendedUnits": recommended_units,
                "unitMetrics": {
                    "dailyYieldLitres": yield_per_day,
                    "milkingDaysPerYear": milking_days,
                    "annualProductionLitres": annual_litres_per_cow,
                    "sellingPricePerLitre": selling_price_per_l,
                    "annualRevenuePerUnit": annual_rev_per_cow,
                    "annualOpexPerUnit": annual_opex_per_cow,
                    "netProfitPerUnitAnnual": net_profit_per_cow_annual,
                    "netProfitPerUnitMonthly": net_profit_per_cow_monthly,
                    "capexPerUnit": capex_per_unit,
                },
                "financialOutlay": {
                    "totalProjectCost": total_project_outlay,
                    "promoterMarginRequired": required_margin_10,
                    "bankLoanEligible": eligible_loan_90,
                },
                "assumptions": [
                    "Average milk yield of 10 Litres/day per crossbred cow over a 300-day lactation cycle.",
                    "Blended farm-gate & direct retail milk selling price of ₹55 per Litre.",
                    "Annual operating cost of ~₹75,000 per cow (Feed & Fodder 55%, Vet/AI 10%, Labor 20%, Utilities 15%).",
                    "Net annual profit of approximately ₹90,000 per milch cow (₹7,500/month).",
                ],
                "assumptionsTe": [
                    "ఒక సంకరజాతి పాడి ఆవు 300 రోజుల పాల కాలంలో రోజుకు సగటున 10 లీటర్ల దిగుబడిని ఇస్తుంది.",
                    "స్థానిక మండి మరియు ప్రత్యక్ష రిటైల్ విక్రయాల సగటు ధర లీటరుకు ₹55.",
                    "ఒక ఆవుకు వార్షిక నిర్వహణ ఖర్చు దాదాపు ₹75,000 (దాణా & పచ్చిగడ్డి 55%, పశువైద్యం 10%, శ్రమ 20%, రవాణా/విద్యుత్ 15%).",
                    "ప్రతి పాడి ఆవు నుండి సంవత్సరానికి దాదాపు ₹90,000 (నెలకు ₹7,500) నికర లాభం లభిస్తుంది.",
                ]
            }

        elif "poultry" in cat_lower or "కోడి" in cat_lower or "chicken" in cat_lower:
            # --- POULTRY (Broiler / Country Chicken) ---
            # Batch size model: 6 batches per year
            # Net profit per broiler bird: ~₹30 / bird / batch = ~₹180 / capacity unit / year
            # Country chicken (Natukodi): ~₹100 net profit / bird
            net_profit_per_bird_annual = 180.0
            exact_units = annual_target / net_profit_per_bird_annual
            recommended_units = max(100, math.ceil(exact_units / 50.0) * 50)
            capex_per_bird = 250.0
            total_project_outlay = recommended_units * capex_per_bird

            return {
                "category": "Poultry Farming",
                "unitNameEn": "broiler birds (shed capacity)",
                "unitNameTe": "పౌల్ట్రీ పక్షుల షెడ్ సామర్థ్యం",
                "targetProfit": target,
                "annualTargetProfit": annual_target,
                "exactUnitsNeeded": round(exact_units, 1),
                "recommendedUnits": recommended_units,
                "unitMetrics": {
                    "batchesPerYear": 6,
                    "netProfitPerBirdBatch": 30.0,
                    "netProfitPerUnitAnnual": net_profit_per_bird_annual,
                    "capexPerUnit": capex_per_bird,
                },
                "financialOutlay": {
                    "totalProjectCost": total_project_outlay,
                    "promoterMarginRequired": total_project_outlay * 0.10,
                    "bankLoanEligible": total_project_outlay * 0.90,
                },
                "assumptions": [
                    "6 rearing cycles per year (40-45 day batch cycle).",
                    "Net profit of ₹30 per bird per batch (~₹180 per capacity slot annually).",
                    "Shed infrastructure capex of ₹250 per bird capacity.",
                ],
                "assumptionsTe": [
                    "సంవత్సరానికి 6 బ్యాచ్‌ల పెంపకం చక్రం (40-45 రోజులు).",
                    "ఒక పక్షికి బ్యాచ్‌కు ₹30 నికర లాభం (వార్షికంగా ₹180).",
                    "షెడ్ మౌలిక సదుపాయాల వ్యయం ఒక్కో పక్షికి ₹250.",
                ]
            }

        elif "weaving" in cat_lower or "handloom" in cat_lower or "చేనేత" in cat_lower:
            # --- HANDLOOM / WEAVING ---
            # Pochampally / Silk Handloom:
            # 3 sarees / month per pit loom = 36 sarees / year
            # Net margin per saree: ₹2,500
            # Net profit per loom per year: ₹90,000 / year
            net_profit_per_loom_annual = 90000.0
            exact_units = annual_target / net_profit_per_loom_annual
            recommended_units = max(1, math.ceil(exact_units))
            capex_per_loom = 50000.0
            total_project_outlay = recommended_units * capex_per_loom

            return {
                "category": "Handloom & Weaving",
                "unitNameEn": "traditional handlooms",
                "unitNameTe": "చేనేత మగ్గాలు",
                "targetProfit": target,
                "annualTargetProfit": annual_target,
                "exactUnitsNeeded": round(exact_units, 2),
                "recommendedUnits": recommended_units,
                "unitMetrics": {
                    "sareesPerMonth": 3,
                    "annualSareesPerLoom": 36,
                    "netProfitPerSaree": 2500.0,
                    "netProfitPerUnitAnnual": net_profit_per_loom_annual,
                    "capexPerUnit": capex_per_loom,
                },
                "financialOutlay": {
                    "totalProjectCost": total_project_outlay,
                    "promoterMarginRequired": total_project_outlay * 0.10,
                    "bankLoanEligible": total_project_outlay * 0.90,
                },
                "assumptions": [
                    "Production of 3 traditional sarees per month per active loom (36 sarees/year).",
                    "Net profit margin of ₹2,500 per saree after yarn, dyes, and weaving labor.",
                    "Annual net profit of ~₹90,000 per handloom.",
                ],
                "assumptionsTe": [
                    "ఒక మగ్గంపై నెలకు 3 చేనేత చీరల ఉత్పత్తి (సంవత్సరానికి 36 చీరలు).",
                    "నూలు, రంగులు మరియు శ్రమ ఖర్చులు పోను చీరకు ₹2,500 నికర లాభం.",
                    "ఒక మగ్గం నుండి వార్షిక నికర లాభం సుమారు ₹90,000.",
                ]
            }

        else:
            # --- GENERAL RETAIL / ENTERPRISE (Kirana, Milling, Services) ---
            # Net Profit Margin: 15%
            # Turnover needed = Target / 0.15
            net_margin_pct = 15.0
            annual_turnover_needed = annual_target / (net_margin_pct / 100.0)
            monthly_turnover_needed = annual_turnover_needed / 12.0
            daily_turnover_needed = annual_turnover_needed / 365.0

            return {
                "category": category or "Rural Enterprise",
                "unitNameEn": "gross annual sales turnover",
                "unitNameTe": "వార్షిక స్థూల అమ్మకాల టర్నోవర్",
                "targetProfit": target,
                "annualTargetProfit": annual_target,
                "exactUnitsNeeded": round(annual_turnover_needed),
                "recommendedUnits": round(annual_turnover_needed),
                "unitMetrics": {
                    "netMarginPercentage": net_margin_pct,
                    "annualTurnoverNeeded": annual_turnover_needed,
                    "monthlyTurnoverNeeded": monthly_turnover_needed,
                    "dailyTurnoverNeeded": daily_turnover_needed,
                },
                "financialOutlay": {
                    "totalProjectCost": annual_turnover_needed * 0.25,
                    "promoterMarginRequired": (annual_turnover_needed * 0.25) * 0.10,
                    "bankLoanEligible": (annual_turnover_needed * 0.25) * 0.90,
                },
                "assumptions": [
                    f"Realistic net operating profit margin of {net_margin_pct}% for rural retail/services.",
                    f"Daily gross sales target of ₹{daily_turnover_needed:,.0f} (₹{monthly_turnover_needed:,.0f}/month).",
                ],
                "assumptionsTe": [
                    f"గ్రామీణ వ్యాపారాలకు వాస్తవిక నికర లాభ మార్జిన్ {net_margin_pct}%.",
                    f"రోజువారీ సగటు అమ్మకాల లక్ష్యం ₹{daily_turnover_needed:,.0f} (నెలకు ₹{monthly_turnover_needed:,.0f}).",
                ]
            }

    @staticmethod
    def calculate_volume_for_target_revenue(
        category: str,
        target_amount: float,
        price_per_unit: float = 55.0,
    ) -> Dict[str, Any]:
        """Calculates exact volume needed to achieve a target gross revenue."""
        target = float(target_amount if target_amount and target_amount > 0 else 100000.0)
        units_needed = math.ceil(target / price_per_unit)
        daily_for_month = math.ceil(units_needed / 30.0)

        return {
            "targetAmount": target,
            "pricePerUnit": price_per_unit,
            "totalUnitsNeeded": units_needed,
            "dailyUnitsNeeded": daily_for_month,
        }

    @staticmethod
    def calculate_break_even(
        category: str,
        fixed_monthly_costs: float = 15000.0,
        gross_margin_percent: float = 25.0,
    ) -> Dict[str, Any]:
        """Calculates break-even monthly and daily sales."""
        margin_dec = max(0.05, gross_margin_percent / 100.0)
        monthly_be = fixed_monthly_costs / margin_dec
        daily_be = monthly_be / 30.0

        return {
            "fixedMonthlyCosts": fixed_monthly_costs,
            "grossMarginPercent": gross_margin_percent,
            "monthlyBreakEvenSales": round(monthly_be),
            "dailyBreakEvenSales": round(daily_be),
        }

business_calculator = BusinessCalculationEngine()

# Module-level convenience aliases
classify_intent = BusinessCalculationEngine.classify_intent
calculate_capacity_for_target_profit = BusinessCalculationEngine.calculate_capacity_for_target_profit
calculate_volume_for_target_revenue = BusinessCalculationEngine.calculate_volume_for_target_revenue
calculate_break_even = BusinessCalculationEngine.calculate_break_even


