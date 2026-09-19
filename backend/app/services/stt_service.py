import io
import json
from typing import Dict, Any, Optional
from app.config import settings
from app.services.gemini_service import gemini_service

class STTService:
    def transcribe_audio(
        self,
        audio_bytes: bytes,
        content_type: str = "audio/webm",
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Multilingual Speech-to-Text transcriber supporting English (en-IN), Telugu (te-IN), and Hindi (hi-IN).
        Primary: Uses Google Gemini multimodal audio transcription (gemini-2.5-flash / gemini-1.5-flash).
        Secondary: Optional Whisper fallback if installed.
        """
        lang_names = {
            "te": "Telugu (తెలుగు)",
            "hi": "Hindi (हिन्दी)",
            "en": "English (Indian English)",
        }
        target_lang = lang_names.get(language, "Indian English, Telugu, or Hindi")

        if gemini_service.is_available():
            try:
                from google.genai import types
                prompt = (
                    f"You are the RuralCred Advisor multilingual STT engine. "
                    f"Listen to the attached audio clip carefully. The speaker is speaking in {target_lang}. "
                    f"1. Accurately transcribe the spoken words into text.\n"
                    f"2. If the user is stating a rural business or financial transaction (e.g., selling milk, buying feed, paying rent), "
                    f"extract the amount, type ('income' or 'expense'), category, and note.\n\n"
                    f"Output strictly valid JSON with this schema:\n"
                    f"{{\n"
                    f'  "transcript": "string",\n'
                    f'  "structured": {{\n'
                    f'    "amount": number or null,\n'
                    f'    "type": "income" or "expense",\n'
                    f'    "category": "string",\n'
                    f'    "note": "string"\n'
                    f"  }}\n"
                    f"}}"
                )

                response = gemini_service.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(
                            data=audio_bytes,
                            mime_type=content_type or "audio/webm",
                        ),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )

                raw_text = (response.text or "").strip()
                if raw_text.startswith("```"):
                    lines = raw_text.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    raw_text = "\n".join(lines).strip()

                parsed = json.loads(raw_text)
                return {
                    "success": True,
                    "transcript": parsed.get("transcript", ""),
                    "structured": parsed.get("structured"),
                    "provider": "Google Gemini 2.5 Flash Audio STT",
                }
            except Exception as e:
                print(f"[WARN] Gemini audio STT transcription failed: {e}")

        # Fallback to local whisper if installed
        try:
            import whisper
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            
            model = whisper.load_model("base")
            result = model.transcribe(tmp_path, language=language if language in ["te", "hi", "en"] else None)
            return {
                "success": True,
                "transcript": result.get("text", "").strip(),
                "provider": "Local Whisper Base",
            }
        except Exception:
            pass

        return {
            "success": False,
            "transcript": "",
            "error": "STT fallback requires GEMINI_API_KEY for audio transcription, or Web Speech API support in browser.",
        }

stt_service = STTService()
