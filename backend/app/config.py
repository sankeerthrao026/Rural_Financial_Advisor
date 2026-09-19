import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "RuralCred Advisor API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # AI Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # ChromaDB
    CHROMA_PERSIST_DIR: str = os.getenv(
        "CHROMA_PERSIST_DIRECTORY",
        str(BASE_DIR / "chroma_db")
    )
    
    # Supabase Auth
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))
    
    # Firebase Firestore
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", ""))
    FIREBASE_CLIENT_EMAIL: str = os.getenv("FIREBASE_CLIENT_EMAIL", "")
    FIREBASE_PRIVATE_KEY: str = os.getenv("FIREBASE_PRIVATE_KEY", "")
    
    # Data directory
    DATA_DIR: Path = PROJECT_ROOT / "data"

    model_config = SettingsConfigDict(
        env_file=[".env", ".env.local", str(BASE_DIR / ".env")],
        extra="ignore"
    )

settings = Settings()
