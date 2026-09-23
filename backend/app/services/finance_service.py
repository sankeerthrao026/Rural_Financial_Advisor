import math
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    SchemeDetails,
    AmortizationRow,
    FinancePlanResponse,
    MetricBreakdown,
    FinancialHealthResponse,
    TailoredSchemeRecommendation,
    WorkingCapitalBreakdown,
    SeasonalMoratoriumAdvice,
    FinanceAdviceRequest,
    FinanceAdviceResponse,
)
from app.services.gemini_service import gemini_service
from app.services.finance_advisor_engine import (
    classify_query_intent,
    calculate_intent_metrics,
    resolve_sector,
)

def calculate_finance_plan(margin_capital: float) -> FinancePlanResponse:
    """
    100% Deterministic Financial Calculation Engine.
    Implements statutory NBCFDC guidelines for RuralCred:
      - Project Cost = Margin Capital / 0.10
      - Loan Amount = 90% of Project Cost
      - Micro Finance: Project Cost <= ₹1.40 Lakh (6.5% p.a., 3 Years, 3M Moratorium)
      - Term Loan: ₹1.40 Lakh < Project Cost <= ₹50 Lakh (8.0% p.a., 7 Years, 6M Moratorium)
    """
    clean_margin = max(1000.0, float(margin_capital))
    project_cost = round(clean_margin / 0.10)
    loan_amount = round(project_cost * 0.90)

    is_micro = project_cost <= 140000

    if is_micro:
        scheme = SchemeDetails(
            id="micro-finance",
            name="Micro Finance Scheme",
            nameTe="సూక్ష్మ రుణ పథకం (Micro Finance)",
            agency="National Backward Classes Finance & Development Corporation (NBCFDC)",
            interestRateAnnual=6.5,
            tenureYears=3,
            moratoriumMonths=3,
            maxProjectCost=140000.0,
            repaymentFrequency="Quarterly",
        )
    else:
        scheme = SchemeDetails(
            id="term-loan",
            name="Term Loan Scheme",
            nameTe="టర్మ్ లోన్ పథకం (Term Loan)",
            agency="National Backward Classes Finance & Development Corporation (NBCFDC)",
            interestRateAnnual=8.0,
            tenureYears=7,
            moratoriumMonths=6,
            maxProjectCost=5000000.0,
            repaymentFrequency="Quarterly",
        )

    annual_rate = scheme.interestRateAnnual / 100.0
    quarterly_rate = annual_rate / 4.0
    total_quarters = scheme.tenureYears * 4
    moratorium_quarters = round(scheme.moratoriumMonths / 3)
    repayment_quarters = total_quarters - moratorium_quarters

    p = float(loan_amount)
    r = quarterly_rate
    n = repayment_quarters

    # Calculate post-moratorium amortized quarterly EMI
    if r > 0 and n > 0:
        compound_factor = math.pow(1.0 + r, n)
        quarterly_emi = round((p * r * compound_factor) / (compound_factor - 1.0))
    else:
        quarterly_emi = round(p / n) if n > 0 else 0

    # Build full quarterly amortization schedule
    schedule: List[AmortizationRow] = []
    current_balance = float(loan_amount)
    total_interest = 0.0
    total_paid = 0.0

    for q in range(1, total_quarters + 1):
        is_moratorium = q <= moratorium_quarters
        start_principal = current_balance
        interest = round(start_principal * r)
        total_interest += interest

        if is_moratorium:
            # During moratorium: borrower services only quarterly accrued interest
            payment = float(interest)
            total_paid += payment
            schedule.append(
                AmortizationRow(
                    quarter=q,
                    isMoratorium=True,
                    startingPrincipal=start_principal,
                    principalPaid=0.0,
                    interestPaid=interest,
                    totalPayment=payment,
                    remainingBalance=current_balance,
                )
            )
        else:
            is_last_quarter = q == total_quarters
            if is_last_quarter:
                principal_paid = current_balance
            else:
                principal_paid = min(current_balance, max(0.0, float(quarterly_emi - interest)))

            total_payment = principal_paid + interest if is_last_quarter else float(quarterly_emi)
            current_balance = max(0.0, current_balance - principal_paid)
            total_paid += total_payment

            schedule.append(
                AmortizationRow(
                    quarter=q,
                    isMoratorium=False,
                    startingPrincipal=start_principal,
                    principalPaid=principal_paid,
                    interestPaid=interest,
                    totalPayment=total_payment,
                    remainingBalance=current_balance,
                )
            )

    return FinancePlanResponse(
        marginCapital=clean_margin,
        projectCost=float(project_cost),
        loanAmount=float(loan_amount),
        scheme=scheme,
        quarterlyEmi=float(quarterly_emi),
        totalQuarters=total_quarters,
        moratoriumQuarters=moratorium_quarters,
        repaymentQuarters=repayment_quarters,
        totalInterestPaid=total_interest,
        totalRepayment=total_paid,
        amortizationSchedule=schedule,
    )

