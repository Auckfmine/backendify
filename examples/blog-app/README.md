# Blog App - Backendify Example

A full-featured blog application demonstrating relationships between collections (Categories, Posts, Comments) using Backendify BaaS.

## Features

- **User Authentication** - Register, login, logout with JWT tokens
- **Categories** - Organize posts by category
- **Posts** - Create, edit, publish/unpublish blog posts
- **Comments** - Users can comment on posts
- **Relationships** - Posts belong to Categories, Comments belong to Posts (configured via Relationships tab)

## Data Model (Relationships)

```
Categories (1) ──── (N) Posts (1) ──── (N) Comments
     │                    │                  │
     └── name             ├── title          └── content
     └── slug             ├── content        
     └── description      ├── excerpt
                          └── published
```

## Setup

### 1. Configure Backend in Backendify Dashboard

Go to your Backendify dashboard and create the following collections:

#### Collection: `categories`

**Fields Tab:**
| Field | Type | Required | Unique | Indexed |
|-------|------|:--------:|:------:|:-------:|
| name | string | ✓ | ✓ | ✓ |
| slug | string | ✓ | ✓ | ✓ |
| description | string | | | |

#### Collection: `posts`

**Fields Tab:**
| Field | Type | Required | Unique | Indexed |
|-------|------|:--------:|:------:|:-------:|
| title | string | ✓ | | ✓ |
| slug | string | ✓ | ✓ | ✓ |
| content | string | ✓ | | |
| excerpt | string | | | |
| published | boolean | | | ✓ |

**Relationships Tab:**
| Relationship | Type | Target Collection | Foreign Key |
|--------------|------|-------------------|-------------|
| category | belongs_to | categories | category_id |

> This creates a `category_id` field automatically that references the `categories` collection.

#### Collection: `comments`

**Fields Tab:**
| Field | Type | Required | Unique | Indexed |
|-------|------|:--------:|:------:|:-------:|
| content | string | ✓ | | |

**Relationships Tab:**
| Relationship | Type | Target Collection | Foreign Key |
|--------------|------|-------------------|-------------|
| post | belongs_to | posts | post_id |

> This creates a `post_id` field automatically that references the `posts` collection.

### 2. Configure Policies

For each collection, add appropriate policies:

#### Categories Policies
- **read** - Allow: `public` (anyone can read categories)
- **create** - Allow: `authenticated` (logged-in users can create)
- **update** - Allow: `authenticated`
- **delete** - Allow: `authenticated`

#### Posts Policies
- **read** - Allow: `public` (anyone can read published posts)
- **create** - Allow: `authenticated`
- **update** - Allow: `authenticated` (ideally owner-only)
- **delete** - Allow: `authenticated` (ideally owner-only)

#### Comments Policies
- **read** - Allow: `public`
- **create** - Allow: `authenticated`
- **update** - Allow: `authenticated` (owner-only)
- **delete** - Allow: `authenticated` (owner-only)

### 3. Run the Frontend

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your project ID
# VITE_API_URL=http://localhost:8000
# VITE_PROJECT_ID=<your-project-id>

# Start development server
npm run dev
```

The app will be available at `http://localhost:5174`

## Usage

1. **Register** - Create a new account
2. **Create Categories** - Go to Categories page and add some categories
3. **Write Posts** - Click "Write" to create a new blog post
4. **Comment** - View a post and leave comments
5. **Manage Posts** - Go to "My Posts" to edit/delete your posts

## API Endpoints Used

- `POST /api/v1/projects/{id}/auth/register` - Register user
- `POST /api/v1/projects/{id}/auth/login` - Login
- `POST /api/v1/projects/{id}/auth/refresh` - Refresh token
- `GET /api/v1/projects/{id}/auth/me` - Get current user
- `GET/POST/PATCH/DELETE /api/v1/projects/{id}/data/categories` - Categories CRUD
- `GET/POST/PATCH/DELETE /api/v1/projects/{id}/data/posts` - Posts CRUD
- `GET/POST/PATCH/DELETE /api/v1/projects/{id}/data/comments` - Comments CRUD

## Tech Stack

- React 18
- React Router DOM
- TailwindCSS
- Lucide Icons
- Vite
