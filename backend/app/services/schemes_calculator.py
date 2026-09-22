import math
from typing import List, Optional, Dict, Any
from app.models.schemas import SchemeEligibilityInput, SchemeCalculationResult


# ----------------- EMI Calculation Utility -----------------

def calculate_reducing_emi(
    principal: float,
    annual_rate_percent: float,
    tenure_months: int,
    moratorium_months: int = 0,
) -> Dict[str, float]:
    """
    Standard reducing balance amortization math:
    - During moratorium: borrower services only monthly interest.
    - Post-moratorium: principal amortizes over remaining months.
    """
    p = max(0.0, float(principal))
    if p <= 0 or tenure_months <= 0:
        return {
            "monthlyEmi": 0.0,
            "quarterlyEmi": 0.0,
            "totalInterestPaid": 0.0,
            "totalRepayment": 0.0,
        }

    monthly_rate = (annual_rate_percent / 100.0) / 12.0
    repayment_months = max(1, tenure_months - moratorium_months)

    if monthly_rate > 0 and repayment_months > 0:
        compound = math.pow(1.0 + monthly_rate, repayment_months)
        monthly_emi = (p * monthly_rate * compound) / (compound - 1.0)
    else:
        monthly_emi = p / repayment_months

    # Moratorium interest total
    moratorium_interest = (p * monthly_rate) * moratorium_months

    # Post-moratorium total repayment
    post_moratorium_repayment = monthly_emi * repayment_months
    total_repayment = round(moratorium_interest + post_moratorium_repayment)
    total_interest = max(0.0, round(total_repayment - p))

    # Quarterly EMI approximation (3x monthly reducing factor)
    quarterly_rate = (annual_rate_percent / 100.0) / 4.0
    quarterly_repayment_periods = max(1, round(repayment_months / 3))
    if quarterly_rate > 0 and quarterly_repayment_periods > 0:
        q_compound = math.pow(1.0 + quarterly_rate, quarterly_repayment_periods)
        quarterly_emi = (p * quarterly_rate * q_compound) / (q_compound - 1.0)
    else:
        quarterly_emi = p / quarterly_repayment_periods

    return {
        "monthlyEmi": round(monthly_emi),
        "quarterlyEmi": round(quarterly_emi),
        "totalInterestPaid": float(total_interest),
        "totalRepayment": float(total_repayment),
    }


# ----------------- Artisan Trades Registry -----------------

VISHWAKARMA_TRADES = [
    "weaver", "weaving", "handloom", "textile", "spinning",
    "carpenter", "suthar", "woodcraft",
    "potter", "kumhaar", "clay", "ceramics",
    "blacksmith", "lohar", "ironwork", "metal",
    "goldsmith", "sonar", "jewelry",
    "cobbler", "charmakar", "leather", "footwear",
    "sculptor", "moortikar", "stone",
    "tailor", "darzi", "stitching", "garment",
    "barber", "naai", "salon",
    "basket", "broom", "bamboo", "coir", "mat",
    "doll", "toy", "handicraft",
    "mason", "raajmistri", "construction",
    "dhobi", "washerman", "laundry",
    "locksmith", "armorer", "boat"
]

def check_is_artisan(category_str: str) -> bool:
    clean = (category_str or "").lower()
    return any(trade in clean for trade in VISHWAKARMA_TRADES)


# ----------------- 1. MUDRA Scheme (PMMY) -----------------

