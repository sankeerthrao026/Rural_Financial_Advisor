import pytest
from app.services.finance_service import calculate_finance_plan, calculate_financial_health

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
