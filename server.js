import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Log every request so we can see what hits the server (debug 404s)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const apiKey = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in your environment.');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set in your environment.');
  process.exit(1);
}

// --- SQLite setup for user authentication ---
sqlite3.verbose();
const db = new sqlite3.Database('./typesense.db', (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err);
    process.exit(1);
  }
  console.log('SQLite database opened at ./typesense.db');
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error('Failed to create users table:', err);
        process.exit(1);
      }
      console.log('Ensured users table exists.');
    }
  );
});

// Small promise-wrappers so we can use async/await cleanly.
const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

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

// --- Auth helpers ---
function createAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// --- Auth routes (must be registered before the 404 handler) ---
app.post('/api/signup', async (req, res) => {
  console.log('POST /api/signup handler hit');
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await dbRun(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = {
      id: result.lastID,
      name: name.trim(),
      email: normalizedEmail,
    };

    const token = createAuthToken(user);

    return res.status(201).json({
      token,
      user,
    });
  } catch (error) {
    console.error('Error in /api/signup:', error);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const row = await dbGet('SELECT id, name, email, password_hash FROM users WHERE email = ?', [
      normalizedEmail,
    ]);

    // Always respond with a generic error to avoid leaking which emails exist.
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
    };

    const token = createAuthToken(user);

    return res.json({
      token,
      user,
    });
  } catch (error) {
    console.error('Error in /api/login:', error);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
});

// Health check: confirms this process has the auth API (e.g. after restart)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, auth: true });
});

// 404 for any other route — return JSON so the client sees a clear message
app.use((req, res) => {
  console.log('404 for', req.method, req.path);
  res.status(404).json({ error: 'Not found', path: req.method + ' ' + req.path });
});

// Ensure JSON error responses for any unhandled route errors (e.g. auth routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`TypeSense AI server listening on http://localhost:${PORT}`);
  console.log('Registered routes: POST /api/generate, POST /api/signup, POST /api/login, GET /api/health');
});

