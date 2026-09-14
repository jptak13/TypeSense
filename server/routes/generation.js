import express from 'express';
import { generatePassage } from '../services/aiPassages.js';

export function createGenerationRouter({ aiConfig, generationRateLimit }) {
  const router = express.Router();
  router.post('/generate', generationRateLimit, async (req, res, next) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      const wordCount = Number(req.body?.wordCount);
      if (!prompt || prompt.length > 600 || !Number.isInteger(wordCount) || wordCount < 10 || wordCount > 500) {
        return res.status(400).json({ error: 'Use a prompt up to 600 characters and a word count from 10 to 500.' });
      }
      const text = await generatePassage(aiConfig, prompt, wordCount);
      return res.json({ text });
    } catch (error) {
      if (/API_KEY|configured/.test(error.message)) return res.status(503).json({ error: error.message });
      return next(error);
    }
  });
  return router;
}
