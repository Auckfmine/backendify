import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPost, getComments, createComment, deleteComment, getCategories, Post, Comment, Category } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Calendar, Tag, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getPost(id), getComments(id), getCategories()])
      .then(([postData, commentsData, categoriesData]) => {
        setPost(postData);
        setComments(commentsData);
        setCategories(categoriesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const comment = await createComment({ content: newComment, post_id: id });
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!post) {
    return <div className="text-center py-12 text-gray-500">Post not found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-indigo-600 hover:underline mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to posts
      </Link>

      <article className="bg-white rounded-lg shadow-sm border p-8 mb-8">
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span className="flex items-center gap-1"><Tag className="w-4 h-4" />{getCategoryName(post.category_id)}</span>
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-gray-600 mb-6 italic">{post.excerpt}</p>}
        <div className="prose max-w-none whitespace-pre-wrap">{post.content}</div>
      </article>

      <section className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" /> Comments ({comments.length})
        </h2>

        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <p className="mb-6 text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link> to leave a comment.
          </p>
        )}

        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="border-b pb-4 last:border-0">
              <div className="flex justify-between items-start">
                <p className="text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                {user && comment.created_by_user_id === user.id && (
                  <button onClick={() => handleDeleteComment(comment.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{new Date(comment.created_at).toLocaleString()}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-gray-500 text-center py-4">No comments yet.</p>}
        </div>
      </section>
    </div>
  );
}
