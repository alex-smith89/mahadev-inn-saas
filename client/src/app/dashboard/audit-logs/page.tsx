// src/app/dashboard/audit-logs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  FiArrowLeft, FiRefreshCw, FiShield, FiUser, FiLogOut,
  FiMenu, FiX, FiHome, FiBookOpen, FiClock, FiDownload,
  FiDollarSign, FiGrid, FiPieChart, FiSearch,
  FiMapPin, FiCalendar, FiEye, FiEyeOff, FiAlertCircle,
  FiAward, FiUserCheck
} from 'react-icons/fi';

// API URL
const API_URL = 'http://localhost:4000/api';

export default function AuditLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Audit Stats
  const [auditStats, setAuditStats] = useState({
    totalActions: 0,
    creates: 0,
    updates: 0,
    deletes: 0,
    logins: 0,
    checkins: 0,
    checkouts: 0,
    users: 0,
  });

  // Normalize branch name
  const normalizeBranchName = (branchName: string) => {
    if (!branchName) return '';
    const lower = branchName.toLowerCase().trim();
    if (lower === 'bhairawa' || lower === 'bhairawaha') return 'Bhairawaha';
    if (lower === 'ktm1' || lower === 'kathmandu1') return 'Kathmandu1';
    if (lower === 'ktm2' || lower === 'kathmandu2') return 'Kathmandu2';
    if (lower === 'pokhara') return 'Pokhara';
    return branchName;
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    // ✅ Only OWNER can access audit logs
    if (!isOwner) {
      setAccessDenied(true);
      return;
    }

    try {
      setAuditLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      let url = `${API_URL}/audit?page=${currentPage}&limit=${itemsPerPage}`;
      
      // Add branch filter if selected
      if (selectedBranch && selectedBranch !== 'all') {
        url += `&branch=${selectedBranch}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      
      if (data.success) {
        const logs = data.data || [];
        setAuditLogs(logs);
        setFilteredLogs(logs);
        setTotalItems(data.total || logs.length);
        setTotalPages(data.totalPages || Math.ceil((data.total || logs.length) / itemsPerPage));
        
        // Calculate stats
        const stats = {
          totalActions: logs.length,
          creates: logs.filter((l: any) => l.action === 'CREATE' || l.action === 'create').length,
          updates: logs.filter((l: any) => l.action === 'UPDATE' || l.action === 'update' || l.action === 'PATCH' || l.action === 'patch' || l.action === 'PUT' || l.action === 'put').length,
          deletes: logs.filter((l: any) => l.action === 'DELETE' || l.action === 'delete').length,
          logins: logs.filter((l: any) => l.action === 'LOGIN' || l.action === 'login').length,
          checkins: logs.filter((l: any) => l.action === 'CHECK_IN' || l.action === 'check_in').length,
          checkouts: logs.filter((l: any) => l.action === 'CHECK_OUT' || l.action === 'check_out').length,
          users: new Set(logs.map((l: any) => l.username)).size,
        };
        setAuditStats(stats);
      } else {
        setError(data.error || 'Failed to load audit logs');
      }
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError(err.message || 'An error occurred while loading audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  // Apply search filter
  const applySearchFilter = () => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredLogs(auditLogs);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = auditLogs.filter((log: any) => {
      return (
        log.username?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower) ||
        log.entity?.toLowerCase().includes(searchLower) ||
        log.branch?.toLowerCase().includes(searchLower) ||
        log.ip?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredLogs(filtered);
  };

  // Update filtered logs when search term or audit logs change
  useEffect(() => {
    applySearchFilter();
  }, [searchTerm, auditLogs]);

  // Load data when page, limit, or branch changes
  useEffect(() => {
    if (user && isOwner) {
      loadAuditLogs();
    }
  }, [currentPage, itemsPerPage, selectedBranch]);

  // Initialize user data
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        
        // ✅ Check if user is OWNER
        const isOwnerRole = userData.role === 'OWNER';
        setIsOwner(isOwnerRole);
        setIsViewer(userData.role === 'VIEWER');
        setIsManager(userData.role === 'MANAGER');
        
        // ✅ If not owner, show access denied
        if (!isOwnerRole) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        
        let userBranches = [];
        if (Array.isArray(userData.branches)) {
          userBranches = userData.branches;
        } else if (typeof userData.branches === 'string') {
          userBranches = userData.branches.split(',').map((b: string) => b.trim());
        } else if (userData.branches && typeof userData.branches === 'object') {
          userBranches = Object.values(userData.branches);
        }
        
        userBranches = userBranches.map((b: string) => normalizeBranchName(b));
        userBranches = [...new Set(userBranches)];
        
        if (userBranches.length === 0) {
          userBranches = ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
        }
        
        setBranches(userBranches);
        
        // Set initial branch selection
        let savedBranch = localStorage.getItem('selectedBranch');
        if (savedBranch && savedBranch !== 'all' && userBranches.includes(savedBranch)) {
          setSelectedBranch(savedBranch);
        } else if (userBranches.length > 0) {
          setSelectedBranch(userBranches[0]);
        } else {
          setSelectedBranch('all');
        }
      } catch (e) {
        console.error('Error parsing user:', e);
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
    }
    
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedBranch');
    router.push('/login');
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    setCurrentPage(1);
    localStorage.setItem('selectedBranch', branch);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1);
  };

  const getStatusColor = (action: string) => {
    const lowerAction = action?.toLowerCase() || '';
    switch (lowerAction) {
      case 'create':
      case 'created':
        return 'bg-green-100 text-green-800';
      case 'update':
      case 'updated':
      case 'patch':
      case 'put':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
      case 'deleted':
        return 'bg-red-100 text-red-800';
      case 'login':
        return 'bg-purple-100 text-purple-800';
      case 'check_in':
      case 'checkin':
        return 'bg-indigo-100 text-indigo-800';
      case 'check_out':
      case 'checkout':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    const lowerAction = action?.toLowerCase() || '';
    switch (lowerAction) {
      case 'create':
      case 'created':
        return '📝';
      case 'update':
      case 'updated':
      case 'patch':
      case 'put':
        return '✏️';
      case 'delete':
      case 'deleted':
        return '🗑️';
      case 'login':
        return '🔑';
      case 'check_in':
      case 'checkin':
        return '✅';
      case 'check_out':
      case 'checkout':
        return '📤';
      default:
        return '📌';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      case 'VIEWER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // ✅ Show access denied for non-owners
  if (accessDenied) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You do not have permission to view audit logs. This page is only accessible to users with <strong>OWNER</strong> role.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/dashboard"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ============================================================ */}
      {/* SIDEBAR */}
      {/* ============================================================ */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-indigo-800 text-white transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:relative lg:flex-shrink-0 overflow-y-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-indigo-700 bg-indigo-900/30">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                <Image
                  src="/mahadev-logo.png"
                  alt="Mahadev Inn"
                  width={48}
                  height={48}
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-wide truncate">Mahadev Inn</h1>
                <p className="text-[8px] sm:text-[10px] text-indigo-300 tracking-wider truncate">AUDIT LOGS</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-indigo-300 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Section */}
          <div className="p-3 sm:p-4 border-b border-indigo-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <FiUser className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate text-sm sm:text-base">{user?.username || 'User'}</p>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getRoleBadgeColor(user?.role)} truncate`}>
                    {user?.role || 'Guest'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation - Full access for owner */}
          <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiHome className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Dashboard</span>
            </Link>
            
            <Link href="/bookings" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiBookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Bookings</span>
            </Link>
            
            <Link href="/dashboard/booking-history" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiClock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Booking History</span>
            </Link>
            
            <Link href="/dashboard/audit-logs" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-indigo-700 text-white transition-colors text-sm sm:text-base">
              <FiShield className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Audit Logs</span>
            </Link>
            
            <Link href="/dashboard/download-history" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiDownload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Download History</span>
            </Link>
            
            {/* Owner-only links */}
            <Link href="/dashboard/room-pricing" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiDollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Room Pricing</span>
            </Link>

            <Link href="/dashboard/room-capacity" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiGrid className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Room Capacity</span>
            </Link>
            
            <Link href="/dashboard/reports" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiPieChart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Reports</span>
            </Link>
          </nav>

          {/* Logout Button */}
          <div className="p-3 sm:p-4 border-t border-indigo-700">
            <button onClick={handleLogout} className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 w-full rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiLogOut className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================ */}
      {/* MAIN CONTENT */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="lg:hidden text-gray-600 hover:text-gray-900 flex-shrink-0"
              >
                <FiMenu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link 
                    href="/dashboard" 
                    className="text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1 text-xs sm:text-sm"
                  >
                    <FiArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    Back to Dashboard
                  </Link>
                  <span className="text-[10px] sm:text-xs bg-purple-100 text-purple-800 px-2 py-0.5 sm:py-1 rounded-full flex items-center gap-1">
                    <FiAward className="w-3 h-3" />
                    Owner Access
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-semibold text-gray-800 truncate flex items-center gap-2">
                  <FiShield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  Audit Logs
                </h2>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
              {/* Branch Dropdown */}
              <div className="relative">
                <select
                  value={selectedBranch || (branches.length > 0 ? branches[0] : '')}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="text-xs sm:text-sm border-2 border-indigo-300 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white min-w-[120px] sm:min-w-[160px] font-medium text-gray-700 hover:border-indigo-400 cursor-pointer shadow-sm"
                >
                  <option value="all" className="font-bold text-indigo-600">🌐 All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      🏨 {branch}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={loadAuditLogs}
                disabled={auditLoading}
                className="bg-indigo-100 text-indigo-700 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-200 transition-colors flex items-center space-x-1 sm:space-x-2 disabled:opacity-50"
              >
                <FiRefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${auditLoading ? 'animate-spin' : ''}`} />
                <span className="text-[10px] sm:text-sm">{auditLoading ? 'Loading...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">

          {/* Owner Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3">
            <FiAward className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-medium text-purple-800">👑 Owner Access</p>
              <p className="text-[10px] sm:text-xs text-purple-600">
                You have <strong>full access</strong> to audit logs. You can view all activities across all branches.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-xs sm:text-sm">
              ⚠️ {error}
              <button onClick={() => setError('')} className="float-right font-bold">×</button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-gray-400">
              <p className="text-[8px] sm:text-xs text-gray-500">Total</p>
              <p className="text-base sm:text-2xl font-bold text-gray-800">{auditStats.totalActions}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-green-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Created</p>
              <p className="text-base sm:text-2xl font-bold text-green-600">{auditStats.creates}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-blue-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Updated</p>
              <p className="text-base sm:text-2xl font-bold text-blue-600">{auditStats.updates}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-red-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Deleted</p>
              <p className="text-base sm:text-2xl font-bold text-red-600">{auditStats.deletes}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-purple-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Logins</p>
              <p className="text-base sm:text-2xl font-bold text-purple-600">{auditStats.logins}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-indigo-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Check-Ins</p>
              <p className="text-base sm:text-2xl font-bold text-indigo-600">{auditStats.checkins}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-orange-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Check-Outs</p>
              <p className="text-base sm:text-2xl font-bold text-orange-600">{auditStats.checkouts}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 border-l-4 border-teal-500">
              <p className="text-[8px] sm:text-xs text-gray-500">Users</p>
              <p className="text-base sm:text-2xl font-bold text-teal-600">{auditStats.users}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search by user, action, entity, branch, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
            {searchTerm && (
              <div className="mt-2 text-xs sm:text-sm text-gray-500">
                Found {filteredLogs.length} result(s) matching "{searchTerm}"
              </div>
            )}
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">USER</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">ACTION</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">ENTITY</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">BRANCH</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">IP ADDRESS</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">TIME</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={6} className="px-2 sm:px-4 py-4 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        <div className="flex justify-center items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 border-b-2 border-indigo-600"></div>
                          Loading audit logs...
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 sm:px-4 py-4 sm:py-8 text-center text-gray-500">
                        <FiShield className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-gray-300 mb-2" />
                        <span className="text-xs sm:text-sm">{searchTerm ? 'No audit logs match your search' : 'No audit logs found'}</span>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-sm text-gray-900 font-medium">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <FiUser className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                            {log.username || 'system'}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs rounded-full whitespace-nowrap ${getStatusColor(log.action)}`}>
                            {getActionIcon(log.action)} {log.action}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                          {log.entity || 'N/A'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <FiMapPin className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                            {log.branch || 'N/A'}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[8px] sm:text-xs text-gray-400 hidden lg:table-cell font-mono">
                          {log.ip || '—'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[8px] sm:text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <FiCalendar className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                            {formatDate(log.createdAt || log.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!auditLoading && filteredLogs.length > 0 && (
              <div className="px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                <div className="text-[10px] sm:text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Items per page */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <label className="text-[10px] sm:text-sm text-gray-500">Show:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="text-[10px] sm:text-sm border border-gray-300 rounded-lg px-1 sm:px-2 py-0.5 sm:py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Page buttons */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    
                    <span className="px-1.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="mt-3 sm:mt-4 text-center text-[8px] sm:text-xs text-gray-400">
            {filteredLogs.length > 0 && (
              <span>
                Showing {filteredLogs.length} of {totalItems} audit log entries
                {selectedBranch && selectedBranch !== 'all' && ` for ${selectedBranch} branch`}
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
            )}
            <span className="ml-2 sm:ml-4 text-purple-600">👑 Owner Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}