import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { authenticateToken } from '../middleware/auth.js';
import {
  getMediaByUser, getMediaById, deleteMedia,
  toggleFavorite, getFavorites, searchMedia,
  getMediaDirs, setMediaDirs,
  createShare, getShareByToken, getSharesByUser, deleteShare,
  saveProgress, getProgress
} from '../db/database.js';
import { scanMediaLibrary, getScanStatus, isScanning } from '../scanner.js';
import { generateVideoThumbnail, getCachedThumbnail } from '../thumbnails.js';

const router = Router();

router.get('/directories', authenticateToken, (req, res) => {
  const dirs = getMediaDirs();
  res.json({ directories: dirs });
});

router.get('/browse', authenticateToken, (req, res) => {
  const reqPath = req.query.path || process.platform === 'win32' ? 'C:\\' : '/';
  const resolved = path.resolve(reqPath);
  const home = process.platform === 'win32' ? 'C:\\' : require('os').homedir();
  const root = process.platform === 'win32' ? 'C:\\' : '/';
  const allowed = [root, home, ...getMediaDirs()].map(d => path.resolve(d));
  const isAllowed = allowed.some(a => resolved.startsWith(a));
  if (!isAllowed && !reqPath.startsWith('/Volumes') && !reqPath.startsWith('/media')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(resolved, e.name) }));
    res.json({ path: resolved, directories: dirs, parent: path.dirname(resolved) });
  } catch {
    res.status(500).json({ error: 'Cannot read directory' });
  }
});

router.post('/directories', authenticateToken, (req, res) => {
  const { directories } = req.body;
  if (!Array.isArray(directories)) {
    return res.status(400).json({ error: 'directories must be an array' });
  }
  const valid = directories.filter(d => typeof d === 'string' && d.trim());
  setMediaDirs(valid.map(d => path.resolve(d.trim())));
  res.json({ directories: getMediaDirs() });
});

router.post('/scan', authenticateToken, (req, res) => {
  if (isScanning()) return res.status(409).json({ error: 'Scan already in progress' });

  const dirs = getMediaDirs();
  if (!dirs.length) return res.status(400).json({ error: 'No media directories configured' });

  const result = scanMediaLibrary(req.userId);
  res.json(result);
});

router.get('/scan/status', authenticateToken, (req, res) => {
  res.json({ scanning: isScanning(), ...getScanStatus() });
});

router.get('/library', authenticateToken, (req, res) => {
  const { type } = req.query;
  const media = getMediaByUser(req.userId, type || null);
  res.json(media);
});

router.get('/favorites', authenticateToken, (req, res) => {
  const favorites = getFavorites(req.userId);
  res.json(favorites);
});

router.post('/favorites/:mediaId', authenticateToken, (req, res) => {
  const result = toggleFavorite(req.userId, parseInt(req.params.mediaId));
  res.json(result);
});

router.get('/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = searchMedia(req.userId, q);
  res.json(results);
});

router.get('/stream/:id', authenticateToken, (req, res) => {
  const media = getMediaById(parseInt(req.params.id), req.userId);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  const filePath = media.path;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  let mimeType = media.mime_type || mime.lookup(filePath) || 'application/octet-stream';
  if (path.extname(filePath).toLowerCase() === '.mov') mimeType = 'video/mp4';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'no-cache');

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

router.get('/thumbnail/:id', authenticateToken, (req, res) => {
  const media = getMediaById(parseInt(req.params.id), req.userId);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  const filePath = media.path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  if (media.type === 'image') {
    const mimeType = media.mime_type || mime.lookup(filePath) || 'image/jpeg';
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } else {
    const cached = getCachedThumbnail(filePath);
    if (cached) {
      const stat = fs.statSync(cached);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(cached).pipe(res);
      return;
    }

    try {
      const thumbPath = generateVideoThumbnail(filePath);
      if (thumbPath && fs.existsSync(thumbPath)) {
        const stat = fs.statSync(thumbPath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(thumbPath).pipe(res);
      } else {
        res.status(200).json({ thumbnail: null });
      }
    } catch {
      res.status(200).json({ thumbnail: null });
    }
  }
});

router.get('/shared/stream/:token', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Share not found' });

  const filePath = share.path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(filePath);
  const mimeType = share.mime_type || mime.lookup(filePath) || 'application/octet-stream';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
});

router.get('/shared/thumbnail/:token', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Share not found' });

  const filePath = share.path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  if (share.type === 'image') {
    const mimeType = share.mime_type || mime.lookup(filePath) || 'image/jpeg';
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } else {
    const cached = getCachedThumbnail(filePath);
    if (cached) {
      const stat = fs.statSync(cached);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(cached).pipe(res);
      return;
    }
    try {
      const thumbPath = generateVideoThumbnail(filePath);
      if (thumbPath && fs.existsSync(thumbPath)) {
        const stat = fs.statSync(thumbPath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(thumbPath).pipe(res);
      } else {
        res.status(200).json({ thumbnail: null });
      }
    } catch {
      res.status(200).json({ thumbnail: null });
    }
  }
});

router.post('/share/:id', authenticateToken, (req, res) => {
  try {
    const media = getMediaById(parseInt(req.params.id), req.userId);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const share = createShare(media.id, req.userId);
    if (!share) return res.status(500).json({ error: 'Failed to create share' });
    res.json({ token: share.token, url: `/api/share/${share.token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/share/:token', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  res.json({
    id: share.media_id,
    name: share.name,
    type: share.type,
    mime_type: share.mime_type,
    size: share.size,
    token: share.token
  });
});

router.delete('/share/:id', authenticateToken, (req, res) => {
  deleteShare(parseInt(req.params.id), req.userId);
  res.json({ message: 'Share removed' });
});

router.post('/progress/:id', authenticateToken, (req, res) => {
  const { position, duration } = req.body;
  if (position === undefined) return res.status(400).json({ error: 'position required' });
  saveProgress(req.userId, parseInt(req.params.id), position, duration || 0);
  res.json({ saved: true });
});

router.get('/progress/:id', authenticateToken, (req, res) => {
  const p = getProgress(req.userId, parseInt(req.params.id));
  res.json(p || { position: 0, duration: 0 });
});

router.get('/progress', authenticateToken, (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',').map(Number) : [];
  if (ids.length === 0) return res.json({});
  const map = {};
  for (const id of ids) {
    const p = getProgress(req.userId, id);
    if (p) map[id] = p;
  }
  res.json(map);
});

router.delete('/:id', authenticateToken, (req, res) => {
  const media = getMediaById(parseInt(req.params.id), req.userId);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  deleteMedia(media.id, req.userId);
  res.json({ message: 'Media removed from library' });
});

export default router;
