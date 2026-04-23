import React, { useEffect, useState } from 'react';
import { Image, Video, Trash2, Calendar, FileType, Search, Download } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface MediaFile {
  id: string;
  url: string;
  mimeType: string;
  createdAt: string;
  size?: number;
}

interface MediaLibraryProps {
  type: 'image' | 'video';
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ type }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMedia();
  }, [type, user?.workspaceId]);

  const fetchMedia = async () => {
    if (!user?.workspaceId) return;
    try {
      setLoading(true);
      const response = await api.get(`/files/workspace/${user.workspaceId}`);
      // Filtrar por tipo (image/ o video/)
      const filtered = response.data.filter((f: any) => f.mimeType.startsWith(type));
      setFiles(filtered);
    } catch (err) {
      console.error(`Error fetching ${type}s:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar este archivo?`)) return;
    try {
      await api.delete(`/files/${id}/workspace/${user?.workspaceId}`);
      setFiles(files.filter(f => f.id !== id));
    } catch (err) {
      alert('Error al eliminar el archivo');
    }
  };

  const filteredFiles = files.filter(f => 
    (f.mimeType || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    new Date(f.createdAt).toLocaleDateString().includes(searchTerm)
  );

  return (
    <div className="posts-history-page">
      <div className="section-header-premium">
        <div>
          <h1 className="page-title-premium capitalize">
            {type === 'image' ? 'Galería de Fotos' : 'Librería de Videos'}
          </h1>
          <p className="page-subtitle-premium">
            Explora y gestiona todos los recursos multimedia de tu workspace.
          </p>
        </div>
        
        <div className="search-bar-premium">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por fecha o formato..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="analytics-loading">
          <div className="bi-loader"></div>
          <p>Cargando medios...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="posts-table-card" style={{ padding: '60px', textAlign: 'center' }}>
           <div style={{ color: '#BAC4C8', marginBottom: '16px' }}>
             {type === 'image' ? <Image size={64} /> : <Video size={64} />}
           </div>
           <h3 style={{ color: '#2F4858', fontSize: '18px' }}>No hay archivos disponibles</h3>
           <p style={{ color: '#4A7C93', marginTop: '8px' }}>
             Sube contenido al crear una nueva publicación para verlo aquí.
           </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {filteredFiles.map((file) => (
            <div key={file.id} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ 
                 width: '100%', 
                 height: '180px', 
                 borderRadius: '12px', 
                 overflow: 'hidden',
                 background: '#f1f5f9',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 position: 'relative'
               }}>
                 {type === 'image' ? (
                   <img src={file.url} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                 )}
                 
                 <button 
                  onClick={() => handleDelete(file.id)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  title="Eliminar archivo"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#2F4858' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#4A7C93"/> 
                    {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}>
                    <FileType size={14} />
                    {file.mimeType.split('/')[1].toUpperCase()}
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