def calculate_mudra(inp: SchemeEligibilityInput) -> SchemeCalculationResult:
    """
    Pradhan Mantri MUDRA Yojana (PMMY):
    - Auto-tier routing:
        * Shishu: Up to ₹50,000 (0% margin, 8.5% p.a., 3 yrs, zero processing fee)
        * Kishore: ₹50,001 to ₹5,00,000 (10% margin, 10.0% p.a., 5 yrs)
        * Tarun: ₹5,00,001 to ₹10,00,000 (15% margin, 11.0% p.a., 5 yrs)
    - Guarantee: Credit Guarantee Fund for Micro Units (CGFMU).
    """
    amount = float(inp.loanAmount)

    if amount <= 50000.0:
        tier_id = "mudra-shishu"
        tier_name = "MUDRA (Shishu Tier)"
        tier_name_te = "పీఎం ముద్రా (శిశు - ₹50,000 వరకు)"
        max_loan = 50000.0
        sanctioned = min(amount, max_loan)
        margin_percent = 0.0
        promoter_contrib = 0.0
        project_cost = sanctioned
        interest_rate = 8.5
        tenure_years = 3.0
        tenure_months = 36
        moratorium_months = 3
        tier_desc = "For micro-starters needing small working capital injections with 0% margin money and zero processing fees."
        tier_desc_te = "చిన్న వ్యాపారాల ప్రారంభానికి ఎటువంటి సొంత వాటా లేకుండా సున్నా ప్రాసెసింగ్ ఫీజుతో లభించే రుణం."
    elif amount <= 500000.0:
        tier_id = "mudra-kishore"
        tier_name = "MUDRA (Kishore Tier)"
        tier_name_te = "పీఎం ముద్రా (కిషోర్ - ₹50,000 నుండి ₹5 లక్షలు)"
        max_loan = 500000.0
        sanctioned = min(amount, max_loan)
        margin_percent = 10.0
        project_cost = round(sanctioned / 0.90)
        promoter_contrib = project_cost - sanctioned
        interest_rate = 9.75 if inp.gender.lower() in ("female", "woman") else 10.0  # 0.25% Mahila Udyami rebate
        tenure_years = 5.0
        tenure_months = 60
        moratorium_months = 6
        tier_desc = "For expanding micro-enterprises purchasing inventory, equipment, or business stock up to ₹5 Lakhs."
        tier_desc_te = "వ్యాపార విస్తరణ మరియు ముడిసరుకు కొనుగోలుకు ₹5 లక్షల వరకు లభించే పూచీకత్తు రహిత రుణం."
    else:
        tier_id = "mudra-tarun"
        tier_name = "MUDRA (Tarun Tier)"
        tier_name_te = "పీఎం ముద్రా (తరుణ్ - ₹5 లక్షల నుండి ₹10 లక్షలు)"
        max_loan = 1000000.0
        sanctioned = min(amount, max_loan)
        margin_percent = 15.0
        project_cost = round(sanctioned / 0.85)
        promoter_contrib = project_cost - sanctioned
        interest_rate = 10.75 if inp.gender.lower() in ("female", "woman") else 11.0
        tenure_years = 5.0
        tenure_months = 60
        moratorium_months = 6
        tier_desc = "For established micro-enterprises scaling operations, setting up production units, or upgrading tech."
        tier_desc_te = "స్థిరపడిన వ్యాపారాల విస్తరణకు ₹10 లక్షల వరకు లభించే ఉన్నత స్థాయి ముద్రా రుణం."

    emi_data = calculate_reducing_emi(
        principal=sanctioned,
        annual_rate_percent=interest_rate,
        tenure_months=tenure_months,
        moratorium_months=moratorium_months,
    )

    return SchemeCalculationResult(
        schemeId=tier_id,
        schemeName=tier_name,
        schemeNameTe=tier_name_te,
        category="Micro Enterprise (PMMY)",
        agency="National Credit Guarantee Trustee Company (NCGTC) & Banks",
        isEligible=True,
        maxEligibleLoan=max_loan,
        requestedLoanAmount=amount,
        sanctionedLoanAmount=sanctioned,
        promoterContribution=float(promoter_contrib),
        promoterContributionPercent=margin_percent,
        totalProjectCost=float(project_cost),
        interestRateAnnual=interest_rate,
        subsidyPercent=None,
        subsidyAmount=None,
        tenureYears=tenure_years,
        tenureMonths=tenure_months,
        moratoriumMonths=moratorium_months,
        monthlyEmi=emi_data["monthlyEmi"],
        quarterlyEmi=emi_data["quarterlyEmi"],
        totalInterestPaid=emi_data["totalInterestPaid"],
        totalRepayment=emi_data["totalRepayment"],
        collateralFree=True,
        guaranteeCoverage="CGFMU (Credit Guarantee Fund for Micro Units, up to 75% default cover)",
        guaranteeCoverageTe="CGFMU (మైక్రో యూనిట్ల క్రెడిట్ గ్యారెంటీ ఫండ్ ద్వారా రక్షణ)",
        benefits=[
            "100% collateral-free credit with zero mortgage of land or house",
            "Pre-approved MUDRA RuPay debit card for revolving working capital withdrawal",
            tier_desc,
        ],
        benefitsTe=[
            "ఎటువంటి ఆస్తి తాకట్టు అవసరం లేని 100% పూచీకత్తు రహిత రుణం",
            "వర్కింగ్ క్యాపిటల్ అవసరాల కోసం ముద్రా రూపే డెబిట్ కార్డు సదుపాయం",
            tier_desc_te,
        ],
    )


