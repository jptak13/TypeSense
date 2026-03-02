import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in your environment.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Helper to normalize the model output and clamp it
 * to the requested word count.
 */
function normalizeToWordCount(rawText, wordCount) {
  if (!rawText) return '';

  // Collapse all whitespace (including newlines) to single spaces.
  let text = rawText.replace(/\s+/g, ' ').trim();

  const words = text.split(' ').filter(Boolean);

  if (words.length > wordCount) {
    text = words.slice(0, wordCount).join(' ');
  }

  // If the model under-shoots the word count we just return what we have.
  return text;
}

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, wordCount } = req.body || {};

    const count = Number(wordCount);
    if (!prompt || !Number.isFinite(count) || count <= 0) {
      return res.status(400).json({
        error: 'Both "prompt" (string) and positive "wordCount" are required.',
      });
    }

    const instruction = `
You are a text generator for a typing practice app.
Generate a single English passage that:
- Has exactly ${count} words.
- Uses only plain text (no bullets, markdown, quotes, or numbering).
- Is written as one single line (no line breaks).
- Does not include any explanations or surrounding commentary.
Return ONLY the passage text itself.`;

    const fullPrompt = `${instruction}\n\nUser prompt: ${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    const rawText = response.text;
    const normalized = normalizeToWordCount(rawText, count);

    return res.json({ text: normalized });
  } catch (error) {
    console.error('Error in /api/generate:', error);
    return res.status(500).json({ error: 'Failed to generate text.' });
  }
});

app.listen(PORT, () => {
  console.log(`TypeSense AI server listening on http://localhost:${PORT}`);
});

