import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, deletePost, Post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Edit, Trash2, Eye, EyeOff } from 'lucide-react';

export default function MyPostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getPosts().then(data => setPosts(data.filter(p => p.created_by_user_id === user.id)))
      .catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try { await deletePost(id); setPosts(prev => prev.filter(p => p.id !== id)); }
    catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Posts</h1>
        <Link to="/new-post" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">New Post</Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">You haven't written any posts yet.</p>
          <Link to="/new-post" className="text-indigo-600 hover:underline">Write your first post</Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border divide-y">
          {posts.map(post => (
            <div key={post.id} className="p-4 flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link to={`/post/${post.id}`} className="font-semibold hover:text-indigo-600">{post.title}</Link>
                  {post.published ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                </div>
                <p className="text-sm text-gray-500">{new Date(post.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/edit-post/${post.id}`} className="p-2 text-gray-600 hover:text-indigo-600"><Edit className="w-5 h-5" /></Link>
                <button onClick={() => handleDelete(post.id)} className="p-2 text-gray-600 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
