import React, { useState } from 'react';
import { SiTiktok } from 'react-icons/si';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart2,
  Users,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Globe,
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
import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PostEditor: React.FC = () => {
  const { user } = useAuth();
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
  const [selectedFiles, setSelectedFiles] = useState<{ id: string; url: string; mimeType?: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const editPost = location.state?.editPost;

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/social-accounts');
      setAccounts(response.data);
    } catch (err) {
      console.error('Error fetching social accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Efecto para cargar datos de edición si existen
  useEffect(() => {
    if (editPost) {
      setContent(editPost.content || '');
      setSelectedAccounts(editPost.accountIds || []);
      setSelectedFiles(editPost.files || []);
      
      if (editPost.scheduledDate) {
        try {
          // Formatear fecha para datetime-local (YYYY-MM-DDTHH:mm)
          const date = new Date(editPost.scheduledDate);
          const formattedDate = date.toISOString().slice(0, 16);
          setScheduledAt(formattedDate);
        } catch (e) {
          console.error("Error formatting date", e);
        }
      }
      
      // Hacer scroll al editor para que el usuario sepa que está editando
      const editor = document.querySelector('.quick-draft-card');
      editor?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [editPost]);

  const displayName = user?.name || 'Usuario';

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
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
    console.log("SELECTED FILE:", selectedFile);
    
    if (!selectedFile) {
      alert("No file selected");
      return;
    }

    const fileType = selectedFile?.type || "";
    const fileName = selectedFile?.name || "";
    const fileSize = selectedFile?.size || 0;

    if (!user?.workspaceId) return;

    try {
      setIsUploading(true);
      console.log('FILE TO UPLOAD:', selectedFile);
      
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log("SENDING FORM DATA");
      // Usar el nuevo endpoint directo y dejar que Axios maneje el Content-Type
      const response = await api.post('/upload', formData);

      // Adaptar respuesta al formato esperado (el nuevo endpoint devuelve {url} o {file})
      const uploadedFile = response.data.file || response.data;
      
      setSelectedFiles(prev => [...prev, { 
        id: uploadedFile.id || `temp-${Date.now()}`, 
        url: uploadedFile.url || uploadedFile.secure_url,
        mimeType: (fileType || "").toLowerCase() || uploadedFile.mimeType
      }]);
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      console.error("Preview error:", err);
      alert('Error al subir el archivo. Intenta con otro formato o tamaño.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreatePost = async (publishNow: boolean, isDraft: boolean = false) => {
    if (!content.trim()) return alert('Por favor escribe el contenido del post.');
    if (!isDraft && selectedAccounts.length === 0) return alert('Selecciona al menos una red social.');
    if (!isDraft && !publishNow && !scheduledAt) return alert('Selecciona una fecha y hora para programar.');

    // 📱 Validaciones específicas por Red Social
    const selectedProviders = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .map(a => a.provider.toUpperCase());

    if (selectedProviders.includes('TIKTOK')) {
      if (selectedFiles.length !== 1) {
        return alert('TikTok requiere exactamente 1 video.');
      }
      const file = selectedFiles[0];
      const isVideo = file.mimeType?.startsWith('video/') || file.url.toLowerCase().endsWith('.mp4');
      if (!isVideo) {
        return alert('Para TikTok el archivo debe ser un video (MP4/WebM).');
      }
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
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al procesar la publicación.');
      }

      if (isDraft) {
        alert('💾 ¡Borrador guardado exitosamente!');
      } else {
        console.log("PLATFORM RESPONSE:", response.data.platforms);
        
        const platformEntries = Object.values(response.data.platforms || {}) as any[];
        const platformNames = platformEntries.map(p => p.provider?.toUpperCase()).filter(Boolean).join(', ');

        const msg = publishNow 
          ? (response.data.status === 'PARTIAL_SUCCESS' 
              ? '⚠️ Post enviado, pero algunas redes fallaron. Revisa el historial.' 
              : `✅ ¡Publicado exitosamente en ${platformNames || 'redes sociales'}! 🚀`)
          : '📅 ¡Misión cumplida! Post programado correctamente 🚀';
        
        alert(msg);
      }
      
      // Limpiar formulario
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

  const handleConnect = () => {
    window.location.href = '/dashboard/social-accounts';
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
            <button className="btn-secondary" onClick={handleConnect}>
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

            {/* Galería de archivos adjuntos */}
            {selectedFiles.length > 0 && (
              <div className="selected-files-gallery">
                {selectedFiles.map(file => {
                  const isVideo = file.mimeType?.startsWith('video/') || file.url.toLowerCase().endsWith('.mp4');
                  return (
                    <div key={file.id} className="file-preview-item">
                      {isVideo ? (
                        <div className="file-item-video-placeholder">
                           <Video size={32} color="white" />
                        </div>
                      ) : (
                        <img src={file.url} alt="Adjunto" className="file-item-media" />
                      )}
                      <button 
                        onClick={() => handleRemoveFile(file.id)}
                        className="file-remove-btn"
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
                      className={`social-icon-3d ${acc.provider.toLowerCase()} ${selectedAccounts.includes(acc.id) ? 'active' : ''}`} 
                      title={`${acc.provider}: @${acc.username}`}
                      onClick={() => handleToggleAccount(acc.id)}
                    >
                       {getProviderIcon(acc.provider)}
                    </div>
                  ))}

                  {/* Botón de conexión rápida para TikTok si no está conectado */}
                  {!accounts.some(acc => acc.provider?.toUpperCase() === 'TIKTOK') && (
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
                  
                  {accounts.length === 0 && (
                    <p className="empty-accounts-text">
                      No hay cuentas conectadas. Ve a la sección de cuentas para empezar.
                    </p>
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
          <button className="btn-secondary" onClick={() => window.location.href = '/dashboard/posts'}>
            Ver historial completo
          </button>
        </div>
        
        <div className="upcoming-list">
          {/* Aquí se cargarán los posts reales cuando el endpoint de próximos posts esté listo */}
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
