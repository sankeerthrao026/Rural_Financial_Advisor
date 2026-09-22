import re
from typing import Optional, Literal
from fastapi import Header, HTTPException
from pydantic import BaseModel
from app.config import settings

class AuthContext(BaseModel):
    mode: Literal["demo", "authenticated"]
    user_id: str

DEMO_ID_REGEX = re.compile(r"^demo[_-][a-zA-Z0-9_-]{2,64}$")
AUTH_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,128}$")

def get_auth_context(
    x_user_id: Optional[str] = Header(None),
    x_auth_mode: Optional[str] = Header(None)
) -> AuthContext:
    """
    DEMO-ONLY pseudo-auth. Client-supplied x-user-id / x-auth-mode headers are NEVER
    a substitute for real identity verification and this code is unsafe for production.

    When DEMO_MODE is not enabled, every request is rejected with 401 because there is
    no real token verification in place. When DEMO_MODE=true, the historical lenient
    header-trust behavior is preserved for local evaluation only.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=401,
            detail="Authentication is disabled. Set DEMO_MODE=true to enable demo-only header auth.",
        )

    if not x_user_id:
        return AuthContext(mode="demo", user_id="demo_default")

    clean_id = x_user_id.strip()

    # 1. Demo Mode Check
    if clean_id.startswith("demo_") or clean_id.startswith("demo-"):
        if not DEMO_ID_REGEX.match(clean_id):
            raise HTTPException(status_code=400, detail="Invalid demo user ID format")
        return AuthContext(mode="demo", user_id=clean_id)

    # 2. Authenticated Mode Check
    if not AUTH_ID_REGEX.match(clean_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    mode: Literal["demo", "authenticated"] = "demo" if x_auth_mode == "demo" else "authenticated"
    return AuthContext(mode=mode, user_id=clean_id)