# ----------------- 2. PM Vishwakarma Scheme -----------------

def calculate_pm_vishwakarma(inp: SchemeEligibilityInput) -> SchemeCalculationResult:
    """
    PM Vishwakarma Scheme for Traditional Artisans & Craftspeople:
    - 18 Designated Trades (weavers, potters, carpenters, cobblers, tailors, etc.)
    - Concessional Interest Rate: 5.0% p.a. (beneficiary rate; 8% subvention by MoMSME)
    - Tranche 1: up to ₹1,00,000 (18 months)
    - Tranche 2: up to ₹2,00,000 (30 months)
    - Overall max: ₹3,00,000
    - Guarantee: CGTMSE fee 100% borne by Govt of India
    """
    amount = float(inp.loanAmount)
    is_artisan = inp.isArtisanTrade if inp.isArtisanTrade is not None else check_is_artisan(inp.category)

    max_loan = 300000.0
    sanctioned = min(amount, max_loan)
    margin_percent = 5.0
    project_cost = round(sanctioned / 0.95)
    promoter_contrib = project_cost - sanctioned

    # Tenure: 18 months for <= 1L (Tranche 1), 30 months if > 1L (Tranche 2 cumulative)
    if sanctioned <= 100000.0:
        tenure_months = 18
        tenure_years = 1.5
    else:
        tenure_months = 30
        tenure_years = 2.5

    moratorium_months = 3
    interest_rate = 5.0  # Statutory 5% concessional rate

    emi_data = calculate_reducing_emi(
        principal=sanctioned,
        annual_rate_percent=interest_rate,
        tenure_months=tenure_months,
        moratorium_months=moratorium_months,
    )

    ineligibility = None
    if not is_artisan:
        ineligibility = "PM Vishwakarma is reserved for 18 designated traditional artisan/craft trades (weavers, carpenters, potters, blacksmiths, tailors, etc.)."

    return SchemeCalculationResult(
        schemeId="pm-vishwakarma",
        schemeName="PM Vishwakarma Scheme",
        schemeNameTe="పీఎం విశ్వకర్మ పథకం (చేతివృత్తుల రుణం)",
        category="Artisan & Traditional Crafts",
        agency="Ministry of Micro, Small and Medium Enterprises (MoMSME)",
        isEligible=is_artisan,
        ineligibilityReason=ineligibility,
        maxEligibleLoan=max_loan,
        requestedLoanAmount=amount,
        sanctionedLoanAmount=sanctioned,
        promoterContribution=float(promoter_contrib),
        promoterContributionPercent=margin_percent,
        totalProjectCost=float(project_cost),
        interestRateAnnual=interest_rate,
        subsidyPercent=8.0,  # 8% interest subvention paid directly by MoMSME
        subsidyAmount=round(sanctioned * 0.08 * tenure_years),
        tenureYears=tenure_years,
        tenureMonths=tenure_months,
        moratoriumMonths=moratorium_months,
        monthlyEmi=emi_data["monthlyEmi"],
        quarterlyEmi=emi_data["quarterlyEmi"],
        totalInterestPaid=emi_data["totalInterestPaid"],
        totalRepayment=emi_data["totalRepayment"],
        collateralFree=True,
        guaranteeCoverage="CGTMSE (100% Credit Guarantee fee paid by Ministry of MSME)",
        guaranteeCoverageTe="CGTMSE (క్రెడిట్ గ్యారెంటీ ఫీజును కేంద్ర ప్రభుత్వమే పూర్తిగా చెల్లిస్తుంది)",
        benefits=[
            "Heavily subsidized 5.0% annual interest rate with 8% MoMSME interest subvention",
            "₹15,000 modern toolkit grant voucher upon basic skill verification",
            "Collateral-free institutional credit with ₹1 digital transaction incentive",
        ],
        benefitsTe=[
            "కేంద్ర ప్రభుత్వం 8% వడ్డీ రాయితీ ఇవ్వడం వల్ల కేవలం 5.0% వార్షిక వడ్డీ మాత్రమే",
            "నైపుణ్య శిక్షణతో పాటు ₹15,000 విలువైన ఆధునిక టూల్‌కిట్ గ్రాంట్ ఉచితం",
            "ఎటువంటి ఆస్తి తనఖా అవసరం లేని పూర్తి పూచీకత్తు రహిత రుణం",
        ],
    )


