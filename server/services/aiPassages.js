import { GoogleGenAI } from '@google/genai';

function normalize(text, wordCount) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, wordCount).join(' ');
}

function promptFor(topic, wordCount) {
  return `Write one coherent English passage for typing practice about: ${topic}\n\nRequirements:\n- exactly ${wordCount} words\n- plain text only\n- one line\n- no title, bullets, quotation marks, or commentary\nReturn only the passage.`;
}

async function generateWithOpenAI({ apiKey, model, prompt }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI request failed.');
  return data.output_text || data.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text || '';
}

export async function generatePassage(aiConfig, topic, wordCount) {
  const prompt = promptFor(topic, wordCount);
  let rawText;

  if (aiConfig.provider === 'openai') {
    if (!aiConfig.openaiKey) throw new Error('OPENAI_API_KEY is not configured.');
    rawText = await generateWithOpenAI({ apiKey: aiConfig.openaiKey, model: aiConfig.openaiModel, prompt });
  } else {
    if (!aiConfig.geminiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const client = new GoogleGenAI({ apiKey: aiConfig.geminiKey });
    const response = await client.models.generateContent({ model: aiConfig.geminiModel, contents: prompt });
    rawText = response.text;
  }

  const text = normalize(rawText, wordCount);
  if (!text) throw new Error('The AI provider returned an empty passage.');
  return text;
}
