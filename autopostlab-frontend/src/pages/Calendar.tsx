import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Instagram, 
  Facebook, 
  Linkedin, 
  Send, 
  Clock, 
  MoreVertical, 
  Filter,
  X,
  Trash2,
  Edit,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

interface CalendarPost {
  id: string;
  postId: string;
  content: string;
  platform: string;
  scheduledAt: Date;
  status: string;
}

const ContentCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDayPosts, setSelectedDayPosts] = useState<CalendarPost[]>([]);
  const [selectedDayTitle, setSelectedDayTitle] = useState('');
  const navigate = useNavigate();

  // --- Helpers ---
  const getPostTitle = (content: string) => {
    const firstLine = content.split('\n')[0];
    return firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;
  };

  // --- Fetch y Procesamiento ---
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/posts');
      const flattened: CalendarPost[] = [];
      
      response.data.forEach((p: any) => {
        p.scheduledPosts?.forEach((sp: any) => {
          const provider = sp.socialAccount?.provider?.toLowerCase() || 'unknown';
          flattened.push({
            id: sp.id,
            postId: p.id,
            content: p.content,
            platform: provider,
            scheduledAt: new Date(sp.scheduledAt),
            status: sp.status?.toLowerCase() || 'pending'
          });
        });
      });
      setPosts(flattened);
    } catch (err) {
      console.error('Error fetching calendar posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // --- Lógica del Calendario (Lunes a Domingo) ---
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    // Ajuste para Lunes = 0 (getDay() da 0 para Domingo, 1 para Lunes)
    // Formula: (day + 6) % 7 -> Domingo 0 -> 6, Lunes 1 -> 0, Martes 2 -> 1...
    let startDayIdx = (firstDay.getDay() + 6) % 7;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    
    // Padding inicial
    for (let i = 0; i < startDayIdx; i++) {
      days.push(null);
    }
    
    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  // --- Filtrado ---
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const matchPlatform = filterPlatform === 'all' || p.platform === filterPlatform;
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchPlatform && matchStatus;
    });
  }, [posts, filterPlatform, filterStatus]);

  const getDayPosts = (date: Date) => {
    return filteredPosts.filter(p => p.scheduledAt.toDateString() === date.toDateString())
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  };

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  // --- Acciones de Modal ---
  const handleOpenDetail = (post: any) => {
    setSelectedPost(post);
    setShowModal(true);
    setShowDayModal(false); // Cerrar el del día si estaba abierto
  };

  const handleOpenDayModal = (date: Date, dayPosts: CalendarPost[]) => {
    setSelectedDayPosts(dayPosts);
    setSelectedDayTitle(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    setShowDayModal(true);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('¿Eliminar este post definitivamente?')) return;
    try {
      await api.delete(`/posts/${id}`);
      fetchPosts();
      setShowModal(false);
    } catch (err) { alert('Error al eliminar'); }
  };

  return (
    <div className="calendar-page scale-in">
      <div className="calendar-header">
        <div className="header-left">
          <h1 className="bi-title capitalize">{monthName}</h1>
          <div className="month-nav">
            <button className="nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
            <button className="nav-btn-today" onClick={() => setCurrentDate(new Date())}>Hoy</button>
            <button className="nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="header-right filters-bar">
          <div className="filter-group">
            <Filter size={14} className="filter-icon" />
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="calendar-select">
              <option value="all">Todas las redes</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          <div className="filter-group">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="calendar-select">
              <option value="all">Todos los estados</option>
              <option value="published">Publicados</option>
              <option value="pending">Programados</option>
              <option value="failed">Error</option>
            </select>
          </div>
        </div>
      </div>

      <div className="calendar-grid-container glass-card">
        {/* Días de la semana */}
        <div className="calendar-weekdays">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="weekday-label">{d}</div>
          ))}
        </div>

        {/* Celdas de días */}
        <div className="calendar-body">
          {calendarData.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="calendar-day padding-day"></div>;
            
            const dayPosts = getDayPosts(day);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div key={day.toISOString()} className={`calendar-day ${isToday ? 'today' : ''}`}>
                <div className="day-number">{day.getDate()}</div>
                <div className="day-posts-container">
                  {dayPosts.slice(0, 3).map(post => (
                    <div 
                      key={post.id} 
                      className={`calendar-post-item ${post.platform} ${post.status}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(post);
                      }}
                    >
                      <div className="post-header-mini">
                         {post.platform === 'instagram' ? <Instagram size={10} /> : (post.platform === 'facebook' ? <Facebook size={10} /> : <Linkedin size={10} />)}
                         <span className="post-time">{post.scheduledAt.getHours()}:{post.scheduledAt.getMinutes().toString().padStart(2, '0')}</span>
                      </div>
                      <p className="post-preview-mini">{getPostTitle(post.content)}</p>
                    </div>
                  ))}
                  
                  {dayPosts.length > 3 && (
                    <button 
                      className="more-posts-indicator"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(day, dayPosts);
                      }}
                    >
                      +{dayPosts.length - 3} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Modal Detalle --- */}
      {showModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-premium calendar-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bi">
              <div className="flex-align-center gap-10">
                 <div className={`platform-icon-circle ${selectedPost.platform}`}>
                   {selectedPost.platform === 'instagram' ? <Instagram size={18} /> : (selectedPost.platform === 'facebook' ? <Facebook size={18} /> : <Linkedin size={18} />)}
                 </div>
                 <h3>Detalle de la Publicación</h3>
              </div>
              <button className="btn-close-bi" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <div className="modal-body-detail">
               <div className="detail-meta">
                  <div className="meta-item">
                     <Clock size={16} /> 
                     <span>{selectedPost.scheduledAt.toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`status-pill ${selectedPost.status}`}>
                     {selectedPost.status === 'published' ? 'Publicado' : 'Programado'}
                  </div>
               </div>
               
               <div className="detail-content-box">
                  <p>{selectedPost.content}</p>
               </div>

               <div className="detail-actions">
                  <button className="btn-bi-secondary" onClick={() => {
                    navigate('/dashboard/create', { state: { editPost: { ...selectedPost, scheduledDate: selectedPost.scheduledAt.toISOString(), parentPostId: selectedPost.postId } } });
                  }}>
                    <Edit size={16} /> Editar post
                  </button>
                  <button className="btn-bi-danger" onClick={() => handleDelete(selectedPost.postId)}>
                    <Trash2 size={16} /> Eliminar definitivamente
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal Lista del Día --- */}
      {showDayModal && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="modal-content-premium day-list-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bi">
              <div>
                <h3 className="capitalize">{selectedDayTitle}</h3>
                <p className="bi-subtitle">{selectedDayPosts.length} publicaciones programadas</p>
              </div>
              <button className="btn-close-bi" onClick={() => setShowDayModal(false)}><X size={20} /></button>
            </div>
            
            <div className="day-posts-list-scroll">
               {selectedDayPosts.map(post => (
                 <div 
                   key={post.id} 
                   className={`calendar-post-item full-width-item ${post.platform} ${post.status}`}
                   onClick={() => handleOpenDetail(post)}
                 >
                   <div className="post-header-mini">
                      <div className="flex-align-center gap-6">
                        {post.platform === 'instagram' ? <Instagram size={14} /> : (post.platform === 'facebook' ? <Facebook size={14} /> : <Linkedin size={14} />)}
                        <span className="capitalize">{post.platform}</span>
                      </div>
                      <span className="post-time">{post.scheduledAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hs</span>
                   </div>
                   <p className="post-preview-text">{post.content}</p>
                   <div className="post-item-footer">
                      <span className={`status-badge-mini ${post.status}`}>{post.status}</span>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentCalendar;
