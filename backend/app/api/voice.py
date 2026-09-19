import base64
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from pydantic import BaseModel
from app.services.stt_service import stt_service

router = APIRouter(prefix="/voice", tags=["Voice STT & Parsing"])

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

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_file(
    file: Optional[UploadFile] = File(None),
    language: Optional[str] = Form("en"),
):
    """
    Multilingual Audio Transcription endpoint.
    Accepts uploaded audio file (WebM, WAV, MP4, MP3) and transcribes using Gemini / Whisper.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Audio file is required")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    result = stt_service.transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=file.content_type or "audio/webm",
        language=language or "en",
    )
    return TranscribeResponse(**result)

@router.post("/transcribe-json", response_model=TranscribeResponse)
def transcribe_audio_json(req: TranscribeJsonRequest):
    """
    Multilingual Audio Transcription from Base64 JSON payload.
    Compatible with browsers recording via MediaRecorder without multipart overhead.
    """
    try:
        raw_b64 = req.audioBase64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {e}")

    result = stt_service.transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=req.mimeType or "audio/webm",
        language=req.language or "en",
    )
    return TranscribeResponse(**result)
