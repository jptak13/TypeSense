import jwt from 'jsonwebtoken';

export function createAuthMiddleware(secret) {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Sign in required.' });
    try {
      req.user = jwt.verify(token, secret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
  };
}