# ----------------- 3. Stand-Up India Scheme -----------------

def calculate_stand_up_india(inp: SchemeEligibilityInput) -> SchemeCalculationResult:
    """
    Stand-Up India Scheme:
    - Target: Women and SC/ST Entrepreneurs setting up greenfield micro/small enterprises.
    - Loan Size: ₹10,00,000 to ₹1,00,00,000 (₹10 Lakh to ₹1 Crore).
    - Margin: 15% (can be backed by state subsidies, borrower contribution min 10%).
    - Interest: Lowest commercial bank lending rate (Base Rate/MCLR + 3% + tenor premium ~8.5%).
    - Tenure: 7 Years (84 months) with up to 18 months moratorium.
    - Guarantee: Credit Guarantee Scheme for Stand-Up India (CGSUI via NCGTC).
    """
    amount = float(inp.loanAmount)
    is_woman = inp.gender.lower() in ("female", "woman", "f")
    is_sc_st = inp.socialCategory.upper() in ("SC", "ST")
    is_qualifying_promoter = is_woman or is_sc_st

    max_loan = 10000000.0  # ₹1 Crore
    min_loan = 1000000.0   # ₹10 Lakhs

    sanctioned = max(min_loan, min(amount, max_loan))
    margin_percent = 15.0
    project_cost = round(sanctioned / 0.85)
    promoter_contrib = project_cost - sanctioned

    interest_rate = 8.5  # Concessional base MCLR + spread
    tenure_years = 7.0
    tenure_months = 84
    moratorium_months = 12  # Standard 1-year greenfield construction moratorium

    emi_data = calculate_reducing_emi(
        principal=sanctioned,
        annual_rate_percent=interest_rate,
        tenure_months=tenure_months,
        moratorium_months=moratorium_months,
    )

    ineligibility = None
    if not is_qualifying_promoter:
        ineligibility = "Stand-Up India is statutorily reserved for Women and SC/ST entrepreneurs setting up greenfield enterprises."

    return SchemeCalculationResult(
        schemeId="stand-up-india",
        schemeName="Stand-Up India Scheme",
        schemeNameTe="స్టాండ్-అప్ ఇండియా పథకం (మహిళలు & SC/ST)",
        category="Greenfield Enterprise (SC/ST & Women)",
        agency="SIDBI & Scheduled Commercial Banks",
        isEligible=is_qualifying_promoter,
        ineligibilityReason=ineligibility,
        maxEligibleLoan=max_loan,
        requestedLoanAmount=amount,
        sanctionedLoanAmount=sanctioned,
        promoterContribution=float(promoter_contrib),
        promoterContributionPercent=margin_percent,
        totalProjectCost=float(project_cost),
        interestRateAnnual=interest_rate,
        subsidyPercent=None,
        subsidyAmount=None,
        tenureYears=tenure_years,
        tenureMonths=tenure_months,
        moratoriumMonths=moratorium_months,
        monthlyEmi=emi_data["monthlyEmi"],
        quarterlyEmi=emi_data["quarterlyEmi"],
        totalInterestPaid=emi_data["totalInterestPaid"],
        totalRepayment=emi_data["totalRepayment"],
        collateralFree=True,
        guaranteeCoverage="CGSUI (Credit Guarantee Scheme for Stand-Up India via NCGTC)",
        guaranteeCoverageTe="CGSUI (NCGTC ద్వారా ప్రభుత్వ సావరిన్ క్రెడిట్ గ్యారెంటీ రక్షణ)",
        benefits=[
            "Statutory bank branch mandate: ₹10 Lakh to ₹1 Crore priority credit window",
            "Lowest applicable commercial interest rate with reduced 15% margin money",
            "Up to 18 months repayment moratorium during initial enterprise stabilization",
        ],
        benefitsTe=[
            "ప్రతి బ్యాంక్ శాఖలో మహిళలు మరియు SC/ST లకు ₹10 లక్షల నుండి ₹1 కోటి వరకు తప్పనిసరి రుణం",
            "బ్యాంకుల్లో అతి తక్కువ వాణిజ్య వడ్డీ రేటు మరియు కేవలం 15% స్వంత వాటా నిబంధన",
            "వ్యాపారం స్థిరపడేందుకు గరిష్టంగా 18 నెలల వరకు మారటోరియం వెసులుబాటు",
        ],
    )


