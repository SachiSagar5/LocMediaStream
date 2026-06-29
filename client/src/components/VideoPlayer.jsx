import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiHeart, FiDownload, FiFilm, FiShare2 } from 'react-icons/fi';
import ShareModal from './ShareModal';

function mediaUrl(path, id) {
  const token = localStorage.getItem('token');
  return `/api/media/${path}/${id}${token ? `?token=${token}` : ''}`;
}

export default function VideoPlayer() {
  const { id } = useParams();
  const { api } = useAuth();
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const videoRef = useRef(null);
  const saveInterval = useRef(null);

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

  const handleVideoError = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlayError(true);
    const code = video.error?.code || 0;
    const codes = { 1: 'aborted', 2: 'network error', 3: 'decode error', 4: 'format not supported' };
    setError(`Video playback error (${codes[code] || code})`);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (error && !media) return (
    <div className="player-error">
      <FiFilm size={64} />
      <h2>{error}</h2>
      <Link to="/" className="btn-primary">Back to Library</Link>
    </div>
  );

  return (
    <div className="video-player-page">
      <div className="player-nav">
        <Link to="/" className="btn-icon"><FiArrowLeft size={24} /></Link>
        <h2>{media?.name}</h2>
        <div className="player-actions">
          <button className="btn-icon" onClick={async () => {
            try { await api.post(`/media/favorites/${id}`); } catch { }
          }}><FiHeart /></button>
          <button className="btn-icon" onClick={() => setShowShare(true)} title="Share">
            <FiShare2 />
          </button>
          <a href={mediaUrl('stream', id)} className="btn-icon"
            download={media?.name || 'video'}><FiDownload /></a>
        </div>
      </div>
      <div className="video-container">
        {playError ? (
          <div className="video-error">
            <FiFilm size={48} />
            <h3>Playback Error</h3>
            <p>{error}</p>
            <a href={mediaUrl('stream', id)} className="btn-primary" download>Download Video</a>
          </div>
        ) : (
          <video ref={videoRef} controls autoPlay playsInline className="video-player"
            poster={mediaUrl('thumbnail', id)}
            onError={handleVideoError}
            onPause={saveProgress}
          >
            <source src={mediaUrl('stream', id)} type={media?.mime_type || 'video/mp4'} />
          </video>
        )}
      </div>
      {showShare && <ShareModal mediaId={media?.id} mediaName={media?.name}
        onClose={() => setShowShare(false)} />}
    </div>
  );
}