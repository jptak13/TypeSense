import express from 'express';

const emptyProfile = { version: 1, sessions: 0, words: {}, patterns: {}, updatedAt: null };

function validProfile(profile) {
  return profile && typeof profile === 'object' && Number.isFinite(profile.sessions)
    && profile.words && typeof profile.words === 'object'
    && profile.patterns && typeof profile.patterns === 'object'
    && Buffer.byteLength(JSON.stringify(profile), 'utf8') <= 250_000;
}

export function createProfileRouter({ database, requireAuth }) {
  const router = express.Router();

  router.get('/profile', requireAuth, async (req, res, next) => {
    try {
      const row = await database.get('SELECT profile_json FROM learning_profiles WHERE user_id = ?', [req.user.id]);
      const profile = row
        ? (typeof row.profile_json === 'string' ? JSON.parse(row.profile_json) : row.profile_json)
        : emptyProfile;
      return res.json({ profile });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/profile', requireAuth, async (req, res, next) => {
    try {
      const profile = req.body?.profile;
      if (!validProfile(profile)) return res.status(400).json({ error: 'Invalid learning profile.' });
      await database.run(`INSERT INTO learning_profiles (user_id, profile_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, JSON.stringify(profile)]);
      return res.json({ profile });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
