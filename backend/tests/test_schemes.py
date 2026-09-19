import pytest
from app.models.schemas import SchemeEligibilityInput
from app.services.schemes_calculator import (
    calculate_mudra,
    calculate_pm_vishwakarma,
    calculate_stand_up_india,
    calculate_pmegp,
    calculate_nbcfdc,
    calculate_all_eligible_schemes,
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_mudra_shishu_small_loan():
    """
    For a small loan request (₹30,000):
    - Must select MUDRA Shishu tier.
    - Sanctioned: ₹30,000.
    - Max eligible: ₹50,000.
    - Promoter contribution: ₹0 (0% margin).
    - Collateral free with CGFMU guarantee.
    - Nominal interest rate (8.5%).
    """
    inp = SchemeEligibilityInput(
        loanAmount=30000.0,
        category="Rural Grocery / Kirana",
        gender="male",
        socialCategory="General",
        locationType="rural",
    )
    result = calculate_mudra(inp)
    assert result.schemeId == "mudra-shishu"
    assert result.sanctionedLoanAmount == 30000.0
    assert result.maxEligibleLoan == 50000.0
    assert result.promoterContribution == 0.0
    assert result.promoterContributionPercent == 0.0
    assert result.interestRateAnnual == 8.5
    assert result.collateralFree is True
    assert "CGFMU" in result.guaranteeCoverage
    assert result.monthlyEmi > 0
    assert result.quarterlyEmi > 0


def test_mudra_tarun_large_loan():
    """
    For a larger loan request (₹8,00,000):
    - Must automatically choose MUDRA Tarun (not Shishu or Kishore).
    - Sanctioned: ₹8,00,000.
    - Max eligible: ₹10,00,000.
    - Margin: 15%.
    - Collateral free with CGFMU guarantee.
    """
    inp = SchemeEligibilityInput(
        loanAmount=800000.0,
        category="Automobile Repair Workshop",
        gender="male",
        socialCategory="General",
        locationType="rural",
    )
    result = calculate_mudra(inp)
    assert result.schemeId == "mudra-tarun"
    assert result.schemeId not in ("mudra-shishu", "mudra-kishore")
    assert result.sanctionedLoanAmount == 800000.0
    assert result.maxEligibleLoan == 1000000.0
    assert result.promoterContributionPercent == 15.0
    assert result.promoterContribution > 0
    assert result.collateralFree is True
    assert "CGFMU" in result.guaranteeCoverage


def test_pm_vishwakarma_artisan_weaver():
    """
    For a weaver/artisan profile (₹1,00,000):
    - Confirm PM Vishwakarma appears as an eligible option.
    - Concessional interest rate: exactly 5.0% p.a.
    - 8% interest subvention provided by MoMSME.
    - CGTMSE credit guarantee fee 100% covered.
    - ₹15,000 toolkit voucher benefit mentioned.
    """
    inp = SchemeEligibilityInput(
        loanAmount=100000.0,
        category="Handloom / Weaving",
        gender="female",
        socialCategory="OBC",
        locationType="rural",
    )
    result = calculate_pm_vishwakarma(inp)
    assert result.isEligible is True
    assert result.schemeId == "pm-vishwakarma"
    assert result.sanctionedLoanAmount == 100000.0
    assert result.interestRateAnnual == 5.0
    assert result.subsidyPercent == 8.0  # 8% subvention
    assert result.tenureMonths == 18     # Tranche 1 is 18 months
    assert result.collateralFree is True
    assert "CGTMSE" in result.guaranteeCoverage


def test_stand_up_india_woman_entrepreneur_large_loan():
    """
    For a woman entrepreneur requesting ₹15 Lakh:
    - Confirm Stand-Up India appears as an option.
    - Minimum loan ₹10 Lakh, maximum ₹1 Crore.
    - 15% margin money.
    - 7 years tenure with moratorium up to 18 months.
    - CGSUI sovereign credit guarantee.
    """
    inp = SchemeEligibilityInput(
        loanAmount=1500000.0,
        category="Dairy Farming & Chilling Unit",
        gender="female",
        socialCategory="General",
        locationType="rural",
    )
    result = calculate_stand_up_india(inp)
    assert result.isEligible is True
    assert result.schemeId == "stand-up-india"
    assert result.sanctionedLoanAmount == 1500000.0
    assert result.maxEligibleLoan == 10000000.0  # ₹1 Crore
    assert result.promoterContributionPercent == 15.0
    assert result.tenureYears == 7.0
    assert result.moratoriumMonths >= 12
    assert "CGSUI" in result.guaranteeCoverage

    # Non-woman General male is NOT eligible for Stand-Up India branch mandate
    male_general = SchemeEligibilityInput(
        loanAmount=1500000.0,
        category="Dairy Farming",
        gender="male",
        socialCategory="General",
        locationType="rural",
    )
    male_res = calculate_stand_up_india(male_general)
    assert male_res.isEligible is False
    assert male_res.ineligibilityReason is not None


def test_pmegp_subsidy_general_vs_special():
    """
    For new micro-enterprise profiles, confirm PMEGP subsidy numbers differ correctly:
    - General Category (Rural): 25% subsidy, 10% own promoter contribution.
    - Special Category (Women / SC / ST / OBC Rural): 35% subsidy, 5% own promoter contribution.
    """
    # 1. Special Category (Woman in Rural)
    special_inp = SchemeEligibilityInput(
        loanAmount=500000.0,
        category="Garment Manufacturing / Tailoring",
        gender="female",
        socialCategory="OBC",
        locationType="rural",
    )
    special_res = calculate_pmegp(special_inp)
    assert special_res.isEligible is True
    assert special_res.subsidyPercent == 35.0
    assert special_res.promoterContributionPercent == 5.0
    assert special_res.subsidyAmount > 0

    # 2. General Category (Male in Rural)
    general_inp = SchemeEligibilityInput(
        loanAmount=500000.0,
        category="Garment Manufacturing / Tailoring",
        gender="male",
        socialCategory="General",
        locationType="rural",
    )
    general_res = calculate_pmegp(general_inp)
    assert general_res.isEligible is True
    assert general_res.subsidyPercent == 25.0
    assert general_res.promoterContributionPercent == 10.0
    # Special subsidy is strictly greater than general subsidy
    assert special_res.subsidyPercent > general_res.subsidyPercent
    assert special_res.promoterContributionPercent < general_res.promoterContributionPercent


def test_calculate_all_eligible_schemes_ranking():
    """
    Evaluates master comparison across all 5 schemes:
    MUDRA, PM Vishwakarma, Stand-Up India, PMEGP, NBCFDC.
    """
    # Case: Artisan Weaver
    artisan_inp = SchemeEligibilityInput(
        loanAmount=80000.0,
        category="Handloom / Weaving",
        gender="female",
        socialCategory="OBC",
        locationType="rural",
    )
    schemes = calculate_all_eligible_schemes(artisan_inp)
    assert len(schemes) == 5
    # PM Vishwakarma should be top match for artisan under ₹3L
    assert schemes[0].schemeId == "pm-vishwakarma"
    assert schemes[0].isTopMatch is True


def test_api_schemes_calculate():
    """
    FastAPI endpoint integration test for /api/finance/schemes/calculate.
    """
    res = client.post(
        "/api/finance/schemes/calculate",
        json={
            "loanAmount": 40000.0,
            "category": "Rural Grocery / Kirana",
            "gender": "female",
            "socialCategory": "General",
            "locationType": "rural",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 5
    # For 40,000, MUDRA Shishu must be top match
    assert data[0]["schemeId"] == "mudra-shishu"
    assert data[0]["isTopMatch"] is True
    assert data[0]["maxEligibleLoan"] == 50000.0
