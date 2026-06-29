import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiHeart, FiDownload, FiFilm, FiShare2, FiPlay, FiPause } from 'react-icons/fi';
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
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [thumbnail, setThumbnail] = useState(null);
  const videoRef = useRef(null);
  const saveInterval = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(null);
  const thumbCache = useRef(new Map());

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

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
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
        const found = res.data.find(m => m.id === parseInt(id));
        if (!found) { setError('Media not found'); return; }
        if (found.type !== 'video') { setError('Not a video file'); return; }
        setMedia(found);
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
            <div className="video-player-inner">
              <video ref={videoRef}
                className="video-player"
                poster={poster}
                src={videoSrc}
                autoPlay playsInline muted
                onError={handleVideoError}
                onPause={() => { saveProgress(); setPlaying(false); }}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onClick={togglePlay}
              />
              <div className="video-controls-overlay">
                <div className="video-controls-left">
                  <button className="video-ctrl-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                    {playing ? <FiPause size={18} /> : <FiPlay size={18} />}
                  </button>
                  <span className="video-time">{formatTime(currentTime)}</span>
                  <span className="video-time-sep">/</span>
                  <span className="video-time">{formatTime(duration)}</span>
                </div>
                <div className="video-progress-wrap" ref={progressRef}
                  onMouseMove={handleProgressHover}
                  onMouseLeave={handleProgressLeave}
                  onClick={handleProgressClick}>
                  <div className="video-progress-track">
                    <div className="video-progress-fill" style={{ width: `${progress}%` }} />
                    <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
                  </div>
                  {hoverTime != null && (
                    <div className="video-thumb-preview" style={{ left: `${hoverX}px` }}>
                      <canvas ref={canvasRef} className="video-thumb-canvas" />
                      <span className="video-thumb-time">{formatTime(hoverTime)}</span>
                    </div>
                  )}
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
