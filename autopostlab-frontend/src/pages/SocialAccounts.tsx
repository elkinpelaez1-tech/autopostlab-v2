import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Instagram, 
  Facebook, 
  Twitter as TwitterIcon, 
  Linkedin as LinkedinIcon,
  RefreshCcw,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SocialAccount {
  id: string;
  provider: string; // Antes era platform
  providerAccountId: string; // Antes era platformId
  displayName: string; // Antes era name
  username: string;
  avatarUrl: string;
}

const SocialAccounts: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/social-accounts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setAccounts(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching social accounts:', err);
      setError('No se pudieron cargar las cuentas conectadas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    // Detección de parámetros de URL para notificaciones
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const provider = urlParams.get('provider');
    const errorParam = urlParams.get('error');

    if (success === 'true' && provider) {
      alert(`¡Cuenta de ${provider.toUpperCase()} conectada con éxito!`);
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      setError(`Error de autenticación: ${errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectInstagram = () => {
    if (!user?.workspaceId) {
      alert('Error: No se encontró el Workspace ID. Por favor re-inicia sesión.');
      return;
    }
    const API_URL = import.meta.env.VITE_API_URL;
    const authUrl = `${API_URL}/api/social-auth/instagram?workspaceId=${user.workspaceId}`;
    window.location.href = authUrl;
  };

  const handleConnectTikTok = () => {
    if (!user?.workspaceId) {
      alert('Error: No se encontró el Workspace ID. Por favor re-inicia sesión.');
      return;
    }
    const API_URL = import.meta.env.VITE_API_URL;
    const authUrl = `${API_URL}/api/social-auth/tiktok?workspaceId=${user.workspaceId}`;
    window.location.href = authUrl;
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram size={24} />;
      case 'facebook': return <Facebook size={24} />;
      case 'twitter': return <TwitterIcon size={24} />;
      case 'linkedin': return <LinkedinIcon size={24} />;
      case 'tiktok': return <SiTiktok size={24} />;
      default: return <RefreshCcw size={24} />;
    }
  };

  const platformName = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      case 'twitter': return 'Twitter';
      case 'linkedin': return 'LinkedIn';
      case 'tiktok': return 'TikTok';
      default: return provider;
    }
  };

  const handleDeleteAccount = async (id: string, username: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres desconectar la cuenta @${username}? Esta acción eliminará también sus publicaciones programadas.`)) {
      return;
    }

    try {
      setIsLoading(true);
      await api.delete(`/social-accounts/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      // Actualizar la lista local eliminando la cuenta borrada
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      alert('Cuenta desconectada con éxito.');
    } catch (err: any) {
      console.error('Error deleting social account:', err);
      alert('Error al intentar eliminar la cuenta social.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="social-accounts-page">
      <div className="section-header-premium">
        <div>
          <h1 className="page-title-premium">Cuentas Sociales</h1>
          <p className="page-subtitle-premium">Gestiona tus conexiones y vincula nuevas plataformas.</p>
        </div>
        <div className="header-actions-premium">
          <button className="btn-programar" onClick={handleConnectInstagram}>
            <Plus size={18} />
            Vincular Nueva Cuenta
          </button>
        </div>
      </div>

      {isLoading && accounts.length === 0 ? (
        <div className="loading-container-centered">
          <RefreshCcw className="animate-spin" size={32} color="var(--accent)" />
          <p className="loading-text-secondary">Buscando cuentas conectadas...</p>
        </div>
      ) : error ? (
        <div className="error-banner-premium">
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="social-accounts-grid">
          {/* Estado vacío si no hay cuentas */}
          {accounts.length === 0 && !isLoading && (
            <div className="empty-state-container col-span-full">
              <div className="empty-state-icon">
                <AlertCircle size={48} color="var(--text-muted)" />
              </div>
              <h2 className="empty-state-title">No hay cuentas conectadas</h2>
              <p className="empty-state-description">
                Comienza vinculando tu primera cuenta de Instagram o TikTok.
              </p>
              <button className="btn-programar mt-4" onClick={handleConnectInstagram}>
                <Plus size={18} />
                Vincular Primera Cuenta
              </button>
            </div>
          )}

          {/* Lista de cuentas reales */}
          {accounts.map((account) => (
            <div 
              key={account.id} 
              className={`social-account-card-premium ${isLoading ? 'opacity-70' : ''}`}
            >
              <div className="account-card-header">
                <div className={`social-icon-3d ${account.provider.toLowerCase()}`}>
                  {getPlatformIcon(account.provider)}
                </div>
                <div className="account-info-main">
                  <h3 className="account-display-name">{account.displayName || account.provider}</h3>
                  <p className="account-username-text">@{account.username}</p>
                </div>
              </div>
              
              <div className="account-card-footer">
                <span className="account-status-badge">
                  <div className="pulse-dot"></div>
                  Conectada
                </span>
                <button 
                  className="icon-btn-header btn-delete-account" 
                  onClick={() => handleDeleteAccount(account.id, account.username)}
                  disabled={isLoading}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export default SocialAccounts;
