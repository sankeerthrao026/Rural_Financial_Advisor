from fastapi import APIRouter, Depends
from app.auth import get_auth_context, AuthContext
from app.models.schemas import DashboardResponse
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardResponse)
def get_dashboard(auth: AuthContext = Depends(get_auth_context)):
    return dashboard_service.get_user_dashboard(auth.user_id)
