import pytest
from app.services.chroma_service import chroma_service
from app.services.rag_service import rag_service
from app.models.schemas import AdvisorAnalyzeRequest
from app.services.business_calculator import business_calculator, detect_business_domain

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

def test_handloom_location_selection_no_dairy_contamination():
    # User's default profile is Dairy Farming, but user asks about handloom shop locations
    req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
        userQuery="Suggest me places where if I establish my handloom shop I can get great profits",
    )
    res = rag_service.analyze_business_opportunity(req)
    assert res.reply is not None

    reply_lower = res.reply.lower()
    # Check that handloom clusters and factors are included
    assert "handloom" in reply_lower or "pembarti" in reply_lower or "jangaon" in reply_lower or "hanamkonda" in reply_lower
    # Strictly zero dairy contamination
    dairy_words = ["milch", "2-cow unit", "cow", "cows", "buffalo", "milk yield"]
    for dw in dairy_words:
        assert dw not in reply_lower, f"Found dairy contamination word '{dw}' in handloom location response!"

def test_multiturn_domain_switching_and_retention():
    # Turn 1: User asks about handloom shop
    turn1_req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
        userQuery="Suggest me places where if I establish my handloom shop I can get great profits",
    )
    turn1_res = rag_service.analyze_business_opportunity(turn1_req)

    # Turn 2: Follow up: "which localities can give me the best profits" (context must retain handloom!)
    history_turn2 = [
        {"role": "user", "content": "Suggest me places where if I establish my handloom shop I can get great profits"},
        {"role": "assistant", "content": turn1_res.reply},
    ]
    turn2_req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
        userQuery="which localities can give me the best profits",
        history=history_turn2,
    )
    turn2_res = rag_service.analyze_business_opportunity(turn2_req)
    assert turn2_res.reply is not None

    turn2_lower = turn2_res.reply.lower()
    assert "handloom" in turn2_lower or "pembarti" in turn2_lower or "jangaon" in turn2_lower or "hanamkonda" in turn2_lower or "cluster" in turn2_lower
    dairy_words = ["milch", "2-cow unit", "cows", "buffalo", "milk yield"]
    for dw in dairy_words:
        assert dw not in turn2_lower, f"Found dairy contamination word '{dw}' in follow-up query!"

def test_investment_decision_ac_for_dairy_farm():
    req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
        userQuery="Let's say I want to buy an air conditioner for my dairy farm. Is that a good investment with my financial history? Is it safe for me to buy an air conditioner? Is it profitable?",
    )
    res = rag_service.analyze_business_opportunity(req)
    assert res.reply is not None
    reply_lower = res.reply.lower()
    assert "air conditioner" in reply_lower or "ac" in reply_lower
    assert "shade net" in reply_lower or "fogger" in reply_lower or "misting" in reply_lower or "alternative" in reply_lower or "viable" in reply_lower

def test_capacity_calculation_handloom():
    req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Handloom & Powerloom Weaving",
        marginCapital=100000.0,
        language="en",
        userQuery="How many looms do I need to make ₹3 lakh profit annually?",
    )
    res = rag_service.analyze_business_opportunity(req)
    assert res.reply is not None
    reply_lower = res.reply.lower()
    assert "handloom" in reply_lower or "loom" in reply_lower or "saree" in reply_lower
    assert "cow" not in reply_lower and "milch" not in reply_lower

def test_retail_kirana_location_selection():
    req = AdvisorAnalyzeRequest(
        location="Warangal",
        category="Rural Grocery / Kirana",
        marginCapital=50000.0,
        language="en",
        userQuery="Where should I open my kirana shop to get good footfall?",
    )
    res = rag_service.analyze_business_opportunity(req)
    assert res.reply is not None
    reply_lower = res.reply.lower()
    assert "kirana" in reply_lower or "store" in reply_lower or "bus stand" in reply_lower or "panchayat" in reply_lower or "residential" in reply_lower
    assert "cow" not in reply_lower and "milch" not in reply_lower
