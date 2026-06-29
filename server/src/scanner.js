import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { getMediaDirs, upsertMedia, getMediaByUser, removeMediaByUserAndPaths, MEDIA_EXTENSIONS } from './db/database.js';

let scanning = false;
let scanProgress = { status: 'idle', total: 0, scanned: 0, added: 0, removed: 0, errors: 0 };

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const videoExts = ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.wmv', '.m4v', '.mpeg', '.mpg'];
  return videoExts.includes(ext) ? 'video' : 'image';
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mov') return 'video/mp4';
  const m = mime.lookup(filePath);
  return m || (getMediaType(filePath) === 'video' ? 'video/mp4' : 'image/jpeg');
}

function walkDir(dir, userId, stats) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) {
            results = results.concat(walkDir(fullPath, userId, stats));
          }
        } else if (entry.isFile()) {
          stats.total++;
          const ext = path.extname(entry.name).toLowerCase();
          if (MEDIA_EXTENSIONS.has(ext)) {
            results.push(fullPath);
          }
        }
      } catch {
        stats.errors++;
      }
    }
  } catch {
    stats.errors++;
  }
  return results;
}

export function scanMediaLibrary(userId) {
  if (scanning) return { error: 'Scan already in progress' };

  const dirs = getMediaDirs(userId);
  if (!dirs.length) return { error: 'No media directories configured' };

  scanning = true;
  scanProgress = { status: 'scanning', total: 0, scanned: 0, added: 0, removed: 0, errors: 0 };

  try {
    const stats = { total: 0, errors: 0 };

    const allFiles = [];
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        const files = walkDir(dir, userId, stats);
        allFiles.push(...files);
      } else {
        scanProgress.errors++;
      }
    }

    scanProgress.total = allFiles.length;
    const scannedPaths = new Set();

    for (const filePath of allFiles) {
      try {
        scanProgress.scanned++;
        const stat = fs.statSync(filePath);
        const name = path.basename(filePath).replace(/\.[^/.]+$/, '');
        const mediaData = {
          path: filePath,
          name,
          type: getMediaType(filePath),
          mime_type: getMimeType(filePath),
          size: stat.size,
          file_modified_at: stat.mtime.toISOString()
        };

        upsertMedia(userId, mediaData);
        scannedPaths.add(filePath);
        scanProgress.added++;

        if (scanProgress.scanned % 50 === 0) {
          scanProgress.status = `scanning (${scanProgress.scanned}/${scanProgress.total})`;
        }
      } catch {
        scanProgress.errors++;
      }
    }

    const existing = getMediaByUser(userId).map(m => m.path);
    const toRemove = existing.filter(p => !scannedPaths.has(p));
    if (toRemove.length > 0) {
      removeMediaByUserAndPaths(userId, toRemove);
      scanProgress.removed = toRemove.length;
    }

    scanProgress.status = 'completed';
    return { success: true, ...scanProgress };
  } catch (err) {
    scanProgress.status = 'error';
    return { error: err.message, ...scanProgress };
  } finally {
    scanning = false;
  }
}

export function getScanStatus() {
  return scanProgress;
}

export function isScanning() {
  return scanning;
}
