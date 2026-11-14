import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProfileGateScreen } from './components/ProfileGateScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SiteConfigProvider } from './contexts/SiteConfigContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AdminPage } from './pages/AdminPage';
import { AISmartPage } from './pages/AISmartPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { DetailsPage } from './pages/DetailsPage';
import { ExplorePage } from './pages/ExplorePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PlansPage } from './pages/PlansPage';
import { PlayerPage } from './pages/PlayerPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { firebaseUser, loading, showProfileGate } = useAuth();

  if (showProfileGate) {
    return <ProfileGateScreen />;
  }

  return (
    <Routes>
      <Route
        path="/profiles"
        element={
          loading ? (
            <div className="min-h-screen bg-[#050814]" aria-busy="true" />
          ) : firebaseUser ? (
            <ProfileGateScreen />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/admin" element={<AdminPage />} />
      <Route
        path="/watch/:type/:tmdbId"
        element={
          <AppShell hideChrome>
            <PlayerPage />
          </AppShell>
        }
      />
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/movie/:id" element={<DetailsPage mediaType="movie" />} />
              <Route path="/series/:id" element={<DetailsPage mediaType="tv" />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/channels" element={<ChannelsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/ai" element={<AISmartPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SiteConfigProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </SiteConfigProvider>
    </ThemeProvider>
  );
}
