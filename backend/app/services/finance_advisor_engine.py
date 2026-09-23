import re
import math
from typing import Dict, Any, List, Optional, Tuple

SECTOR_BENCHMARKS = {
    "dairy": {
        "unitNameEn": "Murrah Buffalo / High-Yield Dairy Cow",
        "unitNameTe": "ముర్రా గేదె / మేలుజాతి పాడి ఆవు",
        "unitCapex": 90000.0,
        "unitAnnualRevenue": 156000.0,
        "unitAnnualOpex": 78000.0,
        "unitAnnualNetProfit": 78000.0,
        "leanSeason": "April – June (Peak Summer Heat)",
        "peakSeason": "August – January (Monsoon & Winter Flush)",
        "guidanceEn": "In dairy farming, summer heat stress depresses milk yield by 20%–30%. Structure a 1-quarter moratorium or interest-only period during summer, accelerating principal repayment during the winter flush season.",
        "guidanceTe": "పాడి పరిశ్రమలో వేసవి కాలంలో పాల దిగుబడి 20%–30% తగ్గుతుంది. కాబట్టి వేసవిలో 1 త్రైమాసికం మారటోరియం తీసుకుని, శీతాకాలంలో అసలు వేగంగా చెల్లించడం ఉత్తమం.",
        "defaultWcRatio": 0.35,
        "wcUses": ["High-protein cattle feed & dry fodder reserves", "Veterinary care, vaccines & milk transport cans"],
        "capexUses": ["High-yield Murrah buffaloes / dairy cows", "Pucca cattle shed construction & bulk milk chiller"],
    },
    "kirana": {
        "unitNameEn": "Inventory Replenishment Cycle / SKU Line",
        "unitNameTe": "కిరాణా సరుకుల నిల్వ / వస్తువుల లైన్",
        "unitCapex": 75000.0,
        "unitAnnualRevenue": 360000.0,
        "unitAnnualOpex": 288000.0,
        "unitAnnualNetProfit": 72000.0,
        "leanSeason": "July – August (Kharif Sowing Season)",
        "peakSeason": "October – January (Festive & Harvest Season)",
        "guidanceEn": "Rural grocery cash flows tighten during sowing months as farmers conserve cash for seeds. Request standard quarterly EMIs with working capital buffer before the festival season.",
        "guidanceTe": "ఖరీఫ్ విత్తనాల కాలంలో అరువులు పెరుగుతాయి కాబట్టి సాధారణ వాయిదాలు చెల్లించి, పండుగల ముందు వర్కింగ్ క్యాపిటల్ పెంచుకోండి.",
        "defaultWcRatio": 0.75,
        "wcUses": ["FMCG wholesale stock & inventory replenishment", "Bulk grains, pulses, spices & customer credit buffer"],
        "capexUses": ["Commercial deep freezer & refrigeration", "Modular steel racks, electronic scale & billing POS"],
    },
    "weaving": {
        "unitNameEn": "Fly-Shuttle Pit Loom & Jacquard Setup",
        "unitNameTe": "ఫ్లై-షటిల్ పిట్ మగ్గం & జకార్డ్ అమరిక",
        "unitCapex": 60000.0,
        "unitAnnualRevenue": 240000.0,
        "unitAnnualOpex": 156000.0,
        "unitAnnualNetProfit": 84000.0,
        "leanSeason": "June – August (Monsoon Humidity)",
        "peakSeason": "September – February (Wedding & Festival Season)",
        "guidanceEn": "Handloom drying slows during monsoon humidity. Structure a 1-quarter moratorium during monsoon, matching principal amortization with the wedding season.",
        "guidanceTe": "వర్షాకాలంలో అమ్మకాలు మందగిస్తాయి కాబట్టి 1 త్రైమాసిక మారటోరియం తీసుకుని, పెళ్లిళ్ల సీజన్లో అసలు చెల్లించండి.",
        "defaultWcRatio": 0.60,
        "wcUses": ["Mulberry silk yarn, cotton yarn & metallic zari", "Natural dyes, warp materials & weaver artisan wages"],
        "capexUses": ["Fly-shuttle pit looms & electronic Jacquard box", "Warping drum, creel stand & pirn winder"],
    },
}

