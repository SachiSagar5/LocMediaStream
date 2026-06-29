import express from 'express';
import https from 'https';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import mediaRoutes from './routes/media.js';
import { getMediaDirs, getSetting, setMediaDirs, db, createUser, getUserByUsername } from './db/database.js';
import { getCerts } from './setup-certs.js';
import { startTunnel, stopTunnel, getTunnelUrl } from './tunnel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '5001');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '5443');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

const serverIPs = getLocalIPs();
const serverInfo = { port: PORT, httpsPort: HTTPS_PORT, ips: serverIPs, hostname: os.hostname() };
app.get('/api/server/info', (req, res) => res.json({ ...serverInfo, tunnelUrl: getTunnelUrl() }));

app.post('/api/server/tunnel', async (req, res) => {
  const { enabled } = req.body;
  if (enabled) {
    const url = await startTunnel(PORT);
    res.json({ tunnelUrl: url });
  } else {
    stopTunnel();
    res.json({ tunnelUrl: null });
  }
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

if (!getUserByUsername('guest')) {
  createUser('guest', 'guest@local', 'guest');
  console.log('  Created default guest user (login disabled)');
}

function printURLs(protocol, port) {
  const ips = getLocalIPs();
  console.log(`  ${protocol === 'https' ? 'Secure' : 'Local'}:   ${protocol}://localhost:${port}`);
  ips.forEach(ip => console.log(`  Network:   ${protocol}://${ip}:${port}`));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  LocMediaStream Server`);
  console.log(`  ─────────────────────`);
  printURLs('http', PORT);

  const certs = getCerts();
  if (certs) {
    https.createServer(certs, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`  ─────────────────────`);
      printURLs('https', HTTPS_PORT);
    });
  }

  const dbName = db.name;
  let dbSize = 'N/A';
  try { const s = fs.statSync(dbName); dbSize = `${(s.size / 1024).toFixed(1)} KB`; } catch {}
  console.log(`  DB:      ${dbName} (${dbSize})`);
  console.log();

  const envDirs = process.env.MEDIA_DIRS;
  const savedDirs = getMediaDirs();

  if (envDirs && !savedDirs.length) {
    const dirs = envDirs.split(',').map(d => d.trim()).filter(Boolean);
    if (dirs.length) {
      setMediaDirs(dirs);
      console.log(`  Using MEDIA_DIRS: ${dirs.join(', ')}`);
    }
  }

  const dirs = getMediaDirs();
  if (dirs.length) {
    console.log(`  Media dirs: ${dirs.join(', ')}`);
  } else {
    console.log('  No media directories configured. Use Settings or set MEDIA_DIRS env.');
  }
  console.log();
});