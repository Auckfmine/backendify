import { useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Users, Settings, Code, Copy, Check, Trash2, Ban, Shield } from "lucide-react";

import {
  fetchAuthSettings,
  updateAuthSettings,
  fetchAppUsers,
  updateAppUser,
  deleteAppUser,
  revokeAppUserSessions,
  AuthSettings,
  AppUser,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, PageHeader, Badge, FormField, Input, Select, SectionTitle } from "../components/ui";

export function AuthPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"settings" | "users" | "developer">("settings");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const API_BASE = `${window.location.origin}/api/projects/${projectId}/auth`;

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: [...queryKeys.project(projectId), "auth-settings"],
    queryFn: () => fetchAuthSettings(projectId),
  });

  const { data: appUsers, isLoading: usersLoading } = useQuery({
    queryKey: [...queryKeys.project(projectId), "app-users"],
    queryFn: () => fetchAppUsers(projectId),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (updates: Partial<AuthSettings>) => updateAuthSettings(projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.project(projectId), "auth-settings"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { is_disabled?: boolean; is_email_verified?: boolean } }) =>
      updateAppUser(projectId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.project(projectId), "app-users"] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteAppUser(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.project(projectId), "app-users"] });
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: (userId: string) => revokeAppUserSessions(projectId, userId),
  });

  const toggleSetting = (key: keyof AuthSettings, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Authentication"
        description="Manage authentication settings and app users"
        icon={<Shield className="h-6 w-6" />}
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "settings"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Auth Settings
          </span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "users"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            App Users ({appUsers?.length || 0})
          </span>
        </button>
        <button
          onClick={() => setActiveTab("developer")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "developer"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Developer
          </span>
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle>Authentication Providers</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Enable authentication methods for your app users.
            </p>

            {settingsLoading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="space-y-4">
                <ToggleRow
                  label="Email/Password"
                  description="Traditional email and password authentication"
                  checked={settings?.enable_email_password ?? true}
                  onChange={(v) => toggleSetting("enable_email_password", v)}
                  disabled={updateSettingsMutation.isPending}
                />
                <ToggleRow
                  label="Magic Link"
                  description="Passwordless login via email link"
                  checked={settings?.enable_magic_link ?? false}
                  onChange={(v) => toggleSetting("enable_magic_link", v)}
                  disabled={updateSettingsMutation.isPending}
                />
                <ToggleRow
                  label="OTP Code"
                  description="One-time password sent via email"
                  checked={settings?.enable_otp ?? false}
                  onChange={(v) => toggleSetting("enable_otp", v)}
                  disabled={updateSettingsMutation.isPending}
                />
                <ToggleRow
                  label="Google OAuth"
                  description="Sign in with Google"
                  checked={settings?.enable_oauth_google ?? false}
                  onChange={(v) => toggleSetting("enable_oauth_google", v)}
                  disabled={updateSettingsMutation.isPending}
                />
                <ToggleRow
                  label="GitHub OAuth"
                  description="Sign in with GitHub"
                  checked={settings?.enable_oauth_github ?? false}
                  onChange={(v) => toggleSetting("enable_oauth_github", v)}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle>Security Settings</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Configure security options for app user authentication.
            </p>

            {settingsLoading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="space-y-4">
                <ToggleRow
                  label="Allow Public Signup"
                  description="Allow new users to register without invitation"
                  checked={settings?.allow_public_signup ?? true}
                  onChange={(v) => toggleSetting("allow_public_signup", v)}
                  disabled={updateSettingsMutation.isPending}
                />
                <ToggleRow
                  label="Require Email Verification"
                  description="Users must verify email before logging in"
                  checked={settings?.require_email_verification ?? false}
                  onChange={(v) => toggleSetting("require_email_verification", v)}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle>Session Configuration</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Configure token lifetimes for app user sessions.
            </p>

            {settingsLoading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Access Token TTL (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings?.access_ttl_minutes ?? 15}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ access_ttl_minutes: parseInt(e.target.value) || 15 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    min={1}
                    max={1440}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Refresh Token TTL (days)
                  </label>
                  <input
                    type="number"
                    value={settings?.refresh_ttl_days ?? 7}
                    onChange={(e) =>
                      updateSettingsMutation.mutate({ refresh_ttl_days: parseInt(e.target.value) || 7 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    min={1}
                    max={365}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle>API Endpoints</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Use these endpoints to integrate app user authentication.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-emerald-600 font-semibold">POST</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/register</span>
              </div>
              <div>
                <span className="text-emerald-600 font-semibold">POST</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/login</span>
              </div>
              <div>
                <span className="text-emerald-600 font-semibold">POST</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/refresh</span>
              </div>
              <div>
                <span className="text-emerald-600 font-semibold">POST</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/logout</span>
              </div>
              <div>
                <span className="text-blue-600 font-semibold">GET</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/me</span>
              </div>
              <div>
                <span className="text-blue-600 font-semibold">GET</span>{" "}
                <span className="text-slate-700">/api/projects/{projectId}/auth/meta</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Developer Tab */}
      {activeTab === "developer" && (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle>Code Snippets</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Copy-paste ready code snippets for integrating authentication.
            </p>

            {/* Register Snippet */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Register User</h4>
                <button
                  onClick={() => copyToClipboard(`// Register a new user
const response = await fetch('${API_BASE}/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});
const { access_token, refresh_token } = await response.json();
// Store tokens securely`, 'register')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'register' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Register a new user
const response = await fetch('${API_BASE}/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});
const { access_token, refresh_token } = await response.json();
// Store tokens securely`}
              </pre>
            </div>

            {/* Login Snippet */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Login User</h4>
                <button
                  onClick={() => copyToClipboard(`// Login user
const response = await fetch('${API_BASE}/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});
const { access_token, refresh_token, expires_in } = await response.json();`, 'login')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'login' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Login user
const response = await fetch('${API_BASE}/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});
const { access_token, refresh_token, expires_in } = await response.json();`}
              </pre>
            </div>

            {/* Authenticated Request Snippet */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Make Authenticated Request</h4>
                <button
                  onClick={() => copyToClipboard(`// Make authenticated request
const response = await fetch('${API_BASE}/me', {
  headers: {
    'Authorization': \`Bearer \${access_token}\`
  }
});
const user = await response.json();
console.log(user.email, user.is_email_verified);`, 'auth-request')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'auth-request' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Make authenticated request
const response = await fetch('${API_BASE}/me', {
  headers: {
    'Authorization': \`Bearer \${access_token}\`
  }
});
const user = await response.json();
console.log(user.email, user.is_email_verified);`}
              </pre>
            </div>

            {/* Refresh Token Snippet */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Refresh Token</h4>
                <button
                  onClick={() => copyToClipboard(`// Refresh access token
const response = await fetch('${API_BASE}/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token })
});
const { access_token: newAccess, refresh_token: newRefresh } = await response.json();
// Update stored tokens (old refresh is now invalid)`, 'refresh')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'refresh' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Refresh access token
const response = await fetch('${API_BASE}/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token })
});
const { access_token: newAccess, refresh_token: newRefresh } = await response.json();
// Update stored tokens (old refresh is now invalid)`}
              </pre>
            </div>
          </Card>

          {/* OTP / Magic Link Snippets */}
          <Card className="p-6">
            <SectionTitle>OTP / Magic Link Login</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Passwordless authentication using one-time codes sent via email.
            </p>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Send OTP Code</h4>
                <button
                  onClick={() => copyToClipboard(`// Send OTP code to user's email
const response = await fetch('${API_BASE}/otp/send?email=user@example.com', {
  method: 'POST'
});
// In production, code is sent via email
// For testing, code may be returned in response`, 'otp-send')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'otp-send' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Send OTP code to user's email
const response = await fetch('${API_BASE}/otp/send?email=user@example.com', {
  method: 'POST'
});
// In production, code is sent via email
// For testing, code may be returned in response`}
              </pre>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Verify OTP Code</h4>
                <button
                  onClick={() => copyToClipboard(`// Verify OTP and get tokens
const response = await fetch('${API_BASE}/otp/verify?email=user@example.com&code=123456', {
  method: 'POST'
});
const { access_token, refresh_token } = await response.json();`, 'otp-verify')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'otp-verify' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Verify OTP and get tokens
const response = await fetch('${API_BASE}/otp/verify?email=user@example.com&code=123456', {
  method: 'POST'
});
const { access_token, refresh_token } = await response.json();`}
              </pre>
            </div>
          </Card>

          {/* OAuth Snippets */}
          <Card className="p-6">
            <SectionTitle>OAuth Login (Google/GitHub)</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Social login using OAuth providers. Redirect users to the OAuth URL.
            </p>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Get OAuth URL</h4>
                <button
                  onClick={() => copyToClipboard(`// Get OAuth redirect URL for a provider
const provider = 'google'; // or 'github'
const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
const response = await fetch(\`${API_BASE}/oauth/\${provider}/url?redirect_uri=\${redirectUri}\`);
const { url } = await response.json();
// Redirect user to OAuth provider
window.location.href = url;`, 'oauth-url')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'oauth-url' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Get OAuth redirect URL for a provider
const provider = 'google'; // or 'github'
const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
const response = await fetch(\`${API_BASE}/oauth/\${provider}/url?redirect_uri=\${redirectUri}\`);
const { url } = await response.json();
// Redirect user to OAuth provider
window.location.href = url;`}
              </pre>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Handle OAuth Callback</h4>
                <button
                  onClick={() => copyToClipboard(`// In your callback page, exchange the code for tokens
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

const response = await fetch('${API_BASE}/oauth/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'google', // or 'github'
    code,
    state,
    redirect_uri: window.location.origin + '/auth/callback'
  })
});
const { access_token, refresh_token } = await response.json();`, 'oauth-callback')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'oauth-callback' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// In your callback page, exchange the code for tokens
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

const response = await fetch('${API_BASE}/oauth/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'google', // or 'github'
    code,
    state,
    redirect_uri: window.location.origin + '/auth/callback'
  })
});
const { access_token, refresh_token } = await response.json();`}
              </pre>
            </div>
          </Card>

          {/* Password Reset Snippets */}
          <Card className="p-6">
            <SectionTitle>Password Reset</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Allow users to reset their password via email.
            </p>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Request Password Reset</h4>
                <button
                  onClick={() => copyToClipboard(`// Request password reset email
const response = await fetch('${API_BASE}/password/reset/send?email=user@example.com', {
  method: 'POST'
});
// Always returns success to prevent email enumeration`, 'pwd-reset-send')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'pwd-reset-send' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Request password reset email
const response = await fetch('${API_BASE}/password/reset/send?email=user@example.com', {
  method: 'POST'
});
// Always returns success to prevent email enumeration`}
              </pre>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Confirm Password Reset</h4>
                <button
                  onClick={() => copyToClipboard(`// Reset password with token from email
const response = await fetch('${API_BASE}/password/reset/confirm?token=TOKEN&new_password=newSecurePassword', {
  method: 'POST'
});`, 'pwd-reset-confirm')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'pwd-reset-confirm' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Reset password with token from email
const response = await fetch('${API_BASE}/password/reset/confirm?token=TOKEN&new_password=newSecurePassword', {
  method: 'POST'
});`}
              </pre>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle>cURL Examples</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Test endpoints directly from your terminal.
            </p>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Register</h4>
                <button
                  onClick={() => copyToClipboard(`curl -X POST '${API_BASE}/register' \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "user@example.com", "password": "securepassword"}'`, 'curl-register')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'curl-register' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`curl -X POST '${API_BASE}/register' \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "user@example.com", "password": "securepassword"}'`}
              </pre>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-slate-700">Get Auth Meta (API Documentation)</h4>
                <button
                  onClick={() => copyToClipboard(`curl '${API_BASE}/meta'`, 'curl-meta')}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                >
                  {copiedSnippet === 'curl-meta' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`curl '${API_BASE}/meta'`}
              </pre>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle>API Reference</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Full endpoint documentation available at <code className="bg-slate-100 px-1 rounded">/auth/meta</code>
            </p>
            <a
              href={`${API_BASE}/meta`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Open API Documentation
            </a>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <Card className="p-6">
          <SectionTitle>App Users</SectionTitle>
          <p className="text-sm text-slate-500 mb-4">
            Manage users who have registered through your app's authentication.
          </p>

          {usersLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : appUsers?.length === 0 ? (
            <p className="text-slate-500">No app users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Verified</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Created</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appUsers?.map((user: AppUser) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{user.email}</div>
                        <div className="text-xs text-slate-400">{user.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        {user.is_disabled ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {user.is_email_verified ? (
                          <span className="text-green-600">✓ Verified</span>
                        ) : (
                          <span className="text-slate-400">Not verified</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() =>
                              updateUserMutation.mutate({
                                userId: user.id,
                                data: { is_disabled: !user.is_disabled },
                              })
                            }
                            className={`text-xs px-2 py-1 ${
                              user.is_disabled
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            }`}
                            disabled={updateUserMutation.isPending}
                          >
                            {user.is_disabled ? "Enable" : "Disable"}
                          </Button>
                          <Button
                            onClick={() => revokeSessionsMutation.mutate(user.id)}
                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700"
                            disabled={revokeSessionsMutation.isPending}
                          >
                            Revoke Sessions
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(`Delete user ${user.email}?`)) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700"
                            disabled={deleteUserMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