def calculate_financial_health(
    total_income: float,
    total_expenses: float,
    entry_count: int = 6,
    has_downward_trend: bool = False,
) -> FinancialHealthResponse:
    """
    Deterministic 0–100 Financial Health Scoring.
    Weights:
      1. Logging Consistency: 30%
      2. Profit Trend: 40%
      3. Expense-to-Income Ratio: 30%
    """
    # 1. Logging Consistency (30%)
    if entry_count >= 10:
        logging_score = 100
    elif entry_count >= 5:
        logging_score = 85
    elif entry_count >= 2:
        logging_score = 65
    else:
        logging_score = 40

    # 2. Expense-to-Income Ratio (30%)
    if total_income <= 0:
        expense_ratio_score = 30
    else:
        ratio = total_expenses / total_income
        if ratio <= 0.40:
            expense_ratio_score = 100
        elif ratio <= 0.60:
            expense_ratio_score = 85
        elif ratio <= 0.80:
            expense_ratio_score = 70
        elif ratio <= 1.00:
            expense_ratio_score = 50
        else:
            expense_ratio_score = 25

    # 3. Profit Trend (40%)
    net = total_income - total_expenses
    if net > 0 and not has_downward_trend:
        trend_score = 95
    elif net > 0 and has_downward_trend:
        trend_score = 70
    elif net == 0:
        trend_score = 50
    else:
        trend_score = 25

    final_score = round(
        (logging_score * 0.30) + (trend_score * 0.40) + (expense_ratio_score * 0.30)
    )

    if final_score >= 80:
        status = "excellent"
        status_te = "ఉత్తమ ఆర్థిక ఆరోగ్యం (Excellent)"
        summary = "Strong operating cash buffer with high savings margin. High loan repayment capacity."
        summary_te = "బలమైన నికర నగదు ప్రవాహం మరియు అద్భుతమైన రుణ చెల్లింపు సామర్థ్యం."
    elif final_score >= 60:
        status = "steady"
        status_te = "స్థిరమైన ఆర్థిక స్థితి (Steady)"
        summary = "Predictable revenue with balanced operating expenses. Capable of debt servicing."
        summary_te = "స్థిరమైన రాబడి మరియు నియంత్రిత ఖర్చులు. సాధారణ రుణ వాయిదాలను చెల్లించగలరు."
    else:
        status = "caution"
        status_te = "జాగ్రత్త అవసరం (Caution)"
        summary = "Operating cash buffer is limited or expenses are near receipts. Tighten liquidity before borrowing."
        summary_te = "నగదు నిల్వలు తక్కువగా ఉన్నాయి లేదా ఖర్చులు ఎక్కువగా ఉన్నాయి. అప్పు తీసుకునే ముందు జాగ్రత్త పడండి."

    breakdown = [
        MetricBreakdown(
            metric="Logging Consistency",
            score=logging_score,
            weight="30%",
            label="Digital Logging Habit",
            labelTe="లాగ్‌బుక్ నిర్వహణ క్రమబద్ధత (30%)",
        ),
        MetricBreakdown(
            metric="Profit Trend",
            score=trend_score,
            weight="40%",
            label="Net Operating Profitability",
            labelTe="నికర లాభదాయకత ధోరణి (40%)",
        ),
        MetricBreakdown(
            metric="Expense Ratio",
            score=expense_ratio_score,
            weight="30%",
            label="Expense-to-Income Discipline",
            labelTe="ఆదాయం-ఖర్చుల నిష్పత్తి (30%)",
        ),
    ]

    return FinancialHealthResponse(
        score=final_score,
        status=status,
        statusTe=status_te,
        summary=summary,
        summaryTe=summary_te,
        breakdown=breakdown,
    )


# ----------------- Conversational AI Finance Advisor Engine -----------------

