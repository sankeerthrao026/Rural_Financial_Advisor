import re
from typing import Optional, Literal
from fastapi import Header, HTTPException
from pydantic import BaseModel

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
    Validates request context distinguishing demo users from authenticated users.
    Accepts validated temporary demo sessions (demo_<id>) without requiring Supabase JWT.
    """
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
