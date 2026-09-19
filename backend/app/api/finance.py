from fastapi import APIRouter, Depends
from app.auth import get_auth_context, AuthContext
from app.models.schemas import FinanceCalculateRequest, FinancePlanResponse, FinancialHealthResponse
from app.services.finance_service import calculate_finance_plan, calculate_financial_health
from app.services.firestore_service import firestore_service
from app.services.logbook_service import logbook_service

router = APIRouter(prefix="/finance", tags=["Finance Engine"])

@router.post("/calculate", response_model=FinancePlanResponse)
def calculate_plan(req: FinanceCalculateRequest):
    """
    100% Deterministic Financial Calculation Endpoint.
    Calculates Project Cost, Loan Amount, Scheme, EMI, and Amortization.
    """
    return calculate_finance_plan(req.marginCapital)

@router.get("", response_model=FinancePlanResponse)
def get_user_finance(auth: AuthContext = Depends(get_auth_context)):
    profile_data = firestore_service.get_user_profile(auth.user_id) or {}
    margin_capital = float(profile_data.get("marginCapital", 100000.0))
    return calculate_finance_plan(margin_capital)

@router.get("/health-score", response_model=FinancialHealthResponse)
def get_health_score(auth: AuthContext = Depends(get_auth_context)):
    entries = logbook_service.get_entries(auth.user_id)
    aggs = logbook_service.calculate_aggregates(entries)
    return calculate_financial_health(
        total_income=aggs["totalIncome"],
        total_expenses=aggs["totalExpenses"],
        entry_count=len(entries),
        has_downward_trend=aggs["netCashFlow"] < 15000 and aggs["totalIncome"] > 0,
    )
