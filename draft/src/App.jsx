// アプリケーションルーティング
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SeasonProvider } from './contexts/SeasonContext';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import FavoritesPage from './pages/FavoritesPage';
import DraftPage from './pages/DraftPage';
import DraftResultPage from './pages/DraftResultPage';
import ResultsPage from './pages/ResultsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

// 認証が必要なルートのラッパー
function ProtectedRoute({ children }) {
  const { isAuthenticated, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#1a6b3c',
        fontSize: '1rem',
        fontFamily: 'var(--font-sans)',
      }}>
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return children;
}

// 管理者専用ルートのラッパー
function AdminRoute({ children }) {
  const { isAuthenticated, needsSetup, loading, isAdmin } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

// セットアップ画面専用ラッパー
function SetupRoute({ children }) {
  const { isAuthenticated, needsSetup, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!needsSetup) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={
        <SetupRoute><SetupPage /></SetupRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/favorites" element={
        <ProtectedRoute><FavoritesPage /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><AdminPage /></ProtectedRoute>
      } />
      <Route path="/draft" element={
        <ProtectedRoute><DraftPage /></ProtectedRoute>
      } />
      <Route path="/draft/result" element={
        <AdminRoute><DraftResultPage /></AdminRoute>
      } />
      <Route path="/results" element={
        <ProtectedRoute><ResultsPage /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SeasonProvider>
          <AppRoutes />
        </SeasonProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