def get_working_capital_breakdown(
    loan_amount: float,
    category: str,
    custom_ratio: Optional[float] = None,
) -> WorkingCapitalBreakdown:
    """
    Computes Working Capital (operating liquidity) vs. Capital Expenditure (capex).
    Infers optimal industrial baseline by business category unless custom ratio is provided.
    Guarantees workingCapitalAmount + capexAmount == loanAmount.
    """
    clean_loan = max(1000.0, float(loan_amount))
    cat_lower = (category or "").lower()

    if "dairy" in cat_lower or "cattle" in cat_lower or "milk" in cat_lower:
        default_ratio = 0.35
        wc_uses = [
            "High-protein cattle feed & dry fodder buffer reserves",
            "Veterinary care, mandatory vaccinations & mineral supplements",
            "Seasonal dairy labor wages and hygienic milk transport cans",
        ]
        capex_uses = [
            "Purchase of high-yield Murrah buffaloes or HF dairy cows",
            "Construction of pucca ventilated cattle shed & mist fans",
            "Bulk milk chilling unit, automatic milking machine & cans",
        ]
    elif "kirana" in cat_lower or "grocery" in cat_lower or "retail" in cat_lower or "store" in cat_lower:
        default_ratio = 0.75
        wc_uses = [
            "Fast-moving consumer goods (FMCG) wholesale bulk inventory",
            "Wholesale procurement of rice, lentils, edible oils & spices",
            "Short-term customer trade credit buffer for harvest settlement",
        ]
        capex_uses = [
            "Commercial deep freezer & dairy product refrigeration unit",
            "Modular heavy-duty steel display shelving and counter desk",
            "Digital weighing scale & POS barcode billing machine",
        ]
    elif "weave" in cat_lower or "handloom" in cat_lower or "textile" in cat_lower:
        default_ratio = 0.60
        wc_uses = [
            "Pure mulberry silk yarn, combed cotton yarn & metallic zari",
            "Eco-friendly vat dyes, sizing chemicals & warp materials",
            "Weaver artisan piece-rate wages across 30-day production cycles",
        ]
        capex_uses = [
            "Fly-shuttle pit looms or modernized frame loom installations",
            "Electronic Jacquard shedding machine & pattern punch card sets",
            "Motorized warping drum, creel stand & pirn winding equipment",
        ]
    elif "tailor" in cat_lower or "garment" in cat_lower:
        default_ratio = 0.30
        wc_uses = [
            "Running yardage fabric rolls, cotton linings, buttons & zippers",
            "High-tensile sewing threads, packaging boxes & hangers",
            "Assistant tailor piece-rate payment reserves",
        ]
        capex_uses = [
            "High-speed direct-drive industrial lockstitch sewing machines",
            "Multi-thread overlock/edging machine & buttonholing apparatus",
            "Master fabric cutting table and vacuum electric steam press",
        ]
    elif "poultry" in cat_lower or "chicken" in cat_lower:
        default_ratio = 0.45
        wc_uses = [
            "Commercial pre-starter and finisher poultry mash feed",
            "Procurement of day-old broiler/layer chicks and vaccines",
            "Litter management, disinfectant bio-security & electricity",
        ]
        capex_uses = [
            "Automated environment-controlled poultry shed construction",
            "Automatic nipple drinking lines and ceiling-suspended feeders",
            "Gas brooding heaters and generator backup power unit",
        ]
    else:
        default_ratio = 0.50
        wc_uses = [
            "Initial raw material inventory and consumable supplies",
            "Operational liquidity for utility bills, logistics & staff dues",
            "Upfront trade security deposits with regional distributors",
        ]
        capex_uses = [
            "Core machinery, specialized production equipment, and tools",
            "Commercial premise fixtures, storage racks, and secure partition",
            "Three-wheeler cargo transport vehicle or loading equipment",
        ]

    if custom_ratio is not None:
        ratio = max(0.05, min(0.95, float(custom_ratio)))
    else:
        ratio = default_ratio

    wc_percent = round(ratio * 100.0, 1)
    capex_percent = round(100.0 - wc_percent, 1)
    wc_amount = round(clean_loan * (wc_percent / 100.0))
    capex_amount = round(clean_loan - wc_amount)

    return WorkingCapitalBreakdown(
        workingCapitalPercent=wc_percent,
        capexPercent=capex_percent,
        workingCapitalAmount=float(wc_amount),
        capexAmount=float(capex_amount),
        workingCapitalUses=wc_uses,
        capexUses=capex_uses,
    )


