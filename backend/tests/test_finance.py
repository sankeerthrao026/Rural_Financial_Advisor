import pytest
from app.services.finance_service import (
    calculate_finance_plan,
    calculate_financial_health,
    generate_finance_advice,
    get_working_capital_breakdown,
    get_seasonal_moratorium_advice,
    get_tailored_scheme_recommendations,
)
from app.models.schemas import FinanceAdviceRequest

def test_micro_finance_tier():
    # Margin ₹10,000 -> Project Cost ₹1,00,000 (<= ₹1.40L)
    plan = calculate_finance_plan(10000)
    assert plan.projectCost == 100000
    assert plan.loanAmount == 90000
    assert plan.scheme.id == "micro-finance"
    assert plan.scheme.interestRateAnnual == 6.5
    assert plan.scheme.tenureYears == 3
    assert plan.scheme.moratoriumMonths == 3
    assert plan.totalQuarters == 12
    assert plan.moratoriumQuarters == 1
    assert plan.repaymentQuarters == 11
    assert plan.quarterlyEmi > 0
    # Final remaining balance must be exactly 0
    assert plan.amortizationSchedule[-1].remainingBalance == 0.0

def test_term_loan_tier():
    # Margin ₹1,00,000 -> Project Cost ₹10,00,000 (> ₹1.40L)
    plan = calculate_finance_plan(100000)
    assert plan.projectCost == 1000000
    assert plan.loanAmount == 900000
    assert plan.scheme.id == "term-loan"
    assert plan.scheme.interestRateAnnual == 8.0
    assert plan.scheme.tenureYears == 7
    assert plan.scheme.moratoriumMonths == 6
    assert plan.totalQuarters == 28
    assert plan.moratoriumQuarters == 2
    assert plan.repaymentQuarters == 26
    assert plan.quarterlyEmi > 0
    # Final remaining balance must be exactly 0
    assert plan.amortizationSchedule[-1].remainingBalance == 0.0

def test_financial_health_scoring():
    # Good performance: 12 entries, high surplus, low expenses
    health_good = calculate_financial_health(
        total_income=50000.0,
        total_expenses=15000.0,
        entry_count=12,
        has_downward_trend=False,
    )
    assert health_good.score >= 80
    assert health_good.status == "excellent"

    # Strained performance: negative/zero net, high expenses
    health_strained = calculate_financial_health(
        total_income=20000.0,
        total_expenses=25000.0,
        entry_count=2,
        has_downward_trend=True,
    )
    assert health_strained.score < 60
    assert health_strained.status == "caution"

def test_tailored_scheme_woman_vs_general():
    # Profile 1: Woman Entrepreneur (Anita Sharma, Dairy, Loan ₹9,00,000)
    woman_req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
    )
    woman_res = generate_finance_advice(woman_req)
    assert len(woman_res.recommendedSchemes) >= 3
    # For a woman entrepreneur with >= 5L loan, Stand-Up India is top match
    top_woman_scheme = woman_res.recommendedSchemes[0]
    assert top_woman_scheme.id == "stand-up-india"
    assert "woman" in top_woman_scheme.whyRecommended.lower()
    assert top_woman_scheme.isTopMatch is True

    # Profile 2: General Male Entrepreneur (Ramesh Kumar, Kirana, Loan ₹4,50,000)
    general_req = FinanceAdviceRequest(
        marginCapital=50000.0,
        loanAmount=450000.0,
        projectCost=500000.0,
        quarterlyEmi=21000.0,
        category="Rural Grocery / Kirana",
        gender="male",
        socialCategory="General",
        location="Khammam, Telangana",
    )
    general_res = generate_finance_advice(general_req)
    assert len(general_res.recommendedSchemes) >= 3
    # Top scheme should differ sensibly (e.g. MUDRA or PMEGP General, NOT Stand-Up India mandate)
    top_general_scheme = general_res.recommendedSchemes[0]
    assert top_general_scheme.id != "stand-up-india" or not top_general_scheme.isTopMatch
    assert top_general_scheme.id in ("mudra", "pmegp")
    # Verify explanations differ
    assert woman_res.loanExplanation != general_res.loanExplanation

