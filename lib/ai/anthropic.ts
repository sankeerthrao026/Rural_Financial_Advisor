export async function callAnthropicMessages(params: {
  system: string;
  userPrompt: string;
  temperature?: number;
  apiKey?: string;
}): Promise<string> {
  const apiKey = params.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      temperature: params.temperature ?? 0.2,
      system: params.system,
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.content?.[0]?.text;
  if (!textContent) {
    throw new Error('Empty response content from Anthropic');
  }

  return textContent;
}
