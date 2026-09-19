import pytest
from app.services.chroma_service import chroma_service
from app.services.rag_service import rag_service
from app.models.schemas import AdvisorAnalyzeRequest

def test_chroma_semantic_retrieval():
    assert chroma_service.get_count() > 0
    results = chroma_service.query_similar("dairy farming Warangal milk yield", n_results=2)
    assert len(results) > 0
    match_ids = [r["id"] for r in results]
    assert any("dairy" in mid or "warangal" in mid for mid in match_ids)

def test_rag_pipeline_execution():
    req = AdvisorAnalyzeRequest(
        location="Warangal, Telangana",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
    )
    analysis = rag_service.analyze_business_opportunity(req)
    assert analysis.marketReach.headline != ""
    assert len(analysis.opportunityAnalysis.primaryDrivers) > 0
    assert len(analysis.swot.strengths) > 0
    assert len(analysis.swot.weaknesses) > 0
    assert len(analysis.swot.threats) > 0
    assert analysis.pricingSuggestion.recommendedBand != ""
    assert len(analysis.sourcesUsed) > 0
