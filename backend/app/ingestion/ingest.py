import json
import os
from pathlib import Path
from app.config import settings
from app.services.chroma_service import chroma_service

def load_json(file_path: Path):
    if not file_path.exists():
        print(f"[WARN] File not found: {file_path}")
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def ingest_all_datasets():
    """
    Repeatable Document Ingestion Pipeline for RuralCred:
      1. Reads approved local datasets (market-data, population-data, schemes).
      2. Normalizes into rich contextual chunks.
      3. Embeds and stores into ChromaDB vector store with metadata.
    """
    data_dir = settings.DATA_DIR
    print(f"Ingesting datasets from: {data_dir.resolve()}")

    documents = []
    metadatas = []
    ids = []

    # 1. Ingest Market Category Benchmarks
    market_file = data_dir / "market-data.json"
    market_data = load_json(market_file)
    if market_data and "categories" in market_data:
        for cat_key, cat_val in market_data["categories"].items():
            doc_id = f"cat_{cat_key}"
            costs_str = ", ".join([f"{c['item']}: {c['percentageOfOpex']}%" for c in cat_val.get("typicalCosts", [])])
            risks_str = "; ".join(cat_val.get("keyRisks", []))
            actions_str = "; ".join(cat_val.get("recommendedActions", []))

            content = f"""
Category: {cat_val.get('name')} (Key: {cat_key})
Benchmark Project Cost: Typical ₹{cat_val.get('benchmarkProjectCost', {}).get('typical', 0):,}, Min ₹{cat_val.get('benchmarkProjectCost', {}).get('min', 0):,}, Max ₹{cat_val.get('benchmarkProjectCost', {}).get('max', 0):,}
Expected Profit Margin: {cat_val.get('marginRange')}
Average Daily Production/Volume: {cat_val.get('averageDailyVolume')}
Pricing Benchmarks: {json.dumps(cat_val.get('pricingBenchmarks', {}), ensure_ascii=False)}
Seasonality: {cat_val.get('demandSeasonality')}
Local Competitor Density: {cat_val.get('competitorDensity')}
Typical Operational Costs (OPEX): {costs_str}
Locality Operating Risks: {risks_str}
Prudent Action Steps: {actions_str}
""".strip()

            documents.append(content)
            metadatas.append({
                "type": "market_benchmark",
                "category": cat_key,
                "name": cat_val.get("name", cat_key),
                "margin": cat_val.get("marginRange", ""),
            })
            ids.append(doc_id)

    # 2. Ingest District Population & Mandi Demographics
    pop_file = data_dir / "population-data.json"
    pop_data = load_json(pop_file)
    if pop_data and "districts" in pop_data:
        for dist_key, dist_val in pop_data["districts"].items():
            doc_id = f"dist_{dist_key}"
            crops_str = ", ".join(dist_val.get("majorCrops", []))
            hubs_str = ", ".join(dist_val.get("commercialHubs", []))

            content = f"""
District: {dist_val.get('name')} (Key: {dist_key})
State: {dist_val.get('state')}
Total Rural Households: {dist_val.get('totalRuralHouseholds'):,}
Average Village Population: {dist_val.get('averageVillagePopulation'):,}
Major Crops & Agriculture Base: {crops_str}
Dairy / Rural Cooperative Presence: {dist_val.get('dairyCooperativePresence')}
Average Monthly Rural Household Income: ₹{dist_val.get('averageMonthlyRuralIncome', 0):,}
Commercial Centers & Mandi Hubs: {hubs_str}
Banking & Credit Access: {dist_val.get('bankingOutlets')}
""".strip()

            documents.append(content)
            metadatas.append({
                "type": "district_demographics",
                "district": dist_key,
                "name": dist_val.get("name", dist_key),
                "state": dist_val.get("state", ""),
            })
            ids.append(doc_id)

    # 3. Ingest Government Schemes
    scheme_file = data_dir / "schemes.json"
    scheme_data = load_json(scheme_file)
    if scheme_data and "schemes" in scheme_data:
        for scheme in scheme_data["schemes"]:
            doc_id = f"scheme_{scheme.get('id')}"
            content = f"""
Scheme Name: {scheme.get('name')}
Agency: {scheme.get('agency')}
Max Project Outlay: ₹{scheme.get('maxProjectCost', 0):,}
Statutory Subsidized Interest Rate: {scheme.get('interestRate')}% per annum
Tenure: {scheme.get('tenureYears')} Years
Moratorium Grace Period: {scheme.get('moratoriumMonths')} Months
Repayment Frequency: {scheme.get('repaymentFrequency')}
Eligibility Criteria: {scheme.get('eligibility')}
Security / Guarantee Requirements: {scheme.get('security')}
Scheme Overview: {scheme.get('description')}
""".strip()

            documents.append(content)
            metadatas.append({
                "type": "government_scheme",
                "scheme_id": scheme.get("id"),
                "name": scheme.get("name"),
                "rate": float(scheme.get("interestRate", 0)),
            })
            ids.append(doc_id)

    print(f"Total documents prepared for ChromaDB: {len(documents)}")
    chroma_service.add_documents(documents=documents, metadatas=metadatas, ids=ids)
    print(f"Ingestion complete! Total documents now in ChromaDB: {chroma_service.get_count()}")

if __name__ == "__main__":
    ingest_all_datasets()
