import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiHeart, FiDownload, FiFilm, FiShare2, FiSkipBack, FiSkipForward, FiMaximize2, FiMinimize2, FiRadio } from 'react-icons/fi';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
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
  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const saveInterval = useRef(null);
  const pageRef = useRef(null);

  const goToVideo = useCallback((idx) => {
    if (idx < 0 || idx >= videos.length) return;
    navigate(`/watch/${videos[idx].id}`);
  }, [videos, navigate]);

  const goNext = useCallback(() => goToVideo(currentIndex + 1), [goToVideo, currentIndex]);
  const goPrev = useCallback(() => goToVideo(currentIndex - 1), [goToVideo, currentIndex]);

  const saveProgress = useCallback(() => {
    const player = plyrRef.current;
    if (!player || !media) return;
    try {
      api.post(`/media/progress/${media.id}`, {
        position: player.currentTime,
        duration: player.duration || 0
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
    if (!media || !videoRef.current) return;
    const el = videoRef.current;
    if (plyrRef.current) { plyrRef.current.destroy(); }

    const player = new Plyr(el, {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      settings: ['speed'],
      clickToPlay: true,
      hideControls: true,
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      seekTime: 10,
      volume: 0.5,
      muted: true,
      storage: { enabled: false },
      fullscreen: { enabled: true, fallback: false, iosNative: true, container: pageRef.current }
    });

    plyrRef.current = player;

    const seekProgress = () => {
      api.get(`/media/progress/${media.id}`)
        .then(res => {
          if (res.data.position > 5) {
            el.addEventListener('canplay', () => {
              player.currentTime = res.data.position;
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

    return () => { player.destroy(); plyrRef.current = null; };
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

  const handleVideoError = () => {
    setError('Video playback error');
    setPlayError(true);
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
            <div className="video-player-inner plyr-container">
              <video ref={videoRef}
                className={`video-player video-ratio-${aspectRatio}`}
                poster={poster}
                onError={handleVideoError}
                playsInline
                autoPlay
              >
                <source src={videoSrc} type={media?.mime_type || 'video/mp4'} />
              </video>
              <button className="video-nav-overlay video-nav-prev"
                onClick={goPrev} disabled={currentIndex <= 0}
                title="Previous (←)" aria-label="Previous video">
                <FiSkipBack size={28} />
              </button>
              <button className="video-nav-overlay video-nav-next"
                onClick={goNext} disabled={currentIndex >= videos.length - 1}
                title="Next (→)" aria-label="Next video">
                <FiSkipForward size={28} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showShare && <ShareModal mediaId={media?.id} mediaName={media?.name}
        onClose={() => setShowShare(false)} />}
    </div>
  );
}