def parse_target_amount(text: str) -> Optional[float]:
    if not text:
        return None
    clean = text.lower().replace(",", "").strip()

    # Lakhs pattern
    m_lakh = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|lac|l|లక్షలు|లక్షల|లక్ష)", clean)
    if m_lakh:
        try:
            return float(m_lakh.group(1)) * 100000.0
        except ValueError:
            pass

    # Crores pattern
    m_cr = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|crs?|cr|కోట్లు|కోట్ల|కోటి)", clean)
    if m_cr:
        try:
            return float(m_cr.group(1)) * 10000000.0
        except ValueError:
            pass

    # Thousands pattern
    m_k = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|వేలు|వేల)", clean)
    if m_k:
        try:
            return float(m_k.group(1)) * 1000.0
        except ValueError:
            pass

    # Raw numbers >= 1000
    m_num = re.search(r"(?:₹|rs\.?|inr\s*)?\s*(\d{4,9})(?:\.\d+)?", clean)
    if m_num:
        try:
            val = float(m_num.group(1))
            if val >= 1000.0:
                return val
        except ValueError:
            pass

    return None

def resolve_sector(category: str) -> Dict[str, Any]:
    cat = (category or "Dairy Farming").lower()
    if "kirana" in cat or "grocery" in cat or "retail" in cat:
        return SECTOR_BENCHMARKS["kirana"]
    if "weave" in cat or "handloom" in cat or "textile" in cat:
        return SECTOR_BENCHMARKS["weaving"]
    return SECTOR_BENCHMARKS["dairy"]

