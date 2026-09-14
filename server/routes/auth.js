import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueAccountToken(database, userId, purpose, lifetimeMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + lifetimeMs).toISOString();
  await database.run('DELETE FROM account_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
  await database.run(`INSERT INTO account_tokens (user_id, purpose, token_hash, expires_at)
    VALUES (?, ?, ?, ?)`, [userId, purpose, hashToken(token), expiresAt]);
  return token;
}

async function validAccountToken(database, token, purpose) {
  if (!token || typeof token !== 'string') return null;
  const row = await database.get(`SELECT id, user_id, expires_at FROM account_tokens
    WHERE token_hash = ? AND purpose = ? AND used_at IS NULL`, [hashToken(token), purpose]);
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

export function createAuthRouter({
  database, jwtSecret, requireAuth, authRateLimit, emailService,
}) {
  const router = express.Router();
  const tokenFor = (user) => jwt.sign(user, jwtSecret, { expiresIn: '7d' });

  router.post('/signup', authRateLimit, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!name || name.length > 80 || !emailPattern.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Enter a valid name and email address.' });
      }
      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      }
      const existing = await database.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const verifiedAt = emailService.enabled ? null : new Date().toISOString();
      const result = await database.get(`INSERT INTO users (name, email, password_hash, email_verified_at)
        VALUES (?, ?, ?, ?) RETURNING id`, [name, email, passwordHash, verifiedAt]);
      const user = { id: result.id, name, email };

      if (emailService.enabled) {
        const verificationToken = await issueAccountToken(database, user.id, 'verify', 24 * 60 * 60_000);
        await emailService.sendVerification(email, verificationToken);
        return res.status(201).json({
          verificationRequired: true,
          message: 'Check your email to verify your account before signing in.',
        });
      }

      return res.status(201).json({ token: tokenFor(user), user });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/login', authRateLimit, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const row = await database.get(`SELECT id, name, email, password_hash, email_verified_at
        FROM users WHERE email = ?`, [email]);
      if (!row || !(await bcrypt.compare(password, row.password_hash))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (!row.email_verified_at) {
        return res.status(403).json({ error: 'Verify your email before signing in.' });
      }
      const user = { id: row.id, name: row.name, email: row.email };
      return res.json({ token: tokenFor(user), user });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/verify-email', authRateLimit, async (req, res, next) => {
    try {
      const accountToken = await validAccountToken(database, req.body?.token, 'verify');
      if (!accountToken) return res.status(400).json({ error: 'This verification link is invalid or expired.' });
      await database.run('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?', [accountToken.user_id]);
      await database.run('UPDATE account_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [accountToken.id]);
      return res.json({ message: 'Email verified. You can now sign in.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/request-verification', authRateLimit, async (req, res, next) => {
    try {
      if (!emailService.enabled) {
        return res.status(503).json({ error: 'Verification email is not configured yet.' });
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      const user = await database.get('SELECT id, email, email_verified_at FROM users WHERE email = ?', [email]);
      if (user && !user.email_verified_at) {
        const verificationToken = await issueAccountToken(database, user.id, 'verify', 24 * 60 * 60_000);
        await emailService.sendVerification(user.email, verificationToken);
      }
      return res.json({ message: 'If that account needs verification, a new link has been sent.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/request-password-reset', authRateLimit, async (req, res, next) => {
    try {
      if (!emailService.enabled) {
        return res.status(503).json({ error: 'Password-reset email is not configured yet.' });
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      const user = await database.get('SELECT id, email FROM users WHERE email = ?', [email]);
      if (user) {
        const resetToken = await issueAccountToken(database, user.id, 'reset', 60 * 60_000);
        await emailService.sendPasswordReset(user.email, resetToken);
      }
      return res.json({ message: 'If that account exists, a reset link has been sent.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/reset-password', authRateLimit, async (req, res, next) => {
    try {
      const password = String(req.body?.password || '');
      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      }
      const accountToken = await validAccountToken(database, req.body?.token, 'reset');
      if (!accountToken) return res.status(400).json({ error: 'This reset link is invalid or expired.' });
      const passwordHash = await bcrypt.hash(password, 12);
      await database.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, accountToken.user_id]);
      await database.run('UPDATE account_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [accountToken.id]);
      return res.json({ message: 'Password updated. You can now sign in.' });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/session', requireAuth, async (req, res, next) => {
    try {
      const user = await database.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
      if (!user) return res.status(401).json({ error: 'Account not found.' });
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
