# Authentication Guide

Backendify provides two types of authentication:

1. **Admin Authentication** - For console/dashboard access
2. **App User Authentication** - For your application's end users

---

## Admin Authentication

Admin users have full access to manage projects, collections, and configurations.

### Register

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword123"
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "token_type": "bearer"
}
```

### Refresh Token

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "a1b2c3d4e5f6..."
}
```

### Using the Access Token

Include the access token in the `Authorization` header:

```bash
GET /api/projects
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## App User Authentication

App users are the end users of your application. Each project has its own user pool.

### Register App User

```bash
POST /api/projects/{project_id}/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userpassword123"
}
```

### Login App User

```bash
POST /api/projects/{project_id}/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userpassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "x1y2z3...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": false
  }
}
```

### Refresh App User Token

```bash
POST /api/projects/{project_id}/auth/refresh
Content-Type: application/json

{
  "refresh_token": "x1y2z3..."
}
```

### Get Current App User

```bash
GET /api/projects/{project_id}/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## API Key Authentication

API keys are useful for server-to-server communication where you don't want to use user credentials.

### Create an API Key

Use the admin console or API to create an API key for your project.

### Using API Keys

Include the API key in the `X-API-Key` header:

```bash
GET /api/projects/{project_id}/data/posts
X-API-Key: your-api-key-here
```

---

## Token Expiration

| Token Type | Default Expiration |
|------------|-------------------|
| Access Token | 30 minutes |
| Refresh Token | 7 days |

Configure these values via environment variables:
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`

---

## Security Best Practices

1. **Never expose tokens in URLs** - Always use headers
2. **Use HTTPS in production** - Tokens are sensitive
3. **Rotate refresh tokens** - Backendify automatically rotates refresh tokens on each use
4. **Set appropriate CORS origins** - Restrict `CORS_ORIGINS` in production
5. **Use short-lived access tokens** - The default 30 minutes is a good balance
