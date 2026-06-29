import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiFilm, FiImage } from 'react-icons/fi';

export default function SharedViewer() {
  const { token } = useParams();
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState(false);

  useEffect(() => {
    fetch(`/api/media/share/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setMedia(data);
      })
      .catch(() => setError('Failed to load shared media'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (error) return (
    <div className="player-error">
      <FiImage size={64} />
      <h2>{error}</h2>
    </div>
  );

  if (media.type === 'video') {
    return (
      <div className="shared-page">
        <div className="shared-header">
          <h2>{media.name}</h2>
        </div>
        <div className="video-container">
          {playError ? (
            <div className="video-error">
              <FiFilm size={48} />
              <h3>Playback Error</h3>
              <p>The video could not be played.</p>
              <a href={`/api/media/shared/stream/${token}`} className="btn-primary" download>
                Download Video
              </a>
            </div>
          ) : (
            <video controls autoPlay className="video-player"
              poster={`/api/media/shared/thumbnail/${token}`}
              onError={() => setPlayError(true)}>
              <source src={`/api/media/shared/stream/${token}`} type={media.mime_type || 'video/mp4'} />
            </video>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shared-page">
      <div className="shared-header">
        <h2>{media.name}</h2>
      </div>
      <div className="photo-container">
        <img src={`/api/media/shared/thumbnail/${token}`} alt={media.name}
          className="photo-viewer" />
      </div>
    </div>
  );
}