def classify_query_intent(query: str) -> Dict[str, Any]:
    if not query or not query.strip():
        return {
            "intent": "open_ended_planning",
            "targetAmount": None,
            "rawQuery": "",
        }

    q = query.lower().strip()
    target_amt = parse_target_amount(q)

    # 1. Moratorium & Seasonal Grace
    if any(k in q for k in ["moratorium", "summer", "lean", "grace", "pause", "skip emi", "మారటోరియం", "వేసవి"]):
        return {"intent": "moratorium_guidance", "targetAmount": target_amt, "rawQuery": query}

    # 2. Target profit / Capacity question: "how many cows to make 500000 profit?"
    is_how_many = any(k in q for k in [
        "how many", "number of", "how much animals", "how much cows", "cows do i need", "cows should i buy",
        "buffaloes do i need", "looms do i need", "how many units", "how many machines",
        "ఎన్ని ఆవులు", "ఎన్ని బర్రెలు", "ఎన్ని మగ్గాలు", "ఎన్ని కావాలి", "ఆవులు కొనాలి", "బర్రెలు కొనాలి"
    ])
    is_profit = any(k in q for k in [
        "profit", "earn", "net income", "income of", "లాభం", "సంపాదించడానికి", "వార్షిక లాభం", "मुनाफा", "कमाई"
    ])

    if is_how_many and (is_profit or target_amt is not None):
        return {"intent": "target_profit_capacity", "targetAmount": target_amt, "rawQuery": query}

    # 3. Revenue for target profit
    if any(k in q for k in ["revenue", "sales", "turnover", "అమ్మకాలు", "టర్నోవర్"]) and (is_profit or target_amt is not None):
        return {"intent": "revenue_for_target_profit", "targetAmount": target_amt, "rawQuery": query}

    # 4. Target profit planning: "I want to make a profit of 5 lakh rupees how my finances should look"
    is_profit_planning = any(k in q for k in [
        "how my finances should look", "how should my finances look", "finances should look",
        "target profit", "make a profit", "profit of", "earn a profit", "get a profit", "reach profit",
        "to make a profit", "want to make a profit", "want to earn", "లాభం రావాలంటే", "లాభం కోసం",
        "ఆర్థిక పరిస్థితి ఎలా ఉండాలి", "లాభ ప్రణాళిక"
    ])

    if is_profit_planning or (
        is_profit and (target_amt is not None or any(k in q for k in ["plan", "target", "how", "want"])) and
        not any(p in q for p in ["how much profit", "my profit", "am i making profit", "నా లాభం ఎంత"])
    ):
        return {"intent": "target_profit_planning", "targetAmount": target_amt, "rawQuery": query}

    # 5. Savings planning
    if any(k in q for k in ["save", "saving", "savings", "దాచుకోవాలి", "పొదుపు", "emergency fund"]) and "subsidy" not in q:
        return {"intent": "savings_planning", "targetAmount": target_amt, "rawQuery": query}

    # 6. Expense reduction
    if (any(k in q for k in ["reduce", "cut", "lower", "control", "curtail", "తగ్గించు", "తగ్గించ"]) and any(w in q for w in ["expense", "cost", "spending", "ఖర్చు"])) or "reduce my expenses" in q:
        return {"intent": "expense_reduction", "targetAmount": target_amt, "rawQuery": query}

    # 7. Specific Scheme Rationale
    if any(k in q for k in ["why", "ఎందుకు"]) and any(k in q for k in ["stand-up", "pmegp", "mudra", "vishwakarma", "nbcfdc", "scheme", "పథకం"]):
        return {"intent": "scheme_rationale", "targetAmount": target_amt, "rawQuery": query}

    # 8. Scheme eligibility
    if any(k in q for k in ["scheme", "eligible", "government scheme", "subsidies", "subsidy", "పథకాలు", "ప్రభుత్వ పథకాలు", "అర్హత"]):
        return {"intent": "government_schemes", "targetAmount": target_amt, "rawQuery": query}

    # 9. Bank documentation
    if any(k in q for k in ["document", "paperwork", "bank require", "kyc", "apply", "approval", "పత్రాలు", "డాక్యుమెంట్లు"]):
        return {"intent": "document_requirements", "targetAmount": target_amt, "rawQuery": query}

    # 10. Working capital vs Capex
    if any(k in q for k in ["working capital", "capex", "split", "machinery", "stock", "వర్కింగ్ క్యాపిటల్", "కేపెక్స్"]):
        return {"intent": "working_capital_split", "targetAmount": target_amt, "rawQuery": query}

    # 11. Max borrowing
    if any(k in q for k in ["how much can i borrow", "how much loan can i get", "maximum loan", "max loan", "borrowing limit", "ఎంత రుణం తీసుకోవచ్చు", "ఎంత లోన్ వస్తుంది"]):
        return {"intent": "max_borrowing_capacity", "targetAmount": target_amt, "rawQuery": query}

    # 12. Repayment / EMI
    if any(k in q for k in ["quarterly repayment", "quarterly emi", "monthly emi", "installment", "monthly pay", "quarterly pay", "వాయిదా", "కిస్తీ"]) or (("emi" in q or "repay" in q) and "interest" not in q):
        return {"intent": "emi_calculation", "targetAmount": target_amt, "rawQuery": query}

    # 13. Interest Cost
    if any(k in q for k in ["interest rate", "total cost of loan", "total interest", "total repay", "వడ్డీ", "మొత్తం వడ్డీ"]):
        return {"intent": "interest_cost", "targetAmount": target_amt, "rawQuery": query}

    # 14. Loan Affordability
    is_loan_k = any(k in q for k in ["loan", "borrow", "debt", "lend", "రుణం", "అప్పు", "తీసుకోవచ్చా", "లోన్"])
    is_afford_k = any(k in q for k in ["afford", "can i take", "can i borrow", "తీసుకోవచ్చా", "భరించగలనా", "సాధ్యమేనా", "తీసుకోవచ్చా లేదా", "safe to take"])
    if is_afford_k or (is_loan_k and target_amt is not None) or (is_loan_k and any(k in q for k in ["afford", "eligible", "safe"])):
        return {"intent": "loan_affordability", "targetAmount": target_amt, "rawQuery": query}

    # 14. Profit analysis
    if any(k in q for k in ["how much profit", "my profit", "profit margin", "am i making profit", "నా లాభం ఎంత", "లాభాలు ఎంత"]):
        return {"intent": "profit_analysis", "targetAmount": target_amt, "rawQuery": query}

    # 15. Business expansion
    if any(k in q for k in ["expand", "expansion", "grow business", "వ్యాపార విస్తరణ", "పెంచవచ్చా", "విస్తరించవచ్చా"]):
        return {"intent": "business_expansion", "targetAmount": target_amt, "rawQuery": query}

    # 16. Break-even
    if any(k in q for k in ["break-even", "breakeven", "break even", "బ్రేక్ ఈవెన్"]):
        return {"intent": "break_even_analysis", "targetAmount": target_amt, "rawQuery": query}

    # 17. Cash flow
    if any(k in q for k in ["cash flow", "cashflow", "నగదు ప్రవాహం"]):
        return {"intent": "cash_flow_analysis", "targetAmount": target_amt, "rawQuery": query}

    return {"intent": "open_ended_planning", "targetAmount": target_amt, "rawQuery": query}

