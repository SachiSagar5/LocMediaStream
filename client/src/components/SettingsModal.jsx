import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiX, FiPlus, FiTrash2, FiFolder, FiRefreshCw, FiMonitor, FiSettings, FiGlobe, FiSearch, FiChevronRight, FiArrowUp } from 'react-icons/fi';

export default function SettingsModal({ onClose }) {
  const { api } = useAuth();
  const [directories, setDirectories] = useState([]);
  const [newDir, setNewDir] = useState('');
  const [scanStatus, setScanStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseDirs, setBrowseDirs] = useState([]);
  const [browseParent, setBrowseParent] = useState('');
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    fetch('/api/server/info').then(r => r.json()).then(info => {
      setServerInfo(info);
      if (info.tunnelUrl) setTunnelEnabled(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/media/directories').then(res => {
      setDirectories(res.data.directories || []);
    }).catch(() => {});
  }, [api]);

  const addDirectory = () => {
    const dir = newDir.trim();
    if (!dir || directories.includes(dir)) return;
    setDirectories([...directories, dir]);
    setNewDir('');
  };

  const removeDirectory = (idx) => {
    setDirectories(directories.filter((_, i) => i !== idx));
  };

  const loadBrowse = async (dirPath) => {
    setBrowseLoading(true);
    try {
      const res = await fetch(`/api/media/browse?path=${encodeURIComponent(dirPath)}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setBrowsePath(data.path);
      setBrowseDirs(data.directories);
      setBrowseParent(data.parent);
    } catch {
      alert('Cannot browse this directory');
    } finally {
      setBrowseLoading(false);
    }
  };

  const openBrowser = () => {
    const startPath = directories.length > 0 ? directories[0] : '/';
    setBrowsing(true);
    loadBrowse(startPath);
  };

  const selectBrowseDir = (dir) => {
    if (dir && !directories.includes(dir)) {
      setDirectories([...directories, dir]);
    }
    setBrowsing(false);
  };

  const saveDirectories = async () => {
    setSaving(true);
    try {
      const res = await api.post('/media/directories', { directories });
      setDirectories(res.data.directories);
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanStatus(null);
    try {
      await api.post('/media/directories', { directories });
      const res = await api.post('/media/scan');
      setScanStatus(res.data);
      if (res.data.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setScanStatus({ error: err.response?.data?.error || err.message });
    } finally {
      setScanning(false);
    }
  };

  const toggleTunnel = async () => {
    setTunnelLoading(true);
    try {
      const res = await api.post('/server/tunnel', { enabled: !tunnelEnabled });
      setTunnelEnabled(!!res.data.tunnelUrl);
      if (res.data.tunnelUrl) {
        setServerInfo(prev => ({ ...prev, tunnelUrl: res.data.tunnelUrl }));
      } else {
        setServerInfo(prev => ({ ...prev, tunnelUrl: null }));
      }
    } catch (err) {
      alert('Tunnel failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setTunnelLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><FiSettings /> Settings</h2>
          <button className="btn-icon" onClick={onClose}><FiX size={20} /></button>
        </div>

        <div className="modal-body">
          <section className="settings-section">
            <h3><FiMonitor /> Network Access</h3>
            <p className="help-text">
              Access from devices on the same network:
            </p>
            {serverInfo && serverInfo.ips?.map(ip => (
              <div key={ip} style={{ marginBottom: 8 }}>
                <div className="network-url">
                  http://{ip}:{serverInfo.port}
                </div>
                {serverInfo.httpsPort && (
                  <div className="network-url" style={{ marginTop: 6 }}>
                    https://{ip}:{serverInfo.httpsPort}
                  </div>
                )}
              </div>
            ))}
            {serverInfo?.tunnelUrl && (
              <div style={{ marginTop: 10 }}>
                <p className="help-text" style={{ color: 'var(--success)' }}>
                  External access active:
                </p>
                <div className="network-url" style={{ color: 'var(--success)' }}>
                  {serverInfo.tunnelUrl}
                </div>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button
                className={`btn-primary small ${tunnelEnabled ? 'secondary' : ''}`}
                onClick={toggleTunnel}
                disabled={tunnelLoading}
              >
                <FiGlobe /> {tunnelLoading ? 'Connecting...' : tunnelEnabled ? 'Disable External Access' : 'Enable External Access'}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3><FiFolder /> Media Directories</h3>
            <p className="help-text">
              Add folders containing your photos and videos. The scanner will recursively find all supported media files.
            </p>

            <div className="dir-list">
              {directories.length === 0 && (
                <div className="empty-dirs">No directories configured yet.</div>
              )}
              {directories.map((dir, i) => (
                <div key={i} className="dir-item">
                  <FiFolder className="dir-icon" />
                  <span className="dir-path">{dir}</span>
                  <button className="btn-icon danger" onClick={() => removeDirectory(i)} title="Remove">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {browsing ? (
              <div className="dir-browser">
                <div className="dir-browser-header">
                  <span className="dir-browser-path">{browsePath}</span>
                  <button className="btn-icon" onClick={() => setBrowsing(false)} title="Close">
                    <FiX size={14} />
                  </button>
                </div>
                <div className="dir-browser-list">
                  {browseParent && browseParent !== browsePath && (
                    <div className="dir-browser-item parent" onClick={() => loadBrowse(browseParent)}>
                      <FiArrowUp size={14} /> ..
                    </div>
                  )}
                  {browseLoading ? (
                    <div className="dir-browser-loading">Loading...</div>
                  ) : browseDirs.length === 0 ? (
                    <div className="dir-browser-empty">No subdirectories</div>
                  ) : (
                    browseDirs.map(d => (
                      <div key={d.path} className="dir-browser-item"
                        onClick={() => loadBrowse(d.path)}>
                        <FiFolder size={14} />
                        <span className="dir-browser-name">{d.name}</span>
                        <button className="btn-icon" title="Select this folder"
                          onClick={(e) => { e.stopPropagation(); selectBrowseDir(d.path); }}>
                          <FiPlus size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="dir-browser-select">
                  <button className="btn-primary small" onClick={() => selectBrowseDir(browsePath)}>
                    <FiPlus /> Select Current Folder
                  </button>
                </div>
              </div>
            ) : (
              <div className="dir-input-group">
                <input
                  type="text"
                  placeholder="/path/to/your/media"
                  value={newDir}
                  onChange={(e) => setNewDir(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDirectory()}
                />
                <button className="btn-primary small" onClick={addDirectory}><FiPlus /> Add</button>
                <button className="btn-primary small secondary" onClick={openBrowser} title="Browse server folders">
                  <FiSearch /> Browse
                </button>
              </div>
            )}

            <div className="settings-actions">
              <button className="btn-primary small" onClick={saveDirectories} disabled={saving}>
                {saving ? 'Saving...' : 'Save Directories'}
              </button>
              <button
                className={`btn-primary small secondary ${scanning ? 'disabled' : ''}`}
                onClick={handleScan}
                disabled={scanning || directories.length === 0}
              >
                <FiRefreshCw className={scanning ? 'spin' : ''} />
                {scanning ? 'Scanning...' : 'Scan Now'}
              </button>
            </div>

            {scanStatus && (
              <div className={`scan-result ${scanStatus.success ? 'success' : 'error'}`}>
                {scanStatus.success ? (
                  <p>Scan completed! Added: {scanStatus.added}, Removed: {scanStatus.removed}, Errors: {scanStatus.errors}</p>
                ) : (
                  <p>Scan failed: {scanStatus.error}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
