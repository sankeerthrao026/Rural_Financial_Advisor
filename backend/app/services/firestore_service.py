import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from app.config import settings

LOCAL_STORE_DIR = Path(settings.CHROMA_PERSIST_DIR).parent / "local_store"
LOCAL_STORE_DIR.mkdir(parents=True, exist_ok=True)

class FirestoreService:
    def __init__(self):
        self.firebase_initialized = False
        self.db = None
        self._init_firebase()

    def _init_firebase(self):
        try:
            if settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL and settings.FIREBASE_PRIVATE_KEY:
                import firebase_admin
                from firebase_admin import credentials, firestore

                cred = credentials.Certificate({
                    "project_id": settings.FIREBASE_PROJECT_ID,
                    "client_email": settings.FIREBASE_CLIENT_EMAIL,
                    "private_key": settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
                })
                if not firebase_admin._apps:
                    firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                self.firebase_initialized = True
        except Exception as e:
            # Resilient fallback to user-isolated persistent local JSON store
            self.firebase_initialized = False

    def _get_user_file(self, user_id: str, collection: str) -> Path:
        safe_id = "".join([c if c.isalnum() or c in "-_" else "_" for c in user_id])
        user_dir = LOCAL_STORE_DIR / safe_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir / f"{collection}.json"

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self.firebase_initialized and self.db:
            try:
                doc = self.db.collection("users").document(user_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception:
                pass

        # Fallback local user store
        p_file = self._get_user_file(user_id, "profile")
        if p_file.exists():
            try:
                return json.loads(p_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return None

    def save_user_profile(self, user_id: str, data: Dict[str, Any]):
        if self.firebase_initialized and self.db:
            try:
                self.db.collection("users").document(user_id).set(data, merge=True)
            except Exception:
                pass

        p_file = self._get_user_file(user_id, "profile")
        p_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def get_user_logbook(self, user_id: str) -> List[Dict[str, Any]]:
        if self.firebase_initialized and self.db:
            try:
                docs = (
                    self.db.collection("users")
                    .document(user_id)
                    .collection("logbook")
                    .order_by("timestamp", direction="DESCENDING")
                    .stream()
                )
                return [{"id": d.id, **d.to_dict()} for d in docs]
            except Exception:
                pass

        l_file = self._get_user_file(user_id, "logbook")
        if l_file.exists():
            try:
                return json.loads(l_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return []

    def save_user_logbook_entry(self, user_id: str, entry: Dict[str, Any]) -> Dict[str, Any]:
        if self.firebase_initialized and self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("logbook").document(entry["id"])
                doc_ref.set(entry)
            except Exception:
                pass

        current = self.get_user_logbook(user_id)
        # Prepend new entry
        updated = [entry] + [e for e in current if e.get("id") != entry["id"]]
        l_file = self._get_user_file(user_id, "logbook")
        l_file.write_text(json.dumps(updated, indent=2), encoding="utf-8")
        return entry

    def delete_user_logbook_entry(self, user_id: str, entry_id: str):
        if self.firebase_initialized and self.db:
            try:
                self.db.collection("users").document(user_id).collection("logbook").document(entry_id).delete()
            except Exception:
                pass

        current = self.get_user_logbook(user_id)
        updated = [e for e in current if e.get("id") != entry_id]
        l_file = self._get_user_file(user_id, "logbook")
        l_file.write_text(json.dumps(updated, indent=2), encoding="utf-8")

firestore_service = FirestoreService()