# ----------------- 4. PMEGP Scheme -----------------

def calculate_pmegp(inp: SchemeEligibilityInput) -> SchemeCalculationResult:
    """
    Prime Minister's Employment Generation Programme (PMEGP):
    - Project Cost Caps:
        * Manufacturing: ₹50,00,000
        * Service / Business: ₹20,00,000
    - Subsidy (Margin Money) Matrix:
        * General Category:
            - Rural: 25% subsidy, 10% own equity, 65% loan
            - Urban: 15% subsidy, 10% own equity, 75% loan
        * Special Category (Women, SC, ST, OBC, Minorities, Ex-Servicemen):
            - Rural: 35% subsidy, 5% own equity, 60% loan
            - Urban: 25% subsidy, 5% own equity, 70% loan
    - Tenure: 5 years (60 months) with 6 months moratorium.
    - Guarantee: CGTMSE coverage (up to 85% for women/special categories).
    """
    amount = float(inp.loanAmount)
    is_woman = inp.gender.lower() in ("female", "woman", "f")
    is_sc_st_obc = inp.socialCategory.upper() in ("SC", "ST", "OBC")
    is_special_category = is_woman or is_sc_st_obc
    is_rural = inp.locationType.lower() == "rural"

    # Category caps
    clean_cat = (inp.category or "").lower()
    is_service = any(k in clean_cat for k in ("grocery", "kirana", "retail", "shop", "service", "tailor", "salon", "laundry"))
    max_project_cost = 2000000.0 if is_service else 5000000.0

    # Determine subsidy % and promoter contribution %
    if is_special_category:
        subsidy_percent = 35.0 if is_rural else 25.0
        promoter_percent = 5.0
    else:
        subsidy_percent = 25.0 if is_rural else 15.0
        promoter_percent = 10.0

    # Bank loan covers only what remains after promoter equity AND the capital subsidy:
    # promoter + loan + subsidy must equal 100% of project cost (within rounding).
    loan_share_percent = 100.0 - promoter_percent - subsidy_percent
    max_loan = max_project_cost * (loan_share_percent / 100.0)

    sanctioned = min(amount, max_loan)
    project_cost = round(sanctioned / (loan_share_percent / 100.0))
    subsidy_amount = round(project_cost * (subsidy_percent / 100.0))
    promoter_contrib = project_cost - sanctioned - subsidy_amount

    interest_rate = 9.0  # Commercial bank priority-sector rate
    tenure_years = 5.0
    tenure_months = 60
    moratorium_months = 6

    emi_data = calculate_reducing_emi(
        principal=sanctioned,
        annual_rate_percent=interest_rate,
        tenure_months=tenure_months,
        moratorium_months=moratorium_months,
    )

    special_tag = "Special Category (Women/SC/ST/OBC)" if is_special_category else "General Category"
    loc_tag = "Rural" if is_rural else "Urban"

    return SchemeCalculationResult(
        schemeId="pmegp",
        schemeName=f"PMEGP ({subsidy_percent:.0f}% {loc_tag} Subsidy)",
        schemeNameTe=f"పీఎంఈజీపీ సబ్సిడీ పథకం ({subsidy_percent:.0f}% సబ్సిడీ)",
        category="Credit-Linked Capital Subsidy",
        agency="KVIC, KVIB & District Industries Centre (DIC)",
        isEligible=True,
        maxEligibleLoan=max_loan,
        requestedLoanAmount=amount,
        sanctionedLoanAmount=sanctioned,
        promoterContribution=float(promoter_contrib),
        promoterContributionPercent=promoter_percent,
        totalProjectCost=float(project_cost),
        interestRateAnnual=interest_rate,
        subsidyPercent=subsidy_percent,
        subsidyAmount=float(subsidy_amount),
        tenureYears=tenure_years,
        tenureMonths=tenure_months,
        moratoriumMonths=moratorium_months,
        monthlyEmi=emi_data["monthlyEmi"],
        quarterlyEmi=emi_data["quarterlyEmi"],
        totalInterestPaid=emi_data["totalInterestPaid"],
        totalRepayment=emi_data["totalRepayment"],
        collateralFree=True,
        guaranteeCoverage="CGTMSE (Credit Guarantee Scheme up to 85% default coverage)",
        guaranteeCoverageTe="CGTMSE (85% వరకు రుణ హామీ రక్షణ, ఆస్తుల తాకట్టు లేదు)",
        benefits=[
            f"Government Non-Refundable Capital Subsidy: {subsidy_percent:.0f}% (₹{subsidy_amount:,.0f})",
            f"Low promoter equity requirement of only {promoter_percent:.0f}% for {special_tag}",
            "3-year lock-in period after which the capital subsidy directly reduces your loan liability",
        ],
        benefitsTe=[
            f"ప్రభుత్వ ఉచిత మూలధన సబ్సిడీ: {subsidy_percent:.0f}% (రూ. {subsidy_amount:,.0f} రాయితీ)",
            f"{special_tag} కింద స్వంత పెట్టుబడి కేవలం {promoter_percent:.0f}% మాత్రమే",
            "3 సంవత్సరాల లాక్-ఇన్ తర్వాత సబ్సిడీ మొత్తం నేరుగా మీ రుణ ఖాతాకు జమ అవుతుంది",
        ],
    )


