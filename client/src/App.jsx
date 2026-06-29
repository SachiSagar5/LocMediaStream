import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import PhotoViewer from './components/PhotoViewer';
import SharedViewer from './components/SharedViewer';

export default function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="app">
      {user && <Navbar />}
      <main className={user ? 'main-content' : ''}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/watch/:id" element={<VideoPlayer />} />
          <Route path="/photo/:id" element={<PhotoViewer />} />
          <Route path="/share/:token" element={<SharedViewer />} />
        </Routes>
      </main>
    </div>
  );
}