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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
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

  const [monthlyPostsCount, setMonthlyPostsCount] = useState(0);

  const fetchPosts = async () => {
    try {
      const response = await api.get('/posts');
      const posts = response.data || [];
      
      let scheduled = 0;
      let published = 0;
      let failed = 0;
      
      posts.forEach((p: any) => {
        p.scheduledPosts?.forEach((sp: any) => {
          if (sp.status === 'PENDING' || sp.status === 'PROCESSING') scheduled++;
          else if (sp.status === 'PUBLISHED') published++;
          else if (sp.status === 'FAILED') failed++;
        });
      });
      
      setStats({ scheduled, published, failed });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const thisMonthPosts = posts.filter((p: any) => {
        const postDate = new Date(p.createdAt);
        return postDate.getMonth() === currentMonth && postDate.getFullYear() === currentYear;
      });
      
      setMonthlyPostsCount(thisMonthPosts.length);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
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
  const plan = user?.plan || 'FREE';
  const planLimit = plan === 'FREE' ? 20 : (plan === 'PRO' ? 200 : null);
  const isUnlimited = plan === 'AGENCY';
  
  const usagePercentage = planLimit ? Math.min((monthlyPostsCount / planLimit) * 100, 100) : 0;
  const isNearLimit = usagePercentage >= 80;

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

    if (usagePercentage >= 100 && !isUnlimited) {
      setShowUpgradeModal(true);
      return;
    }

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
      
      // Refresh posts data after creating
      fetchPosts();
    } catch (error: any) {
      console.error('ERROR COMPLETO:', error);
      console.error('ERROR RESPONSE:', error.response);
      console.error('ERROR DATA:', error.response?.data);
      console.error('ERROR MESSAGE:', error.message);

      // Handle the ForbiddenException effectively to display to user
      const errMessage = error.response?.data?.message || error.message;
      if (error.response?.status === 403 && (errMessage.toLowerCase().includes('límite') || errMessage.toLowerCase().includes('plan'))) {
        setShowUpgradeModal(true);
      } else {
        alert(errMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const planExpiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const hadPro = user?.hadPro || false;
  let daysLeft = null;
  
  if (planExpiresAt) {
    const timeDiff = planExpiresAt.getTime() - new Date().getTime();
    daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  const isExpired = plan === 'FREE' && hadPro;

  return (
    <div className="dashboard-container" onClick={() => setShowMoreOptions(false)}>
      
      {/* Subscription Banners */}
      {plan === 'PRO' && planExpiresAt && daysLeft !== null && daysLeft <= 5 && daysLeft >= 0 && (
        <div style={{ background: '#f59e0b', color: 'white', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span style={{ fontWeight: 600 }}>Tu suscripción vence pronto ({daysLeft} días).</span> Renueva para no perder tus beneficios.
        </div>
      )}

      {isExpired && (
        <div style={{ background: '#ef4444', color: 'white', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span style={{ fontWeight: 600 }}>Tu plan ha expirado.</span> Vuelve a PRO para continuar sin límites.
          </div>
          <button 
            onClick={() => setShowUpgradeModal(true)}
            style={{ background: 'white', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Actualizar
          </button>
        </div>
      )}

      <div className="dashboard-welcome">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>¡Hola, {displayName}! 👋</h1>
            <p>Aquí tienes el resumen de tu contenido real y conectado.</p>
          </div>
          
          <div className="plan-usage-card">
            <div className="plan-usage-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span className="plan-badge">Plan: {plan}</span>
                {plan === 'PRO' && planExpiresAt && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Vence el {planExpiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              {isUnlimited ? (
                <span className="usage-text">Publicaciones ilimitadas</span>
              ) : (
                <span className="usage-text">{monthlyPostsCount} de {planLimit} publicaciones usadas este mes</span>
              )}
            </div>
            
            {!isUnlimited && (
              <>
                <div className="progress-bar-container">
                  <div 
                    className={`progress-bar-fill ${isNearLimit ? 'warning' : ''}`} 
                    style={{ width: `${usagePercentage}%` }}
                  ></div>
                </div>
                {isNearLimit && (
                  <div className="usage-warning">
                    <AlertCircle size={12} />
                    <span>Estás cerca del límite de tu plan</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
                {accounts.length > 0 ? (
                  accounts.map(acc => (
                    <div 
                      key={acc.id}
                      className={`social-icon-3d ${typeof acc.provider === "string" ? acc.provider.toLowerCase() : ""} ${selectedAccounts.includes(acc.id) ? 'active' : ''}`} 
                      title={`${acc.provider}: @${acc.username}`}
                      onClick={() => handleToggleAccount(acc.id)}
                    >
                       {getProviderIcon(acc.provider)}
                    </div>
                  ))
                ) : (
                  <span className="empty-accounts-text">Conecta una cuenta para comenzar</span>
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

      {showUpgradeModal && (
        <div className="modal-overlay">
          <div className="modal-content upgrade-modal">
            <h2>🚀 Desbloquea más capacidad</h2>
            <p className="upgrade-subtitle">Lleva tu estrategia de redes al siguiente nivel con el plan PRO.</p>
            
            <ul className="upgrade-features">
              <li><CheckCircle2 size={16} /> Hasta 5 cuentas sociales</li>
              <li><CheckCircle2 size={16} /> Hasta 200 publicaciones al mes</li>
              <li><CheckCircle2 size={16} /> Programación avanzada</li>
              <li><CheckCircle2 size={16} /> Métricas completas</li>
            </ul>

            <div className="modal-actions" style={{ flexDirection: 'column', gap: '0.8rem' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.8rem', justifyContent: 'center' }}
                disabled={isSubmitting}
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    const response = await api.post('/billing/create-checkout', { 
                      organizationId: user?.organizationId, 
                      plan: 'PRO' 
                    });
                    if (response.data && response.data.checkoutUrl) {
                      window.location.href = response.data.checkoutUrl;
                    } else {
                      throw new Error('No se recibió la URL de pago');
                    }
                  } catch (error: any) {
                    console.error('Error al generar link de pago:', error);
                    alert(error.response?.data?.message || 'Hubo un error al conectar con el procesador de pagos. Por favor intenta de nuevo.');
                    setIsSubmitting(false);
                  }
                }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar a PRO'}
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', border: 'none', background: 'transparent', justifyContent: 'center' }}
                onClick={() => setShowUpgradeModal(false)}
                disabled={isSubmitting}
              >
                Más tarde
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostEditor;
