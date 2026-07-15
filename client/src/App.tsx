import React from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore.js';
import { useSocketStore } from './stores/socketStore.js';

// Layout
import MainLayout from './components/ui/MainLayout.jsx';

// Pages
import HomePage from './components/pages/HomePage.jsx';
import LoginPage from './components/pages/LoginPage.jsx';
import RegisterPage from './components/pages/RegisterPage.jsx';
import ChampionsPage from './components/pages/ChampionsPage.jsx';
import ChampionDetailPage from './components/pages/ChampionDetailPage.jsx';
import PlayPage from './components/pages/PlayPage.jsx';
import ProfilePage from './components/pages/ProfilePage.jsx';
import StorePage from './components/pages/StorePage.jsx';
import LobbyPage from './components/pages/LobbyPage.jsx';
import GamePage from './components/pages/GamePage.jsx';
import AdminPage from './components/pages/AdminPage.jsx';
import NotFoundPage from './components/pages/NotFoundPage.jsx';

// Components
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import ProtectedRoute from './components/ui/ProtectedRoute.jsx';

export default function App() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { connect } = useSocketStore();

  // Safety timeout - if still loading after 10s, show login page
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isLoading) {
        useAuthStore.setState({ isLoading: false });
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  // Connect socket when authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      connect();
    }
  }, [isAuthenticated, connect]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1f2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/lobby" /> : <HomePage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/lobby" /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/lobby" /> : <RegisterPage />} />

        {/* Protected routes */}
        <Route element={<MainLayout />}>
          <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/play" element={<ProtectedRoute><PlayPage /></ProtectedRoute>} />
          <Route path="/champions" element={<ProtectedRoute><ChampionsPage /></ProtectedRoute>} />
          <Route path="/champions/:id" element={<ProtectedRoute><ChampionDetailPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/profile/:id" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Route>

        {/* Game - full screen, no layout */}
        <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
