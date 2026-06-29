import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiArrowLeft, FiHeart, FiDownload, FiImage,
  FiPlus, FiMinus, FiRotateCw, FiRotateCcw, FiMaximize2,
  FiChevronLeft, FiChevronRight, FiShare2
} from 'react-icons/fi';
import ShareModal from './ShareModal';

function mediaUrl(path, id) {
  const token = localStorage.getItem('token');
  return `/api/media/${path}/${id}${token ? `?token=${token}` : ''}`;
}

export default function PhotoViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [allPhotos, setAllPhotos] = useState([]);
  const [media, setMedia] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const containerRef = useRef(null);
  const touchStart = useRef(null);
  const pinchStart = useRef(null);

  useEffect(() => {
    api.get('/media/library?type=image')
      .then(res => {
        const photos = res.data;
        setAllPhotos(photos);
        const idx = photos.findIndex(m => m.id === parseInt(id));
        if (idx === -1) { setError('Media not found'); return; }
        setCurrentIndex(idx);
        setMedia(photos[idx]);
      })
      .catch(() => setError('Failed to load media'))
      .finally(() => setLoading(false));
  }, [id, api]);

  const goPhoto = useCallback((idx) => {
    if (idx < 0 || idx >= allPhotos.length) return;
    setMedia(allPhotos[idx]);
    setCurrentIndex(idx);
    setImgError(false);
    setZoom(1);
    setRotation(0);
    navigate(`/photo/${allPhotos[idx].id}`, { replace: true });
  }, [allPhotos, navigate]);

  const goPrev = () => goPhoto(currentIndex - 1);
  const goNext = () => goPhoto(currentIndex + 1);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  const handleWheel = (e) => {
    if (e.deltaY < 0) setZoom(z => Math.min(z + 0.25, 5));
    else setZoom(z => Math.max(z - 0.25, 0.25));
  };

  const getTouchDist = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.touches.length === 2) {
      pinchStart.current = getTouchDist(e.touches);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const ratio = dist / pinchStart.current;
      setZoom(z => Math.max(0.25, Math.min(5, z * ratio)));
      pinchStart.current = dist;
      touchStart.current = null;
    }
  };

  const handleTouchEnd = (e) => {
    if (pinchStart.current) {
      pinchStart.current = null;
      touchStart.current = null;
      return;
    }
    if (!touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    const dist = Math.hypot(dx, dy);
    if (dist > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStart.current = null;
  };

  const resetView = () => { setZoom(1); setRotation(0); };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (error) return (
    <div className="player-error">
      <FiImage size={64} />
      <h2>{error}</h2>
      <Link to="/" className="btn-primary">Back to Library</Link>
    </div>
  );

  return (
    <div className="photo-viewer-page">
      <div className="player-nav">
        <Link to="/" className="btn-icon"><FiArrowLeft size={24} /></Link>
        <h2>{media?.name}</h2>
        <div className="player-actions">
          <button className="btn-icon" onClick={() => { try { api.post(`/media/favorites/${id}`); } catch { } }} title="Favorite">
            <FiHeart />
          </button>
          <button className="btn-icon" onClick={() => setShowShare(true)} title="Share">
            <FiShare2 />
          </button>
          <a href={mediaUrl('stream', id)} className="btn-icon" download={media?.name} title="Download">
            <FiDownload />
          </a>
        </div>
      </div>

      <div className="photo-toolbar">
        <button className="btn-icon" onClick={goPrev} disabled={currentIndex <= 0} title="Previous">
          <FiChevronLeft size={18} />
        </button>
        <span className="photo-counter">{currentIndex + 1} / {allPhotos.length}</span>
        <button className="btn-icon" onClick={goNext} disabled={currentIndex >= allPhotos.length - 1} title="Next">
          <FiChevronRight size={18} />
        </button>
        <div className="toolbar-divider" />
        <button className="btn-icon" onClick={() => setZoom(z => Math.min(z + 0.25, 5))} title="Zoom in">
          <FiPlus size={16} />
        </button>
        <button className="btn-icon" onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} title="Zoom out">
          <FiMinus size={16} />
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="btn-icon" onClick={() => setRotation(r => r - 90)} title="Rotate left">
          <FiRotateCcw size={16} />
        </button>
        <button className="btn-icon" onClick={() => setRotation(r => r + 90)} title="Rotate right">
          <FiRotateCw size={16} />
        </button>
        {(zoom !== 1 || rotation !== 0) && (
          <button className="btn-icon" onClick={resetView} title="Reset">
            <FiMaximize2 size={16} />
          </button>
        )}
      </div>

      <div className="photo-container" ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>
        {imgError ? (
          <div className="photo-error">
            <FiImage size={64} />
            <p>Failed to load image</p>
          </div>
        ) : (
          <div className="photo-transform-wrapper">
            <img src={mediaUrl('stream', media?.id)} alt={media?.name}
              className="photo-viewer-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 ? 'grab' : 'default'
              }}
              onError={() => setImgError(true)}
              draggable={false} />
          </div>
        )}
      </div>

      {showShare && <ShareModal mediaId={media?.id} mediaName={media?.name}
        onClose={() => setShowShare(false)} />}
    </div>
  );
}