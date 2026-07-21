'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const API_URL = 'http://localhost:4000/api';

// ✅ Complete user database with correct branch mappings
const DEMO_USERS = [
  { 
    username: 'owner', 
    password: 'owner123', 
    role: 'OWNER', 
    branches: ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'],
    displayName: 'Hotel Owner'
  },
  { 
    username: 'manager', 
    password: 'manager123', 
    role: 'MANAGER', 
    branches: ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'],
    displayName: 'General Manager'
  },
  { 
    username: 'viewer', 
    password: 'viewer123', 
    role: 'VIEWER', 
    branches: ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'],
    displayName: 'Guest Viewer'
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState('Pokhara');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(DEMO_USERS[1]);
  const [availableBranches, setAvailableBranches] = useState<string[]>(DEMO_USERS[1].branches);

  // ✅ Clear any logout flag on mount
  useEffect(() => {
    localStorage.removeItem('isLoggingOut');
  }, []);

  // ✅ Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr && !isRedirecting) {
      try {
        const userData = JSON.parse(userStr);
        // ✅ Verify branches exist before redirecting
        if (userData.branches && userData.branches.length > 0) {
          console.log('✅ Token found with branches:', userData.branches);
          setIsRedirecting(true);
          router.push('/dashboard');
        } else {
          console.warn('⚠️ No branches found in user data:', userData);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('selectedBranch');
        }
      } catch (e) {
        console.error('❌ Invalid user data, clearing...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedBranch');
      }
    }
  }, [router, isRedirecting]);

  // ✅ Update available branches when username changes
  useEffect(() => {
    const user = DEMO_USERS.find(u => u.username === username);
    if (user) {
      setSelectedUser(user);
      setAvailableBranches(user.branches);
      if (user.branches.length > 0 && !user.branches.includes(branch)) {
        setBranch(user.branches[0]);
      }
      setError('');
    }
  }, [username]);

  // ✅ Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    // ✅ Validate inputs
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

    // ✅ Check if user exists
    const user = DEMO_USERS.find(u => u.username === username);
    if (!user) {
      setError(`User "${username}" does not exist.`);
      setLoading(false);
      return;
    }

    // ✅ Check password
    if (user.password !== password) {
      setError('Invalid password. Please try again.');
      setLoading(false);
      return;
    }

    // ✅ Check branch access
    if (!user.branches.includes(branch)) {
      setError(`User "${username}" does not have access to "${branch}" branch.\n\nAvailable branches: ${user.branches.join(', ')}`);
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
        
        // ✅ Ensure branches are properly stored
        const userData = {
          id: data.user?.id,
          username: data.user?.username || username,
          role: data.user?.role || user.role,
          branches: user.branches, // Use branches from DEMO_USERS
          selectedBranch: branch,
          email: data.user?.email,
          displayName: user.displayName
        };
        
        console.log('📋 Storing user data:', userData);
        console.log('📋 Branches being stored:', userData.branches);
        
        localStorage.setItem('token', data.token || data.access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('selectedBranch', branch);
        localStorage.setItem('userRole', userData.role);
        localStorage.setItem('username', username);
        
        // ✅ Verify storage was successful
        const verifyUser = localStorage.getItem('user');
        if (verifyUser) {
          const parsed = JSON.parse(verifyUser);
          console.log('✅ Verified stored user data:', parsed);
          console.log('✅ Branches in stored data:', parsed.branches);
          
          if (!parsed.branches || parsed.branches.length === 0) {
            console.error('❌ Branches not stored correctly!');
            setError('Failed to store branch data. Please try again.');
            setLoading(false);
            return;
          }
        }
        
        setSuccess(true);
        setLoading(false);
        
        setTimeout(() => {
          setIsRedirecting(true);
          router.push('/dashboard');
        }, 800);
        return;
      } else {
        console.log('⚠️ Backend login failed with status:', response.status);
      }
    } catch (err) {
      console.log('⚠️ Backend not available, using demo mode');
    }

    // ✅ Demo login (fallback if backend is not available)
    console.log('📤 Using demo login for user:', username);
    
    const token = btoa(JSON.stringify({
      username: user.username,
      role: user.role,
      timestamp: Date.now()
    }));

    // ✅ Store user data with proper structure including branches
    const userData = {
      id: Date.now(),
      username: user.username,
      role: user.role,
      branches: user.branches, // ✅ This is critical - branches must be stored
      selectedBranch: branch,
      displayName: user.displayName,
      email: `${user.username}@mahadevin.com`
    };

    console.log('📋 Storing user data (demo):', userData);
    console.log('📋 Branches being stored:', userData.branches);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('selectedBranch', branch);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('username', user.username);
    
    // ✅ Verify storage was successful
    const verifyUser = localStorage.getItem('user');
    if (verifyUser) {
      const parsed = JSON.parse(verifyUser);
      console.log('✅ Verified stored user data:', parsed);
      console.log('✅ Branches in stored data:', parsed.branches);
      
      if (!parsed.branches || parsed.branches.length === 0) {
        console.error('❌ Branches not stored correctly!');
        setError('Failed to store branch data. Please try again.');
        setLoading(false);
        return;
      }
    }
    
    setSuccess(true);
    setLoading(false);
    
    setTimeout(() => {
      setIsRedirecting(true);
      router.push('/dashboard');
    }, 800);
  };

  // ✅ Quick login function
  const quickLogin = (user: string, pass: string, branchName: string) => {
    console.log('🔄 Quick login for user:', user);
    setUsername(user);
    setPassword(pass);
    setBranch(branchName);
    setError('');
    setSuccess(false);
    setLoading(false);
    setIsRedirecting(false);
    
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
    }, 300);
  };

  // ✅ Show redirecting state
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-100 to-purple-200 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('owner', 'owner123', 'Pokhara')}
              className="text-xs py-2 px-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
            >
              👑 Owner
            </button>
            <button
              type="button"
              onClick={() => quickLogin('manager', 'manager123', 'Pokhara')}
              className="text-xs py-2 px-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
            >
              📋 Manager
            </button>
            <button
              type="button"
              onClick={() => quickLogin('viewer', 'viewer123', 'Pokhara')}
              className="text-xs py-2 px-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
            >
              👁️ Viewer
            </button>
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
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition pr-12"
                required
                placeholder="Enter your password"
                disabled={loading || success}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {selectedUser && (
              <p className="text-xs text-gray-400 mt-1">
                Hint: Password for {selectedUser.username} is "{selectedUser.password}"
              </p>
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
                Available branches: {availableBranches.join(', ')}
              </p>
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
              'Sign In'
            )}
          </button>
        </form>

        {/* User Access Guide */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800 font-medium mb-1">📋 User Access:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <div className="flex justify-between items-center border-b border-blue-100 pb-1">
              <span className="font-medium">👑 owner</span>
              <span>All branches (owner123)</span>
            </div>
            <div className="flex justify-between items-center border-b border-blue-100 pb-1">
              <span className="font-medium">📋 manager</span>
              <span>All branches (manager123)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">👁️ viewer</span>
              <span>All branches (viewer123)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-gray-400">
          <p>Mahadev Inn Hotel Management System</p>
          <p className="mt-1">© {new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </div>
  );
}