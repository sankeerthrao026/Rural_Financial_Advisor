from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.auth import get_auth_context, AuthContext
from app.models.schemas import LogbookEntry, LogbookCreate, LogbookUpdate
from app.services.logbook_service import logbook_service

router = APIRouter(prefix="/logbook", tags=["Digital Logbook"])

@router.get("", response_model=List[LogbookEntry])
def get_logbook(auth: AuthContext = Depends(get_auth_context)):
    return logbook_service.get_entries(auth.user_id)

@router.post("", response_model=LogbookEntry)
def create_entry(entry: LogbookCreate, auth: AuthContext = Depends(get_auth_context)):
    return logbook_service.add_entry(auth.user_id, entry)

@router.put("/{entry_id}", response_model=LogbookEntry)
def update_entry(entry_id: str, entry: LogbookUpdate, auth: AuthContext = Depends(get_auth_context)):
    return logbook_service.update_entry(auth.user_id, entry_id, entry)

@router.delete("/{entry_id}")
def delete_entry(entry_id: str, auth: AuthContext = Depends(get_auth_context)):
    logbook_service.delete_entry(auth.user_id, entry_id)
    return {"success": True, "deletedId": entry_id}
