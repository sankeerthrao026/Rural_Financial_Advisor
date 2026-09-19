from fastapi import APIRouter, Header
from typing import Optional
from app.models.schemas import DashboardResponse
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardResponse)
def get_dashboard(x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "demo-user"
    return dashboard_service.get_user_dashboard(user_id)
