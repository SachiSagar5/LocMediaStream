import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMB_DIR = path.join(__dirname, '..', 'data', 'thumbnails');

if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

function getThumbnailPath(filePath) {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  return path.join(THUMB_DIR, `${hash}.jpg`);
}

export function getCachedThumbnail(filePath) {
  const thumbPath = getThumbnailPath(filePath);
  if (fs.existsSync(thumbPath)) return thumbPath;
  return null;
}

export function generateVideoThumbnail(videoPath) {
  const thumbPath = getThumbnailPath(videoPath);

  const cached = getCachedThumbnail(videoPath);
  if (cached) return cached;

  try {
    execSync(
      `ffmpeg -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 3 -f image2 -update 1 "${thumbPath}"`,
      { stdio: 'ignore', timeout: 15000 }
    );

    if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
      return thumbPath;
    }
    return null;
  } catch {
    try {
      execSync(
        `ffmpeg -y -ss 00:00:00 -i "${videoPath}" -vframes 1 -q:v 3 -f image2 -update 1 "${thumbPath}"`,
        { stdio: 'ignore', timeout: 15000 }
      );
      if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
        return thumbPath;
      }
    } catch {}
    return null;
  }
}

export function clearThumbnailCache() {
  try {
    const files = fs.readdirSync(THUMB_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(THUMB_DIR, file));
    }
  } catch {}
}
