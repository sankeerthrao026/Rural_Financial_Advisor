import json
import os
from typing import Dict, Any, Optional
from app.config import settings

class GeminiService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        self.last_model_used = None
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                print("[INFO] Gemini AI Client initialized successfully with Google GenAI SDK.")
            except Exception as e:
                print(f"[WARN] Failed to initialize Gemini client: {e}")
                self.client = None
        else:
            print("[INFO] GEMINI_API_KEY not configured. AI advisor will utilize verified ChromaDB grounded fallback.")

    def is_available(self) -> bool:
        return bool(self.client and self.api_key)

    def generate_grounded_advice(
        self,
        user_query: str,
        retrieved_context: str,
        language: str = "en",
        history: Optional[list] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Calls Gemini API with strict grounding on the retrieved ChromaDB context.
        Incorporates conversational history for multi-turn dialogue.
        Enforces structured JSON response with automatic fallback across Flash models.
        """
        if not self.is_available():
            return None

        from google.genai import types

        is_te = language == "te"
        system_prompt = f"""You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and cautious business advisory for rural Indian micro-entrepreneurs.
STRICT SAFETY & GROUNDING RULES:
1. Ground all factual claims strictly in the provided RETRIEVED LOCAL CONTEXT.
2. NEVER calculate critical loan amounts, EMI, interest rates, or financial health scores (handled deterministically by the Python engine).
3. NEVER invent fictitious competitors, fake government schemes, or arbitrary prices.
4. If context is insufficient for a reliable estimate, state "Insufficient local data for a reliable estimate."
5. Address follow-up questions directly by maintaining continuity with earlier turns in the conversation.
6. Output valid JSON matching the exact schema requested.
7. Language: {"Telugu (తెలుగు) with standard business loan terms" if is_te else "English with clear Indian rural business terminology"}."""

        history_text = ""
        if history and len(history) > 0:
            formatted_turns = []
            for item in history[-8:]:
                role_val = item.get("role") if isinstance(item, dict) else getattr(item, "role", "user")
                content_val = item.get("content") if isinstance(item, dict) else getattr(item, "content", "")
                speaker = "Entrepreneur" if role_val == "user" else "Advisor"
                formatted_turns.append(f"{speaker}: {content_val}")
            history_text = "CONVERSATION HISTORY (RECENT TURNS):\n" + "\n".join(formatted_turns) + "\n\n"

        prompt = f"""{history_text}CURRENT USER QUESTION / INQUIRY:
{user_query}

RETRIEVED LOCAL CONTEXT (ChromaDB Vector Store):
{retrieved_context}

Return a valid JSON object with the following structure:
{{
  "reply": "Clear, direct, and conversational 2-4 sentence explanation addressing the user's specific inquiry or follow-up question directly.",
  "marketReach": {{
    "headline": "string",
    "details": "string",
    "targetSegment": "string",
    "estimatedLocalDemand": "string"
  }},
  "opportunityAnalysis": {{
    "overview": "string",
    "primaryDrivers": ["string", "string", "string"],
    "seasonalOpportunity": "string"
  }},
  "swot": {{
    "strengths": ["string", "string", "string"],
    "weaknesses": ["string", "string", "string"],
    "opportunities": ["string", "string", "string"],
    "threats": ["string", "string", "string"]
  }},
  "competitorDensity": {{
    "densityLevel": "Low|Moderate|High",
    "description": "string",
    "mitigationStrategy": "string"
  }},
  "pricingSuggestion": {{
    "recommendedBand": "string",
    "benchmarkComparison": "string",
    "marginTarget": "string"
  }},
  "risks": ["string", "string"],
  "assumptions": ["string", "string"]
}}"""

        candidate_models = [
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-flash-latest",
        ]
        for model in candidate_models:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )

                raw_text = response.text or ""
                json_text = raw_text.strip()
                if json_text.startswith("```"):
                    lines = json_text.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    json_text = "\n".join(lines).strip()

                parsed = json.loads(json_text)
                self.last_model_used = model
                print(f"[INFO] Gemini advisory generated successfully via {model} with ChromaDB RAG context.")
                return parsed
            except Exception as e:
                print(f"[WARN] Gemini generation with {model} failed: {e}")

        print("[WARN] All Gemini candidate models failed. Reverting to grounded local fallback.")
        return None

gemini_service = GeminiService()