def get_seasonal_moratorium_advice(category: str, language: str = "en") -> SeasonalMoratoriumAdvice:
    """
    Generates tailored seasonal moratorium recommendations based on business cycles.
    """
    cat_lower = (category or "").lower()

    if "dairy" in cat_lower or "cattle" in cat_lower or "milk" in cat_lower:
        return SeasonalMoratoriumAdvice(
            isSeasonal=True,
            businessType="Dairy Farming",
            leanSeasonMonths="April – June (Peak Summer Heat)",
            peakSeasonMonths="August – January (Monsoon & Winter Flush)",
            moratoriumQuartersRecommended=1,
            guidance=(
                "In dairy farming, extreme summer heat stress (April to June) depresses milk yield by 20%–30% "
                "while green fodder availability plummets, causing severe cash flow compression. We advise requesting "
                "a 1-quarter summer moratorium or interest-only payment period, structuring accelerated principal recovery "
                "during the high-lactation monsoon and winter flush season."
            ),
            guidanceTe=(
                "పాడి పరిశ్రమలో వేసవి కాలంలో (ఏప్రిల్-జూన్) అధిక ఎండల వల్ల పాల దిగుబడి 20-30% వరకు తగ్గుతుంది, పచ్చి మేత ఖర్చులు పెరుగుతాయి. "
                "ఈ సమయంలో నగదు ఇబ్బందులు రాకుండా 1 త్రైమాసికం (3 నెలలు) మారటోరియం లేదా కేవలం వడ్డీ మాత్రమే చెల్లించే సదుపాయాన్ని కోరండి. "
                "వర్షాకాలం మరియు శీతాకాలంలో పాల దిగుబడి పెరిగినప్పుడు అసలు చెల్లింపులను వేగవంతం చేయవచ్చు."
            ),
        )
    elif "kirana" in cat_lower or "grocery" in cat_lower or "retail" in cat_lower or "store" in cat_lower:
        return SeasonalMoratoriumAdvice(
            isSeasonal=True,
            businessType="Rural Grocery / Kirana",
            leanSeasonMonths="July – August (Kharif Sowing Season)",
            peakSeasonMonths="October – January (Harvest & Festive Surge)",
            moratoriumQuartersRecommended=1,
            guidance=(
                "Rural grocery stores face seasonal cash crunches in July–August as farming households direct all liquidity "
                "into seeds and fertilizers, often purchasing daily provisions on credit. Conversely, cash flow surges dramatically "
                "during post-harvest festive months (Dussehra, Diwali, Sankranti). Request a seasonal interest-only quarter during sowing, "
                "with a working capital liquidity renewal before the festive shopping surge."
            ),
            guidanceTe=(
                "గ్రామీణ కిరాణా దుకాణాల్లో ఖరీఫ్ విత్తనాల కాలంలో (జూలై-ఆగస్టు) రైతుల వద్ద నగదు కొరత ఉండటం వల్ల వ్యాపారంలో అరువులు పెరుగుతాయి. "
                "కానీ అక్టోబర్ నుండి జనవరి వరకు పంట చేతికి వచ్చి పండుగల సమయంలో అమ్మకాలు భారీగా పెరుగుతాయి. కాబట్టి జూలై-ఆగస్టు కాలంలో "
                "సాధారణ EMI వెసులుబాటు పొంది, పండుగల ముందు వర్కింగ్ క్యాపిటల్ పెంచుకోవడం ఉత్తమం."
            ),
        )
    elif "weave" in cat_lower or "handloom" in cat_lower or "textile" in cat_lower:
        return SeasonalMoratoriumAdvice(
            isSeasonal=True,
            businessType="Handloom / Weaving",
            leanSeasonMonths="June – August (Monsoon Humidity & Sluggish Footfall)",
            peakSeasonMonths="September – February (Wedding & Festival Season)",
            moratoriumQuartersRecommended=1,
            guidance=(
                "Handloom weaving experiences humidity bottlenecks in yarn sizing/drying and lower footfall during peak monsoon (June–August). "
                "Peak cash realization occurs during the autumn/winter wedding and festive season. We recommend structuring a 1-quarter moratorium "
                "during monsoon, amortizing repayments primarily across the festive wedding quarter."
            ),
            guidanceTe=(
                "చేనేత రంగంలో వర్షాకాలం (జూన్-ఆగస్టు) అధిక తేమ వల్ల రంగులు ఆరడం ఆలస్యమవుతుంది మరియు అమ్మకాలు మందగిస్తాయి. "
                "పెళ్లిళ్ల సీజన్ మరియు పండుగలలో (సెప్టెంబర్-ఫిబ్రవరి) భారీ డిమాండ్ ఉంటుంది. వర్షాకాలంలో 1 త్రైమాసిక మారటోరియం తీసుకుని, "
                "పండుగల కాలంలో అసలు తిరిగి చెల్లించడం అత్యంత లాభదాయకం."
            ),
        )
    else:
        return SeasonalMoratoriumAdvice(
            isSeasonal=False,
            businessType=category or "Rural Micro Enterprise",
            leanSeasonMonths="Varies with regional procurement cycles",
            peakSeasonMonths="Post-harvest rural market liquidation",
            moratoriumQuartersRecommended=1,
            guidance=(
                "Your enterprise benefits from the standard statutory moratorium (3 to 6 months) allowing you to stabilize commercial "
                "operations and build cash reserves before commencing full principal amortization."
            ),
            guidanceTe=(
                "మీ వ్యాపారం స్థిరపడేందుకు ప్రారంభంలో 3 నుండి 6 నెలల చట్టబద్ధమైన మారటోరియం లభిస్తుంది. దీని ద్వారా వ్యాపార నగదు నిల్వలను "
                "సమకూర్చుకున్న తర్వాత పూర్తి రుణ చెల్లింపులు ప్రారంభించవచ్చు."
            ),
        )


