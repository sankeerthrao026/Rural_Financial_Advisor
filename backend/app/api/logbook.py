from fastapi import APIRouter, Header, HTTPException
from typing import List, Optional
from app.models.schemas import LogbookEntry, LogbookCreate
from app.services.logbook_service import logbook_service

router = APIRouter(prefix="/logbook", tags=["Digital Logbook"])

@router.get("", response_model=List[LogbookEntry])
def get_logbook(x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "demo-user"
    return logbook_service.get_entries(user_id)

@router.post("", response_model=LogbookEntry)
def create_entry(entry: LogbookCreate, x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "demo-user"
    return logbook_service.add_entry(user_id, entry)

@router.delete("/{entry_id}")
def delete_entry(entry_id: str, x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "demo-user"
    logbook_service.delete_entry(user_id, entry_id)
    return {"success": True, "deletedId": entry_id}
