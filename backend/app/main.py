from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.models.schemas import HealthResponse
from app.services.chroma_service import chroma_service
from app.services.gemini_service import gemini_service
from app.api import profile, finance, logbook, risk, dashboard, advisor

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure ChromaDB vector store is populated on startup
    count = chroma_service.get_count()
    if count == 0:
        print("[INFO] ChromaDB empty on startup. Ingesting approved local datasets...")
        from app.ingestion.ingest import ingest_all_datasets
        try:
            ingest_all_datasets()
        except Exception as e:
            print(f"[WARN] Ingestion during startup encountered: {e}")
    else:
        print(f"[INFO] ChromaDB vector store active with {count} documents.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="RuralCred Advisor — Backend REST API, Deterministic Finance & Risk Engine, ChromaDB RAG, and Gemini Intelligence",
    lifespan=lifespan,
)

# Enable CORS for Next.js and frontend consumers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        chromadb_connected=chroma_service.get_count() > 0,
        gemini_configured=gemini_service.is_available(),
    )

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
    }

# Mount all API routers
app.include_router(profile.router, prefix=settings.API_PREFIX)
app.include_router(finance.router, prefix=settings.API_PREFIX)
app.include_router(logbook.router, prefix=settings.API_PREFIX)
app.include_router(risk.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(advisor.router, prefix=settings.API_PREFIX)
