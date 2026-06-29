import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiLogIn } from 'react-icons/fi';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const isEmail = loginId.includes('@');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEmail) {
        await login('', password, loginId);
      } else {
        await login(loginId, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">&#9654;</span>
          <h1>LocMediaStream</h1>
          <p>Your personal media library</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            {isEmail ? <FiMail className="input-icon" /> : <FiUser className="input-icon" />}
            <input type="text" placeholder="Username or email" value={loginId}
              onChange={(e) => setLoginId(e.target.value)} required />
          </div>
          <div className="input-group">
            <FiLock className="input-icon" />
            <input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner-sm" /> : <FiLogIn />}
            Sign In
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
