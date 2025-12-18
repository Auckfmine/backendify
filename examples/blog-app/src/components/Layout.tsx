import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { BookOpen, PenSquare, LogOut, User, FolderOpen } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-600">
              <BookOpen className="w-6 h-6" />
              Blog App
            </Link>
            
            <nav className="flex items-center gap-4">
              <Link to="/categories" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600">
                <FolderOpen className="w-4 h-4" />
                Categories
              </Link>
              
              {user ? (
                <>
                  <Link to="/my-posts" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600">
                    <User className="w-4 h-4" />
                    My Posts
                  </Link>
                  <Link
                    to="/new-post"
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                  >
                    <PenSquare className="w-4 h-4" />
                    Write
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1 text-gray-600 hover:text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-600 hover:text-indigo-600">
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Blog App - Built with Backendify BaaS
        </div>
      </footer>
    </div>
  );
}
