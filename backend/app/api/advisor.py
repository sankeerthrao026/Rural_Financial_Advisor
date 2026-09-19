from fastapi import APIRouter
from app.models.schemas import AdvisorAnalyzeRequest, AdvisorAnalyzeResponse
from app.services.rag_service import rag_service

router = APIRouter(prefix="/advisor", tags=["Business Advisor RAG"])

@router.post("/analyze", response_model=AdvisorAnalyzeResponse)
def analyze_business(req: AdvisorAnalyzeRequest):
    """
    RAG-Powered Hyper-Local Business Advisory:
      ChromaDB Retrieval -> Gemini Grounded Generation -> Structured Advice
    """
    return rag_service.analyze_business_opportunity(req)
