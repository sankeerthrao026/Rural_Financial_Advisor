import os
import time
import json
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
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
        self._doc_count: Optional[int] = None
        self._lock = threading.RLock()
        
        # In-memory document lookup caches for instant 0ms retrieval
        self._category_index: Dict[str, Dict[str, Any]] = {}
        self._district_index: Dict[str, Dict[str, Any]] = {}
        self._scheme_index: Dict[str, Dict[str, Any]] = {}
        
        # Query Embedding LRU cache: query_text -> List[float]
        self._embedding_cache: Dict[str, List[float]] = {}
        self._max_embedding_cache_size = 512

        # Query result LRU/TTL cache: key -> (timestamp, List[matched])
        self._query_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
        self._cache_ttl_seconds = 300.0  # 5 minutes
        self._max_cache_size = 256

        # Initialize document indexes
        self._refresh_in_memory_indexes()

    def _refresh_in_memory_indexes(self):
        """Loads and indexes static document metadata in-memory for instant lookups."""
        try:
            with self._lock:
                self._doc_count = self.collection.count()
                if self._doc_count > 0:
                    all_data = self.collection.get(include=["documents", "metadatas"])
                    if all_data and "documents" in all_data and all_data["documents"]:
                        docs = all_data["documents"]
                        metas = all_data.get("metadatas", [{}] * len(docs))
                        ids = all_data.get("ids", [""] * len(docs))
                        
                        self._category_index.clear()
                        self._district_index.clear()
                        self._scheme_index.clear()

                        for doc_text, meta, doc_id in zip(docs, metas, ids):
                            doc_entry = {
                                "id": doc_id,
                                "document": doc_text,
                                "metadata": meta or {},
                            }
                            doc_type = meta.get("type") if meta else ""
                            if doc_type == "market_benchmark":
                                cat_key = str(meta.get("category", "")).lower().strip()
                                cat_name = str(meta.get("name", "")).lower().strip()
                                if cat_key:
                                    self._category_index[cat_key] = doc_entry
                                if cat_name:
                                    self._category_index[cat_name] = doc_entry
                            elif doc_type == "district_demographics":
                                dist_key = str(meta.get("district", "")).lower().strip()
                                dist_name = str(meta.get("name", "")).lower().strip()
                                if dist_key:
                                    self._district_index[dist_key] = doc_entry
                                if dist_name:
                                    self._district_index[dist_name] = doc_entry
                            elif doc_type == "government_scheme":
                                scheme_id = str(meta.get("scheme_id", "")).lower().strip()
                                scheme_name = str(meta.get("name", "")).lower().strip()
                                if scheme_id:
                                    self._scheme_index[scheme_id] = doc_entry
                                if scheme_name:
                                    self._scheme_index[scheme_name] = doc_entry
        except Exception as e:
            print(f"[WARN] Failed to index ChromaDB documents in-memory: {e}")

    def get_count(self) -> int:
        """Returns cached document count to avoid repeated SQLite disk reads."""
        if self._doc_count is None:
            with self._lock:
                self._doc_count = self.collection.count()
        return self._doc_count

    def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
    ):
        """Adds or updates documents in the vector store and refreshes caches."""
        with self._lock:
            self.collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            self._doc_count = None  # Invalidate count
            self._query_cache.clear()  # Invalidate query cache
            self._embedding_cache.clear()  # Invalidate embedding cache
            self._refresh_in_memory_indexes()

    def get_or_compute_embedding(self, query_text: str) -> Optional[List[float]]:
        """Retrieves cached embedding vector or generates one once and caches it."""
        clean_text = query_text.strip().lower()
        with self._lock:
            if clean_text in self._embedding_cache:
                return self._embedding_cache[clean_text]

        # Generate embedding via collection embedding function
        if hasattr(self.collection, "_embedding_function") and self.collection._embedding_function:
            try:
                embeddings = self.collection._embedding_function([query_text])
                if embeddings and len(embeddings) > 0:
                    emb = embeddings[0]
                    # Convert numpy array to list if needed
                    emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
                    with self._lock:
                        if len(self._embedding_cache) >= self._max_embedding_cache_size:
                            oldest_key = next(iter(self._embedding_cache))
                            del self._embedding_cache[oldest_key]
                        self._embedding_cache[clean_text] = emb_list
                    return emb_list
            except Exception as e:
                print(f"[WARN] Error computing embedding: {e}")
        return None

    def get_category_benchmark(self, category_str: str) -> Optional[Dict[str, Any]]:
        """Instant 0ms lookup for category market benchmarks from pre-indexed memory."""
        if not category_str:
            return None
        clean = category_str.lower().split("/")[0].split("(")[0].strip()
        # 1. Exact match
        if clean in self._category_index:
            return self._category_index[clean]
        # 2. Substring match
        for k, v in self._category_index.items():
            if clean in k or k in clean:
                return v
        return None

    def get_district_demographics(self, location_str: str) -> Optional[Dict[str, Any]]:
        """Instant 0ms lookup for district demographics from pre-indexed memory."""
        if not location_str:
            return None
        clean = location_str.lower().split(",")[0].split("/")[0].split("(")[0].strip()
        # 1. Exact match
        if clean in self._district_index:
            return self._district_index[clean]
        # 2. Substring match
        for k, v in self._district_index.items():
            if clean in k or k in clean:
                return v
        return None

    def query_similar(
        self,
        query_text: str,
        n_results: int = 4,
        where_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Performs optimized semantic similarity retrieval from ChromaDB.
        Utilizes LRU/TTL caching for repeated queries and cached embeddings.
        """
        count = self.get_count()
        if count == 0:
            return []

        limit = min(n_results, count)
        
        # Check LRU / TTL Query Cache
        filter_str = json.dumps(where_filter, sort_keys=True) if where_filter else ""
        cache_key = f"{query_text.strip().lower()}|{limit}|{filter_str}"
        now = time.time()

        with self._lock:
            if cache_key in self._query_cache:
                ts, cached_matched = self._query_cache[cache_key]
                if (now - ts) < self._cache_ttl_seconds:
                    return cached_matched

        # Fast path: Query with cached/precomputed embedding
        embedding = self.get_or_compute_embedding(query_text)
        if embedding:
            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=limit,
                where=where_filter,
            )
        else:
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
            dists = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for doc_text, meta, doc_id, dist in zip(docs, metas, ids, dists):
                matched.append({
                    "id": doc_id,
                    "document": doc_text,
                    "metadata": meta or {},
                    "distance": float(dist),
                })

        # Update query cache
        with self._lock:
            if len(self._query_cache) >= self._max_cache_size:
                # Remove oldest entry
                oldest_key = next(iter(self._query_cache))
                del self._query_cache[oldest_key]
            self._query_cache[cache_key] = (now, matched)

        return matched

chroma_service = ChromaService()
