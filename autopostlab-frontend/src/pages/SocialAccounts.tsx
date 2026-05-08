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
  const [showProviderModal, setShowProviderModal] = useState(false);

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

  const handleConnect = async (provider: string) => {
    if (!user?.workspaceId) {
      alert('Error: No se encontró el Workspace ID. Por favor re-inicia sesión.');
      return;
    }
    const API_URL = import.meta.env.VITE_API_URL || '';
    
    if (provider === 'instagram') {
      try {
        setIsLoading(true);
        setShowProviderModal(false);
        const response = await api.post('/social-accounts/detect-instagram', {}, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        await fetchAccounts();
        alert(response.data.message || 'Sincronización de Instagram completada con éxito.');
      } catch (err: any) {
        console.error('Error detectando Instagram:', err);
        alert(err.response?.data?.message || 'No se pudieron escanear las páginas conectadas de Facebook en busca de cuentas de Instagram Business.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    let authUrl = '';
    switch (provider) {
      case 'tiktok':
        authUrl = `${API_URL}/api/tiktok/auth?workspaceId=${user.workspaceId}`;
        break;
      case 'facebook':
        authUrl = `${API_URL}/api/social-auth/facebook?workspaceId=${user.workspaceId}`;
        break;
      case 'linkedin':
        authUrl = `${API_URL}/api/social-auth/linkedin?workspaceId=${user.workspaceId}`;
        break;
      default:
        return;
    }
    
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
          <button className="btn-programar" onClick={() => setShowProviderModal(true)}>
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
          {/* Botón de Añadir (Estilo Glassmorphism) SIEMPRE visible */}
          <div 
            className="add-account-card" 
            onClick={() => setShowProviderModal(true)}
          >
            <div className="plus-circle-premium">
              <Plus size={24} />
            </div>
            <p className="add-account-text">Añadir perfil social</p>
          </div>

          {/* Mensaje de estado vacío si no hay cuentas */}
          {accounts.length === 0 && !isLoading && (
            <div className="empty-state-simple col-span-full py-8 text-center">
              <AlertCircle size={40} color="var(--text-muted)" className="mx-auto mb-3 opacity-50" />
              <p className="empty-state-description">
                Aún no has vinculado ninguna cuenta. <br/>
                Haz clic en el botón de arriba para comenzar.
              </p>
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

      {showProviderModal && (
        <div className="modal-overlay-premium" onClick={() => setShowProviderModal(false)}>
          <div className="modal-content-premium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-premium">
              <h2>Selecciona la Plataforma</h2>
              <button className="modal-close-btn" onClick={() => setShowProviderModal(false)}>×</button>
            </div>
            <div className="modal-body-premium">
              <p className="modal-subtitle-premium">Elige la red social que deseas vincular a tu workspace:</p>
              <div className="provider-selection-grid">
                
                <button className="provider-option-btn" onClick={() => handleConnect('facebook')}>
                  <div className="provider-icon-3d facebook">
                    <Facebook size={24} />
                  </div>
                  <span>Facebook</span>
                </button>

                <button className="provider-option-btn" onClick={() => handleConnect('instagram')}>
                  <div className="provider-icon-3d instagram">
                    <Instagram size={24} />
                  </div>
                  <span>Instagram</span>
                </button>

                <button className="provider-option-btn" onClick={() => handleConnect('linkedin')}>
                  <div className="provider-icon-3d linkedin">
                    <LinkedinIcon size={24} />
                  </div>
                  <span>LinkedIn</span>
                </button>

                <button className="provider-option-btn" onClick={() => handleConnect('tiktok')}>
                  <div className="provider-icon-3d tiktok">
                    <SiTiktok size={24} />
                  </div>
                  <span>TikTok</span>
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default SocialAccounts;
