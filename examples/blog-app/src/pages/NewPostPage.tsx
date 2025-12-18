import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, getCategories, Category } from '../lib/api';

export default function NewPostPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const generateSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const post = await createPost({
        title, slug: slug || generateSlug(title), content, excerpt: excerpt || undefined,
        category_id: categoryId || undefined, published
      });
      navigate(`/post/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Write New Post</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); if (!slug) setSlug(generateSlug(e.target.value)); }}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="auto-generated" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Brief summary..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" required />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="published" checked={published} onChange={(e) => setPublished(e.target.checked)} className="rounded" />
          <label htmlFor="published" className="text-sm text-gray-700">Publish immediately</label>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  );
}
