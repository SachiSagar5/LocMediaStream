import localtunnel from 'localtunnel';
import http from 'http';

let tunnel = null;
let tunnelUrl = null;
let keepAliveTimer = null;

async function startTunnel(port) {
  if (tunnel) return;
  try {
    tunnel = await localtunnel({ port, subdomain: `locmedia-${Date.now().toString(36)}`, local_host: '127.0.0.1' });
    tunnelUrl = tunnel.url;
    console.log('  Tunnel:', tunnelUrl);

    tunnel.on('close', () => {
      console.log('  Tunnel closed');
      stopTunnel();
    });

    tunnel.on('error', (err) => {
      console.error('  Tunnel error:', err.message);
    });

    keepAliveTimer = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/api/server/info`, (res) => { res.resume(); }).on('error', () => {});
    }, 30000);

    return tunnelUrl;
  } catch (err) {
    console.error('  Tunnel failed:', err.message);
    return null;
  }
}

function stopTunnel() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (tunnel) {
    tunnel.close();
    tunnel = null;
    tunnelUrl = null;
  }
}

function getTunnelUrl() {
  return tunnelUrl;
}

export { startTunnel, stopTunnel, getTunnelUrl };