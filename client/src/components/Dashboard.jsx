import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiPlay, FiHeart, FiTrash2, FiFilm, FiImage, FiShare2,
  FiChevronRight, FiChevronLeft, FiClock, FiGrid, FiList
} from 'react-icons/fi';
import ShareModal from './ShareModal';

function mediaUrl(path, id) {
  const token = localStorage.getItem('token');
  return `/api/media/${path}/${id}${token ? `?token=${token}` : ''}`;
}

function Section({ title, items, onFavorite, onDelete, onShare, empty, progress }) {
  const rowRef = useRef(null);

  const scroll = (dir) => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: dir * 340, behavior: 'smooth' });
    }
  };

  return (
    <section className="tv-section">
      <div className="tv-section-header">
        <h2 className="tv-section-title">{title}</h2>
        <div className="tv-section-nav">
          <button className="tv-scroll-btn" onClick={() => scroll(-1)}><FiChevronLeft /></button>
          <button className="tv-scroll-btn" onClick={() => scroll(1)}><FiChevronRight /></button>
        </div>
      </div>
      <div className="tv-row" ref={rowRef}>
        {items.length === 0 ? (
          <div className="tv-row-empty">{empty}</div>
        ) : (
          items.map(item => (
            <div key={item.id} className="tv-card">
              <Link to={item.type === 'video' ? `/watch/${item.id}` : `/photo/${item.id}`}>
                <div className="tv-card-poster">
                  <img src={mediaUrl('thumbnail', item.id)} alt={item.name} loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.querySelector('.tv-card-fallback').style.display = 'flex';
                    }} />
                  <div className="tv-card-fallback" style={{ display: 'none' }}>
                    {item.type === 'video' ? <FiFilm size={32} /> : <FiImage size={32} />}
                  </div>
                  {item.type === 'video' && (
                    <div className="tv-card-play"><FiPlay size={24} /></div>
                  )}
                  {progress && progress[item.id] && progress[item.id].position > 5 && (
                    <div className="tv-card-progress-wrap">
                      <div className="tv-card-progress-bar"
                        style={{ width: `${Math.min(100, (progress[item.id].position / Math.max(1, progress[item.id].duration)) * 100)}%` }} />
                    </div>
                  )}
                  <div className="tv-card-badge">
                    {item.type === 'video' ? <FiFilm size={12} /> : <FiImage size={12} />}
                    {item.type === 'video' ? 'Video' : 'Photo'}
                  </div>
                </div>
              </Link>
              <div className="tv-card-info">
                <Link to={item.type === 'video' ? `/watch/${item.id}` : `/photo/${item.id}`}>
                  <h3 title={item.name}>{item.name}</h3>
                </Link>
                <div className="tv-card-actions">
                  <button className={`tv-action ${item.favorited ? 'active' : ''}`}
                    onClick={() => onFavorite(item.id)} title="Favorite">
                    <FiHeart />
                  </button>
                  <button className="tv-action" onClick={() => onShare(item)} title="Share">
                    <FiShare2 />
                  </button>
                  <button className="tv-action danger" onClick={() => onDelete(item.id)} title="Delete">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PhotoGrid({ items, onFavorite, onDelete, onShare }) {
  return (
    <div className="photo-grid">
      {items.length === 0 ? (
        <div className="tv-row-empty">No photos found</div>
      ) : (
        items.map(item => (
          <div key={item.id} className="photo-grid-card">
            <Link to={`/photo/${item.id}`}>
              <div className="photo-grid-poster">
                <img src={mediaUrl('thumbnail', item.id)} alt={item.name} loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.querySelector('.tv-card-fallback').style.display = 'flex';
                  }} />
                <div className="tv-card-fallback" style={{ display: 'none' }}>
                  <FiImage size={24} />
                </div>
              </div>
            </Link>
            <div className="photo-grid-info">
              <Link to={`/photo/${item.id}`}>
                <h3 title={item.name}>{item.name}</h3>
              </Link>
              <div className="tv-card-actions">
                <button className={`tv-action ${item.favorited ? 'active' : ''}`}
                  onClick={() => onFavorite(item.id)} title="Favorite">
                  <FiHeart />
                </button>
                <button className="tv-action" onClick={() => onShare(item)} title="Share">
                  <FiShare2 />
                </button>
                <button className="tv-action danger" onClick={() => onDelete(item.id)} title="Delete">
                  <FiTrash2 />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Dashboard() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState(null);
  const [progress, setProgress] = useState({});
  const [heroIndex, setHeroIndex] = useState(0);
  const [gridView, setGridView] = useState(() => {
    const saved = localStorage.getItem('photoGridView');
    return saved !== null ? saved === 'true' : true;
  });
  const heroVideoRef = useRef(null);
  const heroTimer = useRef(null);

  const token = localStorage.getItem('token');
  const tok = token ? `?token=${token}` : '';

  const typeParam = searchParams.get('type');
  const searchQuery = searchParams.get('search');
  const favoritesOnly = searchParams.get('favorites');

  useEffect(() => {
    setLoading(true);
    const fetchMedia = async () => {
      try {
        let res;
        if (favoritesOnly) {
          res = await api.get('/media/favorites');
        } else if (searchQuery) {
          res = await api.get(`/media/search?q=${encodeURIComponent(searchQuery)}`);
        } else {
          res = await api.get(`/media/library${typeParam ? `?type=${typeParam}` : ''}`);
        }
        setMedia(res.data);
      } catch (err) {
        console.error('Failed to load media', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [typeParam, searchQuery, favoritesOnly, api]);

  useEffect(() => {
    const videoIds = media.filter(m => m.type === 'video').map(m => m.id);
    if (videoIds.length === 0) return;
    api.get(`/media/progress?ids=${videoIds.join(',')}`)
      .then(res => setProgress(res.data))
      .catch(() => {});
  }, [media, api]);

  const heroVideos = media.filter(m => m.type === 'video');

  useEffect(() => {
    if (heroVideos.length < 2) return;
    heroTimer.current = setInterval(() => {
      setHeroIndex(i => (i + 1) % heroVideos.length);
    }, 8000);
    return () => clearInterval(heroTimer.current);
  }, [heroVideos.length]);

  const handleHeroEnded = () => {
    if (heroVideos.length > 1) {
      setHeroIndex(i => (i + 1) % heroVideos.length);
    }
  };

  const handleFavorite = async (mediaId) => {
    try {
      const res = await api.post(`/media/favorites/${mediaId}`);
      setMedia(prev => prev.map(m => m.id === mediaId ? { ...m, favorited: res.data.favorited } : m));
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const handleDelete = async (mediaId) => {
    if (!confirm('Remove from library?')) return;
    try {
      await api.delete(`/media/${mediaId}`);
      setMedia(prev => prev.filter(m => m.id !== mediaId));
    } catch (err) {
      console.error('Failed to delete media', err);
    }
  };

  const toggleGridView = () => {
    setGridView(g => { localStorage.setItem('photoGridView', !g); return !g; });
  };

  const videos = media.filter(m => m.type === 'video');
  const photos = media.filter(m => m.type === 'image');

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (media.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <div className="empty-icon">{typeParam === 'video' ? <FiFilm size={32} /> : <FiImage size={32} />}</div>
          <h2>{searchQuery ? `No results for "${searchQuery}"` : 'Your library is empty'}</h2>
          <p>Configure media directories in Settings to scan your photos and videos.</p>
        </div>
      </div>
    );
  }

  if (searchQuery) {
    return (
      <div className="tv-dashboard">
        <div className="tv-page-header">
          <h1>Search: "{searchQuery}"</h1>
          <span className="tv-count">{media.length} result{media.length !== 1 ? 's' : ''}</span>
        </div>
        <Section title="Results" items={media} progress={progress}
          onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
          empty="No matching media found" />
        {shareTarget && <ShareModal mediaId={shareTarget.id} mediaName={shareTarget.name}
          onClose={() => setShareTarget(null)} />}
      </div>
    );
  }

  return (
    <div className="tv-dashboard">
      {favoritesOnly ? (
        <>
          <div className="tv-page-header">
            <h1>Favorites</h1>
            <span className="tv-count">{media.length} item{media.length !== 1 ? 's' : ''}</span>
          </div>
          <Section title="Favorites" items={media} progress={progress}
            onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
            empty="No favorites yet" />
        </>
      ) : typeParam === 'video' ? (
        <>
          <div className="tv-page-header">
            <h1>Videos</h1>
            <span className="tv-count">{videos.length} item{videos.length !== 1 ? 's' : ''}</span>
          </div>
          <Section title="All Videos" items={videos} progress={progress}
            onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
            empty="No videos found" />
        </>
      ) : typeParam === 'image' ? (
        <>
          <div className="tv-page-header">
            <h1>Photos</h1>
            <span className="tv-count">{photos.length} item{photos.length !== 1 ? 's' : ''}</span>
            <button className="tv-nav-btn" onClick={toggleGridView} title={gridView ? 'Row view' : 'Grid view'}>
              {gridView ? <FiList size={16} /> : <FiGrid size={16} />}
            </button>
          </div>
          {gridView ? (
            <PhotoGrid items={photos} onFavorite={handleFavorite}
              onDelete={handleDelete} onShare={setShareTarget} />
          ) : (
            <Section title="All Photos" items={photos} progress={progress}
              onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
              empty="No photos found" />
          )}
        </>
      ) : (
        <>
          <div className="tv-hero">
            {heroVideos.length > 0 && (
              <>
                <video key={heroIndex} ref={heroVideoRef}
                  className="tv-hero-video" muted playsInline autoPlay
                  src={`/api/media/stream/${heroVideos[heroIndex].id}${tok}`}
                  onLoadedMetadata={() => heroVideoRef.current?.play()}
                  onEnded={handleHeroEnded}
                  poster={`/api/media/thumbnail/${heroVideos[heroIndex].id}${tok}`} />
                <div className="tv-hero-video-title">
                  {heroVideos[heroIndex].name}
                </div>
              </>
            )}
            <div className="tv-hero-bg" />
            <div className="tv-hero-content">
              <h1 className="tv-hero-title">Your Media Library</h1>
              <p className="tv-hero-sub">{media.length} item{media.length !== 1 ? 's' : ''}</p>
              {heroVideos.length > 0 && (
                <div className="tv-hero-dots">
                  {heroVideos.slice(0, 10).map((v, i) => (
                    <span key={v.id}
                      className={`tv-hero-dot ${i === heroIndex ? 'active' : ''}`}
                      onClick={() => setHeroIndex(i)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <Section title="All Media" items={media.slice(0, 20)} progress={progress}
            onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
            empty="No media found" />

          {videos.length > 0 && (
            <Section title="Videos" items={videos} progress={progress}
              onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
              empty="No videos" />
          )}

          {photos.length > 0 && (
            <Section title="Photos" items={photos} progress={progress}
              onFavorite={handleFavorite} onDelete={handleDelete} onShare={setShareTarget}
              empty="No photos" />
          )}
        </>
      )}

      {shareTarget && <ShareModal mediaId={shareTarget.id} mediaName={shareTarget.name}
        onClose={() => setShareTarget(null)} />}
    </div>
  );
}