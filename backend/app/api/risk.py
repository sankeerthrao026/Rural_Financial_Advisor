from fastapi import APIRouter
from app.models.schemas import RiskAnalysisRequest, RiskAnalysisResponse
from app.services.risk_service import evaluate_financial_risks

router = APIRouter(prefix="/risk", tags=["Risk Engine"])

@router.post("/analyze", response_model=RiskAnalysisResponse)
def analyze_risk(req: RiskAnalysisRequest):
    """
    Deterministic Risk Invariant Rules:
      Rule 1: Active loan + 2nd loan request
      Rule 2: Negative cash flow
      Rule 3: Downward profit trend
    """
    return evaluate_financial_risks(
        has_active_loan=req.hasActiveLoan,
        simulating_second_loan=req.simulatingSecondLoan,
        total_income=req.totalIncome,
        total_expenses=req.totalExpenses,
        net_cash_flow=req.netCashFlow,
        previous_net_cash_flow=req.previousNetCashFlow,
    )
