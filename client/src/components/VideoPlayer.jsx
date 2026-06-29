import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiHeart, FiDownload, FiFilm, FiShare2, FiPlay, FiPause, FiMaximize, FiMinimize, FiSkipBack, FiSkipForward, FiVolume2, FiVolumeX } from 'react-icons/fi';
import ShareModal from './ShareModal';

function mediaUrl(path, id) {
  const token = localStorage.getItem('token');
  return `/api/media/${path}/${id}${token ? `?token=${token}` : ''}`;
}

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPlayer() {
  const { id } = useParams();
  const { api } = useAuth();
  const navigate = useNavigate();
  const [media, setMedia] = useState(null);
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [thumbnail, setThumbnail] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef(null);
  const saveInterval = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(null);
  const thumbCache = useRef(new Map());
  const wrapperRef = useRef(null);

  const generateThumbnail = useCallback((time) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const cached = thumbCache.current.get(Math.floor(time));
    if (cached) { setThumbnail(cached); return; }
    try {
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      thumbCache.current.set(Math.floor(time), dataUrl);
      if (thumbCache.current.size > 200) {
        const first = thumbCache.current.keys().next().value;
        thumbCache.current.delete(first);
      }
      setThumbnail(dataUrl);
    } catch {}
  }, []);

  const captureThumbnail = useCallback((time) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    video.currentTime = time;
    generateThumbnail(time);
  }, [generateThumbnail]);

  const handleProgressHover = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const time = pct * duration;
    setHoverX(x);
    setHoverTime(time);
    captureThumbnail(time);
  }, [duration, captureThumbnail]);

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
    setThumbnail(null);
  }, []);

  const handleProgressClick = useCallback((e) => {
    const video = videoRef.current;
    const rect = progressRef.current?.getBoundingClientRect();
    if (!video || !rect) return;
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    video.currentTime = pct * duration;
  }, [duration]);

  const goToVideo = useCallback((idx) => {
    if (idx < 0 || idx >= videos.length) return;
    navigate(`/watch/${videos[idx].id}`);
  }, [videos, navigate]);

  const goNext = useCallback(() => goToVideo(currentIndex + 1), [goToVideo, currentIndex]);
  const goPrev = useCallback(() => goToVideo(currentIndex - 1), [goToVideo, currentIndex]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const saveProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !media) return;
    try {
      api.post(`/media/progress/${media.id}`, {
        position: video.currentTime,
        duration: video.duration || 0
      });
    } catch {}
  }, [api, media]);

  useEffect(() => {
    api.get('/media/library')
      .then(res => {
        const all = res.data.filter(m => m.type === 'video');
        setVideos(all);
        const idx = all.findIndex(m => m.id === parseInt(id));
        if (idx === -1) { setError('Media not found'); return; }
        setCurrentIndex(idx);
        setMedia(all[idx]);
      })
      .catch(() => setError('Failed to load media'))
      .finally(() => setLoading(false));
  }, [id, api]);

  useEffect(() => {
    if (!media) return;
    api.get(`/media/progress/${media.id}`)
      .then(res => {
        if (res.data.position > 5) {
          const video = videoRef.current;
          if (video) {
            const trySeek = () => {
              if (video.readyState >= 1) {
                video.currentTime = res.data.position;
              } else {
                video.addEventListener('loadedmetadata', () => {
                  video.currentTime = res.data.position;
                }, { once: true });
              }
            };
            trySeek();
          }
        }
      })
      .catch(() => {});
  }, [media, api]);

  useEffect(() => {
    saveInterval.current = setInterval(saveProgress, 5000);
    return () => clearInterval(saveInterval.current);
  }, [saveProgress]);

  useEffect(() => {
    const handleBeforeUnload = () => saveProgress();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);

  const handleVideoError = (e) => {
    const el = e?.target || videoRef.current;
    const error = el?.error;
    const code = error?.code || 0;
    const codes = { 1: 'aborted', 2: 'network error', 3: 'decode error', 4: 'format not supported' };
    setError(`Video playback error (${codes[code] || code})`);
    setPlayError(true);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) { setCurrentTime(v.currentTime); setDuration(v.duration || 0); }
  };

  const handlePlay = () => setPlaying(true);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (error && !media) return (
    <div className="player-error">
      <FiFilm size={64} />
      <h2>{error}</h2>
      <Link to="/" className="btn-primary">Back to Library</Link>
    </div>
  );

  const poster = mediaUrl('thumbnail', id);
  const videoSrc = mediaUrl('stream', id);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="video-player-page">
      <div className="video-blur-bg" style={{ backgroundImage: `url(${poster})` }} />
      <div className="video-player-nav">
        <Link to="/" className="btn-icon"><FiArrowLeft size={22} /></Link>
        <button className="btn-icon" onClick={goPrev} disabled={currentIndex <= 0} title="Previous">
          <FiSkipBack size={18} />
        </button>
        <button className="btn-icon" onClick={goNext} disabled={currentIndex >= videos.length - 1} title="Next">
          <FiSkipForward size={18} />
        </button>
        <h2>{media?.name}</h2>
        <button className="btn-icon" onClick={async () => {
          try { await api.post(`/media/favorites/${id}`); } catch { }
        }} title="Favorite"><FiHeart size={18} /></button>
        <button className="btn-icon" onClick={() => setShowShare(true)} title="Share">
          <FiShare2 size={18} />
        </button>
        <a href={videoSrc} className="btn-icon"
          download={media?.name || 'video'} title="Download"><FiDownload size={18} /></a>
      </div>

      <div className="video-player-main">
        {playError ? (
          <div className="video-error">
            <FiFilm size={48} />
            <h3>Playback Error</h3>
            <p>{error}</p>
            <a href={videoSrc} className="btn-primary" download>Download Video</a>
          </div>
        ) : (
          <div className="video-player-wrapper">
            <div className="video-blur-bg-inner" style={{ backgroundImage: `url(${poster})` }} />
            <div className="video-player-inner" ref={wrapperRef}>
              <video ref={videoRef}
                className="video-player"
                poster={poster}
                src={videoSrc}
                autoPlay playsInline muted={muted}
                onError={handleVideoError}
                onPause={() => { saveProgress(); setPlaying(false); }}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onClick={togglePlay}
              />
              <div className="video-controls-overlay">
                <div className="video-progress-wrap" ref={progressRef}
                  onMouseMove={handleProgressHover}
                  onMouseLeave={handleProgressLeave}
                  onClick={handleProgressClick}>
                  <div className="video-progress-track">
                    <div className="video-progress-fill" style={{ width: `${progress}%` }} />
                    <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
                  </div>
                  <div className={`video-thumb-preview${hoverTime != null ? ' visible' : ''}`} style={{ left: `${hoverX}px` }}>
                    <canvas ref={canvasRef} className="video-thumb-canvas" />
                    <span className="video-thumb-time">{formatTime(hoverTime || 0)}</span>
                  </div>
                </div>
                <div className="video-controls-bottom">
                  <div className="video-controls-left">
                    <button className="video-ctrl-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                      {playing ? <FiPause size={18} /> : <FiPlay size={18} />}
                    </button>
                    <button className="video-ctrl-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                      {muted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
                    </button>
                    <button className="video-ctrl-btn" onClick={goPrev} disabled={currentIndex <= 0} title="Previous">
                      <FiSkipBack size={16} />
                    </button>
                    <button className="video-ctrl-btn" onClick={goNext} disabled={currentIndex >= videos.length - 1} title="Next">
                      <FiSkipForward size={16} />
                    </button>
                    <span className="video-time">{formatTime(currentTime)}</span>
                    <span className="video-time-sep">/</span>
                    <span className="video-time">{formatTime(duration)}</span>
                  </div>
                  <div className="video-controls-right">
                    <span className="video-time">{currentIndex + 1}/{videos.length}</span>
                    <button className="video-ctrl-btn" onClick={toggleFullscreen} title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                      {fullscreen ? <FiMinimize size={16} /> : <FiMaximize size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showShare && <ShareModal mediaId={media?.id} mediaName={media?.name}
        onClose={() => setShowShare(false)} />}
    </div>
  );
}
