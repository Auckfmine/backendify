import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPost, updatePost, getCategories, Category } from '../lib/api';

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getPost(id), getCategories()]).then(([post, cats]) => {
      setTitle(post.title); setSlug(post.slug); setContent(post.content);
      setExcerpt(post.excerpt || ''); setCategoryId(post.category_id || '');
      setPublished(post.published); setCategories(cats);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true); setError('');
    try {
      await updatePost(id, { title, slug, content, excerpt: excerpt || undefined, category_id: categoryId || undefined, published });
      navigate(`/post/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Post</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-4 py-2 border rounded-lg" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="w-full px-4 py-2 border rounded-lg" required /></div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="published" checked={published} onChange={(e) => setPublished(e.target.checked)} className="rounded" />
          <label htmlFor="published" className="text-sm text-gray-700">Published</label></div>
        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}</button>
      </form>
    </div>
  );
}
