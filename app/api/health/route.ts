import { NextResponse } from 'next/server';

export async function GET() {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  let backendStatus = {
    connected: false,
    details: null as any,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${backendBaseUrl}/api/health`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      backendStatus = {
        connected: true,
        details: data,
      };
    }
  } catch (err: any) {
    backendStatus = {
      connected: false,
      details: err?.message || 'Backend unreachable',
    };
  }

  return NextResponse.json({
    status: 'healthy',
    service: 'RuralCred Advisor Frontend & API Gateway',
    aiProvider: 'Google Gemini (gemini-2.5-flash)',
    ragVectorStore: 'ChromaDB (ruralcred_knowledge via FastAPI)',
    hasGeminiKey,
    pipelineMode: backendStatus.connected
      ? (backendStatus.details?.gemini_configured ? 'FastAPI ChromaDB RAG + Gemini 2.5 Flash' : 'FastAPI ChromaDB Grounded Fallback')
      : (hasGeminiKey ? 'Direct Next.js Gemini 2.5 Flash + Bundled District Grounding' : 'Standalone Grounded Fallback'),
    backendBridge: {
      targetUrl: backendBaseUrl,
      ...backendStatus,
    },
    timestamp: new Date().toISOString(),
  });
}
