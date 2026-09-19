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
    assert analysis.pricingSuggestion.recommendedBand != ""
    assert len(analysis.sourcesUsed) > 0

def test_interactive_conversation_rag():
    # Turn 1: Initial question
    turn1_req = AdvisorAnalyzeRequest(
        location="Warangal, Telangana",
        category="Dairy Farming",
        marginCapital=150000.0,
        language="en",
    )
    turn1_res = rag_service.analyze_business_opportunity(turn1_req)
    assert turn1_res.reply is not None
    assert "Warangal" in turn1_res.groundedFacts.district or "Warangal" in turn1_res.reply

    # Turn 2: Follow-up question about expanding to neighboring village
    history_turn2 = [
        {"role": "user", "content": "How viable is dairy farming in Warangal?"},
        {"role": "assistant", "content": turn1_res.reply},
    ]
    turn2_req = AdvisorAnalyzeRequest(
        location="Warangal, Telangana",
        category="Dairy Farming",
        marginCapital=150000.0,
        language="en",
        userQuery="What if I expand to the next village?",
        history=history_turn2,
    )
    turn2_res = rag_service.analyze_business_opportunity(turn2_req)
    assert turn2_res.reply is not None
    # Reply should address expansion and reference Warangal
    assert "expand" in turn2_res.reply.lower() or "village" in turn2_res.reply.lower() or "25%" in turn2_res.reply

    # Turn 3: Follow-up question about feed suppliers
    history_turn3 = [
        *history_turn2,
        {"role": "user", "content": "What if I expand to the next village?"},
        {"role": "assistant", "content": turn2_res.reply},
    ]
    turn3_req = AdvisorAnalyzeRequest(
        location="Warangal, Telangana",
        category="Dairy Farming",
        marginCapital=150000.0,
        language="en",
        userQuery="Where can I buy feed cheaper?",
        history=history_turn3,
    )
    turn3_res = rag_service.analyze_business_opportunity(turn3_req)
    assert turn3_res.reply is not None
    assert "feed" in turn3_res.reply.lower() or "apmc" in turn3_res.reply.lower() or "mandi" in turn3_res.reply.lower()

