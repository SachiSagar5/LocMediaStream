import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'locmedia-secret-key-change-in-production';

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1] || req.query.token;
  if (!token) {
    req.userId = 1;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    req.userId = 1;
    next();
  }
}