def calculate_intent_metrics(
    ctx: Dict[str, Any],
    intent_data: Dict[str, Any]
) -> Dict[str, Any]:
    intent = intent_data.get("intent", "open_ended_planning")
    target_amount = intent_data.get("targetAmount")

    loan = ctx.get("loan", {})
    income = ctx.get("income", {})
    expenses = ctx.get("expenses", {})
    calc = ctx.get("calculations", {})
    biz = ctx.get("business", {})
    prof = ctx.get("profile", {})

    loan_amount = float(loan.get("loanAmount", 900000.0))
    monthly_rev = float(income.get("monthlyRevenue", 45700.0))
    monthly_exp = float(expenses.get("monthlyExpenses", 12700.0))
    monthly_surplus = float(calc.get("monthlyProfit", monthly_rev - monthly_exp))
    interest_rate = float(loan.get("interestRate", 9.0))
    tenure_years = int(loan.get("tenureYears", 5))

    if intent == "loan_affordability":
        test_loan = float(target_amount) if target_amount and target_amount > 0 else loan_amount
        monthly_rate = interest_rate / 100.0 / 12.0
        total_months = tenure_years * 12
        cf = math.pow(1.0 + monthly_rate, total_months)
        test_emi = round((test_loan * monthly_rate * cf) / (cf - 1.0))
        test_q_emi = test_emi * 3
        proj_disp = monthly_surplus - test_emi
        test_dti = round((test_emi / monthly_rev * 100.0)) if monthly_rev > 0 else 0
        test_dscr = round((monthly_surplus / test_emi * 100.0)) / 100.0 if test_emi > 0 else 9.99

        is_afford = test_dscr >= 1.25 and test_dti <= 45
        is_tight = test_dscr >= 1.0 and not is_afford

        if is_afford:
            summary = f"Yes, you can comfortably afford a ₹{test_loan:,.0f} loan. At {interest_rate}% over {tenure_years} years, your estimated monthly repayment will be ₹{test_emi:,.0f} (Quarterly: ₹{test_q_emi:,.0f}). With your current monthly net cash flow of ₹{monthly_surplus:,.0f}, you will retain ₹{proj_disp:,.0f} in disposable cash buffer (DSCR: {test_dscr}x, DTI: {test_dti}%)."
            summary_te = f"అవును, మీరు ₹{test_loan:,.0f} రుణాన్ని సులభంగా భరించగలరు. {interest_rate}% వడ్డీతో 5 సంవత్సరాలకు నెలవారీ వాయిదా సుమారు ₹{test_emi:,.0f} (త్రైమాసికం: ₹{test_q_emi:,.0f}). మీ ప్రస్తుత నికర మిగులు ₹{monthly_surplus:,.0f} లో వాయిదా పోను ₹{proj_disp:,.0f} మిగులు నిధులు ఉంటాయి (DSCR: {test_dscr}x)."
        elif is_tight:
            summary = f"A ₹{test_loan:,.0f} loan is possible but financially tight. The monthly EMI of ₹{test_emi:,.0f} consumes {test_dti}% of your monthly income, leaving only ₹{proj_disp:,.0f} disposable cash (DSCR: {test_dscr}x)."
            summary_te = f"₹{test_loan:,.0f} రుణం సాధ్యమే కానీ కాస్త రిస్క్ ఉంది. నెలవారీ వాయిదా ₹{test_emi:,.0f} మీ ఆదాయంలో {test_dti}% తీసుకుంటుంది. మిగులు కేవలం ₹{proj_disp:,.0f} మాత్రమే ఉంటుంది."
        else:
            summary = f"A ₹{test_loan:,.0f} loan is NOT recommended right now. The monthly EMI of ₹{test_emi:,.0f} stresses your current monthly surplus of ₹{monthly_surplus:,.0f} (DSCR: {test_dscr}x). Safe borrowing limit is ~₹{calc.get('maxSafeLoanAmount', 0):,.0f}."
            summary_te = f"ప్రస్తుత ఆదాయ పరిస్థితుల్లో ₹{test_loan:,.0f} రుణం సిఫార్సు చేయబడదు. మీ ప్రస్తుత సురక్షిత రుణ పరిమితి దాదాపు ₹{calc.get('maxSafeLoanAmount', 0):,.0f}."

        return {"summary": summary, "summaryTe": summary_te, "data": {"testLoan": test_loan, "testEmi": test_emi, "dscr": test_dscr, "dti": test_dti}}

    elif intent == "target_profit_capacity":
        target_profit = float(target_amount) if target_amount and target_amount > 0 else 500000.0
        unit_profit = float(biz.get("unitAnnualNetProfit", 78000.0))
        unit_capex = float(biz.get("unitCapex", 90000.0))
        unit_name = biz.get("unitNameEn", "Dairy Cow")
        unit_name_te = biz.get("unitNameTe", "పాడి ఆవు")

        exact_units = target_profit / unit_profit
        rec_units = math.ceil(exact_units)
        total_outlay = rec_units * unit_capex
        margin_req = round(total_outlay * 0.10)
        loan_req = total_outlay - margin_req

        summary = f"To generate a target annual profit of ₹{target_profit:,.0f}, you require {rec_units} {unit_name}s (exact: {exact_units:.1f}). Each unit generates ₹{unit_profit:,.0f} in annual net profit. Total capital required is ₹{total_outlay:,.0f}, structured as ₹{margin_req:,.0f} equity margin (10%) and ₹{loan_req:,.0f} bank loan."
        summary_te = f"వార్షికంగా ₹{target_profit:,.0f} నికర లాభం సంపాదించడానికి మీకు {rec_units} {unit_name_te}లు అవసరం. ప్రతి యూనిట్ ద్వారా వార్షికంగా ₹{unit_profit:,.0f} నికర లాభం వస్తుంది. మొత్తం ప్రాజెక్ట్ వ్యయం ₹{total_outlay:,.0f} (మీ పెట్టుబడి: ₹{margin_req:,.0f}, బ్యాంక్ రుణం: ₹{loan_req:,.0f})."

        return {"summary": summary, "summaryTe": summary_te, "data": {"recommendedUnits": rec_units, "totalOutlay": total_outlay, "marginReq": margin_req, "loanReq": loan_req}}

    elif intent == "target_profit_planning":
        target_profit = float(target_amount) if target_amount and target_amount > 0 else 500000.0
        target_monthly_profit = round(target_profit / 12.0)

        current_monthly_rev = monthly_rev
        current_monthly_exp = monthly_exp
        current_monthly_profit = monthly_surplus
        annualized_profit = current_monthly_profit * 12.0

        profit_gap_monthly = target_monthly_profit - current_monthly_profit
        profit_gap_annual = target_profit - annualized_profit

        current_margin_pct = round((current_monthly_profit / current_monthly_rev * 100.0)) if current_monthly_rev > 0 else 50
        margin_decimal = max(0.15, current_margin_pct / 100.0)

        required_monthly_rev = round(target_monthly_profit / margin_decimal)
        required_annual_rev = required_monthly_rev * 12
        incremental_monthly_rev = max(0, required_monthly_rev - int(current_monthly_rev))

        unit_profit = float(biz.get("unitAnnualNetProfit", 78000.0))
        unit_name = biz.get("unitNameEn", "Dairy Cow")
        unit_name_te = biz.get("unitNameTe", "పాడి ఆవు")
        units_needed = max(1, math.ceil(profit_gap_annual / max(1.0, unit_profit)))

        if profit_gap_monthly <= 0:
            summary = f"Your enterprise currently generates ₹{current_monthly_profit:,.0f}/month in net profit (Annualized: ₹{annualized_profit:,.0f}), which already fulfills your target annual profit of ₹{target_profit:,.0f}. To sustain this: 1) Maintain monthly sales volume at ₹{current_monthly_rev:,.0f}, 2) Keep operating costs controlled at ₹{current_monthly_exp:,.0f}, and 3) Build a 3-month operating emergency buffer of ₹{round(current_monthly_exp * 3):,.0f}."
            summary_te = f"మీ వ్యాపారం ఇప్పటికే నెలకు ₹{current_monthly_profit:,.0f} (వార్షికంగా: ₹{annualized_profit:,.0f}) నికర లాభాన్ని ఆర్జిస్తోంది, ఇది మీ లక్ష్యమైన ₹{target_profit:,.0f} లాభాన్ని చేరుకుంది."
        else:
            summary = (
                f"To achieve a target annual profit of ₹{target_profit:,.0f} (~₹{target_monthly_profit:,.0f}/month) for your {biz.get('businessType', 'Dairy Farming')} enterprise:\n"
                f"1. Current Baseline & Profit Gap: You currently earn ₹{current_monthly_profit:,.0f}/month in net cash surplus (Revenue: ₹{current_monthly_rev:,.0f} minus Expenses: ₹{current_monthly_exp:,.0f}). Your monthly profit gap is ₹{profit_gap_monthly:,.0f} (Annual gap: ₹{profit_gap_annual:,.0f}).\n"
                f"2. Financial Blueprint: At your current operating margin of {current_margin_pct}%, your target monthly revenue should be ₹{required_monthly_rev:,.0f} (Annualized: ₹{required_annual_rev:,.0f}) with operating expenses disciplined around ₹{round(required_monthly_rev * (1 - margin_decimal)):,.0f}/month.\n"
                f"3. Growth & Capacity Pathway: You can bridge this ₹{profit_gap_monthly:,.0f}/month gap by adding {units_needed} {unit_name}{'s' if units_needed > 1 else ''} (generating ~₹{units_needed * unit_profit:,.0f}/year net profit) or scaling monthly production volume by ₹{incremental_monthly_rev:,.0f}."
            )
            summary_te = (
                f"వార్షికంగా ₹{target_profit:,.0f} (నెలకు సుమారు ₹{target_monthly_profit:,.0f}) నికర లాభాన్ని సాధించడానికి మీ ఆర్థిక ప్రణాళిక:\n"
                f"1. ప్రస్తుత స్థితి & లాభాల లోటు: మీ ప్రస్తుత నెలవారీ లాభం ₹{current_monthly_profit:,.0f} (ఆదాయం: ₹{current_monthly_rev:,.0f}, ఖర్చులు: ₹{current_monthly_exp:,.0f}). లక్ష్యాన్ని చేరడానికి నెలకు ఇంకా ₹{profit_gap_monthly:,.0f} (సంవత్సరానికి ₹{profit_gap_annual:,.0f}) అదనపు లాభం అవసరం.\n"
                f"2. టర్నోవర్ లక్ష్యం: {current_margin_pct}% లాభాల మార్జిన్ ప్రకారం మీ నెలవారీ ఆదాయం ₹{required_monthly_rev:,.0f} (వార్షికంగా ₹{required_annual_rev:,.0f}) కి చేరాలి.\n"
                f"3. వ్యాపార విస్తరణ: అదనంగా {units_needed} {unit_name_te}లను చేర్చుకోవడం ద్వారా లేదా నెలవారీ అమ్మకాలను ₹{incremental_monthly_rev:,.0f} పెంచడం ద్వారా ఈ లాభాల లోటును భర్తీ చేయవచ్చు."
            )

        return {
            "summary": summary,
            "summaryTe": summary_te,
            "data": {
                "targetProfit": target_profit,
                "targetMonthlyProfit": target_monthly_profit,
                "currentMonthlyRevenue": current_monthly_rev,
                "currentMonthlyExpenses": current_monthly_exp,
                "currentMonthlyProfit": current_monthly_profit,
                "annualizedProfit": annualized_profit,
                "profitGapMonthly": profit_gap_monthly,
                "profitGapAnnual": profit_gap_annual,
                "currentMarginPct": current_margin_pct,
                "requiredMonthlyRevenue": required_monthly_rev,
                "requiredAnnualRevenue": required_annual_rev,
                "incrementalMonthlyRevenue": incremental_monthly_rev,
                "additionalUnitsNeeded": units_needed,
            },
        }

    elif intent == "expense_reduction":
        largest = expenses.get("largestCategories", [])
        top_cat = largest[0] if largest else {"category": "Supplies & Feed", "amount": 6250, "percentage": 49}
        second_cat = largest[1] if len(largest) > 1 else {"category": "Fodder", "amount": 4500, "percentage": 35}
        pot_save = round(monthly_exp * 0.15)

        summary = f"Based on your digital logbook records, your largest operational spending is in: 1) {top_cat.get('category')} (₹{top_cat.get('amount', 0):,.0f}, {top_cat.get('percentage', 0)}%) and 2) {second_cat.get('category')} (₹{second_cat.get('amount', 0):,.0f}, {second_cat.get('percentage', 0)}%). Sourcing bulk cattle feed and making seasonal silage can save up to ₹{pot_save:,.0f} per month."
        summary_te = f"మీ డిజిటల్ లాగ్‌బుక్ ప్రకారం ప్రధాన ఖర్చులు: 1) {top_cat.get('category')} (₹{top_cat.get('amount', 0):,.0f}) మరియు 2) {second_cat.get('category')} (₹{second_cat.get('amount', 0):,.0f}). హోల్‌సేల్ కొనుగోళ్లు చేయడం ద్వారా నెలకు సుమారు ₹{pot_save:,.0f} ఆదా చేయవచ్చు."

        return {"summary": summary, "summaryTe": summary_te, "data": {"topCategories": largest, "potentialSavings": pot_save}}

    elif intent == "savings_planning":
        rec_sav = round(monthly_surplus * 0.25)
        runway = round(monthly_exp * 3)
        months = math.ceil(runway / rec_sav) if rec_sav > 0 else 12

        summary = f"With your monthly revenue of ₹{monthly_rev:,.0f} and expenses of ₹{monthly_exp:,.0f}, your net surplus is ₹{monthly_surplus:,.0f}. Saving 25% (₹{rec_sav:,.0f}/month) will build a 3-month operating emergency runway of ₹{runway:,.0f} in {months} months."
        summary_te = f"మీ నెలవారీ నికర మిగులు ₹{monthly_surplus:,.0f} లో 25% (నెలకు ₹{rec_sav:,.0f}) పొదుపు చేయడం ద్వారా {months} నెలల్లో 3 నెలల ఎమర్జెన్సీ ఫండ్ (₹{runway:,.0f}) సిద్ధమవుతుంది."

        return {"summary": summary, "summaryTe": summary_te, "data": {"recommendedMonthly": rec_sav, "runwayTarget": runway, "months": months}}

    elif intent == "max_borrowing_capacity":
        safe_emi = float(calc.get("maxSafeMonthlyEmi", monthly_surplus * 0.40))
        max_loan = float(calc.get("maxSafeLoanAmount", safe_emi * 48))
        safe_q_emi = safe_emi * 3

        summary = f"Based on your monthly surplus of ₹{monthly_surplus:,.0f}, your maximum safe debt-servicing capacity is ₹{safe_emi:,.0f}/month (40% prudent underwriting cap). At 9.0% over 5 years, your maximum prudent borrowing limit is approximately ₹{max_loan:,.0f} (Quarterly EMI: ₹{safe_q_emi:,.0f})."
        summary_te = f"మీ నెలవారీ నికర మిగులు ₹{monthly_surplus:,.0f} ఆధారంగా, 40% సురక్షిత పరిమితిలో మీరు నెలకు గరిష్టంగా ₹{safe_emi:,.0f} వాయిదా చెల్లించగలరు. మీ గరిష్ట రుణ పరిమితి సుమారు ₹{max_loan:,.0f} (త్రైమాసిక వాయిదా: ₹{safe_q_emi:,.0f})."

        return {"summary": summary, "summaryTe": summary_te, "data": {"safeMonthlyEmi": safe_emi, "maxSafeLoan": max_loan}}

    elif intent == "moratorium_guidance":
        guidance = biz.get("moratoriumGuidance", "In dairy farming, summer heat stress depresses milk yield. Structure a 1-quarter moratorium.")
        guidance_te = biz.get("moratoriumGuidanceTe", "పాడి పరిశ్రమలో వేసవి కాలంలో పాల దిగుబడి తగ్గుతుంది. 1 త్రైమాసికం మారటోరియం తీసుకోండి.")
        lean_s = biz.get("leanSeason", "April – June")
        peak_s = biz.get("peakSeason", "August – January")

        summary = f"{guidance} During {lean_s}, you can structure an interest-only moratorium on your ₹{loan_amount:,.0f} loan, preserving liquidity before cash flow accelerates in {peak_s}."
        summary_te = f"{guidance_te} {lean_s} కాలంలో అసలు చెల్లించకుండా కేవలం వడ్డీ మాత్రమే చెల్లించి, {peak_s} కాలంలో అసలు వేగంగా చెల్లించవచ్చు."

        return {"summary": summary, "summaryTe": summary_te, "data": {"leanSeason": lean_s, "peakSeason": peak_s, "guidance": guidance}}

    elif intent == "government_schemes":
        summary = f"Based on your profile ({prof.get('gender')}, {prof.get('socialCategory')}, {prof.get('location')}), you qualify for: 1) Stand-Up India (priority credit for women & SC/ST up to ₹1 Cr), 2) PMEGP (up to 35% capital subsidy for rural micro-enterprises), and 3) PM MUDRA Yojana (collateral-free credit up to ₹10 Lakhs)."
        summary_te = f"మీ ప్రొఫైల్ ({prof.get('gender')}, {prof.get('socialCategory')}, {prof.get('location')}) ఆధారంగా మీరు అర్హులైన పథకాలు: 1) స్టాండ్-అప్ ఇండియా, 2) పీఎంఈజీపీ (35% వరకు గ్రామీణ సబ్సిడీ), 3) పీఎం ముద్రా యోజన."

        return {"summary": summary, "summaryTe": summary_te, "data": {"schemes": ["Stand-Up India", "PMEGP", "MUDRA"]}}

    elif intent == "scheme_rationale":
        summary = f"We recommend your priority scheme because as an entrepreneur in {prof.get('location')}, you are eligible for concessional margin money (10%-15%) and government credit guarantee coverage, keeping your quarterly repayment at ₹{float(loan.get('quarterlyEmi', 42000.0)):,.0f}."
        summary_te = f"మీకు ఈ పథకం సిఫార్సు చేయబడింది ఎందుకంటే ప్రభుత్వ క్రెడిట్ గ్యారెంటీ మరియు సబ్సిడీతో మీ త్రైమాసిక వాయిదా ₹{float(loan.get('quarterlyEmi', 42000.0)):,.0f} గా ఉంటుంది."

        return {"summary": summary, "summaryTe": summary_te, "data": {"quarterlyEmi": float(loan.get("quarterlyEmi", 42000.0))}}

    elif intent == "emi_calculation":
        q_emi = float(loan.get("quarterlyEmi", 42000.0))
        m_emi = float(loan.get("monthlyEmiEquivalent", q_emi / 3.0))
        summary = f"For your ₹{loan_amount:,.0f} loan at {interest_rate}% interest over {tenure_years} years, your scheduled quarterly repayment is ₹{q_emi:,.0f} (monthly equivalent: ~₹{m_emi:,.0f})."
        summary_te = f"మీ ₹{loan_amount:,.0f} రుణానికి {interest_rate}% వడ్డీతో {tenure_years} సంవత్సరాల కాలపరిమితిలో త్రైమాసిక వాయిదా ₹{q_emi:,.0f} (నెలకు సుమారు ₹{m_emi:,.0f})."

        return {"summary": summary, "summaryTe": summary_te, "data": {"loanAmount": loan_amount, "quarterlyEmi": q_emi, "monthlyEmi": m_emi}}

    elif intent == "interest_cost":
        q_emi = float(loan.get("quarterlyEmi", 42000.0))
        tot_rep = q_emi * (tenure_years * 4)
        tot_int = max(0.0, tot_rep - loan_amount)
        summary = f"Over your {tenure_years}-year tenure on ₹{loan_amount:,.0f}, total interest paid is ₹{tot_int:,.0f}, bringing total repayment outlay to ₹{tot_rep:,.0f}."
        summary_te = f"మొత్తం {tenure_years} సంవత్సరాల కాలంలో ₹{loan_amount:,.0f} పై చెల్లించాల్సిన మొత్తం వడ్డీ ₹{tot_int:,.0f}, మొత్తం తిరిగి చెల్లింపు ₹{tot_rep:,.0f}."

        return {"summary": summary, "summaryTe": summary_te, "data": {"totalInterest": tot_int, "totalRepayment": tot_rep}}

    elif intent == "working_capital_split":
        wc_amt = float(loan.get("workingCapitalAmount", loan_amount * 0.35))
        wc_pct = float(loan.get("workingCapitalPercent", 35.0))
        capex_amt = float(loan.get("capexAmount", loan_amount * 0.65))
        capex_pct = float(loan.get("capexPercent", 65.0))
        summary = f"Of your ₹{loan_amount:,.0f} loan: ₹{wc_amt:,.0f} ({wc_pct:.0f}%) is allocated for operational working capital and ₹{capex_amt:,.0f} ({capex_pct:.0f}%) is for long-term capital assets."
        summary_te = f"మీ ₹{loan_amount:,.0f} రుణంలో: రోజువారీ వర్కింగ్ క్యాపిటల్ కోసం ₹{wc_amt:,.0f} ({wc_pct:.0f}%) మరియు శాశ్వత యంత్రాల కోసం ₹{capex_amt:,.0f} ({capex_pct:.0f}%) కేటాయించబడింది."

        return {"summary": summary, "summaryTe": summary_te, "data": {"wcAmount": wc_amt, "capexAmount": capex_amt}}

    elif intent == "document_requirements":
        summary = f"To sanction your ₹{loan_amount:,.0f} loan, banks require: 1) Aadhaar & PAN KYC, 2) Residence & Caste certificate ({prof.get('socialCategory')}), 3) Machinery/Equipment proforma quotations, 4) 6 months digital logbook/bank statements, and 5) Udyam MSME registration."
        summary_te = f"మీ ₹{loan_amount:,.0f} రుణ దరఖాస్తుకు అవసరమైన పత్రాలు: 1) ఆధార్ & పాన్ కార్డు, 2) నివాస & కుల ధృవీకరణ పత్రం ({prof.get('socialCategory')}), 3) యంత్రాల కొటేషన్లు, 4) 6 నెలల బ్యాంక్/లాగ్‌బుక్ రికార్డులు, 5) ఉద్యమ్ రిజిస్ట్రేషన్."

        return {"summary": summary, "summaryTe": summary_te, "data": {"requiredDocs": ["Aadhaar", "PAN", "Caste", "Quotations", "Logbook"]}}

    else:
        q_emi = float(loan.get("quarterlyEmi", 42000.0))
        summary = f"For your {biz.get('businessType', 'Dairy Farming')} in {prof.get('location', 'Warangal')}: your loan of ₹{loan_amount:,.0f} requires quarterly repayments of ₹{q_emi:,.0f}. With a net monthly surplus of ₹{monthly_surplus:,.0f}, your debt-service coverage ratio is {calc.get('debtServiceCoverageRatio', 1.8)}x."
        summary_te = f"{prof.get('location', 'Warangal')} లోని మీ {biz.get('businessType', 'Dairy')} వ్యాపారానికి ₹{loan_amount:,.0f} రుణానికి త్రైమాసిక వాయిదా ₹{q_emi:,.0f}. మీ నెలవారీ నికర మిగులు ₹{monthly_surplus:,.0f}."

        return {"summary": summary, "summaryTe": summary_te, "data": {"loanAmount": loan_amount, "quarterlyEmi": q_emi, "monthlySurplus": monthly_surplus}}