# ----------------- 5. NBCFDC Schemes -----------------

def calculate_nbcfdc(inp: SchemeEligibilityInput) -> SchemeCalculationResult:
    """
    National Backward Classes Finance & Development Corporation (NBCFDC):
    - Micro Finance: Project cost <= ₹1,40,000 (6.5% p.a., 3 yrs, 3 mos moratorium)
    - Term Loan: Project cost <= ₹50,00,000 (8.0% p.a., 7 yrs, 6 mos moratorium)
    - Promoters: OBC entrepreneurs living below double poverty line.
    """
    amount = float(inp.loanAmount)
    is_obc = inp.socialCategory.upper() == "OBC"

    # Project Cost = Loan / 0.90
    project_cost = round(amount / 0.90)
    is_micro = project_cost <= 140000.0

    if is_micro:
        scheme_id = "nbcfdc-micro"
        scheme_name = "NBCFDC Micro Finance Scheme"
        scheme_name_te = "ఎన్‌బీసీఎఫ్‌డీసీ సూక్ష్మ రుణ పథకం"
        max_loan = 126000.0  # 90% of 1.40L
        sanctioned = min(amount, max_loan)
        interest_rate = 6.5
        tenure_years = 3.0
        tenure_months = 36
        moratorium_months = 3
    else:
        scheme_id = "nbcfdc-term"
        scheme_name = "NBCFDC Term Loan Scheme"
        scheme_name_te = "ఎన్‌బీసీఎఫ్‌డీసీ టర్మ్ లోన్ పథకం"
        max_loan = 4500000.0  # 90% of 50L
        sanctioned = min(amount, max_loan)
        interest_rate = 8.0
        tenure_years = 7.0
        tenure_months = 84
        moratorium_months = 6

    actual_project_cost = round(sanctioned / 0.90)
    promoter_contrib = actual_project_cost - sanctioned

    emi_data = calculate_reducing_emi(
        principal=sanctioned,
        annual_rate_percent=interest_rate,
        tenure_months=tenure_months,
        moratorium_months=moratorium_months,
    )

    ineligibility = None
    if not is_obc:
        ineligibility = "NBCFDC concessional lending is designated for Other Backward Classes (OBC) entrepreneurs."

    return SchemeCalculationResult(
        schemeId=scheme_id,
        schemeName=scheme_name,
        schemeNameTe=scheme_name_te,
        category="Backward Classes Concessional Credit",
        agency="National Backward Classes Finance & Development Corporation (NBCFDC)",
        isEligible=is_obc,
        ineligibilityReason=ineligibility,
        maxEligibleLoan=max_loan,
        requestedLoanAmount=amount,
        sanctionedLoanAmount=sanctioned,
        promoterContribution=float(promoter_contrib),
        promoterContributionPercent=10.0,
        totalProjectCost=float(actual_project_cost),
        interestRateAnnual=interest_rate,
        subsidyPercent=None,
        subsidyAmount=None,
        tenureYears=tenure_years,
        tenureMonths=tenure_months,
        moratoriumMonths=moratorium_months,
        monthlyEmi=emi_data["monthlyEmi"],
        quarterlyEmi=emi_data["quarterlyEmi"],
        totalInterestPaid=emi_data["totalInterestPaid"],
        totalRepayment=emi_data["totalRepayment"],
        collateralFree=True,
        guaranteeCoverage="Statutory Sovereign refinance window via State Channelising Agencies",
        guaranteeCoverageTe="రాష్ట్ర వెనుకబడిన తరగతుల కార్పొరేషన్ ద్వారా ప్రత్యక్ష ప్రభుత్వ హామీ",
        benefits=[
            f"Statutory concessional interest rate of {interest_rate:.1f}% p.a. with quarterly reducing balance",
            f"{moratorium_months} months grace period prior to commencement of principal amortization",
            "Convenient quarterly repayment cycle aligned with rural cash-flow cycles",
        ],
        benefitsTe=[
            f"చట్టబద్ధమైన రాయితీ వడ్డీ రేటు కేవలం {interest_rate:.1f}% మాత్రమే",
            f"ప్రారంభంలో {moratorium_months} నెలల వరకు అసలు చెల్లించాల్సిన అవసరం లేని గ్రేస్ పీరియడ్",
            "గ్రామీణ ఆదాయ చక్రాలకు సరిపోయే త్రైమాసిక వాయిదాల చెల్లింపు సదుపాయం",
        ],
    )


