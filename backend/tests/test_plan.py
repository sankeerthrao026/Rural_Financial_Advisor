import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import BusinessPlanRequest
from app.services.plan_service import (
    generate_unified_business_plan,
    generate_12_month_cash_flow,
    calculate_dscr_analysis,
    resolve_guarantee_details,
)

client = TestClient(app)

def test_12_month_cash_flow_structure():
    # Test cash flow generation with 3-month moratorium
    items = generate_12_month_cash_flow(
        project_cost=1000000.0,
        category="Dairy Farming",
        monthly_emi=18500.0,
        moratorium_months=3,
        base_revenue=200000.0,
        base_expense=116000.0,
    )
    assert len(items) == 12
    # First 3 months should have 0 debt service due to moratorium
    for m in items[:3]:
        assert m.debtService == 0.0
    # Month 4 onwards should charge monthly EMI
    for m in items[3:]:
        assert m.debtService == 18500.0
    # Closing cash balance should track cumulative flow
    assert items[-1].closingCashBalance > items[0].closingCashBalance

def test_dscr_mathematical_calculation():
    # DSCR = Annual NOI / Annual Debt Service
    # Hand-calculated case:
    # Monthly NOI = 30,000 * 12 = 360,000
    # Monthly EMI = 18,750 * 12 = 225,000
    # DSCR = 360,000 / 225,000 = 1.60
    items = generate_12_month_cash_flow(
        project_cost=500000.0,
        category="Dairy Farming",
        monthly_emi=18750.0,
        moratorium_months=0,
        base_revenue=50000.0,
        base_expense=20000.0,
    )
    dscr = calculate_dscr_analysis(items, monthly_emi=18750.0)
    assert dscr.dscrValue > 1.20
    assert dscr.isHealthy is True
    assert "DSCR" in dscr.interpretation
    assert "1.20x" in dscr.benchmark

def test_guarantee_details_resolution():
    # Test CGFMU for MUDRA
    mudra_g = resolve_guarantee_details("mudra-tarun", "MUDRA Tarun Loan")
    assert "CGFMU" in mudra_g.guaranteeAgency
    assert mudra_g.isCollateralFree is True
    assert mudra_g.coveragePercent == 100.0

    # Test CGTMSE for PM Vishwakarma
    vishwa_g = resolve_guarantee_details("pm-vishwakarma", "PM Vishwakarma Scheme")
    assert "CGTMSE" in vishwa_g.guaranteeAgency
    assert vishwa_g.isCollateralFree is True

    # Test CGSUI for Stand-Up India
    standup_g = resolve_guarantee_details("stand-up-india", "Stand-Up India Scheme")
    assert "CGSUI" in standup_g.guaranteeAgency
    assert standup_g.isCollateralFree is True

    # Test CGTMSE for PMEGP
    pmegp_g = resolve_guarantee_details("pmegp", "Prime Minister Employment Generation Programme")
    assert "CGTMSE" in pmegp_g.guaranteeAgency
    assert pmegp_g.isCollateralFree is True

def test_generate_unified_business_plan_service():
    req = BusinessPlanRequest(
        entrepreneurName="Anita Sharma",
        businessName="Sharma Dairy Farm",
        location="Warangal, Telangana",
        category="Dairy Farming",
        gender="female",
        socialCategory="OBC",
        marginCapital=100000.0,
        loanAmount=900000.0,
        projectCost=1000000.0,
    )
    plan = generate_unified_business_plan(req)
    assert plan.enterpriseName == "Sharma Dairy Farm"
    assert plan.entrepreneurName == "Anita Sharma"
    assert plan.totalProjectCost == 1000000.0
    assert plan.promoterMargin > 0
    assert plan.requestedLoanAmount > 0
    assert len(plan.capitalAllocations) == 3
    assert len(plan.cashFlowForecast) == 12
    assert plan.dscr.dscrValue > 0
    assert plan.guaranteeInfo.isCollateralFree is True
    assert len(plan.documentChecklist) >= 5
    assert len(plan.riskMitigations) >= 3

def test_plan_api_endpoint():
    response = client.post(
        "/api/plan/generate",
        json={
            "entrepreneurName": "Laxmi Bai",
            "businessName": "Laxmi Handlooms",
            "location": "Pochampally, Telangana",
            "category": "Handloom / Weaving",
            "gender": "female",
            "socialCategory": "OBC",
            "marginCapital": 50000.0,
            "projectCost": 500000.0,
            "loanAmount": 450000.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["enterpriseName"] == "Laxmi Handlooms"
    assert data["category"] == "Handloom / Weaving"
    assert len(data["cashFlowForecast"]) == 12
    assert "dscr" in data
    assert data["dscr"]["dscrValue"] > 0
    assert data["guaranteeInfo"]["isCollateralFree"] is True
    assert "capitalAllocations" in data
    assert len(data["documentChecklist"]) >= 5
