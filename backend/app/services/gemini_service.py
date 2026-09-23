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
        if is_te:
            system_prompt = """You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and concise business advisory for rural Indian micro-entrepreneurs.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
Respond entirely in Telugu. Do not include Hindi. Use Telugu as the primary language throughout the answer. Keep technical names, proper nouns, numbers, currency values, and unavoidable technical terminology in their standard form where appropriate.
You MUST generate EVERY user-facing string value in the output JSON exclusively in natural, fluent Telugu (తెలుగు) script.
This applies unconditionally to all keys: 'reply', 'marketReach' ('headline', 'details', 'targetSegment', 'estimatedLocalDemand'), 'opportunityAnalysis' ('overview', 'primaryDrivers', 'seasonalOpportunity'), 'swot' ('strengths', 'weaknesses', 'opportunities', 'threats'), 'competitorDensity' ('description', 'mitigationStrategy'), 'pricingSuggestion' ('recommendedBand', 'benchmarkComparison', 'marginTarget'), 'risks', and 'assumptions'.
STRICT RULES:
1. Do NOT write in English. Do NOT return bilingual or mixed English-Telugu text.
2. Even if the user's question, conversation history, or retrieved context is in English, your response MUST be in pure Telugu script.
3. For numerical / business questions (e.g. how many cows/birds/looms needed, target profit, break-even, required sales):
   - You MUST answer the exact question directly in the 'reply' field using the exact figures from the DETERMINISTIC BUSINESS CALCULATION block.
   - Show the step-by-step numbers clearly: (Target ÷ Profit per Unit = Required Units).
   - State the unit economics and assumptions clearly in Telugu.
   - NEVER provide vague generic boilerplate or dodge the calculation.
4. Ground all factual claims strictly in the provided context and benchmarks.
5. Output valid JSON matching the exact schema requested without altering JSON keys."""
        else:
            system_prompt = """You are the RuralCred Advisor AI Engine.
You provide realistic, grounded, and concise business advisory for rural Indian micro-entrepreneurs.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology. Answer the user's question directly and completely in English.
You MUST generate EVERY user-facing string value in the output JSON in clear, simple English.
STRICT RULES:
1. Output pure English with clear rural business terminology. Do NOT generate Telugu, Hindi, or bilingual parentheticals (e.g. never output 'Dairy Farming (పాడి పరిశ్రమ)' or 'Warangal (వరంగల్)').
2. Even if the user's question or conversation history is written in Telugu script, translate the intent and respond completely in English.
3. For numerical / business questions (e.g. how many cows/birds/looms needed, target profit, break-even, required sales):
   - You MUST answer the exact question directly in the 'reply' field using the exact figures from the DETERMINISTIC BUSINESS CALCULATION block.
   - Show the step-by-step numbers clearly: (Target ÷ Profit per Unit = Required Units).
   - State the unit economics and assumptions clearly in English.
   - NEVER provide vague generic boilerplate or dodge the calculation.
4. Ground all factual claims strictly in the provided context and benchmarks.
5. Output valid JSON matching the exact schema requested without altering JSON keys."""

        history_text = ""
        if history and len(history) > 0:
            formatted_turns = []
            for item in history[-6:]:
                role_val = item.get("role") if isinstance(item, dict) else getattr(item, "role", "user")
                content_val = item.get("content") if isinstance(item, dict) else getattr(item, "content", "")
                speaker = "Entrepreneur" if role_val == "user" else "Advisor"
                formatted_turns.append(f"{speaker}: {content_val}")
            history_text = "CONVERSATION HISTORY (RECENT TURNS):\n" + "\n".join(formatted_turns) + "\n\n"

        lang_directive = (
            "MANDATORY: Respond entirely in Telugu. Do not include Hindi. Use Telugu as the primary language throughout the answer. Keep technical names, proper nouns, numbers, currency values, and unavoidable technical terminology in their standard form where appropriate."
            if is_te
            else "MANDATORY: Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology. Answer the user's question directly and completely in English."
        )

        prompt = f"""{history_text}CURRENT USER INQUIRY & CALCULATION CONTEXT:
{user_query}

RETRIEVED LOCAL CONTEXT (ChromaDB Vector Store):
{retrieved_context}

{lang_directive}
Return a valid JSON object with the following structure:
{{
  "reply": "Direct, precise answer to the user's inquiry first, followed by clear step-by-step numbers, unit economics, and actionable guidance.",
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
            "gemini-flash-latest",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
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
        Returns a plain-language conversational advisor reply in the requested language.
        """
        if not self.is_available():
            return None

        from google.genai import types

        is_te = language == "te"
        if is_te:
            system_prompt = """You are the RuralCred AI Loan & Finance Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
Respond entirely in Telugu. Do not include Hindi. Use Telugu as the primary language throughout the answer. Keep technical names, proper nouns, numbers, currency values, and unavoidable technical terminology in their standard form where appropriate.
You MUST generate your entire conversational response in natural, fluent Telugu (తెలుగు) script.
STRICT RULES:
1. Do NOT write in English. Do NOT provide bilingual text.
2. Even if the user inquiry or loan context is in English, your response MUST be in pure Telugu script.
3. NEVER alter, hallucinate, or recalculate the verified loan numbers provided in the LOAN SUMMARY below (these are calculated deterministically by our banking engine).
4. Directly answer the entrepreneur's question or follow-up, referencing their exact loan amount, EMI, working capital split, or seasonal moratorium where appropriate.
5. Tailor your explanation to their demographic profile (e.g. woman entrepreneur, SC/ST/OBC category, rural location)."""
        else:
            system_prompt = """You are the RuralCred AI Loan & Finance Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology. Answer the user's question directly and completely in English.
You MUST generate your entire conversational response in clear, simple English.
STRICT RULES:
1. Output pure English with clear financial terminology. Do NOT generate Telugu, Hindi, or bilingual terms.
2. Even if the user inquiry is in Telugu script, your response MUST be in English.
3. NEVER alter, hallucinate, or recalculate the verified loan numbers provided in the LOAN SUMMARY below (these are calculated deterministically by our banking engine).
4. Directly answer the entrepreneur's question or follow-up, referencing their exact loan amount, EMI, working capital split, or seasonal moratorium where appropriate.
5. Tailor your explanation to their demographic profile (e.g. woman entrepreneur, SC/ST/OBC category, rural location)."""

        history_text = ""
        if history and len(history) > 0:
            formatted_turns = []
            for item in history[-8:]:
                role_val = item.get("role") if isinstance(item, dict) else getattr(item, "role", "user")
                content_val = item.get("content") if isinstance(item, dict) else getattr(item, "content", "")
                speaker = "Entrepreneur" if role_val == "user" else "Loan Advisor"
                formatted_turns.append(f"{speaker}: {content_val}")
            history_text = "PREVIOUS CONVERSATION:\n" + "\n".join(formatted_turns) + "\n\n"

        lang_instruction = (
            "MANDATORY: Respond entirely in Telugu. Do not include Hindi. Use Telugu as the primary language throughout the answer. Keep technical names, proper nouns, numbers, currency values, and unavoidable technical terminology in their standard form where appropriate."
            if is_te
            else "MANDATORY: Respond entirely in English. Do not include Telugu, Hindi, or any other regional-language translations. Do not provide bilingual terminology. Answer the user's question directly and completely in English."
        )

        prompt = f"""{history_text}CURRENT USER PROFILE:
- Name: {loan_context.get('userName', 'Entrepreneur')}
- Business: {loan_context.get('category', 'Dairy Farming')}
- Location: {loan_context.get('location', 'Warangal, Telangana')}
- Demographics: {loan_context.get('gender', 'female')}, {loan_context.get('socialCategory', 'OBC')}

CURRENT FINANCIAL SUMMARY:
- Monthly Revenue: ₹{loan_context.get('monthlyRevenue', 0):,.0f}
- Monthly Expenses: ₹{loan_context.get('monthlyExpenses', 0):,.0f}
- Net Monthly Cash Surplus: ₹{loan_context.get('monthlyProfit', 0):,.0f}
- Debt-Service Coverage Ratio (DSCR): {loan_context.get('dscr', 1.8)}x

DIGITAL LOGBOOK SUMMARY:
- Total Income: ₹{loan_context.get('totalIncome', 0):,.0f} | Total Expenses: ₹{loan_context.get('totalExpenses', 0):,.0f}
- Net Cash Flow: ₹{loan_context.get('netCashFlow', 0):,.0f}
- Top Expense Categories: {loan_context.get('topExpenseCategories', 'N/A')}

LOAN SUMMARY:
- Margin Capital (Equity): ₹{loan_context.get('marginCapital', 0):,.0f}
- Bank Loan Amount: ₹{loan_context.get('loanAmount', 0):,.0f}
- Total Project Outlay: ₹{loan_context.get('projectCost', 0):,.0f}
- Quarterly EMI: ₹{loan_context.get('quarterlyEmi', 0):,.0f}
- Working Capital Split: ₹{loan_context.get('workingCapitalAmount', 0):,.0f} ({loan_context.get('workingCapitalPercent', 0)}%)
- Capital Expenditure (Capex) Split: ₹{loan_context.get('capexAmount', 0):,.0f} ({loan_context.get('capexPercent', 0)}%)
- Recommended Schemes: {loan_context.get('topSchemes')}
- Seasonal Moratorium Guidance: {loan_context.get('moratoriumGuidance')}

VERIFIED DETERMINISTIC CALCULATIONS FOR THIS QUESTION:
{loan_context.get('verifiedCalculationSummary', 'N/A')}

CURRENT ENTREPRENEUR INQUIRY:
{user_query}

{lang_instruction}
Provide a direct, helpful, and professional conversational response (2 to 4 paragraphs) addressing the entrepreneur's question directly using the verified calculations above."""

        candidate_models = [
            "gemini-2.5-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-2.0-flash",
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
