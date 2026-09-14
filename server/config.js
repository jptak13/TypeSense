import dotenv from 'dotenv';

dotenv.config();

const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  databasePath: process.env.DATABASE_PATH || './typesense.db',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : localOrigins,
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    appUrl: process.env.APP_URL || 'http://localhost:5173',
  },
  ai: {
    provider: process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'gemini'),
    geminiKey: process.env.GEMINI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
};

if (!config.jwtSecret) throw new Error('JWT_SECRET is required.');
