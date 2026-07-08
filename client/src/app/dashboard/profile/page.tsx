'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { 
  FiUser, FiMapPin, FiEdit2, FiSave, FiX, FiLock, 
  FiUserCheck, FiAlertCircle, FiCheckCircle
} from 'react-icons/fi';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    branch: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
      setFormData({
        username: userData.username || '',
        branch: userData.branch || 'Pokhara',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    setLoading(false);
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please login again');
        router.push('/login');
        return;
      }

      // Validate passwords
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        setSaving(false);
        return;
      }

      if (formData.newPassword && formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        setSaving(false);
        return;
      }

      // Build update data
      const updateData: any = {};

      if (formData.username && formData.username !== user?.username) {
        updateData.username = formData.username;
      }

      if (formData.branch && formData.branch !== user?.branch) {
        updateData.branch = formData.branch;
      }

      if (formData.newPassword) {
        updateData.password = formData.newPassword;
      }

      // If nothing to update
      if (Object.keys(updateData).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      console.log('📤 Sending update:', updateData);

      const response = await axios.put(
        'http://localhost:4000/users/me',
        updateData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
        }
      );

      console.log('✅ Update response:', response.data);

      // Update local storage
      const updatedUser = {
        ...user,
        ...response.data,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setFormData({
        ...formData,
        username: updatedUser.username || '',
        branch: updatedUser.branch || 'Pokhara',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setSuccess('✅ Profile updated successfully!');
      setIsEditing(false);

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('❌ Error updating profile:', err);
      
      if (err.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Make sure backend is running on port 4000');
      } else if (err.response) {
        setError(err.response.data?.message || `Server error: ${err.response.status}`);
      } else {
        setError(err.message || 'Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    if (user) {
      setFormData({
        username: user.username || '',
        branch: user.branch || 'Pokhara',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      'OWNER': 'bg-purple-100 text-purple-800 border-purple-300',
      'MANAGER': 'bg-blue-100 text-blue-800 border-blue-300',
      'VIEWER': 'bg-green-100 text-green-800 border-green-300',
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return '👑';
      case 'MANAGER': return '📋';
      case 'VIEWER': return '👁️';
      default: return '👤';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 font-medium">
              <span>←</span>
              <span>Back to Dashboard</span>
            </Link>
            <h2 className="text-xl font-semibold text-gray-800">My Profile</h2>
          </div>
          <div className="flex items-center space-x-4">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2">
                <FiEdit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button onClick={handleCancel} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors flex items-center space-x-2">
                <FiX className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            )}
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start">
            <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-700 font-bold">×</button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-start">
            <FiCheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto text-green-700 font-bold">×</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl">
                {getRoleIcon(user?.role)}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{user?.username || 'User'}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRoleColor(user?.role)}`}>
                    {user?.role || 'Guest'}
                  </span>
                  <span className="text-sm text-white/80">
                    {user?.branches?.join(', ') || 'No branches'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <FiUser className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Username</p>
                    <p className="text-sm font-medium">{user?.username}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <FiMapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Branch</p>
                    <p className="text-sm font-medium">{user?.branch || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg col-span-full">
                  <FiUserCheck className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Available Branches</p>
                    <p className="text-sm font-medium">{user?.branches?.join(', ') || 'None'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input type="text" name="username" value={formData.username} onChange={handleChange} className="mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <input type="text" value={user?.role || ''} disabled className="mt-1 block w-full border rounded-lg px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">Role cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primary Branch</label>
                    <select name="branch" value={formData.branch} onChange={handleChange} className="mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                      {user?.branches?.map((branch: string) => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                      {!user?.branches?.length && (
                        <>
                          <option value="Pokhara">Pokhara</option>
                          <option value="Kathmandu1">Kathmandu1</option>
                          <option value="Kathmandu2">Kathmandu2</option>
                          <option value="Bhairawaha">Bhairawaha</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Available Branches</label>
                    <input type="text" value={user?.branches?.join(', ') || 'None'} disabled className="mt-1 block w-full border rounded-lg px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>

                <div className="border-t pt-6 mt-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
                    <FiLock className="w-5 h-5 mr-2 text-indigo-600" />
                    Change Password
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Password</label>
                      <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleChange} className="mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Enter current password" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Password</label>
                      <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} className="mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Enter new password (min 6 chars)" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                      <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Confirm new password" />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-gray-400">Leave blank to keep current password</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={handleCancel} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className={`px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <FiSave className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}