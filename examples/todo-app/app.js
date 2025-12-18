/**
 * Todo App - Example using Backendify BaaS
 * 
 * This demonstrates how to use the BaaS for:
 * - User authentication (email/password, OTP)
 * - CRUD operations on a "todos" collection
 * - Token management (access + refresh tokens)
 */

// =============================================================================
// CONFIGURATION - Update these values for your project
// =============================================================================

const CONFIG = {
  // Your Backendify API base URL
  API_BASE: 'http://localhost:8000/api',
  
  // Your project ID (get this from the Backendify console)
  PROJECT_ID: '134a175b-2568-4969-9546-616db8705d4f',
  
  // Collection name for todos (create this in Schema Builder)
  COLLECTION_NAME: 'todos',
};

// Computed URLs
const AUTH_URL = `${CONFIG.API_BASE}/projects/${CONFIG.PROJECT_ID}/auth`;
const DATA_URL = `${CONFIG.API_BASE}/projects/${CONFIG.PROJECT_ID}/data/${CONFIG.COLLECTION_NAME}`;

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

let accessToken = localStorage.getItem('access_token');
let refreshToken = localStorage.getItem('refresh_token');
let currentUser = null;

function saveTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// Refresh the access token using the refresh token
async function refreshAccessToken() {
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(`${AUTH_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  
  clearTokens();
  return false;
}

// Make an authenticated API request with automatic token refresh
async function authFetch(url, options = {}) {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };
  
  let response = await fetch(url, { ...options, headers });
  
  // If 401, try refreshing the token
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      showAuthSection();
      throw new Error('Session expired');
    }
  }
  
  return response;
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  
  try {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token);
      await loadUserAndShowTodos();
    } else {
      const error = await response.json();
      errorEl.textContent = error.detail || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  } catch (error) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  const errorEl = document.getElementById('register-error');
  
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }
  
  try {
    const response = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token);
      await loadUserAndShowTodos();
    } else {
      const error = await response.json();
      errorEl.textContent = error.detail || 'Registration failed';
      errorEl.classList.remove('hidden');
    }
  } catch (error) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
  }
}

let otpEmail = '';

async function handleOtpSend(event) {
  event.preventDefault();
  const email = document.getElementById('otp-email').value;
  const messageEl = document.getElementById('otp-message');
  
  try {
    const response = await fetch(`${AUTH_URL}/otp/send?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    });
    
    const data = await response.json();
    otpEmail = email;
    
    // Show verify form
    document.getElementById('otp-form').classList.add('hidden');
    document.getElementById('otp-verify-form').classList.remove('hidden');
    
    messageEl.classList.remove('hidden', 'text-red-500');
    messageEl.classList.add('text-green-600');
    
    // In dev mode, the code might be returned directly
    if (data.code) {
      messageEl.textContent = `Dev mode - Your code is: ${data.code}`;
    } else {
      messageEl.textContent = 'Check your email for the code';
    }
  } catch (error) {
    messageEl.textContent = 'Failed to send OTP';
    messageEl.classList.remove('hidden', 'text-green-600');
    messageEl.classList.add('text-red-500');
  }
}

async function handleOtpVerify(event) {
  event.preventDefault();
  const code = document.getElementById('otp-code').value;
  const messageEl = document.getElementById('otp-message');
  
  try {
    const response = await fetch(`${AUTH_URL}/otp/verify?email=${encodeURIComponent(otpEmail)}&code=${code}`, {
      method: 'POST',
    });
    
    if (response.ok) {
      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token);
      await loadUserAndShowTodos();
    } else {
      messageEl.textContent = 'Invalid or expired code';
      messageEl.classList.remove('hidden', 'text-green-600');
      messageEl.classList.add('text-red-500');
    }
  } catch (error) {
    messageEl.textContent = 'Verification failed';
    messageEl.classList.remove('hidden', 'text-green-600');
    messageEl.classList.add('text-red-500');
  }
}

async function handleLogout() {
  try {
    await authFetch(`${AUTH_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    // Ignore logout errors
  }
  
  clearTokens();
  showAuthSection();
}

async function loadUserAndShowTodos() {
  try {
    const response = await authFetch(`${AUTH_URL}/me`);
    if (response.ok) {
      currentUser = await response.json();
      document.getElementById('user-email').textContent = currentUser.email;
      showTodoSection();
      await loadTodos();
    } else {
      showAuthSection();
    }
  } catch (error) {
    showAuthSection();
  }
}

// =============================================================================
// TODO CRUD OPERATIONS
// =============================================================================

let todos = [];

async function loadTodos() {
  try {
    const response = await authFetch(DATA_URL);
    if (response.ok) {
      const data = await response.json();
      todos = data.records || [];
      renderTodos();
    }
  } catch (error) {
    console.error('Failed to load todos:', error);
  }
}

async function handleAddTodo(event) {
  event.preventDefault();
  const input = document.getElementById('todo-input');
  const title = input.value.trim();
  
  if (!title) return;
  
  try {
    const response = await authFetch(DATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        completed: false,
      }),
    });
    
    if (response.ok) {
      const newTodo = await response.json();
      todos.unshift(newTodo);
      renderTodos();
      input.value = '';
    }
  } catch (error) {
    console.error('Failed to add todo:', error);
  }
}

async function toggleTodo(id, completed) {
  try {
    const response = await authFetch(`${DATA_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    
    if (response.ok) {
      const updated = await response.json();
      todos = todos.map(t => t.id === id ? updated : t);
      renderTodos();
    }
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

async function deleteTodo(id) {
  try {
    const response = await authFetch(`${DATA_URL}/${id}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      todos = todos.filter(t => t.id !== id);
      renderTodos();
    }
  } catch (error) {
    console.error('Failed to delete todo:', error);
  }
}

// =============================================================================
// UI RENDERING
// =============================================================================

function renderTodos() {
  const listEl = document.getElementById('todo-list');
  const emptyEl = document.getElementById('todo-empty');
  const statsEl = document.getElementById('todo-stats');
  
  if (todos.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    listEl.innerHTML = todos.map(todo => `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
        <input 
          type="checkbox" 
          ${todo.completed ? 'checked' : ''} 
          onchange="toggleTodo('${todo.id}', ${todo.completed})"
          class="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        >
        <span class="flex-1 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}">
          ${escapeHtml(todo.title)}
        </span>
        <button 
          onclick="deleteTodo('${todo.id}')"
          class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    `).join('');
  }
  
  const completed = todos.filter(t => t.completed).length;
  statsEl.textContent = `${todos.length} item${todos.length !== 1 ? 's' : ''} • ${completed} completed`;
}

function showTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('border-blue-500', 'text-blue-600');
    loginTab.classList.remove('text-gray-500');
    registerTab.classList.remove('border-blue-500', 'text-blue-600');
    registerTab.classList.add('text-gray-500');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerTab.classList.add('border-blue-500', 'text-blue-600');
    registerTab.classList.remove('text-gray-500');
    loginTab.classList.remove('border-blue-500', 'text-blue-600');
    loginTab.classList.add('text-gray-500');
  }
  
  // Clear errors
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('register-error').classList.add('hidden');
}

function showAuthSection() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('todo-section').classList.add('hidden');
  
  // Reset OTP form
  document.getElementById('otp-form').classList.remove('hidden');
  document.getElementById('otp-verify-form').classList.add('hidden');
  document.getElementById('otp-message').classList.add('hidden');
}

function showTodoSection() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('todo-section').classList.remove('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  // Check if we have a stored token
  if (accessToken) {
    await loadUserAndShowTodos();
  } else {
    showAuthSection();
  }
}

// Start the app
init();
