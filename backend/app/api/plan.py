from fastapi import APIRouter
from app.models.schemas import BusinessPlanRequest, BusinessPlanResponse
from app.services.plan_service import generate_unified_business_plan

router = APIRouter(prefix="/plan", tags=["Business Plan Synthesis"])

@router.post("/generate", response_model=BusinessPlanResponse)
def generate_plan(req: BusinessPlanRequest):
    """
    Synthesizes a unified, lender-ready Business Plan & Credit Appraisal Memorandum.
    Combines:
      - Entrepreneur Profile & Location
      - Grounded Market Intelligence
      - Deterministic Scheme Financing (MUDRA, PM Vishwakarma, Stand-Up India, PMEGP, NBCFDC)
      - 12-Month Projected Cash Flow Forecast
      - Debt Service Coverage Ratio (DSCR) & Plain-Language Banking Evaluation
      - Sovereign Collateral-Free Guarantee Details (CGFMU, CGTMSE, CGSUI)
      - Bank Appraisal Checklist & Mandatory Documentation
    """
    return generate_unified_business_plan(req)
