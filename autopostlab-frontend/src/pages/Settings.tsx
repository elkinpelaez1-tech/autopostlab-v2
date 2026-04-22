import React, { useState, useEffect } from 'react';
import { 
  User, 
  Globe, 
  Shield, 
  ExternalLink, 
  CheckCircle2, 
  Instagram, 
  Facebook,
  ChevronRight,
  Camera,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

interface SocialAccount {
  id: string;
  provider: string;
  displayName: string;
  username: string;
}

const Settings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState('America/Bogota');
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/social-accounts');
        setAccounts(response.data);
      } catch (err) {
        console.error('Error fetching accounts for settings:', err);
      }
    };
    fetchAccounts();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!name.trim()) {
      alert('Por favor, ingresa tu nombre antes de guardar.');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 🎯 ACTUALIZACIÓN QUIRÚRGICA: Solo campos editados, NADA de avatarUrl aquí
      const response = await api.patch(`/users/${user.id}`, { 
        name,
      });

      // 🔄 ACTUALIZACIÓN DESDE BACKEND: Usar la respuesta real del servidor
      const updatedUser = response.data;
      updateProfile({ 
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl 
      });

      setSaveStatus('¡Perfil actualizado con éxito!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Error al actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // 1. Subir el archivo al workspace del usuario
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await api.post(`/files/upload/${user.workspaceId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { file: savedFile } = uploadRes.data;
      const url = savedFile.url;

      // 2. Actualizar el perfil del usuario con la nueva URL (SOLO LA URL)
      const updateRes = await api.patch(`/users/${user.id}`, { avatarUrl: url });

      // 🔄 ACTUALIZACIÓN DESDE BACKEND: Usar la respuesta real del servidor
      const updatedUserFromAvatar = updateRes.data;
      updateProfile({ 
        avatarUrl: updatedUserFromAvatar.avatarUrl 
      });
      setSaveStatus('¡Imagen de perfil actualizada!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Error al subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="section-header-premium">
        <div>
          <h1 className="page-title-premium">Ajustes de Usuario</h1>
          <p className="page-subtitle-premium">Configura tu perfil y preferencias de la plataforma.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile Section */}
        <section className="settings-card premium-card">
          <div className="card-header-iconic">
            <div className="icon-wrapper accent">
               <User size={20} />
            </div>
            <h3>Información Personal</h3>
          </div>
          <div className="card-body-settings">
            <div className="avatar-settings-section">
              <div className="avatar-preview-wrapper" onClick={() => fileInputRef.current?.click()} style={{ flexShrink: 0 }}>
                {user?.avatarUrl ? (
                  <img 
                    key={user.avatarUrl} 
                    src={user.avatarUrl} 
                    alt="Avatar" 
                    className="avatar-img-premium" 
                  />
                ) : (
                  <div className="avatar-placeholder-premium">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="avatar-edit-overlay">
                   {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                style={{ display: 'none' }} 
                accept="image/*"
              />
              <div className="avatar-info">
                <h4>Tu Foto de Perfil</h4>
                <p className="text-secondary text-xs">JPG o PNG. Se recomienda 400x400px.</p>
                {saveStatus && saveStatus.includes('Imagen') && <span className="save-status-msg text-success">{saveStatus}</span>}
              </div>
            </div>

            <div className="info-form-group">
              <div className="settings-field">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="settings-field disabled">
                <label>Correo Electrónico</label>
                <input 
                  type="email" 
                  className="premium-input" 
                  value={user?.email || ''} 
                  disabled
                />
                <p className="text-xs text-secondary mt-1">El email no puede ser cambiado.</p>
              </div>
            </div>
            
            <div className="form-actions-settings">
              <button 
                className="btn-save-premium" 
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Guardar Cambios'}
              </button>
              {saveStatus && !saveStatus.includes('Imagen') && <span className="save-status-msg text-success ml-3">{saveStatus}</span>}
            </div>
          </div>
        </section>

        {/* Connected Accounts Summary */}
        <section className="settings-card premium-card">
          <div className="card-header-iconic">
            <div className="icon-wrapper success">
               <Shield size={20} />
            </div>
            <h3>Cuentas Vinculadas</h3>
          </div>
          <div className="card-body-settings">
            <div className="accounts-summary-list">
              {accounts.length > 0 ? (
                accounts.map(acc => (
                  <div key={acc.id} className="account-mini-strip">
                    <div className={`platform-icon-pill ${acc.provider.toLowerCase()}`}>
                       {acc.provider === 'instagram' ? <Instagram size={14} /> : <Facebook size={14} />}
                    </div>
                    <span>{acc.displayName || acc.username}</span>
                    <CheckCircle2 size={14} className="text-success" />
                  </div>
                ))
              ) : (
                <p className="text-muted text-sm">No hay cuentas conectadas.</p>
              )}
            </div>
            <button 
              className="btn-settings-action" 
              onClick={() => navigate('/dashboard/social-accounts')}
            >
              Gestionar Cuentas
              <ExternalLink size={14} />
            </button>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="settings-card premium-card">
          <div className="card-header-iconic">
            <div className="icon-wrapper warning">
               <Globe size={20} />
            </div>
            <h3>Preferencias Regionales</h3>
          </div>
          <div className="card-body-settings">
            <div className="settings-field">
              <label>Zona Horaria</label>
              <select 
                className="premium-select" 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <optgroup label="Sudamérica">
                  <option value="America/Bogota">Bogotá, Colombia (GMT-5)</option>
                  <option value="America/Lima">Lima, Perú (GMT-5)</option>
                  <option value="America/Quito">Quito, Ecuador (GMT-5)</option>
                  <option value="America/Santiago">Santiago, Chile (GMT-4)</option>
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires, Argentina (GMT-3)</option>
                  <option value="America/Sao_Paulo">São Paulo, Brasil (GMT-3)</option>
                  <option value="America/Caracas">Caracas, Venezuela (GMT-4)</option>
                </optgroup>
                <optgroup label="Centroamérica y Otros">
                  <option value="America/Mexico_City">Ciudad de México, México (GMT-6)</option>
                  <option value="America/Panama">Panamá, Panamá (GMT-5)</option>
                  <option value="America/Costa_Rica">Costa Rica (GMT-6)</option>
                  <option value="America/Guatemala">Guatemala (GMT-6)</option>
                  <option value="America/El_Salvador">El Salvador (GMT-6)</option>
                </optgroup>
                <optgroup label="Internacional">
                  <option value="America/New_York">Nueva York, EE.UU. (GMT-5)</option>
                  <option value="Europe/Madrid">Madrid, España (GMT+1)</option>
                  <option value="UTC">UTC (Tiempo Universal)</option>
                </optgroup>
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
