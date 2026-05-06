import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Home from './pages/Home';
import './App.css';

import SocialAccounts from './pages/SocialAccounts';
import Posts from './pages/Posts';
import Settings from './pages/Settings';
import PostEditor from './pages/PostEditor';
import ContentCalendar from './pages/Calendar';
import MediaLibrary from './pages/media/MediaLibrary';
import AIReport from './pages/AIReport';
import AdminLayout from './pages/admin/AdminLayout';
import AdminMetrics from './pages/admin/AdminMetrics';

// Componente para proteger rutas
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        <div style={{ marginTop: '20px' }}>Cargando AutopostLab...</div>
      </div>
    );
  }
  
  if (!token) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/login" element={<Login />} />
      
      {/* Rutas Protegidas */}
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="posts" element={<Posts />} />
        <Route path="social-accounts" element={<SocialAccounts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="create" element={<PostEditor />} />
        <Route path="calendar" element={<ContentCalendar />} />
        <Route path="photos" element={<MediaLibrary type="image" />} />
        <Route path="videos" element={<MediaLibrary type="video" />} />
        <Route path="ai-report" element={<AIReport />} />
        <Route path="analytics" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Rutas Internas SaaS (Admin) */}
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route path="metrics" element={<AdminMetrics />} />
        <Route index element={<Navigate to="/admin/metrics" replace />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  const googleClientId = "220803589898-mtig12rjm9k7mjasvhdbc798cmt5vmjg.apps.googleusercontent.com";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
