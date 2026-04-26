import React, { useState, useRef, useEffect } from 'react';
import { SiTiktok } from 'react-icons/si';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Share2,
  Image as ImageIcon,
  Video,
  Calendar as CalendarIcon,
  Send,
  MoreHorizontal,
  RefreshCcw,
  X,
  Loader2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SelectedFile {
  id: string;
  url?: string;
  previewUrl?: string;
  mimeType?: string;
}

const PostEditor: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editPost = location.state?.editPost;

  const [stats, setStats] = useState({
    scheduled: 0,
    published: 0,
    failed: 0,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/social-accounts');
      setAccounts(response.data || []);
    } catch (err) {
      console.error('Error fetching social accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Cleanup Blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (editPost) {
      setContent(editPost.content || '');
      setSelectedAccounts(editPost.accountIds || []);
      setSelectedFiles(editPost.files || []);
      
      if (editPost.scheduledDate) {
        try {
          const date = new Date(editPost.scheduledDate);
          setScheduledAt(date.toISOString().slice(0, 16));
        } catch (e) {
          console.error("Error formatting date", e);
        }
      }
      
      const editor = document.querySelector('.quick-draft-card');
      editor?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [editPost]);

  const displayName = user?.name || 'Usuario';

  const getProviderIcon = (provider: string) => {
    const safeProvider = typeof provider === "string" ? provider.toLowerCase() : "";
    switch (safeProvider) {
      case 'instagram': return <Instagram size={20} />;
      case 'facebook': return <Facebook size={20} />;
      case 'twitter':
      case 'x': return <Twitter size={20} />;
      case 'linkedin': return <Linkedin size={20} />;
      case 'tiktok': return <SiTiktok size={20} />;
      default: return <Share2 size={20} />;
    }
  };

  const handleToggleAccount = (id: string) => {
    setSelectedAccounts(prev => 
      prev.includes(id) 
        ? prev.filter(accId => accId !== id) 
        : [...prev, id]
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileType = typeof selectedFile.type === "string" ? selectedFile.type.toLowerCase() : "";
    const tempId = `temp-${Date.now()}`;
    const previewUrl = URL.createObjectURL(selectedFile);

    // 1. Mostrar preview inmediato
    setSelectedFiles(prev => [...prev, { 
      id: tempId, 
      previewUrl, 
      mimeType: fileType 
    }]);

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/upload', formData);
      const uploadedFile = response.data.file || response.data;
      
      // 2. Actualizar con datos reales del servidor
      setSelectedFiles(prev => prev.map(f => 
        f.id === tempId ? {
          ...f,
          id: uploadedFile.id || f.id,
          url: uploadedFile.url || uploadedFile.secure_url,
          mimeType: uploadedFile.mimeType || f.mimeType
        } : f
      ));
      
      // Liberar el blob una vez subido con éxito si ya tenemos la URL remota
      if (uploadedFile.url || uploadedFile.secure_url) {
        URL.revokeObjectURL(previewUrl);
      }

    } catch (err: any) {
      console.error("UPLOAD ERROR:", err);
      // Eliminar el preview si falló la subida
      setSelectedFiles(prev => prev.filter(f => f.id !== tempId));
      URL.revokeObjectURL(previewUrl);

      const errorMessage = err.response?.data?.message || err.message || 'Error desconocido';
      alert(`Error al subir el archivo: ${errorMessage}. Intenta con otro formato o tamaño.`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    const fileToRemove = selectedFiles.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreatePost = async (publishNow: boolean, isDraft: boolean = false) => {
    if (!content.trim()) return alert('Por favor escribe el contenido del post.');
    if (!isDraft && selectedAccounts.length === 0) return alert('Selecciona al menos una red social.');
    if (!isDraft && !publishNow && !scheduledAt) return alert('Selecciona una fecha y hora para programar.');

    const selectedProviders = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .map(a => typeof a.provider === "string" ? a.provider.toUpperCase() : "");

    if (selectedProviders.includes('TIKTOK')) {
      if (selectedFiles.length !== 1) return alert('TikTok requiere exactamente 1 video.');
      const file = selectedFiles[0];
      const safeMimeType = typeof file.mimeType === "string" ? file.mimeType : "";
      const isVideo = safeMimeType.startsWith('video/') || (file.url || "").toLowerCase().endsWith('.mp4');
      if (!isVideo) return alert('Para TikTok el archivo debe ser un video (MP4/WebM).');
    }

    try {
      setIsSubmitting(true);
      const payload = {
        content,
        accountIds: selectedAccounts,
        scheduledAt: (!publishNow && !isDraft) ? new Date(scheduledAt).toISOString() : null,
        publishNow,
        isDraft,
        fileIds: selectedFiles.map(f => f.id)
      };

      const response = await api.post('/posts', payload);
      
      if (!response.data.success) throw new Error(response.data.message || 'Error al procesar la publicación.');

      alert(isDraft ? '💾 ¡Borrador guardado!' : (publishNow ? '✅ ¡Publicado exitosamente!' : '📅 ¡Post programado!'));
      
      setContent('');
      setSelectedAccounts([]);
      setScheduledAt('');
      setSelectedFiles([]);
      setShowMoreOptions(false);
    } catch (err: any) {
      console.error('Error al crear post:', err);
      alert(err.response?.data?.message || 'Hubo un error al procesar el post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container" onClick={() => setShowMoreOptions(false)}>
      <div className="dashboard-welcome">
        <h1>¡Hola, {displayName}! 👋</h1>
        <p>Aquí tienes el resumen de tu contenido real y conectado.</p>
      </div>

      <section className="quick-draft-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>Redactar Rápidamente</h2>
          {accounts.length === 0 ? (
            <button className="btn-secondary" onClick={() => navigate('/dashboard/social-accounts')}>
              <Plus size={14} /> Conectar Cuentas
            </button>
          ) : (
            <div className="connected-badge">
              <CheckCircle2 size={14} color="#10b981" /> 
              <span>{accounts.length} cuentas vinculadas</span>
            </div>
          )}
        </div>
        
        <div className="draft-editor-container">
          <div className="user-draft-avatar">
            {displayName.charAt(0)}
          </div>
          <div className="draft-textarea-wrapper">
            <textarea 
              placeholder="¿Qué quieres publicar hoy?" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            {selectedFiles.length > 0 && (
              <div className="selected-files-gallery">
                {selectedFiles.map(file => {
                  const safeMimeType = typeof file.mimeType === "string" ? file.mimeType : "";
                  const displayUrl = file.previewUrl || file.url;
                  const isVideo = safeMimeType.startsWith('video/') || (file.url || "").toLowerCase().endsWith('.mp4');
                  
                  if (!displayUrl) return null;

                  return (
                    <div key={file.id} className="file-preview-item">
                      {isVideo ? (
                        <div className="file-item-video-placeholder">
                           <Video size={32} color="white" />
                        </div>
                      ) : (
                        <img src={displayUrl} alt="Adjunto" className="file-item-media" />
                      )}
                      <button 
                        onClick={() => handleRemoveFile(file.id)}
                        className="file-remove-btn"
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="draft-actions">
              <div className="social-selector">
                {accounts.map(acc => (
                  <div 
                    key={acc.id}
                    className={`social-icon-3d ${typeof acc.provider === "string" ? acc.provider.toLowerCase() : ""} ${selectedAccounts.includes(acc.id) ? 'active' : ''}`} 
                    title={`${acc.provider}: @${acc.username}`}
                    onClick={() => handleToggleAccount(acc.id)}
                  >
                     {getProviderIcon(acc.provider)}
                  </div>
                ))}

                {!accounts.some(acc => (typeof acc.provider === "string" ? acc.provider.toUpperCase() : "") === 'TIKTOK') && (
                  <div 
                    className="social-icon-3d tiktok" 
                    title="Conectar TikTok"
                    onClick={() => {
                      const baseUrl = api.defaults.baseURL || 'http://localhost:3001/api';
                      window.location.href = `${baseUrl}/tiktok/auth?workspaceId=${user?.workspaceId}`;
                    }}
                  >
                     <SiTiktok size={20} />
                  </div>
                )}
              </div>
               
              <div className="attachment-btns">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden-input" 
                  accept="image/*,video/*" 
                  onChange={handleFileChange}
                />
                <button 
                  className="icon-btn-secondary" 
                  title="Subir imagen"
                  onClick={() => {
                    if(fileInputRef.current) {
                      fileInputRef.current.accept = "image/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                </button>
                <button 
                  className="icon-btn-secondary"
                  title="Subir video"
                  onClick={() => {
                    if(fileInputRef.current) {
                      fileInputRef.current.accept = "video/*";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={isUploading}
                >
                  <Video size={20} />
                </button>
                <div className="relative-container">
                  <button 
                    className={`icon-btn-secondary ${showMoreOptions ? 'active' : ''}`}
                    title="Más opciones"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreOptions(!showMoreOptions);
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  {showMoreOptions && (
                    <div className="dropdown-menu-premium">
                      <button 
                        className="dropdown-item" 
                        onClick={() => {
                          setShowMoreOptions(false);
                          const input = document.getElementById('scheduled-input') as HTMLInputElement;
                          if (input && 'showPicker' in input) {
                            (input as any).showPicker();
                          } else {
                            input?.focus();
                          }
                        }}
                      >
                        <Clock size={16} /> Programar post
                      </button>
                      <button 
                        className="dropdown-item" 
                        onClick={() => handleCreatePost(false, true)}
                      >
                        <Send size={16} /> Guardar borrador
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="draft-schedule-row-premium">
          <div 
            className="date-picker-mini" 
            onClick={() => {
              const input = document.getElementById('scheduled-input') as HTMLInputElement;
              if (input && 'showPicker' in input) {
                (input as any).showPicker();
              } else {
                input?.focus();
              }
            }}
          >
            <CalendarIcon size={18} color="#94a3b8" />
            <input 
              id="scheduled-input"
              type="datetime-local" 
              value={scheduledAt}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledAt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="date-picker-input-raw"
            />
          </div>
          
          <div className="flex-gap-10">
            <button 
              className="btn-programar" 
              onClick={() => handleCreatePost(false)}
              disabled={isSubmitting || isUploading || !content || selectedAccounts.length === 0 || !scheduledAt}
            >
              {isSubmitting ? <RefreshCcw className="animate-spin" size={18} /> : (editPost ? <RefreshCcw size={18} /> : <Clock size={18} />)}
              <span>{editPost ? 'Actualizar Programación' : 'Programar'}</span>
            </button>

            <button 
              className="btn-publish-now" 
              onClick={() => handleCreatePost(true)}
              disabled={isSubmitting || isUploading || !content || selectedAccounts.length === 0}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              <span>{editPost ? 'Publicar Cambios' : 'Publicar ahora'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="performance-section">
        <h2>Rendimiento</h2>
        <div className="performance-grid">
           <div className="perf-card">
              <h3>Cuentas Conectadas</h3>
              <p className="perf-value">{accounts.length}</p>
           </div>
           <div className="perf-card">
              <h3>Posts Programados</h3>
              <p className="perf-value gradient">{stats.scheduled}</p>
           </div>
        </div>
      </section>

      <section className="upcoming-posts-section">
        <div className="section-header">
          <h2>Próximos a Publicar</h2>
          <button className="btn-secondary" onClick={() => navigate('/dashboard/posts')}>
            Ver historial completo
          </button>
        </div>
        
        <div className="upcoming-list">
          <div className="empty-state-card">
             <Clock size={32} className="empty-state-icon" />
             <p>Consulta la sección de "Publicaciones" para ver el estado detallado de tus contenidos.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PostEditor;
