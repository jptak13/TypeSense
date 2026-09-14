import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { openDatabase } from './database.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { createAuthRouter } from './routes/auth.js';
import { createGenerationRouter } from './routes/generation.js';
import { createProfileRouter } from './routes/profile.js';
import { createEmailService } from './services/email.js';

export async function createApp() {
  const app = express();
  const database = openDatabase({
    databaseUrl: config.databaseUrl,
    databasePath: config.databasePath,
  });
  await database.initialize();

  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS.'));
    },
  }));
  app.use(express.json({ limit: '16kb' }));

  const requireAuth = createAuthMiddleware(config.jwtSecret);
  const authRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30 });
  const generationRateLimit = rateLimit({ windowMs: 60_000, limit: 12 });
  const emailService = createEmailService(config.email);

  app.get('/api/health', (req, res) => res.json({
    ok: true, auth: true, learning: true, database: database.provider,
  }));
  app.use('/api', createAuthRouter({
    database, jwtSecret: config.jwtSecret, requireAuth, authRateLimit, emailService,
  }));
  app.use('/api', createProfileRouter({ database, requireAuth }));
  app.use('/api', createGenerationRouter({ aiConfig: config.ai, generationRateLimit }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return { app, database };
}
