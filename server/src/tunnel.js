import localtunnel from 'localtunnel';

let tunnel = null;
let tunnelUrl = null;

async function startTunnel(port) {
  if (tunnel) return;
  try {
    tunnel = await localtunnel({ port, subdomain: `locmedia-${Date.now().toString(36)}` });
    tunnelUrl = tunnel.url;
    tunnel.on('close', () => { tunnel = null; tunnelUrl = null; });
    return tunnelUrl;
  } catch {
    return null;
  }
}

function stopTunnel() {
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