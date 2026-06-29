import { Router } from 'express';
import { createUser, getUserByUsername, getUserByEmail, verifyPassword, getUserById } from '../db/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    if (getUserByUsername(username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    if (getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userId = createUser(username, email, password);
    const token = generateToken(userId);
    const user = getUserById(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginId = username || email;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = loginId.includes('@')
      ? getUserByEmail(loginId)
      : getUserByUsername(loginId);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    const { password: _, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