# ----------------- Master Evaluation Function -----------------

def calculate_all_eligible_schemes(inp: SchemeEligibilityInput) -> List[SchemeCalculationResult]:
    """
    Pure deterministic evaluation of all national schemes for an entrepreneur:
    1. MUDRA (Shishu / Kishore / Tarun automatically tiered)
    2. PM Vishwakarma (Artisans / Craftspeople)
    3. Stand-Up India (Women & SC/ST up to ₹1 Crore)
    4. PMEGP (Credit-linked Capital Subsidy up to 35%)
    5. NBCFDC (Micro & Term Loan for OBCs)

    Sorts and tags top demographic match.
    """
    results: List[SchemeCalculationResult] = []

    # 1. MUDRA
    results.append(calculate_mudra(inp))

    # 2. PM Vishwakarma
    results.append(calculate_pm_vishwakarma(inp))

    # 3. Stand-Up India
    results.append(calculate_stand_up_india(inp))

    # 4. PMEGP
    results.append(calculate_pmegp(inp))

    # 5. NBCFDC
    results.append(calculate_nbcfdc(inp))

    # Determine Top Match based on eligibility and strongest financial benefit:
    # Priority:
    # 1. If artisan trade & loan <= 3L -> PM Vishwakarma (5% interest + ₹15k grant is unbeatable)
    # 2. If woman/SC/ST & loan >= 10L -> Stand-Up India (mandate up to 1Cr, low margin)
    # 3. If special category & rural -> PMEGP (35% free capital subsidy)
    # 4. If OBC & loan <= 1.4L -> NBCFDC Micro (6.5% interest)
    # 5. MUDRA (auto-tier collateral-free default)

    is_woman = inp.gender.lower() in ("female", "woman", "f")
    is_sc_st = inp.socialCategory.upper() in ("SC", "ST")
    is_obc = inp.socialCategory.upper() == "OBC"
    is_artisan = inp.isArtisanTrade if inp.isArtisanTrade is not None else check_is_artisan(inp.category)

    top_id = "mudra-kishore"
    if is_artisan and inp.loanAmount <= 300000.0:
        top_id = "pm-vishwakarma"
    elif (is_woman or is_sc_st) and inp.loanAmount >= 1000000.0:
        top_id = "stand-up-india"
    elif (is_woman or is_sc_st or is_obc) and inp.loanAmount > 140000.0 and inp.loanAmount < 1000000.0:
        top_id = "pmegp"
    elif is_obc and inp.loanAmount <= 140000.0:
        top_id = "nbcfdc-micro"
    elif inp.loanAmount <= 50000.0:
        top_id = "mudra-shishu"
    elif inp.loanAmount > 500000.0:
        top_id = "mudra-tarun"
    else:
        top_id = "mudra-kishore"

    for r in results:
        if r.schemeId == top_id:
            r.isTopMatch = True
            break

    # If no top match marked yet, pick the first eligible scheme
    if not any(r.isTopMatch for r in results):
        for r in results:
            if r.isEligible:
                r.isTopMatch = True
                break

    # Sort results: eligible first, top match first, then by lowest interest/highest subsidy
    results.sort(key=lambda s: (not s.isEligible, not s.isTopMatch, -(s.subsidyPercent or 0), s.interestRateAnnual))

    return results
