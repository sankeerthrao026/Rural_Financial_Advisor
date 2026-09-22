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
                from google.genai import types
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=10000)
                )
                print("[INFO] Gemini AI Client initialized successfully with Google GenAI SDK (timeout=10s).")
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
        Enforces structured JSON response with thinking_budget=0 and max_output_tokens=1024 for minimal latency.
        """
        if not self.is_available():
            return None

        import time
        from google.genai import types

        is_te = language == "te"
        system_prompt = f"""You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and concise business advisory for rural Indian micro-entrepreneurs.
STRICT SAFETY & GROUNDING RULES:
1. Ground all factual claims strictly in the provided RETRIEVED LOCAL CONTEXT.
2. NEVER calculate critical loan amounts, EMI, interest rates, or financial health scores (handled deterministically by the Python engine).
3. NEVER invent fictitious competitors, fake government schemes, or arbitrary prices.
4. If context is insufficient for a reliable estimate, state "Insufficient local data for a reliable estimate."
5. Address follow-up questions directly by maintaining continuity with earlier turns in the conversation.
6. Output valid, concise JSON matching the exact schema requested.
7. Language: {"Telugu (తెలుగు) with standard business loan terms" if is_te else "English with clear Indian rural business terminology"}."""

        history_text = ""
        if history and len(history) > 0:
            formatted_turns = []
            for item in history[-6:]:
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
    "primaryDrivers": ["string", "string"],
    "seasonalOpportunity": "string"
  }},
  "swot": {{
    "strengths": ["string", "string"],
    "weaknesses": ["string", "string"],
    "opportunities": ["string", "string"],
    "threats": ["string", "string"]
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
  "assumptions": ["string"]
}}"""

        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-3.6-flash",
            "gemini-flash-latest",
        ]
        for model in candidate_models:
            t_model_start = time.time()
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        temperature=0.2,
                        max_output_tokens=1024,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                t_model_duration = (time.time() - t_model_start) * 1000

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
                print(f"[INFO] Gemini advisory generated successfully via {model} in {t_model_duration:.1f}ms.")
                return parsed
            except Exception as e:
                t_model_duration = (time.time() - t_model_start) * 1000
                print(f"[WARN] Gemini generation with {model} failed after {t_model_duration:.1f}ms: {e}")

        print("[WARN] All Gemini candidate models failed. Reverting to grounded local fallback.")
        return None

    def generate_conversational_finance_reply(
        self,
        user_query: str,
        loan_context: Dict[str, Any],
        language: str = "en",
        history: Optional[list] = None,
    ) -> Optional[str]:
        """
        Calls Gemini API with full awareness of deterministic loan figures,
        demographics (gender, social category), working capital split, and seasonal moratorium.
        Returns a plain-language conversational advisor reply.
        """
        if not self.is_available():
            return None

        from google.genai import types

        is_te = language == "te"
        system_prompt = f"""You are the RuralCred AI Loan & Finance Advisor.
You converse with rural Indian micro-entrepreneurs in simple, supportive, and practical language.
STRICT RULES:
1. NEVER alter, hallucinate, or recalculate the verified loan numbers provided in the LOAN SUMMARY below (these are calculated deterministically by our banking engine).
2. Directly answer the entrepreneur's question or follow-up, referencing their exact loan amount, EMI, working capital split, or seasonal moratorium where appropriate.
3. Tailor your explanation to their demographic profile (e.g. woman entrepreneur, SC/ST/OBC category, rural location).
4. Explain why recommended schemes (like Stand-Up India, PMEGP 35% subsidy, Stree Nidhi, MUDRA, or NBCFDC) benefit them specifically.
5. Language: {"Telugu (తెలుగు) using accessible rural terminology" if is_te else "Simple Indian English with clear financial terminology"}."""

        history_text = ""
        if history and len(history) > 0:
            formatted_turns = []
            for item in history[-8:]:
                role_val = item.get("role") if isinstance(item, dict) else getattr(item, "role", "user")
                content_val = item.get("content") if isinstance(item, dict) else getattr(item, "content", "")
                speaker = "Entrepreneur" if role_val == "user" else "Loan Advisor"
                formatted_turns.append(f"{speaker}: {content_val}")
            history_text = "PREVIOUS CONVERSATION:\n" + "\n".join(formatted_turns) + "\n\n"

        prompt = f"""{history_text}VERIFIED LOAN & ENTREPRENEUR SUMMARY:
- Margin Capital (Equity): ₹{loan_context.get('marginCapital', 0):,.0f}
- Bank Loan Amount: ₹{loan_context.get('loanAmount', 0):,.0f}
- Total Project Outlay: ₹{loan_context.get('projectCost', 0):,.0f}
- Quarterly EMI: ₹{loan_context.get('quarterlyEmi', 0):,.0f}
- Working Capital Split: ₹{loan_context.get('workingCapitalAmount', 0):,.0f} ({loan_context.get('workingCapitalPercent', 0)}%)
- Capital Expenditure (Capex) Split: ₹{loan_context.get('capexAmount', 0):,.0f} ({loan_context.get('capexPercent', 0)}%)
- Entrepreneur Demographics: Gender: {loan_context.get('gender')}, Category: {loan_context.get('socialCategory')}, Business: {loan_context.get('category')}, Location: {loan_context.get('location')}
- Seasonal Moratorium Guidance: {loan_context.get('moratoriumGuidance')}
- Recommended Schemes: {loan_context.get('topSchemes')}

CURRENT ENTREPRENEUR INQUIRY:
{user_query}

Provide a helpful, warm, and professional conversational response (2 to 4 paragraphs) addressing the entrepreneur's question with specific references to their profile and numbers."""

        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-3.6-flash",
            "gemini-flash-latest",
        ]
        for model in candidate_models:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.3,
                        max_output_tokens=1024,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                text = response.text or ""
                if text.strip():
                    self.last_model_used = model
                    return text.strip()
            except Exception as e:
                print(f"[WARN] Gemini finance reply with {model} failed: {e}")

        return None

gemini_service = GeminiService()
