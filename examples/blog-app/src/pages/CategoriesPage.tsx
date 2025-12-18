import { useState, useEffect, FormEvent } from 'react';
import { getCategories, createCategory, deleteCategory, Category } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Plus, Trash2, FolderOpen } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error).finally(() => setLoading(false));
  }, []);

  const generateSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const cat = await createCategory({ name, slug: slug || generateSlug(name) });
      setCategories(prev => [...prev, cat]);
      setName(''); setSlug('');
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try { await deleteCategory(id); setCategories(prev => prev.filter(c => c.id !== id)); }
    catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><FolderOpen className="w-6 h-6" /> Categories</h1>
      
      {user && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="font-semibold mb-4">Create Category</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(generateSlug(e.target.value)); }}
              placeholder="Name" className="px-4 py-2 border rounded-lg" required />
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="Slug (auto)" className="px-4 py-2 border rounded-lg" />
          </div>
          <button type="submit" disabled={creating} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Plus className="w-4 h-4" /> {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm border divide-y">
        {categories.map(cat => (
          <div key={cat.id} className="p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{cat.name}</h3>
              <p className="text-sm text-gray-500">/{cat.slug}</p>
            </div>
            {user && (
              <button onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {categories.length === 0 && <p className="p-6 text-center text-gray-500">No categories yet.</p>}
      </div>
    </div>
  );
}
