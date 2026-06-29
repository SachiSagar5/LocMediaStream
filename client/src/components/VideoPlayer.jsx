import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiHeart, FiDownload, FiFilm, FiShare2, FiSkipBack, FiSkipForward, FiMaximize2, FiMinimize2, FiRadio } from 'react-icons/fi';
import ShareModal from './ShareModal';

function mediaUrl(path, id) {
  const token = localStorage.getItem('token');
  return `/api/media/${path}/${id}${token ? `?token=${token}` : ''}`;
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
  const [aspectRatio, setAspectRatio] = useState('contain');
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const saveInterval = useRef(null);
  const pageRef = useRef(null);

  const goToVideo = useCallback((idx) => {
    if (idx < 0 || idx >= videos.length) return;
    navigate(`/watch/${videos[idx].id}`);
  }, [videos, navigate]);

  const goNext = useCallback(() => goToVideo(currentIndex + 1), [goToVideo, currentIndex]);
  const goPrev = useCallback(() => goToVideo(currentIndex - 1), [goToVideo, currentIndex]);

  const saveProgress = useCallback(() => {
    const el = videoRef.current;
    if (!el || !media) return;
    try {
      api.post(`/media/progress/${media.id}`, {
        position: el.currentTime,
        duration: el.duration || 0
      });
    } catch {}
  }, [api, media]);

  useEffect(() => {
    let cancelled = false;
    api.get('/media/library')
      .then(res => {
        if (cancelled) return;
        const all = res.data.filter(m => m.type === 'video');
        setVideos(all);
        const idx = all.findIndex(m => m.id === parseInt(id));
        if (idx === -1) { setError('Media not found'); return; }
        setCurrentIndex(idx);
        setMedia(all[idx]);
      })
      .catch(() => { if (!cancelled) setError('Failed to load media'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, api]);

  useEffect(() => {
    if (!media) return;
    const el = videoRef.current;
    if (!el) return;

    const seekProgress = () => {
      api.get(`/media/progress/${media.id}`)
        .then(res => {
          if (res.data.position > 5) {
            el.addEventListener('canplay', () => {
              el.currentTime = res.data.position;
            }, { once: true });
          }
        })
        .catch(() => {});
    };

    if (el.readyState >= 1) {
      el.addEventListener('loadedmetadata', seekProgress, { once: true });
    } else {
      seekProgress();
    }

    el.addEventListener('loadedmetadata', () => {
      setDuration(el.duration);
      const tracks = el.audioTracks;
      if (tracks && tracks.length > 0) {
        const list = [];
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          list.push({ id: i, label: t.label || `Track ${i + 1}`, language: t.language, enabled: t.enabled });
          if (t.enabled) setActiveAudioTrack(i);
        }
        setAudioTracks(list);
      }
    }, { once: true });
  }, [media]);

  useEffect(() => {
    saveInterval.current = setInterval(saveProgress, 5000);
    return () => clearInterval(saveInterval.current);
  }, [saveProgress]);

  useEffect(() => {
    const handler = () => saveProgress();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveProgress]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') { goPrev(); }
      else if (e.key === 'ArrowRight') { goNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  const toggleAspectRatio = () => {
    setAspectRatio(prev => {
      const modes = ['contain', 'fill', 'cover'];
      return modes[(modes.indexOf(prev) + 1) % modes.length];
    });
  };

  const switchAudioTrack = () => {
    const el = videoRef.current;
    if (!el || !el.audioTracks || el.audioTracks.length < 2) return;
    const next = (activeAudioTrack + 1) % el.audioTracks.length;
    for (let i = 0; i < el.audioTracks.length; i++) {
      el.audioTracks[i].enabled = i === next;
    }
    setActiveAudioTrack(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      pageRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const changeSpeed = (speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleVideoError = () => {
    setError('Video playback error');
    setPlayError(true);
  };

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

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

  return (
    <div className={`video-player-page${isFullscreen ? ' is-fullscreen' : ''}`} ref={pageRef}>
      <div className="video-blur-bg" style={{ backgroundImage: `url(${poster})` }} />
      <div className="video-player-nav">
        <Link to="/" className="btn-icon"><FiArrowLeft size={22} /></Link>
        <button className="btn-icon" onClick={goPrev} disabled={currentIndex <= 0} title="Previous">
          <FiSkipBack size={18} />
        </button>
        <button className="btn-icon" onClick={goNext} disabled={currentIndex >= videos.length - 1} title="Next">
          <FiSkipForward size={18} />
        </button>
        <h2>{media?.name || 'Video'}</h2>
        <span className="video-counter">{currentIndex + 1}/{videos.length}</span>
        <button className="btn-icon" onClick={async () => {
          try { await api.post(`/media/favorites/${id}`); } catch { }
        }} title="Favorite"><FiHeart size={18} /></button>
        <button className="btn-icon" onClick={toggleAspectRatio} title={`Aspect ratio: ${aspectRatio}`}>
          {aspectRatio === 'contain' ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
        </button>
        {audioTracks.length > 1 && (
          <button className="btn-icon" onClick={switchAudioTrack} title={`Audio: ${audioTracks[activeAudioTrack]?.label || 'Track'} (click to switch)`}>
            <FiRadio size={18} />
          </button>
        )}
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
                className={`video-player video-ratio-${aspectRatio}`}
                poster={poster}
                onError={handleVideoError}
                onTimeUpdate={() => { setCurrentTime(videoRef.current?.currentTime || 0); }}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { if (currentIndex < videos.length - 1) goNext(); }}
                playsInline
                autoPlay
                controls
              >
                <source src={videoSrc} />
              </video>

              <div className="video-controls-bar">
                <div className="vc-left">
                  <button className="vc-btn" onClick={() => videoRef.current?.play()}>▶</button>
                  <button className="vc-btn" onClick={() => videoRef.current?.pause()}>⏸</button>
                  <span className="vc-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className="vc-center">
                  {[1, 1.5, 2].map(s => (
                    <button key={s}
                      className={`vc-speed${playbackSpeed === s ? ' active' : ''}`}
                      onClick={() => changeSpeed(s)}>
                      {s}x
                    </button>
                  ))}
                </div>
                <div className="vc-right">
                  <button className="vc-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    {isFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
                  </button>
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