def test_working_capital_capex_split_adds_up():
    loan_amount = 900000.0

    # Test default dairy split (~35% WC, 65% Capex)
    dairy_split = get_working_capital_breakdown(loan_amount, "Dairy Farming")
    assert dairy_split.workingCapitalPercent == 35.0
    assert dairy_split.capexPercent == 65.0
    assert dairy_split.workingCapitalAmount + dairy_split.capexAmount == loan_amount

    # Test default kirana split (~75% WC, 25% Capex)
    kirana_split = get_working_capital_breakdown(450000.0, "Rural Grocery / Kirana")
    assert kirana_split.workingCapitalPercent == 75.0
    assert kirana_split.capexPercent == 25.0
    assert kirana_split.workingCapitalAmount + kirana_split.capexAmount == 450000.0

    # Test custom ratio override (e.g. 40% WC, 60% Capex)
    custom_split = get_working_capital_breakdown(600000.0, "Handloom / Weaving", custom_ratio=0.40)
    assert custom_split.workingCapitalPercent == 40.0
    assert custom_split.capexPercent == 60.0
    assert custom_split.workingCapitalAmount + custom_split.capexAmount == 600000.0

def test_seasonal_moratorium_advice():
    # Dairy: Peak Summer heat stress lean season
    dairy_mora = get_seasonal_moratorium_advice("Dairy Farming")
    assert dairy_mora.isSeasonal is True
    assert "summer" in dairy_mora.leanSeasonMonths.lower()
    assert "milk yield" in dairy_mora.guidance.lower() or "heat" in dairy_mora.guidance.lower()
    assert dairy_mora.moratoriumQuartersRecommended >= 1

    # Kirana: Sowing season credit crunch vs harvest festival surge
    kirana_mora = get_seasonal_moratorium_advice("Rural Grocery / Kirana")
    assert kirana_mora.isSeasonal is True
    assert "sowing" in kirana_mora.leanSeasonMonths.lower() or "july" in kirana_mora.leanSeasonMonths.lower()
    assert "festive" in kirana_mora.peakSeasonMonths.lower() or "harvest" in kirana_mora.peakSeasonMonths.lower()

def test_conversational_finance_follow_up():
    req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
        userQuery="Can I get a moratorium during summer?",
    )
    res = generate_finance_advice(req)
    assert len(res.reply) > 20
    assert "moratorium" in res.reply.lower() or "interest" in res.reply.lower() or "summer" in res.reply.lower()

def test_personalization_across_three_distinct_users():
    # User A: High profit Dairy Farmer (Revenue 50k, Expenses 15k, Surplus 35k)
    user_a_req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
        profile={"name": "Anita Sharma", "category": "Dairy Farming"},
        aggregates={"totalIncome": 50000.0, "totalExpenses": 15000.0, "netCashFlow": 35000.0},
        userQuery="Can I afford a ₹2 lakh loan?",
    )
    res_a = generate_finance_advice(user_a_req)

    # User B: Kirana Store (Revenue 120k, Expenses 60k, Surplus 60k)
    user_b_req = FinanceAdviceRequest(
        marginCapital=50000.0,
        loanAmount=450000.0,
        projectCost=500000.0,
        quarterlyEmi=21000.0,
        category="Rural Grocery / Kirana",
        gender="male",
        socialCategory="General",
        location="Khammam, Telangana",
        profile={"name": "Ramesh Kumar", "category": "Rural Grocery / Kirana"},
        aggregates={"totalIncome": 120000.0, "totalExpenses": 60000.0, "netCashFlow": 60000.0},
        userQuery="Can I afford a ₹2 lakh loan?",
    )
    res_b = generate_finance_advice(user_b_req)

    # User C: Weaving Artisan (Revenue 30k, Expenses 28k, Surplus 2k - Strained)
    user_c_req = FinanceAdviceRequest(
        marginCapital=30000.0,
        loanAmount=270000.0,
        projectCost=300000.0,
        quarterlyEmi=13000.0,
        category="Handloom / Weaving",
        gender="female",
        socialCategory="OBC",
        location="Nalgonda, Telangana",
        profile={"name": "Lakshmi Devi", "category": "Handloom / Weaving"},
        aggregates={"totalIncome": 30000.0, "totalExpenses": 28000.0, "netCashFlow": 2000.0},
        userQuery="Can I afford a ₹2 lakh loan?",
    )
    res_c = generate_finance_advice(user_c_req)

    # All three must receive distinct responses reflecting their financial health
    assert res_a.reply != res_b.reply
    assert res_b.reply != res_c.reply
    assert res_a.reply != res_c.reply

    # User C has only 2k surplus, so a 2L loan (EMI ~4k) must be tight or not recommended
    assert "tight" in res_c.reply.lower() or "not recommended" in res_c.reply.lower() or "risk" in res_c.reply.lower()

