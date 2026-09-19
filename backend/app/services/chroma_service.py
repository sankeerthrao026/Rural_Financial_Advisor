import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings

COLLECTION_NAME = "ruralcred_knowledge"

class ChromaService:
    def __init__(self):
        self.persist_dir = Path(settings.CHROMA_PERSIST_DIR)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "RuralCred hyper-local business benchmarks and schemes"},
        )

    def get_count(self) -> int:
        return self.collection.count()

    def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
    ):
        """Adds or updates documents in the vector store."""
        self.collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )

    def query_similar(
        self,
        query_text: str,
        n_results: int = 4,
        where_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic similarity retrieval from ChromaDB.
        Returns matched documents with metadata and similarity distances.
        """
        count = self.get_count()
        if count == 0:
            return []

        limit = min(n_results, count)
        results = self.collection.query(
            query_texts=[query_text],
            n_results=limit,
            where=where_filter,
        )

        matched = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
            ids = results["ids"][0] if "ids" in results and results["ids"] else [""] * len(docs)

            for doc_text, meta, doc_id in zip(docs, metas, ids):
                matched.append({
                    "id": doc_id,
                    "document": doc_text,
                    "metadata": meta,
                })
        return matched

chroma_service = ChromaService()