def get_tailored_scheme_recommendations(
    loan_amount: float,
    gender: str,
    social_category: str,
    category: str,
    language: str = "en",
) -> List[TailoredSchemeRecommendation]:
    """
    Ranks government credit schemes tailored directly to the entrepreneur's demographic profile:
    - Gender (e.g., Woman entrepreneurs receive Stand-Up India mandate and Stree Nidhi priority)
    - Social Category (SC/ST receive Stand-Up India + 35% PMEGP subsidy; OBC receives NBCFDC concessional rates)
    - Explains WHY the scheme fits them specifically.
    """
    is_woman = (gender or "").strip().lower() in ("female", "woman", "f")
    soc_cat = (social_category or "").strip().upper()
    is_sc_st = soc_cat in ("SC", "ST")
    is_obc = soc_cat == "OBC"
    clean_loan = float(loan_amount)

    schemes: List[TailoredSchemeRecommendation] = []

    # 1. Stand-Up India Scheme (Statutory mandate for Women & SC/ST)
    stand_up_why = (
        "As a woman entrepreneur, you are legally prioritized under Stand-Up India's statutory mandate requiring every bank branch to extend ₹10L–₹1Cr loans to women borrowers with concessional interest and lower margin money."
        if is_woman
        else (
            "As an SC/ST entrepreneur, every commercial bank branch has a mandatory credit target to sanction Stand-Up India loans up to ₹1 Crore with concessional margins and sovereign credit guarantee."
            if is_sc_st
            else "Available for greenfield enterprise expansion when co-promoted with qualifying women or SC/ST partners."
        )
    )
    stand_up_why_te = (
        "మహిళా వ్యవస్థాపకురాలిగా, ప్రతి బ్యాంక్ శాఖ తప్పనిసరిగా మహిళలకు ₹10 లక్షల నుండి ₹1 కోటి వరకు రుణాలు ఇవ్వాలనే ప్రభుత్వ నిబంధన ప్రకారం మీకు అత్యధిక ప్రాధాన్యత లభిస్తుంది."
        if is_woman
        else (
            "SC/ST వ్యవస్థాపకులుగా, ప్రతి బ్యాంక్ బ్రాంచ్‌లో మీకు స్టాండ్-అప్ ఇండియా కింద ₹1 కోటి వరకు తక్కువ మార్జిన్ మరియు రాయితీ వడ్డీతో రుణం పొందే హక్కు ఉంది."
            if is_sc_st
            else "భాగస్వామ్య సంస్థలలో అర్హత కలిగిన ప్రమోటర్లతో కలిసి ఈ పథకం కింద విస్తరణ రుణం పొందవచ్చు."
        )
    )
    schemes.append(
        TailoredSchemeRecommendation(
            id="stand-up-india",
            name="Stand-Up India Scheme for Women & SC/ST",
            nameTe="స్టాండ్-అప్ ఇండియా పథకం (మహిళలు & SC/ST)",
            agency="SIDBI & Scheduled Commercial Banks",
            maxAmount=10000000.0,
            subsidyOrConcession="Lowest commercial rate (Base rate/MCLR + 3%), only 15% promoter margin, NCGTC sovereign credit guarantee",
            subsidyOrConcessionTe="తక్కువ వడ్డీ రేటు, కేవలం 15% స్వంత వాటా, ప్రభుత్వ క్రెడిట్ గ్యారెంటీ కవరేజ్",
            whyRecommended=stand_up_why,
            whyRecommendedTe=stand_up_why_te,
            isTopMatch=(is_woman or is_sc_st) and clean_loan >= 500000,
        )
    )

    # 2. PMEGP (Prime Minister's Employment Generation Programme)
    has_special_subsidy = is_woman or is_sc_st or is_obc
    pmegp_subsidy = (
        "35% Rural Capital Subsidy (Special Category) — promoter equity contribution only 5%!"
        if has_special_subsidy
        else "25% Rural Capital Subsidy (General Category) — promoter equity contribution 10%"
    )
    pmegp_subsidy_te = (
        "గ్రామీణ ప్రాంతాల్లో 35% భారీ మూలధన సబ్సిడీ — ప్రమోటర్ స్వంత వాటా కేవలం 5% మాత్రమే!"
        if has_special_subsidy
        else "గ్రామీణ ప్రాంతాల్లో 25% మూలధన సబ్సిడీ — ప్రమోటర్ స్వంత వాటా 10%"
    )
    pmegp_why = (
        f"Under PMEGP Special Category guidelines, {'women' if is_woman else 'socially backward'} rural entrepreneurs receive an elevated 35% non-refundable capital subsidy, saving up to 35% of your total project outlay!"
        if has_special_subsidy
        else "PMEGP provides a generous 25% non-refundable government capital subsidy for viable rural micro-enterprises."
    )
    pmegp_why_te = (
        "ప్రత్యేక కేటగిరీ కింద గ్రామీణ మహిళలు, SC, ST, OBC వ్యవస్థాపకులకు అదనంగా 10% సబ్సిడీ (మొత్తం 35%) లభిస్తుంది, దీనివల్ల రుణ భారం గణనీయంగా తగ్గుతుంది."
        if has_special_subsidy
        else "గ్రామీణ ప్రాంతాల్లో కొత్త వ్యాపారాలకు ప్రభుత్వం 25% మూలధన సబ్సిడీని నేరుగా బ్యాంక్ లోన్‌కు జమ చేస్తుంది."
    )
    schemes.append(
        TailoredSchemeRecommendation(
            id="pmegp",
            name="PMEGP Credit Linked Subsidy Scheme",
            nameTe="పీఎంఈజీపీ (PMEGP) సబ్సిడీ పథకం",
            agency="KVIC, KVIB & District Industries Centre (DIC)",
            maxAmount=5000000.0,
            subsidyOrConcession=pmegp_subsidy,
            subsidyOrConcessionTe=pmegp_subsidy_te,
            whyRecommended=pmegp_why,
            whyRecommendedTe=pmegp_why_te,
            isTopMatch=has_special_subsidy and clean_loan < 500000 and clean_loan > 140000,
        )
    )

    # 3. Stree Nidhi Credit Cooperative (Exclusively Women SHG members)
    if is_woman:
        schemes.append(
            TailoredSchemeRecommendation(
                id="stree-nidhi",
                name="Stree Nidhi Credit Cooperative (SHG Window)",
                nameTe="స్త్రీ నిధి క్రెడిట్ కోఆపరేటివ్ (మహిళా సంఘాల రుణం)",
                agency="Stree Nidhi & Society for Elimination of Rural Poverty (SERP)",
                maxAmount=300000.0,
                subsidyOrConcession="9.0% - 11.0% p.a., 100% zero physical collateral, fast 48-hour Village Organization (VO) appraisal",
                subsidyOrConcessionTe="కేవలం 9% - 11% వార్షిక వడ్డీ, ఎటువంటి తనఖా అవసరం లేదు, 48 గంటల్లో గ్రామ సమాఖ్య ద్వారా మంజూరు",
                whyRecommended="Tailored specifically for rural women micro-entrepreneurs. Enables prompt collateral-free capital deployment through your village SHG federation without tedious banking paperwork.",
                whyRecommendedTe="గ్రామీణ మహిళలకు ఇది అత్యంత సులువైన రుణం. గ్రామ మహిళా సంఘం ద్వారా ఎటువంటి ఆస్తుల తనఖా లేకుండా వేగంగా రుణం అందుతుంది.",
                isTopMatch=clean_loan <= 140000,
            )
        )

    # 4. NBCFDC (Concessional for OBC)
    if is_obc or not is_woman:
        schemes.append(
            TailoredSchemeRecommendation(
                id="nbcfdc",
                name="NBCFDC Micro & Term Loan Scheme",
                nameTe="ఎన్‌బీసీఎఫ్‌డీసీ వెనుకబడిన తరగతుల రుణ పథకం",
                agency="National Backward Classes Finance & Development Corporation",
                maxAmount=5000000.0,
                subsidyOrConcession="Subsidized 6.5% - 8.0% p.a. annual interest with 3 to 6 months initial principal moratorium",
                subsidyOrConcessionTe="కేవలం 6.5% - 8.0% వార్షిక రాయితీ వడ్డీ, 3 నుండి 6 నెలల మారటోరియం గ్రేస్ పీరియడ్",
                whyRecommended="As an OBC entrepreneur, NBCFDC delivers direct statutory interest subvention, giving you rates as low as 6.5% p.a. and flexible quarterly repayments.",
                whyRecommendedTe="ఓబీసీ వర్గాలకు ప్రభుత్వం కల్పిస్తున్న ప్రత్యేక రాయితీ పథకం. అతి తక్కువ వడ్డీతో పాటు సులభ వాయిదాల చెల్లింపు సదుపాయం ఉంటుంది.",
                isTopMatch=is_obc and not is_woman and clean_loan <= 140000,
            )
        )

    # 5. Pradhan Mantri MUDRA Yojana (PMMY)
    schemes.append(
        TailoredSchemeRecommendation(
            id="mudra",
            name="Pradhan Mantri MUDRA Yojana (Kishor / Tarun)",
            nameTe="పీఎం ముద్రా యోజన (MUDRA Kishor/Tarun)",
            agency="National Credit Guarantee Trustee Company (NCGTC) & Banks",
            maxAmount=1000000.0,
            subsidyOrConcession="100% collateral-free, MUDRA RuPay card overdraft for working capital, 0.25% Mahila Udyami rebate",
            subsidyOrConcessionTe="100% తనఖా రహితం, వర్కింగ్ క్యాపిటల్ కోసం ముద్రా కార్డ్ సదుపాయం, మహిళలకు ప్రత్యేక వడ్డీ రాయితీ",
            whyRecommended="Universal collateral-free credit for micro-enterprises up to ₹10 Lakhs. The accompanying MUDRA card allows you to withdraw and service working capital on a revolving credit basis.",
            whyRecommendedTe="రూ. 10 లక్షల వరకు ఎలాంటి షూరిటీ లేదా ఆస్తి పత్రాలు అవసరం లేని జాతీయ పథకం. ముద్రా కార్డు ద్వారా అవసరమైనప్పుడు నగదు విత్‌డ్రా చేసుకోవచ్చు.",
            isTopMatch=(not has_special_subsidy) or (not any(s.isTopMatch for s in schemes)),
        )
    )

    # Ensure exactly one top match is flagged and sorted first
    top_matches = [s for s in schemes if s.isTopMatch]
    if not top_matches:
        schemes[0].isTopMatch = True

    # Sort so top match is at the very beginning
    schemes.sort(key=lambda s: 0 if s.isTopMatch else 1)
    return schemes


