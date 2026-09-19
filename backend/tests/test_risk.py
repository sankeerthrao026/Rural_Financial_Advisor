import pytest
from app.services.risk_service import evaluate_financial_risks

def test_risk_rule_1_over_leverage():
    # Active loan + simulating 2nd loan
    res = evaluate_financial_risks(
        has_active_loan=True,
        simulating_second_loan=True,
        total_income=40000.0,
        total_expenses=20000.0,
        net_cash_flow=20000.0,
    )
    assert not res.isSafe
    assert res.activeCount >= 1
    rule_codes = [r.ruleCode for r in res.detectedRisks]
    assert "RULE_1" in rule_codes

def test_risk_rule_2_negative_cash_flow():
    # Expenses exceed income
    res = evaluate_financial_risks(
        has_active_loan=False,
        simulating_second_loan=False,
        total_income=15000.0,
        total_expenses=32000.0,
        net_cash_flow=-17000.0,
    )
    assert not res.isSafe
    rule_codes = [r.ruleCode for r in res.detectedRisks]
    assert "RULE_2" in rule_codes

def test_risk_rule_3_downward_trend():
    # Drop from 50,000 to 15,000 (70% drop)
    res = evaluate_financial_risks(
        has_active_loan=False,
        simulating_second_loan=False,
        total_income=30000.0,
        total_expenses=15000.0,
        net_cash_flow=15000.0,
        previous_net_cash_flow=50000.0,
    )
    rule_codes = [r.ruleCode for r in res.detectedRisks]
    assert "RULE_3" in rule_codes

def test_risk_all_safe():
    # Healthy standing: no debt conflict, net positive, steady
    res = evaluate_financial_risks(
        has_active_loan=False,
        simulating_second_loan=False,
        total_income=45000.0,
        total_expenses=18000.0,
        net_cash_flow=27000.0,
        previous_net_cash_flow=25000.0,
    )
    assert res.isSafe
    assert len(res.detectedRisks) == 0
