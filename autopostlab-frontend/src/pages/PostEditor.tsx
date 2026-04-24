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

const PostEditor: React.FC = () => {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const editPost = location.state?.editPost;

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get('/social-accounts');
        setAccounts(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (typeof file?.previewUrl === 'string' && file.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [selectedFiles]);

  const getProviderIcon = (provider: string) => {
    const safeProvider = typeof provider === "string" ? provider.toLowerCase() : "";

    switch (safeProvider) {
      case "instagram": return <Instagram size={20} />;
      case "facebook": return <Facebook size={20} />;
      case "twitter":
      case "x": return <Twitter size={20} />;
      case "linkedin": return <Linkedin size={20} />;
      case "tiktok": return <SiTiktok size={20} />;
      default: return <Share2 size={20} />;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileType = typeof selectedFile.type === "string" ? selectedFile.type.toLowerCase() : "";

    if (!fileType.startsWith("image/")) {
      alert("Solo imágenes");
      return;
    }

    if (selectedFiles.length >= 1) {
      alert("Solo 1 imagen");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    const tempId = `temp-${Date.now()}`;

    setSelectedFiles([{ id: tempId, previewUrl, file: selectedFile }]);

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.post('/upload', formData);
      const uploaded = res.data;

      setSelectedFiles(prev =>
        prev.map(f =>
          f.id === tempId
            ? { ...f, id: uploaded.id, url: uploaded.url }
            : f
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePost = async (publishNow: boolean) => {
    if (!content.trim()) return;

    const selectedProviders = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .map(a =>
        typeof a.provider === "string"
          ? a.provider.toUpperCase()
          : ""
      );

    try {
      setIsSubmitting(true);

      await api.post('/posts', {
        content,
        accountIds: selectedAccounts,
        publishNow,
        scheduledAt: publishNow ? null : scheduledAt,
        fileIds: selectedFiles.map(f => f.id)
      });

      alert("OK");

      setContent('');
      setSelectedFiles([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-welcome">
        <h1>Nuevo Post</h1>
      </div>

      <section className="quick-draft-card">
        <div className="draft-editor-container">
          <textarea
            placeholder="¿Qué quieres publicar?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: "100%", minHeight: 120 }}
          />

          <div style={{ marginTop: 20 }}>
            <input type="file" onChange={handleFileChange} />
          </div>

          <div style={{ marginTop: 20 }}>
            {selectedFiles.map(file => {
              const url =
                typeof file.previewUrl === "string"
                  ? file.previewUrl
                  : typeof file.url === "string"
                    ? file.url
                    : "";

              if (!url) return null;

              return <img key={file.id} src={url} width={200} />;
            })}
          </div>

          <div style={{ marginTop: 20 }}>
            <button onClick={() => handleCreatePost(true)}>
              Publicar
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  export default PostEditor;