from typing import Optional
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
def get_health_score(
    totalIncome: Optional[float] = None,
    totalExpenses: Optional[float] = None,
    entryCount: Optional[int] = None,
    hasDownwardTrend: Optional[bool] = None,
    auth: AuthContext = Depends(get_auth_context)
):
    if totalIncome is not None and totalExpenses is not None:
        inc = float(totalIncome)
        exp = float(totalExpenses)
        count = int(entryCount) if entryCount is not None else 6
        downward = bool(hasDownwardTrend) if hasDownwardTrend is not None else (inc - exp < 15000 and inc > 0)
    else:
        entries = logbook_service.get_entries(auth.user_id)
        aggs = logbook_service.calculate_aggregates(entries)
        inc = aggs["totalIncome"]
        exp = aggs["totalExpenses"]
        count = len(entries)
        downward = aggs["netCashFlow"] < 15000 and aggs["totalIncome"] > 0

    return calculate_financial_health(
        total_income=inc,
        total_expenses=exp,
        entry_count=count,
        has_downward_trend=downward,
    )
