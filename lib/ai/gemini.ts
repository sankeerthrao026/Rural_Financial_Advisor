/**
 * RuralCred Advisor — Google Gemini API Client for Next.js.
 * Unifies all frontend AI operations directly on Google Gemini models (e.g. gemini-2.5-flash).
 * Eliminates all external dependencies on Anthropic or OpenAI.
 */

export interface GeminiCallParams {
  systemInstruction?: string;
  userPrompt: string;
  responseMimeType?: 'application/json' | 'text/plain';
  temperature?: number;
}

export interface GeminiCallResult {
  text: string;
  model: string;
  success: boolean;
  error?: string;
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

/**
 * Executes a call to Google Gemini REST API.
 * Uses process.env.GEMINI_API_KEY.
 */
export async function callGeminiApi(params: GeminiCallParams): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      text: '',
      model: '',
      success: false,
      error: 'GEMINI_API_KEY is not configured in environment variables.',
    };
  }

  const cleanKey = apiKey.trim();

  // Try candidate models in order of priority
  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

      const contents: any[] = [];

      const body: Record<string, any> = {
        contents: [
          {
            role: 'user',
            parts: [{ text: params.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: params.temperature ?? 0.2,
        },
      };

      if (params.systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: params.systemInstruction }],
        };
      }

      if (params.responseMimeType === 'application/json') {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[Gemini] Model ${model} responded with ${res.status}: ${errorText.slice(0, 150)}`);
        continue; // Try next model
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.warn(`[Gemini] Model ${model} returned empty content`);
        continue;
      }

      return {
        text: rawText,
        model,
        success: true,
      };
    } catch (err: any) {
      console.warn(`[Gemini] Network error calling model ${model}:`, err?.message);
    }
  }

  return {
    text: '',
    model: '',
    success: false,
    error: 'All Gemini model candidates failed or timed out.',
  };
}
