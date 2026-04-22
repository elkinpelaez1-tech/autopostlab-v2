import React, { useEffect, useState } from 'react';
import { 
  History, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MoreVertical,
  Search,
  ExternalLink,
  Trash2,
  Edit,
  Send,
  RefreshCw,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface FlattenedPost {
  id: string; // ID de ScheduledPost
  parentPostId: string; // ID de Post base
  content: string;
  status: string;
  scheduledDate: string;
  platform: string;
  accountIds: string[];
  files: { id: string; url: string; mimeType: string }[];
}

const Posts: React.FC = () => {
  const [posts, setPosts] = useState<FlattenedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Modals stats
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FlattenedPost | null>(null);
  const [newDate, setNewDate] = useState('');

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/posts');
      
      const flattened: FlattenedPost[] = [];
      response.data.forEach((parentPost: any) => {
        if (parentPost.scheduledPosts && parentPost.scheduledPosts.length > 0) {
          parentPost.scheduledPosts.forEach((sp: any) => {
            flattened.push({
              id: sp.id,
              parentPostId: parentPost.id,
              content: parentPost.content,
              status: sp.status.toLowerCase(),
              scheduledDate: sp.scheduledAt,
              platform: sp.socialAccount?.provider || 'unknown',
              accountIds: parentPost.scheduledPosts.map((p: any) => p.socialAccountId),
              files: parentPost.files.map((f: any) => ({
                id: f.file.id,
                url: f.file.url,
                mimeType: f.file.mimeType
              }))
            });
          });
        }
      });

      setPosts(flattened);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async () => {
    if (!selectedPost) return;
    try {
      setActionLoading(selectedPost.parentPostId);
      await api.delete(`/posts/${selectedPost.parentPostId}`);
      alert('¡Post eliminado correctamente!');
      fetchPosts();
    } catch (err) {
      alert('Error al eliminar el post');
    } finally {
      setActionLoading(null);
      setShowDeleteModal(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedPost || !newDate) return;
    try {
      setActionLoading(selectedPost.id);
      await api.patch(`/posts/scheduled/${selectedPost.id}`, { scheduledAt: new Date(newDate).toISOString() });
      alert('¡Fecha actualizada correctamente!');
      fetchPosts();
    } catch (err) {
      alert('Error al reprogramar');
    } finally {
      setActionLoading(null);
      setShowRescheduleModal(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      setActionLoading(id);
      await api.post(`/posts/scheduled/${id}/publish`);
      alert('¡Publicación enviada exitosamente!');
      fetchPosts();
    } catch (err: any) {
      alert('Error al enviar: ' + (err.response?.data?.message || err.message));
      fetchPosts();
    } finally {
      setActionLoading(null);
      setActiveMenuId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <span className="status-badge published">Publicado</span>;
      case 'pending':
      case 'scheduled':
        return <span className="status-badge scheduled">Programado</span>;
      case 'failed':
        return <span className="status-badge failed">Error</span>;
      default:
        return <span className="status-badge default">{status}</span>;
    }
  };

  return (
    <div className="posts-history-page" onClick={() => setActiveMenuId(null)}>
      <div className="section-header-premium">
        <div>
          <h1 className="page-title-premium">Historial de Publicaciones</h1>
          <p className="page-subtitle-premium">Revisa el estado de todo tu contenido programado.</p>
        </div>
        
        <div className="search-bar-premium">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Buscar publicaciones..." />
        </div>
      </div>

      <div className="posts-table-card">
        <table className="posts-table">
          <thead>
            <tr className="posts-table-header">
              <th>Contenido</th>
              <th>Plataforma</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
               <tr><td colSpan={5} className="posts-table-cell-empty">Cargando publicaciones...</td></tr>
            ) : posts.length === 0 ? (
               <tr><td colSpan={5} className="posts-table-cell-empty">No hay publicaciones registradas aún.</td></tr>
            ) : (
               posts.map((post) => (
                <tr key={post.id} className="posts-table-row table-row-hover">
                  <td className="posts-table-cell">
                    <p className="content-preview-text">{post.content}</p>
                  </td>
                  <td className="posts-table-cell">
                    <div className="platform-info">
                       <div className={`social-icon-3d ${(post.platform || 'unknown').toLowerCase()} bg-mini`}>
                          <ExternalLink size={12} />
                       </div>
                       {post.platform}
                    </div>
                  </td>
                  <td className="posts-table-cell">
                    <div className="date-info">
                      <Calendar size={14} />
                      {post.scheduledDate ? new Date(post.scheduledDate).toLocaleString() : 'Sin fecha'}
                    </div>
                  </td>
                  <td className="posts-table-cell">
                    {actionLoading === post.id ? (
                        <div className="loading-text-primary">
                            <RefreshCw size={14} className="spin-slow" /> Procesando...
                        </div>
                    ) : getStatusBadge(post.status)}
                  </td>
                  <td className="posts-table-cell">
                    <div className="relative-container">
                        <button 
                            className={`icon-btn-header ${activeMenuId === post.id ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === post.id ? null : post.id);
                            }}
                        >
                            <MoreVertical size={18} />
                        </button>

                        {activeMenuId === post.id && (
                            <div className="dropdown-panel action-menu-panel scale-in" onClick={(e) => e.stopPropagation()}>
                                <button className="dropdown-menu-item" onClick={() => {
                                    setSelectedPost(post);
                                    setNewDate(post.scheduledDate);
                                    setShowRescheduleModal(true);
                                    setActiveMenuId(null);
                                }}>
                                    <Clock size={16} /> Reprogramar
                                </button>
                                <button className="dropdown-menu-item" onClick={() => handlePublishNow(post.id)}>
                                    <Send size={16} /> Enviar ahora
                                </button>
                                <button className="dropdown-menu-item" onClick={() => {
                                    navigate('/dashboard', { state: { editPost: post } });
                                    setActiveMenuId(null);
                                }}>
                                    <Edit size={16} /> Editar post
                                </button>
                                <div className="dropdown-divider" />
                                <button className="dropdown-menu-item danger" onClick={() => {
                                    setSelectedPost(post);
                                    setShowDeleteModal(true);
                                    setActiveMenuId(null);
                                }}>
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            </div>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
            <div className="modal-content-premium modal-width-sm">
                <h2 className="modal-title-danger">¿Eliminar publicación?</h2>
                <p>Esta acción eliminará el post y todas sus programaciones de forma permanente. No se puede deshacer.</p>
                <div className="modal-actions-right">
                    <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                    <button className="btn-danger-premium" onClick={handleDelete}>
                        Eliminar permanentemente
                    </button>
                </div>
            </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="modal-overlay">
            <div className="modal-content-premium modal-width-sm">
                <div className="modal-header-premium">
                    <h2>Nueva Fecha</h2>
                    <X size={20} className="cursor-pointer" onClick={() => setShowRescheduleModal(false)} />
                </div>
                <input 
                    type="datetime-local" 
                    className="premium-input-field" 
                    value={newDate.split('.')[0]} 
                    onChange={(e) => setNewDate(e.target.value)} 
                />
                <div className="modal-actions-right">
                    <button className="btn-secondary" onClick={() => setShowRescheduleModal(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={handleReschedule}>Actualizar programación</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Posts;

