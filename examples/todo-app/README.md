# Todo App - Backendify BaaS Example

A simple Todo application demonstrating how to use Backendify BaaS for:
- User authentication (email/password, OTP)
- CRUD operations on data collections
- Token management with automatic refresh

## Setup Instructions

### 1. Start Backendify

Make sure your Backendify BaaS is running:

```bash
cd /path/to/backendify
docker compose up
```

### 2. Create a Project in Backendify Console

1. Open the Backendify console at `http://localhost:5173`
2. Login or register an admin account
3. Create a new project (e.g., "Todo App")
4. Copy the **Project ID** from the URL or project settings

### 3. Configure Auth Settings

In your project:
1. Go to **Auth Settings**
2. Enable **Email/Password** authentication
3. Enable **OTP/Magic Link** if you want passwordless login
4. Enable **Public Signup** to allow users to register

### 4. Create the Todos Collection

In **Schema Builder**:
1. Create a new collection named `todos`
2. Add these fields:
   - `title` (text, required)
   - `completed` (boolean, default: false)

### 5. Set Up Policies

In **Policies** for the `todos` collection:

Create a policy for **App Users to manage their own todos**:
- Name: "Users can manage own todos"
- Action: `create`, `read`, `update`, `delete` (create one for each)
- Effect: `allow`
- Allowed Principals: `app_user`
- Condition: `created_by_app_user_id` equals `$current_user_id`

Or for simpler setup, allow all authenticated users:
- Name: "Authenticated users full access"
- Action: `create` / `read` / `update` / `delete`
- Effect: `allow`
- Allowed Principals: `app_user`

### 6. Configure the App

Edit `app.js` and update the CONFIG section:

```javascript
const CONFIG = {
  API_BASE: 'http://localhost:8000/api',
  PROJECT_ID: 'your-project-id-here',  // <-- Update this!
  COLLECTION_NAME: 'todos',
};
```

### 7. Run the App

You can serve the app with any static file server:

```bash
# Using Python
python -m http.server 3000

# Using Node.js (npx)
npx serve -p 3000

# Using PHP
php -S localhost:3000
```

Then open `http://localhost:3000` in your browser.

## Features Demonstrated

### Authentication
- **Email/Password Login** - Traditional login with email and password
- **User Registration** - Create new accounts
- **OTP Login** - Passwordless authentication with one-time codes
- **Token Refresh** - Automatic access token refresh using refresh tokens
- **Logout** - Proper session termination

### Data Operations
- **Create** - Add new todos
- **Read** - List all todos for the current user
- **Update** - Toggle todo completion status
- **Delete** - Remove todos

### Security
- All API calls use Bearer token authentication
- Automatic token refresh on 401 responses
- Tokens stored in localStorage (use secure cookies in production)

## Code Structure

```
todo-app/
├── index.html    # UI with Tailwind CSS
├── app.js        # Application logic
└── README.md     # This file
```

## API Endpoints Used

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and invalidate refresh token
- `GET /auth/me` - Get current user info
- `POST /auth/otp/send` - Send OTP code
- `POST /auth/otp/verify` - Verify OTP and get tokens

### Data
- `GET /data/todos` - List todos
- `POST /data/todos` - Create todo
- `PATCH /data/todos/:id` - Update todo
- `DELETE /data/todos/:id` - Delete todo

## Customization Ideas

1. **Add due dates** - Add a `due_date` field to todos
2. **Categories** - Add a `category` field and filter by category
3. **Priority levels** - Add a `priority` field (low, medium, high)
4. **Sharing** - Create a separate collection for shared todos
5. **OAuth login** - Add Google/GitHub login buttons

## Production Considerations

- Use HTTPS for all API calls
- Store tokens in httpOnly cookies instead of localStorage
- Add CSRF protection
- Implement proper error handling and user feedback
- Add loading states for better UX
