import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FiFilm, FiImage, FiLogOut, FiSearch, FiStar,
  FiRefreshCw, FiSettings, FiSun, FiMoon, FiSmartphone, FiX, FiMenu
} from 'react-icons/fi';
import { QRCodeCanvas } from 'qrcode.react';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showQR, setShowQR] = useState(false);
  const [serverURL, setServerURL] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshServerURL = () => {
    fetch('/api/server/info')
      .then(r => r.json())
      .then(info => {
        if (info.tunnelUrl) {
          setServerURL(info.tunnelUrl + '/');
          return;
        }
        const ip = info.ips?.[0] || location.hostname;
        const httpsPort = info.httpsPort;
        if (httpsPort) {
          setServerURL(`https://${ip}:${httpsPort}/`);
        } else {
          setServerURL(`http://${ip}:${info.port || 5001}/`);
        }
      })
      .catch(() => setServerURL(window.location.origin + '/'));
  };

  useEffect(refreshServerURL, []);

  const openQR = () => {
    refreshServerURL();
    setShowQR(true);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const currentTab = new URLSearchParams(location.search).get('type') ||
    (location.pathname === '/' ? 'all' : '');

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
      setMenuOpen(false);
    }
  };

  const handleRescan = async () => {
    setScanning(true);
    try {
      const res = await api.post('/media/scan');
      if (res.data.success) window.location.reload();
      else if (res.data.error) alert(res.data.error);
    } catch (err) {
      alert(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const tabClick = () => setMenuOpen(false);

  return (
    <>
      <nav className="tv-nav">
        <div className="tv-nav-left">
          <Link to="/" className="tv-nav-brand" onClick={tabClick}>
            <span className="tv-nav-logo">&#9654;</span>
            <span>LocMedia</span>
          </Link>
          <div className="tv-nav-tabs">
            <Link to="/" className={`tv-nav-tab ${currentTab === 'all' ? 'active' : ''}`}>All</Link>
            <Link to="/?type=video" className={`tv-nav-tab ${currentTab === 'video' ? 'active' : ''}`}>
              <FiFilm size={14} /> Videos
            </Link>
            <Link to="/?type=image" className={`tv-nav-tab ${currentTab === 'image' ? 'active' : ''}`}>
              <FiImage size={14} /> Photos
            </Link>
            <Link to="/?favorites=true" className="tv-nav-tab">
              <FiStar size={14} /> Favorites
            </Link>
          </div>
        </div>
        <div className="tv-nav-right">
          <button className="tv-nav-btn tv-hamburger" onClick={() => setMenuOpen(true)} title="Menu">
            <FiMenu size={20} />
          </button>
          <form className="tv-search" onSubmit={handleSearch}>
            <FiSearch className="tv-search-icon" />
            <input type="text" placeholder="Search" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </form>
          <button className="tv-nav-btn tv-hide-mobile" onClick={toggleTheme} title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <button className="tv-nav-btn tv-hide-mobile" onClick={() => setShowQR(true)} title="QR Code">
            <FiSmartphone size={18} />
          </button>
          <button className="tv-nav-btn tv-hide-mobile" onClick={handleRescan} disabled={scanning} title="Rescan">
            <FiRefreshCw className={scanning ? 'spin' : ''} size={18} />
          </button>
          <button className="tv-nav-btn tv-hide-mobile" onClick={() => setShowSettings(true)} title="Settings">
            <FiSettings size={18} />
          </button>
          <div className="tv-nav-user tv-hide-mobile">
            <span>{user?.username}</span>
            <button className="tv-nav-btn" onClick={logout} title="Logout">
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <Link to="/" className="tv-nav-brand" onClick={tabClick}>
                <span className="tv-nav-logo">&#9654;</span>
                <span>LocMedia</span>
              </Link>
              <button className="btn-icon" onClick={() => setMenuOpen(false)}><FiX size={20} /></button>
            </div>
            <div className="mobile-menu-search">
              <form className="tv-search" onSubmit={handleSearch}>
                <FiSearch className="tv-search-icon" />
                <input type="text" placeholder="Search" value={search}
                  onChange={(e) => setSearch(e.target.value)} autoFocus />
              </form>
            </div>
            <nav className="mobile-menu-nav">
              <Link to="/" className={`mobile-menu-link ${currentTab === 'all' ? 'active' : ''}`} onClick={tabClick}>
                All
              </Link>
              <Link to="/?type=video" className={`mobile-menu-link ${currentTab === 'video' ? 'active' : ''}`} onClick={tabClick}>
                <FiFilm size={16} /> Videos
              </Link>
              <Link to="/?type=image" className={`mobile-menu-link ${currentTab === 'image' ? 'active' : ''}`} onClick={tabClick}>
                <FiImage size={16} /> Photos
              </Link>
              <Link to="/?favorites=true" className="mobile-menu-link" onClick={tabClick}>
                <FiStar size={16} /> Favorites
              </Link>
            </nav>
            <div className="mobile-menu-actions">
              <button className="mobile-menu-action" onClick={() => { setShowQR(true); setMenuOpen(false); }}>
                <FiSmartphone size={18} /> QR Code
              </button>
              <button className="mobile-menu-action" onClick={toggleTheme}>
                {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />} {theme === 'dark' ? 'Light' : 'Dark'} Mode
              </button>
              <button className="mobile-menu-action" onClick={() => { handleRescan(); setMenuOpen(false); }} disabled={scanning}>
                <FiRefreshCw className={scanning ? 'spin' : ''} size={18} /> Rescan
              </button>
              <button className="mobile-menu-action" onClick={() => { setShowSettings(true); setMenuOpen(false); }}>
                <FiSettings size={18} /> Settings
              </button>
              <button className="mobile-menu-action" onClick={() => { logout(); setMenuOpen(false); }}>
                <FiLogOut size={18} /> Logout
              </button>
            </div>
            <div className="mobile-menu-user">
              <span>{user?.username}</span>
            </div>
          </div>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <FiSmartphone size={20} />
              <h3>Access from Any Device</h3>
              <button className="btn-icon" onClick={() => setShowQR(false)}><FiX size={20} /></button>
            </div>
            <p className="qr-modal-sub">Scan this QR code with your phone camera to open LocMedia on the same network.</p>
            <div className="qr-modal-body">
              <div className="qr-code-box">
                {serverURL && <QRCodeCanvas value={serverURL} size={200} level="M" fgColor="#000000" bgColor="#ffffff" />}
              </div>
              <div className="qr-url-box">
                <span className="qr-url">{serverURL}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}