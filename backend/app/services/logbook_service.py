import time
import uuid
from typing import List, Dict, Any
from app.models.schemas import LogbookEntry, LogbookCreate, LogbookUpdate
from app.services.firestore_service import firestore_service

INITIAL_DEMO_ENTRIES = [
    {
        "id": "demo-1",
        "date": "18 Sep 2026",
        "amount": 18400.0,
        "type": "income",
        "category": "Sales",
        "note": "Cooperative bulk milk supply (320 L)",
        "timestamp": int(time.time() * 1000) - 86400000 * 1,
    },
    {
        "id": "demo-2",
        "date": "16 Sep 2026",
        "amount": 6250.0,
        "type": "expense",
        "category": "Supplies",
        "note": "Cattle feed pellets & mineral mix (5 bags)",
        "timestamp": int(time.time() * 1000) - 86400000 * 3,
    },
    {
        "id": "demo-3",
        "date": "15 Sep 2026",
        "amount": 12800.0,
        "type": "income",
        "category": "Sales",
        "note": "Retail morning milk delivery to village households",
        "timestamp": int(time.time() * 1000) - 86400000 * 4,
    },
    {
        "id": "demo-4",
        "date": "12 Sep 2026",
        "amount": 1950.0,
        "type": "expense",
        "category": "Healthcare",
        "note": "Veterinary doctor visit & annual vaccinations",
        "timestamp": int(time.time() * 1000) - 86400000 * 7,
    },
    {
        "id": "demo-5",
        "date": "08 Sep 2026",
        "amount": 14500.0,
        "type": "income",
        "category": "Sales",
        "note": "Weekly cooperative milk payout",
        "timestamp": int(time.time() * 1000) - 86400000 * 11,
    },
    {
        "id": "demo-6",
        "date": "04 Sep 2026",
        "amount": 4500.0,
        "type": "expense",
        "category": "Fodder",
        "note": "Green fodder tractor load from neighboring farm",
        "timestamp": int(time.time() * 1000) - 86400000 * 15,
    },
]

class LogbookService:
    def get_entries(self, user_id: str) -> List[LogbookEntry]:
        raw_entries = firestore_service.get_user_logbook(user_id)
        if not raw_entries and ("anita" in user_id.lower() or user_id == "demo-user"):
            # Seed default demo entries for Anita Sharma evaluation persona
            for item in INITIAL_DEMO_ENTRIES:
                firestore_service.save_user_logbook_entry(user_id, item)
            raw_entries = INITIAL_DEMO_ENTRIES

        return [LogbookEntry(**e) for e in raw_entries]

    def add_entry(self, user_id: str, entry_data: LogbookCreate) -> LogbookEntry:
        new_id = f"entry-{int(time.time())}-{str(uuid.uuid4())[:6]}"
        entry_dict = {
            "id": new_id,
            "date": entry_data.date,
            "amount": float(entry_data.amount),
            "type": entry_data.type,
            "category": entry_data.category,
            "note": entry_data.note,
            "tags": entry_data.tags or [],
            "timestamp": int(time.time() * 1000),
        }
        saved = firestore_service.save_user_logbook_entry(user_id, entry_dict)
        return LogbookEntry(**saved)

    def update_entry(self, user_id: str, entry_id: str, updates: LogbookUpdate) -> LogbookEntry:
        existing = self.get_entries(user_id)
        target = None
        for e in existing:
            if e.id == entry_id:
                target = e
                break

        if target:
            target_dict = target.model_dump()
            for k, v in updates.model_dump(exclude_unset=True).items():
                if v is not None:
                    target_dict[k] = v
        else:
            target_dict = {
                "id": entry_id,
                "date": updates.date or "2026-09-20",
                "amount": float(updates.amount or 1000.0),
                "type": updates.type or "income",
                "category": updates.category or "Sales",
                "note": updates.note or "",
                "tags": updates.tags or [],
                "timestamp": int(time.time() * 1000),
            }

        saved = firestore_service.save_user_logbook_entry(user_id, target_dict)
        return LogbookEntry(**saved)

    def delete_entry(self, user_id: str, entry_id: str):
        firestore_service.delete_user_logbook_entry(user_id, entry_id)

    def calculate_aggregates(self, entries: List[LogbookEntry]) -> Dict[str, Any]:
        total_income = sum(e.amount for e in entries if e.type == "income")
        total_expenses = sum(e.amount for e in entries if e.type == "expense")
        net_cash_flow = total_income - total_expenses
        expense_ratio = (total_expenses / total_income) if total_income > 0 else 0.0

        return {
            "totalIncome": total_income,
            "totalExpenses": total_expenses,
            "netCashFlow": net_cash_flow,
            "expenseRatio": round(expense_ratio, 3),
        }

logbook_service = LogbookService()