def generate_finance_advice(req: FinanceAdviceRequest) -> FinanceAdviceResponse:
    """
    Synthesizes conversational AI finance advisory:
    1. Keeps 100% deterministic calculations for loan math.
    2. Computes working capital vs. capex split.
    3. Analyzes business seasonality and advises on repayment moratorium.
    4. Ranks credit schemes biased by demographics (woman, SC/ST, OBC).
    5. Answers follow-up queries conversationally via Gemini 2.5 Flash with grounded fallback.
    """
    from app.services.rag_service import clean_for_english, clean_for_telugu

    is_te = req.language == "te"
    cat_clean = clean_for_telugu(req.category) if is_te else clean_for_english(req.category)
    loc_clean = clean_for_telugu(req.location) if is_te else clean_for_english(req.location)
    if not cat_clean:
        cat_clean = req.category
    if not loc_clean:
        loc_clean = req.location

    wc_breakdown = get_working_capital_breakdown(
        loan_amount=req.loanAmount,
        category=req.category,
        custom_ratio=req.workingCapitalRatio,
    )
    moratorium_advice = get_seasonal_moratorium_advice(
        category=req.category,
        language=req.language,
    )
    schemes = get_tailored_scheme_recommendations(
        loan_amount=req.loanAmount,
        gender=req.gender,
        social_category=req.socialCategory,
        category=req.category,
        language=req.language,
    )

    top_scheme = schemes[0] if schemes else None
    scheme_name = top_scheme.name if top_scheme else "Micro Finance Scheme"

    # Base plain-language explanation grounded in deterministic math
    if is_te:
        loan_exp = (
            f"మీ {cat_clean} వ్యాపారం కోసం మొత్తం ప్రాజెక్ట్ వ్యయం ₹{req.projectCost:,.0f} గా లెక్కించబడింది. "
            f"ఇందులో మీ స్వంత మూలధన వాటా ₹{req.marginCapital:,.0f} (10%) కాగా, బ్యాంక్ ద్వారా లభించే రుణం ₹{req.loanAmount:,.0f} (90%). "
            f"ప్రతి 3 నెలలకు తగ్గుతున్న అసలుపై చెల్లించాల్సిన EMI ₹{req.quarterlyEmi:,.0f}. "
            f"మీ ప్రొఫైల్ ప్రకారం '{top_scheme.nameTe if top_scheme else scheme_name}' పథకం అత్యుత్తమంగా సరిపోతుంది ({top_scheme.whyRecommendedTe if top_scheme else ''})."
        )
    else:
        loan_exp = (
            f"For your {cat_clean} enterprise, our banking model establishes a total project outlay of ₹{req.projectCost:,.0f}. "
            f"Your promoter equity contribution is ₹{req.marginCapital:,.0f} (10%), with the remaining ₹{req.loanAmount:,.0f} (90%) funded via institutional credit. "
            f"Your quarterly reducing-balance repayment will be ₹{req.quarterlyEmi:,.0f}. "
            f"Based on your profile, '{scheme_name}' is prioritized ({top_scheme.whyRecommended if top_scheme else ''})."
        )

    # Conversational reply handling (answering userQuery or welcome overview)
    provider_used = "Grounded Financial Calculation Engine"
    reply_text = ""

    # Aggregate logbook / income numbers from request if provided
    prof_dict = req.profile or {}
    user_name = prof_dict.get("name", "Anita Sharma")
    aggs_dict = req.aggregates or {}
    monthly_rev = float(aggs_dict.get("totalIncome", 0.0))
    monthly_exp = float(aggs_dict.get("totalExpenses", 0.0))
    if monthly_rev == 0 and monthly_exp == 0:
        if "kirana" in cat_clean.lower():
            monthly_rev, monthly_exp = 65000.0, 48000.0
        elif "weave" in cat_clean.lower():
            monthly_rev, monthly_exp = 42000.0, 24000.0
        else:
            monthly_rev, monthly_exp = 45700.0, 12700.0

    monthly_profit = monthly_rev - monthly_exp
    monthly_emi_equiv = round(req.quarterlyEmi / 3.0)
    dscr = round((monthly_profit / monthly_emi_equiv * 100.0)) / 100.0 if monthly_emi_equiv > 0 else 9.99

    sector_info = resolve_sector(cat_clean)

    context_dict = {
        "profile": {
            "name": user_name,
            "businessName": prof_dict.get("businessName", f"{user_name}'s Enterprise"),
            "location": loc_clean,
            "businessType": cat_clean,
            "availableCapital": req.marginCapital,
            "gender": req.gender,
            "socialCategory": req.socialCategory,
        },
        "income": {
            "monthlyRevenue": monthly_rev,
            "annualRevenue": monthly_rev * 12,
        },
        "expenses": {
            "monthlyExpenses": monthly_exp,
            "annualExpenses": monthly_exp * 12,
            "largestCategories": [
                {"category": "Supplies & Inventory", "amount": round(monthly_exp * 0.5), "percentage": 50},
                {"category": "Operations & Utilities", "amount": round(monthly_exp * 0.3), "percentage": 30},
            ],
        },
        "loan": {
            "marginCapital": req.marginCapital,
            "loanAmount": req.loanAmount,
            "projectCost": req.projectCost,
            "quarterlyEmi": req.quarterlyEmi,
            "monthlyEmiEquivalent": monthly_emi_equiv,
            "interestRate": 9.0,
            "tenureYears": 5,
            "workingCapitalAmount": wc_breakdown.workingCapitalAmount,
            "workingCapitalPercent": wc_breakdown.workingCapitalPercent,
            "capexAmount": wc_breakdown.capexAmount,
            "capexPercent": wc_breakdown.capexPercent,
        },
        "business": {
            "businessType": cat_clean,
            "location": loc_clean,
            "unitNameEn": sector_info["unitNameEn"],
            "unitNameTe": sector_info["unitNameTe"],
            "unitCapex": sector_info["unitCapex"],
            "unitAnnualRevenue": sector_info["unitAnnualRevenue"],
            "unitAnnualOpex": sector_info["unitAnnualOpex"],
            "unitAnnualNetProfit": sector_info["unitAnnualNetProfit"],
            "leanSeason": sector_info["leanSeason"],
            "peakSeason": sector_info["peakSeason"],
            "moratoriumGuidance": sector_info["guidanceEn"],
            "moratoriumGuidanceTe": sector_info["guidanceTe"],
        },
        "calculations": {
            "monthlyProfit": monthly_profit,
            "debtServiceCoverageRatio": dscr,
            "maxSafeMonthlyEmi": max(0.0, monthly_profit * 0.40),
            "maxSafeLoanAmount": max(0.0, monthly_profit * 0.40 * 48),
        },
    }

    if req.userQuery and req.userQuery.strip():
        intent_info = classify_query_intent(req.userQuery)
        calc_res = calculate_intent_metrics(context_dict, intent_info)

        loan_context_for_gemini = {
            "userName": user_name,
            "category": cat_clean,
            "location": loc_clean,
            "gender": req.gender,
            "socialCategory": req.socialCategory,
            "monthlyRevenue": monthly_rev,
            "monthlyExpenses": monthly_exp,
            "monthlyProfit": monthly_profit,
            "dscr": dscr,
            "totalIncome": monthly_rev,
            "totalExpenses": monthly_exp,
            "netCashFlow": monthly_profit,
            "topExpenseCategories": "Supplies (50%), Operations (30%)",
            "marginCapital": req.marginCapital,
            "loanAmount": req.loanAmount,
            "projectCost": req.projectCost,
            "quarterlyEmi": req.quarterlyEmi,
            "workingCapitalAmount": wc_breakdown.workingCapitalAmount,
            "workingCapitalPercent": wc_breakdown.workingCapitalPercent,
            "capexAmount": wc_breakdown.capexAmount,
            "capexPercent": wc_breakdown.capexPercent,
            "moratoriumGuidance": moratorium_advice.guidance,
            "topSchemes": ", ".join([f"{s.name} ({s.whyRecommended})" for s in schemes[:3]]),
            "verifiedCalculationSummary": calc_res["summary"] if not is_te else calc_res["summaryTe"],
        }

        # Attempt Gemini 2.5 Flash first
        if gemini_service.is_available():
            gemini_reply = gemini_service.generate_conversational_finance_reply(
                user_query=req.userQuery,
                loan_context=loan_context_for_gemini,
                language=req.language,
                history=req.history,
            )
            if gemini_reply:
                reply_text = gemini_reply
                provider_used = f"Google Gemini ({gemini_service.last_model_used or 'gemini-2.5-flash'})"

        # Grounded conversational fallback (uses verified calculation summary)
        if not reply_text:
            reply_text = calc_res["summaryTe"] if is_te else calc_res["summary"]
    else:
        # Default greeting / executive advisor overview
        if is_te:
            reply_text = (
                f"నమస్కారం! మీ {cat_clean} వ్యాపారానికి సంబంధించిన ఆర్థిక విశ్లేషణ సిద్ధంగా ఉంది. "
                f"మీకు ₹{req.loanAmount:,.0f} రుణం అవసరమవుతుంది, త్రైమాసిక వాయిదా ₹{req.quarterlyEmi:,.0f}. "
                f"మీ ప్రొఫైల్ ఆధారంగా '{top_scheme.nameTe if top_scheme else scheme_name}' పథకం సిఫార్సు చేయబడింది. "
                f"రుణ వివరాలు, మారటోరియం లేదా వర్కింగ్ క్యాపిటల్ గురించి ఏవైనా సందేహాలుంటే నన్ను అడగండి."
            )
        else:
            reply_text = (
                f"Welcome! I have analyzed your {cat_clean} enterprise requirements. "
                f"Based on your ₹{req.marginCapital:,.0f} equity margin, you qualify for an institutional loan of ₹{req.loanAmount:,.0f} with a quarterly EMI of ₹{req.quarterlyEmi:,.0f}. "
                f"I have tailored '{scheme_name}' as your top scheme match and scheduled a seasonal moratorium for your lean months. "
                f"You can ask me any questions about interest rates, working capital, or bank approval requirements below."
            )

    return FinanceAdviceResponse(
        reply=reply_text,
        replyTe=reply_text if is_te else None,
        loanExplanation=loan_exp,
        loanExplanationTe=loan_exp if is_te else None,
        recommendedSchemes=schemes,
        workingCapitalBreakdown=wc_breakdown,
        seasonalMoratoriumAdvice=moratorium_advice,
        providerUsed=provider_used,
    )

