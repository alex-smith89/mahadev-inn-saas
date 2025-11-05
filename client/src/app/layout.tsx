'use client';
import '../../styles/globals.css';
import { AuthProvider, useAuth } from '../../lib/auth';
import api from '../../lib/api';

function Header() {
  const { user, setUser } = useAuth();

  function logout() {
  // Call backend logout to trigger audit log
  api.post('/auth/logout')
    .catch(err => {
      console.warn('Logout audit failed:', err);
      // Still proceed to clear session — don't block UX
    })
    .finally(() => {
      // Clear frontend session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.href = '/login';
    });
}

  return (
    <header className="flex justify-between items-center p-4 bg-indigo-700 text-white">
      <h1 className="font-bold">Mahadev Inn SaaS</h1>
      {user && (
        <button
          onClick={logout}
          className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
        >
          Logout
        </button>
      )}
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
