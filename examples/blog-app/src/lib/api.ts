const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || '';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  published: boolean;
  category_id: string | null;
  author_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  content: string;
  post_id: string;
  author_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

let accessToken: string | null = localStorage.getItem('blog_access_token');
let refreshToken: string | null = localStorage.getItem('blog_refresh_token');

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  localStorage.setItem('blog_access_token', tokens.access_token);
  localStorage.setItem('blog_refresh_token', tokens.refresh_token);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('blog_access_token');
  localStorage.removeItem('blog_refresh_token');
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  
  try {
    const res = await fetch(`${API_BASE}/api/projects/${PROJECT_ID}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (!res.ok) {
      clearTokens();
      return false;
    }
    
    const data = await res.json();
    setTokens(data);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return res.json();
}

// Auth
export async function register(email: string, password: string, displayName?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/projects/${PROJECT_ID}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(error.detail || 'Registration failed');
  }
  
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/api/projects/${PROJECT_ID}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(error.detail || 'Login failed');
  }
  
  const tokens = await res.json();
  setTokens(tokens);
  return tokens;
}

export async function getMe(): Promise<User> {
  return apiRequest(`/api/projects/${PROJECT_ID}/auth/me`);
}

export function logout() {
  clearTokens();
}

// Paginated response type
interface PaginatedResponse<T> {
  records: T[];
  total: number;
  limit: number;
  offset: number;
}

// Categories
export async function getCategories(): Promise<Category[]> {
  const response = await apiRequest<PaginatedResponse<Category>>(`/api/projects/${PROJECT_ID}/data/categories`);
  return response.records;
}

export async function getCategory(id: string): Promise<Category> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/categories/${id}`);
}

export async function createCategory(data: { name: string; slug: string }): Promise<Category> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/categories/${id}`, {
    method: 'DELETE',
  });
}

// Posts
export async function getPosts(filters?: { category_id?: string; published?: boolean; author_id?: string }): Promise<Post[]> {
  const params = new URLSearchParams();
  if (filters?.category_id) params.append('category_id', filters.category_id);
  if (filters?.published !== undefined) params.append('published', String(filters.published));
  if (filters?.author_id) params.append('author_id', filters.author_id);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiRequest<PaginatedResponse<Post>>(`/api/projects/${PROJECT_ID}/data/posts${query}`);
  return response.records;
}

export async function getPost(id: string): Promise<Post> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/posts/${id}`);
}

export async function createPost(data: {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  published?: boolean;
  category_id?: string;
}): Promise<Post> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/posts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePost(id: string, data: Partial<Post>): Promise<Post> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePost(id: string): Promise<void> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/posts/${id}`, {
    method: 'DELETE',
  });
}

// Comments
export async function getComments(postId?: string): Promise<Comment[]> {
  const query = postId ? `?post_id=${postId}` : '';
  const response = await apiRequest<PaginatedResponse<Comment>>(`/api/projects/${PROJECT_ID}/data/comments${query}`);
  return response.records;
}

export async function getComment(id: string): Promise<Comment> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/comments/${id}`);
}

export async function createComment(data: { content: string; post_id: string }): Promise<Comment> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateComment(id: string, data: { content: string }): Promise<Comment> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteComment(id: string): Promise<void> {
  return apiRequest(`/api/projects/${PROJECT_ID}/data/comments/${id}`, {
    method: 'DELETE',
  });
}
