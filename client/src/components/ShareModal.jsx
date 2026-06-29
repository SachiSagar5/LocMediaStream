import { useState, useEffect } from 'react';
import { FiLink, FiCopy, FiX, FiCheck, FiShare2 } from 'react-icons/fi';

export default function ShareModal({ mediaId, mediaName, onClose }) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`/api/media/share/${mediaId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setLink(`${window.location.origin}/share/${data.token}`);
      })
      .catch(() => setError('Failed to create share link'))
      .finally(() => setLoading(false));
  }, [mediaId, token]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <FiShare2 size={20} />
          <h3>Share</h3>
          <button className="btn-icon" onClick={onClose}><FiX size={20} /></button>
        </div>
        {mediaName && <p className="share-modal-sub">{mediaName}</p>}
        {loading ? (
          <div className="share-modal-loading"><div className="spinner-sm" /></div>
        ) : error ? (
          <p className="error-msg">{error}</p>
        ) : (
          <div className="share-modal-body">
            <div className="share-link-box">
              <FiLink className="share-link-icon" />
              <input type="text" readOnly value={link} className="share-link-input"
                onClick={e => e.target.select()} />
            </div>
            <button className="btn-primary share-copy-btn" onClick={copyLink}>
              {copied ? <><FiCheck /> Copied</> : <><FiCopy /> Copy Link</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}