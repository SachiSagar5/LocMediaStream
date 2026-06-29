import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

function getCerts(force) {
  if (!force && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
  }

  console.log('  Generating self-signed SSL certificate...');
  fs.mkdirSync(certDir, { recursive: true });

  const subj = '/CN=LocMediaStream';
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "${subj}"`,
      { stdio: 'ignore', timeout: 10000 }
    );
    fs.chmodSync(keyPath, 0o600);
    console.log('  SSL certificate generated.');
  } catch (e) {
    console.log('  Warning: openssl failed, HTTPS will be disabled:', e.message);
    return null;
  }

  return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
}

export { getCerts, certDir };