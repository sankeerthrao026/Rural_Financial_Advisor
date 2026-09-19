from fastapi import APIRouter, Depends
from app.auth import get_auth_context, AuthContext
from app.models.schemas import UserProfile, ProfileUpdate
from app.services.firestore_service import firestore_service

router = APIRouter(prefix="/profile", tags=["Profile"])

@router.get("", response_model=UserProfile)
def get_profile(auth: AuthContext = Depends(get_auth_context)):
    user_id = auth.user_id
    data = firestore_service.get_user_profile(user_id)
    if data:
        return UserProfile(**data)
    # Default profile for new user
    return UserProfile(id=user_id)

@router.post("", response_model=UserProfile)
@router.put("", response_model=UserProfile)
def update_profile(updates: ProfileUpdate, auth: AuthContext = Depends(get_auth_context)):
    user_id = auth.user_id
    existing = firestore_service.get_user_profile(user_id) or UserProfile(id=user_id).model_dump()
    
    update_dict = updates.model_dump(exclude_unset=True)
    merged = {**existing, **update_dict, "id": user_id}
    firestore_service.save_user_profile(user_id, merged)
    return UserProfile(**merged)