def test_question_specific_intents():
    base_req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
        aggregates={"totalIncome": 45700.0, "totalExpenses": 12700.0, "netCashFlow": 33000.0},
    )

    # Question 1: How many cows for 5 lakh profit?
    q1 = base_req.model_copy(update={"userQuery": "how many cows do i need to get a profit of 500000"})
    res1 = generate_finance_advice(q1)
    assert any(c in res1.reply.lower() for c in ["cow", "buffalo", "unit", "7", "6", "8"])

    # Question 2: How can I reduce expenses?
    q2 = base_req.model_copy(update={"userQuery": "How can I reduce my expenses?"})
    res2 = generate_finance_advice(q2)
    assert any(w in res2.reply.lower() for w in ["supplies", "feed", "bulk", "save", "expense"])

    # Question 3: How much should I save?
    q3 = base_req.model_copy(update={"userQuery": "How much should I save every month?"})
    res3 = generate_finance_advice(q3)
    assert any(w in res3.reply.lower() for w in ["save", "saving", "emergency", "runway", "month"])

    # Question 4: How much can I borrow?
    q4 = base_req.model_copy(update={"userQuery": "How much can I borrow?"})
    res4 = generate_finance_advice(q4)
    assert any(w in res4.reply.lower() for w in ["limit", "borrow", "safe", "capacity", "₹"])

    # All answers must be completely distinct
    assert res1.reply != res2.reply
    assert res2.reply != res3.reply
    assert res3.reply != res4.reply

def test_target_profit_planning_golden_query():
    """
    Golden Test Case:
    User asks: 'I want to make a profit of 5 lakh rupees how my finances should look'
    Must NOT be classified as loan affordability (no 'afford a ₹5,00,000 loan' reply).
    Must provide target profit planning, profit gap, revenue requirements, and unit scaling.
    """
    req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
        profile={"name": "Anita Sharma", "category": "Dairy Farming"},
        aggregates={"totalIncome": 45700.0, "totalExpenses": 12700.0, "netCashFlow": 33000.0},
        userQuery="I want to make a profit of 5 lakh rupees how my finances should look",
    )
    res = generate_finance_advice(req)

    # Must NOT mention loan affordability or borrow ₹5,00,000
    assert "afford a ₹5,00,000 loan" not in res.reply.lower()
    assert "can comfortably afford a ₹5,00,000 loan" not in res.reply.lower()

    # Must mention profit gap, target profit, and required revenue / scaling
    reply_lower = res.reply.lower()
    assert "profit" in reply_lower or "gap" in reply_lower
    assert any(k in res.reply for k in ["500,000", "5,00,000", "500000"]) or "5 lakh" in reply_lower
    assert any(k in reply_lower for k in ["revenue", "gap", "baseline", "blueprint", "scaling", "unit", "cow"])

def test_target_profit_planning_telugu_query():
    """
    Telugu Test Case:
    User asks: '5 లక్షల లాభం రావాలంటే నా ఆర్థిక పరిస్థితి ఎలా ఉండాలి' in Telugu mode
    """
    req = FinanceAdviceRequest(
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
        quarterlyEmi=42000.0,
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        location="Warangal, Telangana",
        language="te",
        profile={"name": "అనిత శర్మ", "category": "Dairy Farming"},
        aggregates={"totalIncome": 45700.0, "totalExpenses": 12700.0, "netCashFlow": 33000.0},
        userQuery="5 లక్షల లాభం రావాలంటే నా ఆర్థిక పరిస్థితి ఎలా ఉండాలి",
    )
    res = generate_finance_advice(req)
    assert res.reply is not None
    assert "లాభం" in res.reply or "రూ." in res.reply or "5,00,000" in res.reply



