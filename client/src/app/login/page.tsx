'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const API_URL = 'http://localhost:4000/api';

// ✅ Complete user database - MATCHES YOUR SEED DATA
const DEMO_USERS = [
  { 
    username: 'owner', 
    password: 'owner123', 
    role: 'OWNER', 
    branches: ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'],
    displayName: 'Hotel Owner',
    branchPasswords: {
      'Pokhara': 'owner123',
      'Kathmandu1': 'owner123',
      'Kathmandu2': 'owner123',
      'Bhairawaha': 'owner123'
    }
  },
  { 
    username: 'manager1', 
    password: 'manager123',
    role: 'MANAGER', 
    branches: ['Pokhara'],
    displayName: 'Manager - Pokhara',
    branchPasswords: {
      'Pokhara': 'manager123',
    }
  },
  { 
    username: 'manager2', 
    password: 'manager123',
    role: 'MANAGER', 
    branches: ['Kathmandu1'],
    displayName: 'Manager - Kathmandu 1',
    branchPasswords: {
      'Kathmandu1': 'manager123',
    }
  },
  { 
    username: 'manager3', 
    password: 'manager123',
    role: 'MANAGER', 
    branches: ['Kathmandu2'],
    displayName: 'Manager - Kathmandu 2',
    branchPasswords: {
      'Kathmandu2': 'manager123',
    }
  },
  { 
    username: 'manager4', 
    password: 'manager123',
    role: 'MANAGER', 
    branches: ['Bhairawaha'],
    displayName: 'Manager - Bhairawaha',
    branchPasswords: {
      'Bhairawaha': 'manager123',
    }
  },
  { 
    username: 'viewer', 
    password: 'viewer123', 
    role: 'VIEWER', 
    branches: ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'],
    displayName: 'Guest Viewer',
    branchPasswords: {
      'Pokhara': 'viewer123',
      'Kathmandu1': 'viewer123',
      'Kathmandu2': 'viewer123',
      'Bhairawaha': 'viewer123'
    }
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('manager1');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState('Pokhara');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(DEMO_USERS[1]);
  const [availableBranches, setAvailableBranches] = useState<string[]>(DEMO_USERS[1].branches);
  const [branchPasswordHint, setBranchPasswordHint] = useState<string>('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ✅ Clear any logout flag on mount
  useEffect(() => {
    localStorage.removeItem('isLoggingOut');
  }, []);

  // ✅ Check if already logged in
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        console.log('🔍 Login page - Checking auth');
        console.log('Token exists:', !!token);
        console.log('User exists:', !!userStr);
        
        if (token && userStr) {
          const userData = JSON.parse(userStr);
          console.log('User data from storage:', userData);
          
          if (userData.branches && userData.branches.length > 0) {
            console.log('✅ User has branches, redirecting to dashboard');
            window.location.href = '/dashboard';
            return;
          } else {
            console.warn('⚠️ No branches found, clearing storage');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('selectedBranch');
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedBranch');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // ✅ Update available branches and password hint
  useEffect(() => {
    const user = DEMO_USERS.find(u => u.username === username);
    if (user) {
      setSelectedUser(user);
      setAvailableBranches(user.branches);
      if (user.branches.length > 0 && !user.branches.includes(branch)) {
        setBranch(user.branches[0]);
      }
      if (user.branchPasswords && user.branchPasswords[branch]) {
        setBranchPasswordHint(user.branchPasswords[branch]);
      } else {
        setBranchPasswordHint(user.password || '');
      }
      setError('');
      
      // Clear password when switching users for security
      if (user.role === 'MANAGER') {
        setPassword('');
      }
    }
  }, [username, branch]);

  // ✅ Handle login - Try backend first, fallback to demo
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    // Validations
    if (!username || !password) {
      setError('Please enter username and password');
      setLoading(false);
      return;
    }

    if (!branch) {
      setError('Please select a branch');
      setLoading(false);
      return;
    }

    const user = DEMO_USERS.find(u => u.username === username);
    if (!user) {
      setError(`User "${username}" does not exist.`);
      setLoading(false);
      return;
    }

    if (!user.branches.includes(branch)) {
      setError(`User "${username}" does not have access to "${branch}" branch.\n\nAvailable branches: ${user.branches.join(', ')}`);
      setLoading(false);
      return;
    }

    // Get correct password for this branch
    let correctPassword = user.password;
    if (user.branchPasswords && user.branchPasswords[branch]) {
      correctPassword = user.branchPasswords[branch];
    }

    if (correctPassword !== password) {
      setError(`Invalid password for "${branch}" branch.\n\n${user.role === 'MANAGER' ? 'Each manager has a specific branch. Please check your credentials.' : 'Please try again.'}`);
      setLoading(false);
      return;
    }

    // ✅ Clear any existing data before login
    localStorage.clear();

    // ✅ Try backend login first
    try {
      console.log('📤 Attempting login with backend for user:', username);
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          branch,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Login successful from backend');
        
        const userData = {
          id: data.user?.id,
          username: data.user?.username || username,
          role: data.user?.role || user.role,
          branches: user.branches,
          selectedBranch: branch,
          email: data.user?.email,
          displayName: user.displayName,
          branchSpecificPassword: user.role === 'MANAGER' ? true : false,
          loginTimestamp: Date.now()
        };
        
        console.log('📋 Storing user data:', userData);
        
        localStorage.setItem('token', data.token || data.access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('selectedBranch', branch);
        localStorage.setItem('userRole', userData.role);
        localStorage.setItem('username', username);
        
        setSuccess(true);
        setLoading(false);
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
        return;
      } else {
        console.log('⚠️ Backend login failed with status:', response.status);
        // Continue to demo login
      }
    } catch (err) {
      console.log('⚠️ Backend not available, using demo mode');
      // Continue to demo login
    }

    // ✅ Demo login (fallback)
    console.log('📤 Using demo login for user:', username);
    console.log('📍 Branch:', branch);
    console.log('🔑 Role:', user.role);
    
    const token = btoa(JSON.stringify({
      username: user.username,
      role: user.role,
      branch: branch,
      timestamp: Date.now()
    }));

    const userData = {
      id: Date.now(),
      username: user.username,
      role: user.role,
      branches: user.branches,
      selectedBranch: branch,
      displayName: user.displayName,
      email: `${user.username}@mahadevin.com`,
      branchSpecificPassword: user.role === 'MANAGER' ? true : false,
      loginTimestamp: Date.now()
    };

    console.log('📋 Storing user data (demo):', userData);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('selectedBranch', branch);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('username', user.username);
    
    setSuccess(true);
    setLoading(false);
    
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500);
  };

  // ✅ Quick login function
  const quickLogin = (user: string, branchName: string) => {
    console.log('🔄 Quick login for user:', user, 'branch:', branchName);
    
    const userData = DEMO_USERS.find(u => u.username === user);
    let pass = '';
    if (userData) {
      if (userData.branchPasswords && userData.branchPasswords[branchName]) {
        pass = userData.branchPasswords[branchName];
      } else {
        pass = userData.password;
      }
    }
    
    setUsername(user);
    setPassword(pass);
    setBranch(branchName);
    setError('');
    setSuccess(false);
    setLoading(false);
    
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
    }, 300);
  };

  // ✅ Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-100 to-purple-200 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-100 to-purple-200 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-28 h-28 relative">
                <Image
                  src="/mahadev-logo.png"
                  alt="Mahadev Inn Pokhara"
                  width={112}
                  height={112}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-300 to-purple-300 rounded-2xl -z-10 blur-sm opacity-50"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your hotel</p>
        </div>

        {/* Quick Login Buttons */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 text-center mb-2">Quick Login</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('owner', 'Pokhara')}
              className="text-xs py-2 px-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
            >
              👑 Owner - Pokhara
            </button>
            <button
              type="button"
              onClick={() => quickLogin('viewer', 'Pokhara')}
              className="text-xs py-2 px-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
            >
              👁️ Viewer - Pokhara
            </button>
          </div>
          
          {/* Manager Quick Login Buttons */}
          <div className="mt-2">
            <p className="text-xs text-gray-500 text-center mb-1"></p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => quickLogin('manager1', 'Pokhara')}
                className="text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                🏔️ Pokhara
              </button>
              <button
                type="button"
                onClick={() => quickLogin('manager2', 'Kathmandu1')}
                className="text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                🏙️ KTM-1
              </button>
              <button
                type="button"
                onClick={() => quickLogin('manager3', 'Kathmandu2')}
                className="text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                🏙️ KTM-2
              </button>
              <button
                type="button"
                onClick={() => quickLogin('manager4', 'Bhairawaha')}
                className="text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                🕌 Bhairawaha
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <span className="whitespace-pre-line">{error}</span>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span>Login successful! Redirecting to dashboard...</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <select
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setPassword('');
                setError('');
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              disabled={loading || success}
            >
              {DEMO_USERS.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.role === 'OWNER' ? '👑' : user.role === 'MANAGER' ? '📋' : '👁️'} 
                  {user.username} - {user.displayName}
                </option>
              ))}
            </select>
            {selectedUser && (
              <div className="mt-1 text-xs text-gray-500">
                <span className="font-medium">Role:</span> {selectedUser.role} • 
                <span className="font-medium ml-2">Branches:</span> {selectedUser.branches.join(', ')}
                {selectedUser.role === 'MANAGER' && (
                  <span className="ml-2 text-indigo-600 font-medium"></span>
                )}
              </div>
            )}
          </div>

          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              required
              disabled={availableBranches.length === 0 || loading || success}
            >
              {availableBranches.map((b: string) => (
                <option key={b} value={b}>🏨 {b}</option>
              ))}
            </select>
            {availableBranches.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
               
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password for {branch}
              {selectedUser?.role === 'MANAGER' && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">
                  
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition pr-12"
                required
                placeholder={`Enter password for ${branch}`}
                disabled={loading || success}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '👁️‍🗨️' : ''}
              </button>
            </div>
            {selectedUser && branchPasswordHint && (
              <div className="mt-1 flex items-center justify-between">
                
                {selectedUser.role === 'MANAGER' && (
                  <span className="text-xs text-indigo-500 font-medium"></span>
                )}
              </div>
            )}
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading || success || !branch || !selectedUser}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging in...
              </span>
            ) : success ? (
              'Redirecting...'
            ) : (
              `Sign In to ${branch}`
            )}
          </button>
        </form>

       
        {/* Footer */}
        <div className="mt-4 text-center text-xs text-gray-400">
          <p>Mahadev Inn Hotel Management System</p>
          <p className="mt-1">© {new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </div>
  );
}