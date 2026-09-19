export async function callOpenAIChat(params: {
  system: string;
  userPrompt: string;
  temperature?: number;
  apiKey?: string;
}): Promise<string> {
  const apiKey = params.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: params.temperature ?? 0.2,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('Empty response content from OpenAI');
  }

  return textContent;
}
