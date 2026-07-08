'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FiArrowLeft, FiSave, FiRefreshCw, FiAlertCircle,
  FiCheckCircle, FiHome, FiEdit2, FiPlus, FiX,
  FiTrendingUp, FiTrendingDown, FiGrid, FiChevronDown
} from 'react-icons/fi';

const API_URL = 'http://localhost:4000';

interface BranchCapacity {
  id: string;
  branch: string;
  singleCap: number;
  doubleCap: number;
  tripleCap: number;
  quardCap: number;
  createdAt: string;
  updatedAt: string;
}

interface RoomTypeCapacity {
  id: number;
  branch: string;
  roomType: string;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
}

export default function RoomCapacityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchCapacity, setBranchCapacity] = useState<BranchCapacity | null>(null);
  const [roomTypeCapacities, setRoomTypeCapacities] = useState<RoomTypeCapacity[]>([]);
  const [editingCapacity, setEditingCapacity] = useState<{[key: string]: number}>({});
  const [editingRoomCapacity, setEditingRoomCapacity] = useState<{[key: string]: number}>({});
  const [summary, setSummary] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'branch' | 'summary'>('branch');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        console.log('✅ User loaded:', userData);
        
        // Get branches from user data
        const userBranches = userData.branches || [];
        setBranches(userBranches);
        
        // Set selected branch - use stored selection or first branch
        const savedBranch = localStorage.getItem('selectedBranch');
        if (savedBranch && userBranches.includes(savedBranch)) {
          setSelectedBranch(savedBranch);
        } else if (userBranches.length > 0) {
          setSelectedBranch(userBranches[0]);
        }
        
        if (userData.role !== 'OWNER') {
          router.push('/dashboard');
          return;
        }
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    setLoading(false);
  }, [router]);

  // Load data when branch changes
  useEffect(() => {
    if (selectedBranch) {
      loadData();
    }
  }, [selectedBranch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      console.log('📊 Loading data for branch:', selectedBranch);

      // Load branch capacity
      const branchRes = await fetch(`${API_URL}/room-capacity/branch/${selectedBranch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranchCapacity(data);
        setEditingCapacity({
          singleCap: data.singleCap || 0,
          doubleCap: data.doubleCap || 0,
          tripleCap: data.tripleCap || 0,
          quardCap: data.quardCap || 0,
        });
        console.log('✅ Branch capacity loaded:', data);
      } else {
        console.error('❌ Failed to load branch capacity');
      }

      // Load room type capacities
      const roomRes = await fetch(`${API_URL}/room-capacity/room-types/${selectedBranch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (roomRes.ok) {
        const data = await roomRes.json();
        setRoomTypeCapacities(data);
        const editing: {[key: string]: number} = {};
        data.forEach((r: RoomTypeCapacity) => {
          editing[r.roomType] = r.totalRooms;
        });
        setEditingRoomCapacity(editing);
        console.log('✅ Room type capacities loaded:', data);
      } else {
        console.error('❌ Failed to load room type capacities');
      }

      // Load summary
      const summaryRes = await fetch(`${API_URL}/room-capacity/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
        console.log('✅ Summary loaded:', data);
      }

    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Failed to load capacity data');
    } finally {
      setLoading(false);
    }
  };

  const handleCapacityChange = (field: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingCapacity(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleRoomCapacityChange = (roomType: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingRoomCapacity(prev => ({ ...prev, [roomType]: numValue }));
    }
  };

  const saveBranchCapacity = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/room-capacity/branch/${selectedBranch}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingCapacity),
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update capacity');
      }

      setSuccess('✅ Branch capacity updated successfully!');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update capacity');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const saveRoomCapacity = async (roomType: string) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      const totalRooms = editingRoomCapacity[roomType];

      const response = await fetch(`${API_URL}/room-capacity/room-type/${selectedBranch}/${roomType}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totalRooms }),
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update room capacity');
      }

      setSuccess(`✅ ${roomType} capacity updated successfully!`);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update room capacity');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getTotalRooms = () => {
    if (!branchCapacity) return 0;
    return branchCapacity.singleCap + branchCapacity.doubleCap + 
           branchCapacity.tripleCap + branchCapacity.quardCap;
  };

  const getOccupiedRooms = () => {
    return roomTypeCapacities.reduce((sum, r) => sum + r.occupiedRooms, 0);
  };

  const getAvailableRooms = () => {
    return getTotalRooms() - getOccupiedRooms();
  };

  const getOccupancyRate = () => {
    const total = getTotalRooms();
    if (total === 0) return 0;
    return Math.round((getOccupiedRooms() / total) * 100);
  };

  const handleBranchSelect = (branch: string) => {
    console.log('🔄 Selecting branch:', branch);
    setSelectedBranch(branch);
    setIsBranchDropdownOpen(false);
    // Save selected branch to localStorage
    localStorage.setItem('selectedBranch', branch);
  };

  if (loading && !branchCapacity) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              <FiArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Room Capacity Management</h1>
              <p className="text-sm text-gray-500">Manage room capacity for each branch and room type</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Branch Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                className="border border-gray-300 rounded-lg px-4 py-2 bg-white hover:bg-gray-50 transition-colors flex items-center space-x-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-w-[150px] justify-between"
              >
                <span className="font-medium">{selectedBranch || 'Select Branch'}</span>
                <FiChevronDown className={`w-4 h-4 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isBranchDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-60 overflow-y-auto">
                  {branches.length === 0 ? (
                    <div className="px-4 py-2 text-gray-500 text-sm">No branches available</div>
                  ) : (
                    branches.map((branch) => (
                      <button
                        key={branch}
                        onClick={() => handleBranchSelect(branch)}
                        className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors ${
                          selectedBranch === branch ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {branch}
                        {selectedBranch === branch && (
                          <span className="float-right text-indigo-600">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setViewMode('branch')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'branch' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Branch View
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'summary' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Summary View
            </button>
            
            <button
              onClick={loadData}
              disabled={loading}
              className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <FiCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Summary View */}
        {viewMode === 'summary' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">All Branches Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {summary.map((s) => (
                <div key={s.branch} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-indigo-500">
                  <h3 className="font-semibold text-gray-800">{s.branch}</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="flex justify-between">
                      <span className="text-gray-500">Total Rooms:</span>
                      <span className="font-medium">{s.totalRooms}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">Occupied:</span>
                      <span className="font-medium text-orange-600">{s.occupiedRooms}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">Available:</span>
                      <span className="font-medium text-green-600">{s.availableRooms}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">Occupancy:</span>
                      <span className={`font-medium ${s.occupancyRate > 80 ? 'text-green-600' : s.occupancyRate > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {s.occupancyRate}%
                      </span>
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${s.occupancyRate > 80 ? 'bg-green-500' : s.occupancyRate > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(s.occupancyRate, 100)}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleBranchSelect(s.branch);
                      setViewMode('branch');
                    }}
                    className="mt-3 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    View Details →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Branch Capacity */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FiHome className="mr-2" />
                {selectedBranch || 'Select Branch'} - Branch Capacity
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Single Rooms</label>
                  <input
                    type="number"
                    value={editingCapacity.singleCap || 0}
                    onChange={(e) => handleCapacityChange('singleCap', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Double Rooms</label>
                  <input
                    type="number"
                    value={editingCapacity.doubleCap || 0}
                    onChange={(e) => handleCapacityChange('doubleCap', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Triple Rooms</label>
                  <input
                    type="number"
                    value={editingCapacity.tripleCap || 0}
                    onChange={(e) => handleCapacityChange('tripleCap', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quad Rooms</label>
                  <input
                    type="number"
                    value={editingCapacity.quardCap || 0}
                    onChange={(e) => handleCapacityChange('quardCap', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveBranchCapacity}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <FiSave className="w-4 h-4" />
                  <span>Save Branch Capacity</span>
                </button>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-500">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-800">{getTotalRooms()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                <p className="text-sm text-gray-500">Occupied Rooms</p>
                <p className="text-2xl font-bold text-orange-600">{getOccupiedRooms()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-500">Available Rooms</p>
                <p className="text-2xl font-bold text-green-600">{getAvailableRooms()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-500">Occupancy Rate</p>
                <p className={`text-2xl font-bold ${getOccupancyRate() > 80 ? 'text-green-600' : getOccupancyRate() > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {getOccupancyRate()}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full ${getOccupancyRate() > 80 ? 'bg-green-500' : getOccupancyRate() > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(getOccupancyRate(), 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Room Type Capacity */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Room Type Capacity</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rooms</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupied</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roomTypeCapacities.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No room types configured
                        </td>
                      </tr>
                    ) : (
                      roomTypeCapacities.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.roomType}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editingRoomCapacity[r.roomType] || r.totalRooms}
                              onChange={(e) => handleRoomCapacityChange(r.roomType, e.target.value)}
                              className="w-24 border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-3 text-orange-600">{r.occupiedRooms}</td>
                          <td className="px-4 py-3 text-green-600">{r.availableRooms}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => saveRoomCapacity(r.roomType)}
                              disabled={saving}
                              className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center space-x-1 text-sm"
                            >
                              <FiSave className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}