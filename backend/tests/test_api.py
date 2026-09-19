from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["chromadb_connected"] is True

def test_calculate_finance_api():
    response = client.post(
        "/api/finance/calculate",
        json={"marginCapital": 10000},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["projectCost"] == 100000
    assert data["loanAmount"] == 90000
    assert data["scheme"]["id"] == "micro-finance"

def test_risk_analyze_api():
    response = client.post(
        "/api/risk/analyze",
        json={
            "hasActiveLoan": True,
            "simulatingSecondLoan": True,
            "totalIncome": 20000,
            "totalExpenses": 10000,
            "netCashFlow": 10000,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["isSafe"] is False
    assert any(r["ruleCode"] == "RULE_1" for r in data["detectedRisks"])

def test_dashboard_api():
    response = client.get("/api/dashboard", headers={"x-user-id": "demo-anita"})
    assert response.status_code == 200
    data = response.json()
    assert "totalIncome" in data
    assert "netCashFlow" in data
    assert "healthScore" in data
    assert "finance" in data
    assert len(data["cashFlowTrend"]) > 0

def test_logbook_api():
    # 1. Fetch entries
    res = client.get("/api/logbook", headers={"x-user-id": "test-user-isolation-a"})
    assert res.status_code == 200
    initial_count = len(res.json())

    # 2. Add entry for User A
    create_res = client.post(
        "/api/logbook",
        headers={"x-user-id": "test-user-isolation-a"},
        json={
            "date": "19 Sep 2026",
            "amount": 5500,
            "type": "income",
            "category": "Sales",
            "note": "Bulk direct sale",
        },
    )
    assert create_res.status_code == 200
    entry_id = create_res.json()["id"]

    # 3. Verify User A sees entry
    res_a = client.get("/api/logbook", headers={"x-user-id": "test-user-isolation-a"})
    assert len(res_a.json()) == initial_count + 1

    # 4. Verify User B does NOT see User A's entry (User isolation!)
    res_b = client.get("/api/logbook", headers={"x-user-id": "test-user-isolation-b"})
    user_b_ids = [e["id"] for e in res_b.json()]
    assert entry_id not in user_b_ids
