import time
import pytest
from app.services.chroma_service import chroma_service
from app.services.rag_service import rag_service
from app.models.schemas import AdvisorAnalyzeRequest

def test_metadata_benchmark_instant_lookups():
    """Verify 0ms in-memory lookups for category and district benchmarks."""
    t0 = time.perf_counter()
    cat_item = chroma_service.get_category_benchmark("Dairy Farming")
    t_cat = (time.perf_counter() - t0) * 1000
    assert cat_item is not None
    assert "Dairy Farming" in cat_item["document"]
    assert t_cat < 2.0  # Must be fast in-memory (< 2ms)

    t0 = time.perf_counter()
    dist_item = chroma_service.get_district_demographics("Warangal, Telangana")
    t_dist = (time.perf_counter() - t0) * 1000
    assert dist_item is not None
    assert "Warangal" in dist_item["document"]
    assert t_dist < 2.0

def test_query_embedding_reuse():
    """Verify query embeddings are cached and reused on subsequent requests."""
    q = "how to reduce raw material cost for rural enterprises"
    emb1 = chroma_service.get_or_compute_embedding(q)
    assert emb1 is not None and len(emb1) > 0

    # Second call should be instant cache hit
    t0 = time.perf_counter()
    emb2 = chroma_service.get_or_compute_embedding(q)
    t_hit = (time.perf_counter() - t0) * 1000
    assert emb2 == emb1
    assert t_hit < 0.5

def test_all_10_real_world_rag_queries():
    """Tests all 10 query archetypes requested in the performance optimization spec."""
    scenarios = [
        # 1. Local raw-material question
        {
            "label": "Local raw-material",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "Where can I buy feed and raw materials cheaper?",
            "lang": "en",
            "expected_keywords": ["feed", "apmc", "mandi", "pacs"],
        },
        # 2. Government scheme question
        {
            "label": "Government scheme",
            "loc": "Nalgonda, Telangana",
            "cat": "Handloom / Weaving",
            "query": "What government subsidies or loans are available?",
            "lang": "en",
            "expected_keywords": ["pmegp", "mudra", "subsidy", "scheme"],
        },
        # 3. Business expansion question
        {
            "label": "Business expansion",
            "loc": "Karimnagar, Telangana",
            "cat": "Rural Grocery / Kirana",
            "query": "What if I expand to the next village cluster?",
            "lang": "en",
            "expected_keywords": ["expand", "village", "radius", "b2b"],
        },
        # 4. Financial question
        {
            "label": "Financial question",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "How much loan can I get for 1,00,000 margin capital?",
            "lang": "en",
            "expected_keywords": ["loan", "outlay", "project", "margin"],
        },
        # 5. Seasonal question
        {
            "label": "Seasonal question",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "How to maintain milk yield during summer heat?",
            "lang": "en",
            "expected_keywords": ["summer", "heat", "temperature", "water"],
        },
        # 6. Follow-up question
        {
            "label": "Follow-up question",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "What about the neighboring village?",
            "lang": "en",
            "history": [
                {"role": "user", "content": "How can I increase milk production in Warangal?"},
                {"role": "assistant", "content": "Maintain clean sheds and proper feed rations."},
            ],
            "expected_keywords": ["village", "expand", "reach", "demand"],
        },
        # 7. Same question repeated (Cache Hit Test)
        {
            "label": "Repeated same question",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "Where can I buy feed and raw materials cheaper?",
            "lang": "en",
            "expected_keywords": ["feed", "apmc", "mandi"],
        },
        # 8. Different business with same question
        {
            "label": "Different business same question",
            "loc": "Nalgonda, Telangana",
            "cat": "Handloom / Weaving",
            "query": "Where can I buy feed and raw materials cheaper?",
            "lang": "en",
            "expected_keywords": ["nalgonda", "handloom", "material", "raw"],
        },
        # 9. Different district with same question
        {
            "label": "Different district same question",
            "loc": "Karimnagar, Telangana",
            "cat": "Dairy Farming",
            "query": "Where can I buy feed and raw materials cheaper?",
            "lang": "en",
            "expected_keywords": ["karimnagar", "feed", "mandi"],
        },
        # 10. Telugu query
        {
            "label": "Telugu query",
            "loc": "Warangal, Telangana",
            "cat": "Dairy Farming",
            "query": "దాణా ఖర్చులు తగ్గించుకోవడానికి మార్గాలు ఏమిటి?",
            "lang": "te",
            "expected_keywords": ["దాణా", "ఖర్చు", "వరంగల్", "apmc"],
        },
    ]

    for sc in scenarios:
        req = AdvisorAnalyzeRequest(
            location=sc["loc"],
            category=sc["cat"],
            marginCapital=100000.0,
            language=sc["lang"],
            userQuery=sc["query"],
            history=sc.get("history"),
        )
        res = rag_service.analyze_business_opportunity(req)
        assert res is not None
        assert res.reply is not None and len(res.reply) > 0
        assert res.marketReach.headline != ""
        assert len(res.sourcesUsed) > 0

        # Verify query-specific or domain-appropriate response content
        reply_lower = res.reply.lower()
        has_matching_keyword = any(kw.lower() in reply_lower for kw in sc["expected_keywords"])
        assert has_matching_keyword, f"Failed keyword check for scenario '{sc['label']}'. Reply: {res.reply}"

def test_cache_isolation_across_profiles():
    """Verify that different users/profiles do not receive cached data from each other."""
    req1 = AdvisorAnalyzeRequest(
        location="Warangal, Telangana",
        category="Dairy Farming",
        marginCapital=100000.0,
        language="en",
        userQuery="Where can I buy raw materials cheaper?",
    )
    res1 = rag_service.analyze_business_opportunity(req1)
    assert "Warangal" in res1.groundedFacts.district or "Warangal" in res1.reply

    req2 = AdvisorAnalyzeRequest(
        location="Nalgonda, Telangana",
        category="Handloom / Weaving",
        marginCapital=30000.0,
        language="en",
        userQuery="Where can I buy raw materials cheaper?",
    )
    res2 = rag_service.analyze_business_opportunity(req2)
    assert "Nalgonda" in res2.groundedFacts.district or "Nalgonda" in res2.reply
    assert res1.groundedFacts.district != res2.groundedFacts.district
    assert res1.groundedFacts.category != res2.groundedFacts.category
