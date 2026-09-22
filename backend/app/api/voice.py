import base64
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import AuthContext, get_auth_context
from app.services.stt_service import stt_service

router = APIRouter(prefix="/voice", tags=["Voice STT & Parsing"])

# Upper bound on decoded audio size to avoid unbounded base64 payloads.
# A ~40-second webm voice note is typically well under 10 MB; 16 MB is generous.
MAX_AUDIO_BYTES = 16 * 1024 * 1024

class TranscribeJsonRequest(BaseModel):
    audioBase64: str
    mimeType: Optional[str] = "audio/webm"
    language: Optional[str] = "en"

class TranscribeResponse(BaseModel):
    success: bool
    transcript: str
    structured: Optional[dict] = None
    provider: Optional[str] = None
    error: Optional[str] = None

@router.post("/transcribe-json", response_model=TranscribeResponse)
def transcribe_audio_json(
    req: TranscribeJsonRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Multilingual Audio Transcription from Base64 JSON payload.
    The Next.js `/api/voice/transcribe` route normalizes browser MediaRecorder
    blobs to base64 and forwards them here.
    """
    try:
        raw_b64 = req.audioBase64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {e}")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio payload too large: {len(audio_bytes)} bytes exceeds the {MAX_AUDIO_BYTES} byte limit.",
        )

    result = stt_service.transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=req.mimeType or "audio/webm",
        language=req.language or "en",
    )
    return TranscribeResponse(**result)
