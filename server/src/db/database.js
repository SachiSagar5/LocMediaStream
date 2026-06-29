import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'data', 'locmedia.db');

import fs from 'fs';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    directories TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS media_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('video', 'image')),
    mime_type TEXT,
    size INTEGER,
    file_modified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
    UNIQUE(user_id, media_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playback_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    position REAL NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
    UNIQUE(user_id, media_id)
  );
`);

// Migrate: add directories column to users if missing, fix media_library constraint
try { db.exec(`ALTER TABLE users ADD COLUMN directories TEXT DEFAULT '[]'`); } catch {}
try {
  // Fix: UNIQUE(path) -> UNIQUE(user_id, path)
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='media_library'`).get();
  if (schema && schema.sql && !schema.sql.includes('UNIQUE(user_id, path)')) {
    db.exec(`
      CREATE TABLE media_library_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('video', 'image')),
        mime_type TEXT,
        size INTEGER,
        file_modified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, path)
      );
      INSERT OR IGNORE INTO media_library_new SELECT * FROM media_library;
      DROP TABLE media_library;
      ALTER TABLE media_library_new RENAME TO media_library;
    `);
  }
} catch (e) { console.error('Migration error:', e.message); }

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mkv', '.mov', '.avi', '.wmv', '.m4v', '.mpeg', '.mpg',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.svg', '.heic', '.heif'
]);

export function createUser(username, email, password) {
  const hashed = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
  const result = stmt.run(username, email, hashed);
  return result.lastInsertRowid;
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(id);
}

export function verifyPassword(inputPassword, hashedPassword) {
  return bcrypt.compareSync(inputPassword, hashedPassword);
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getMediaDirs(userId) {
  const user = db.prepare('SELECT directories FROM users WHERE id = ?').get(userId);
  if (!user || !user.directories) return [];
  try { return JSON.parse(user.directories); } catch { return []; }
}

export function setMediaDirs(userId, dirs) {
  db.prepare('UPDATE users SET directories = ? WHERE id = ?').run(JSON.stringify(dirs), userId);
}

export function getMediaByUserAndPath(userId, filePath) {
  return db.prepare('SELECT * FROM media_library WHERE user_id = ? AND path = ?').get(userId, filePath);
}

export function upsertMedia(userId, media) {
  const existing = getMediaByUserAndPath(userId, media.path);
  if (existing) {
    db.prepare(`
      UPDATE media_library SET name=?, type=?, mime_type=?, size=?, file_modified_at=?
      WHERE user_id = ? AND path = ?
    `).run(media.name, media.type, media.mime_type, media.size, media.file_modified_at, userId, media.path);
    return existing.id;
  } else {
    const stmt = db.prepare(`
      INSERT INTO media_library (user_id, path, name, type, mime_type, size, file_modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, media.path, media.name, media.type, media.mime_type, media.size, media.file_modified_at).lastInsertRowid;
  }
}

export function removeMediaByUserAndPaths(userId, paths) {
  if (paths.length === 0) return;
  const placeholders = paths.map(() => '?').join(',');
  db.prepare(`DELETE FROM media_library WHERE user_id = ? AND path IN (${placeholders})`).run(userId, ...paths);
}

export function getMediaByUser(userId, type = null) {
  let query = 'SELECT * FROM media_library WHERE user_id = ?';
  const params = [userId];
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

export function getMediaById(id, userId) {
  return db.prepare('SELECT * FROM media_library WHERE id = ? AND user_id = ?').get(id, userId);
}

export function deleteMedia(id, userId) {
  return db.prepare('DELETE FROM media_library WHERE id = ? AND user_id = ?').run(id, userId);
}

export function toggleFavorite(userId, mediaId) {
  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND media_id = ?').get(userId, mediaId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    return { favorited: false };
  } else {
    db.prepare('INSERT INTO favorites (user_id, media_id) VALUES (?, ?)').run(userId, mediaId);
    return { favorited: true };
  }
}

export function getFavorites(userId) {
  return db.prepare(`
    SELECT m.* FROM media_library m
    JOIN favorites f ON m.id = f.media_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId);
}

export function createShare(mediaId, userId) {
  const existing = db.prepare('SELECT * FROM shares WHERE media_id = ? AND user_id = ?').get(mediaId, userId);
  if (existing) return existing;

  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT OR IGNORE INTO shares (media_id, user_id, token) VALUES (?, ?, ?)').run(mediaId, userId, token);
  return db.prepare('SELECT * FROM shares WHERE media_id = ? AND user_id = ?').get(mediaId, userId);
}

export function getShareByToken(token) {
  return db.prepare(`
    SELECT s.*, m.path, m.name, m.type, m.mime_type, m.size
    FROM shares s
    JOIN media_library m ON s.media_id = m.id
    WHERE s.token = ?
  `).get(token);
}

export function deleteShare(mediaId, userId) {
  db.prepare('DELETE FROM shares WHERE media_id = ? AND user_id = ?').run(mediaId, userId);
}

export function getSharesByUser(userId) {
  return db.prepare(`
    SELECT s.*, m.name, m.type
    FROM shares s
    JOIN media_library m ON s.media_id = m.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(userId);
}

export function searchMedia(userId, query) {
  return db.prepare(`
    SELECT * FROM media_library
    WHERE user_id = ? AND name LIKE ?
    ORDER BY created_at DESC
  `).all(userId, `%${query}%`);
}

export function saveProgress(userId, mediaId, position, duration) {
  db.prepare(`
    INSERT INTO playback_progress (user_id, media_id, position, duration, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, media_id)
    DO UPDATE SET position = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
  `).run(userId, mediaId, position, duration, position, duration);
}

export function getProgress(userId, mediaId) {
  return db.prepare('SELECT position, duration, updated_at FROM playback_progress WHERE user_id = ? AND media_id = ?').get(userId, mediaId);
}

export { MEDIA_EXTENSIONS };
export { db };
export default db;
