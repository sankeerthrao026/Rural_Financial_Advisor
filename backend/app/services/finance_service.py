import math
from typing import List, Dict, Any
from app.models.schemas import (
    SchemeDetails,
    AmortizationRow,
    FinancePlanResponse,
    MetricBreakdown,
    FinancialHealthResponse,
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
