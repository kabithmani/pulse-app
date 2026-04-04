'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Photo { path: string; name: string; url: string; created_at: string; }

interface PhotoGalleryProps {
  entityType: 'task' | 'contact';
  entityId: string;
}

export default function PhotoGallery({ entityType, entityId }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchPhotos = async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/photos/list?entity_type=${entityType}&entity_id=${entityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPhotos(json.photos || []);
    } catch { setPhotos([]); }
    setLoading(false);
  };

  useEffect(() => { fetchPhotos(); }, [entityId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = await getToken();
    if (!token) return;

    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('entity_type', entityType);
    form.append('entity_id', entityId);

    try {
      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) await fetchPhotos();
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (path: string) => {
    const token = await getToken();
    if (!token) return;
    await fetch('/api/photos/delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    setPhotos(prev => prev.filter(p => p.path !== path));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          📸 PHOTOS {photos.length > 0 && `(${photos.length})`}
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: 'var(--accent)', color: 'white', opacity: uploading ? 0.6 : 1 }}>
          {uploading ? 'Uploading…' : '+ Add photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Gallery grid */}
      {loading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-20 h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-4 rounded-xl text-xs text-center border-dashed border-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
          Tap to add a photo
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map(photo => (
            <div key={photo.path} className="relative group">
              <img
                src={photo.url}
                alt="attachment"
                className="w-20 h-20 object-cover rounded-xl cursor-pointer"
                style={{ border: '1px solid var(--border)' }}
                onClick={() => setLightbox(photo.url)}
              />
              <button
                onClick={() => handleDelete(photo.path)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex"
                style={{ background: '#FF3B30' }}>
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-xl flex items-center justify-center text-xl border-dashed border-2"
            style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
            +
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setLightbox(null)}>
            <img
              src={lightbox}
              alt="full"
              className="max-w-full max-h-full rounded-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              onClick={() => setLightbox(null)}>
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
