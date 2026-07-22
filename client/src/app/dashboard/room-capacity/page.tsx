'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FiArrowLeft, FiSave, FiRefreshCw, FiAlertCircle,
  FiCheckCircle, FiHome, FiEdit2, FiPlus, FiX,
  FiTrendingUp, FiTrendingDown, FiGrid, FiChevronDown,
  FiUserPlus
} from 'react-icons/fi';

// ✅ FIX: Use the correct API URL with /api prefix
const API_URL = 'http://localhost:4000/api';

interface BranchCapacity {
  id: string;
  branch: string;
  singleCap: number;
  doubleCap: number;
  tripleCap: number;
  quardCap: number;
  suiteCap: number;
  singleExtraBedCharge: number;
  doubleExtraBedCharge: number;
  tripleExtraBedCharge: number;
  guardExtraBedCharge: number;  // ✅ Corrected: 'guard' not 'quard'
  suiteExtraBedCharge: number;
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

interface Room {
  id: string;
  roomNumber: string;
  branch: string;
  roomType: string;
  capacity: number;
  status: string;
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
  const [editingExtraBedCharges, setEditingExtraBedCharges] = useState<{[key: string]: number}>({});
  const [editingRoomCapacity, setEditingRoomCapacity] = useState<{[key: string]: number}>({});
  const [originalCapacity, setOriginalCapacity] = useState<{[key: string]: number}>({});
  const [originalExtraBedCharges, setOriginalExtraBedCharges] = useState<{[key: string]: number}>({});
  const [summary, setSummary] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'branch' | 'summary'>('branch');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extra bed charge presets for quick fill
  const EXTRA_BED_PRESETS = [
    { label: 'None', values: { single: 0, double: 0, triple: 0, guard: 0, suite: 0 } },
    { label: 'Low', values: { single: 500, double: 500, triple: 500, guard: 500, suite: 500 } },
    { label: 'Medium', values: { single: 1000, double: 1500, triple: 1500, guard: 2000, suite: 2500 } },
    { label: 'High', values: { single: 1500, double: 2000, triple: 2500, guard: 3000, suite: 3500 } },
    { label: 'Premium', values: { single: 2000, double: 2500, triple: 3000, guard: 3500, suite: 4000 } },
  ];

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
        
        const userBranches = userData.branches || [];
        setBranches(userBranches);
        
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

  useEffect(() => {
    if (selectedBranch) {
      loadData();
    }
  }, [selectedBranch]);

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
        console.log('📊 Branch capacity data from API:', data);
        setBranchCapacity(data);
        
        const caps = {
          singleCap: data.singleCap || 0,
          doubleCap: data.doubleCap || 0,
          tripleCap: data.tripleCap || 0,
          quardCap: data.quardCap || 0,
          suiteCap: data.suiteCap || 0,
        };
        setEditingCapacity(caps);
        setOriginalCapacity(caps);
        
        // ✅ Load extra bed charges - using 'guardExtraBedCharge' (correct column name)
        const extraCharges = {
          singleExtraBedCharge: data.singleExtraBedCharge || 0,
          doubleExtraBedCharge: data.doubleExtraBedCharge || 0,
          tripleExtraBedCharge: data.tripleExtraBedCharge || 0,
          guardExtraBedCharge: data.guardExtraBedCharge || 0,  // ✅ Correct field name
          suiteExtraBedCharge: data.suiteExtraBedCharge || 0,
        };
        console.log('📊 Extra bed charges loaded:', extraCharges);
        setEditingExtraBedCharges(extraCharges);
        setOriginalExtraBedCharges(extraCharges);
      } else {
        console.error('❌ Failed to load branch capacity');
        // Set default values
        const defaultCaps = {
          singleCap: 0,
          doubleCap: 0,
          tripleCap: 0,
          quardCap: 0,
          suiteCap: 0,
        };
        setEditingCapacity(defaultCaps);
        setOriginalCapacity(defaultCaps);
        const defaultExtra = {
          singleExtraBedCharge: 0,
          doubleExtraBedCharge: 0,
          tripleExtraBedCharge: 0,
          guardExtraBedCharge: 0,  // ✅ Correct field name
          suiteExtraBedCharge: 0,
        };
        setEditingExtraBedCharges(defaultExtra);
        setOriginalExtraBedCharges(defaultExtra);
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

      // Load rooms for this branch
      const roomsRes = await fetch(`${API_URL}/rooms/branch/${selectedBranch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data);
        console.log('✅ Rooms loaded:', data.length);
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

  const handleExtraBedChargeChange = (field: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingExtraBedCharges(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleRoomCapacityChange = (roomType: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingRoomCapacity(prev => ({ ...prev, [roomType]: numValue }));
    }
  };

  const applyExtraBedPreset = (preset: typeof EXTRA_BED_PRESETS[0]) => {
    setEditingExtraBedCharges({
      singleExtraBedCharge: preset.values.single,
      doubleExtraBedCharge: preset.values.double,
      tripleExtraBedCharge: preset.values.triple,
      guardExtraBedCharge: preset.values.guard,  // ✅ Correct field name
      suiteExtraBedCharge: preset.values.suite,
    });
  };

  const getRoomTypePrefix = (roomType: string) => {
    const prefixes: {[key: string]: string} = {
      'Single': 'SGL',
      'Double': 'DBL',
      'Triple': 'TPL',
      'Quard': 'QRD',
      'Suite': 'STE'
    };
    return prefixes[roomType] || roomType.substring(0, 3).toUpperCase();
  };

  const getRoomCapacity = (roomType: string) => {
    const capacities: {[key: string]: number} = {
      'Single': 1,
      'Double': 2,
      'Triple': 3,
      'Quard': 4,
      'Suite': 4
    };
    return capacities[roomType] || 1;
  };

  const createRoomsForType = async (roomType: string, currentCount: number, newCount: number) => {
    if (newCount <= currentCount) return [];

    const token = localStorage.getItem('token');
    const branchPrefix = selectedBranch.substring(0, 3).toUpperCase();
    const typePrefix = getRoomTypePrefix(roomType);
    const capacity = getRoomCapacity(roomType);
    const createdRooms = [];

    const existingRooms = rooms.filter(r => r.roomType === roomType);
    const existingNumbers = existingRooms.map(r => {
      const parts = r.roomNumber.split('-');
      return parseInt(parts[2] || '0');
    });

    let nextNumber = 1;
    if (existingNumbers.length > 0) {
      nextNumber = Math.max(...existingNumbers) + 1;
    }

    for (let i = 0; i < newCount - currentCount; i++) {
      const roomNumber = `${branchPrefix}-${typePrefix}-${String(nextNumber++).padStart(3, '0')}`;
      
      try {
        const response = await fetch(`${API_URL}/rooms`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomNumber,
            branch: selectedBranch,
            roomType,
            capacity,
            status: 'available',
          }),
        });

        if (response.ok) {
          const newRoom = await response.json();
          createdRooms.push(newRoom);
          console.log(`✅ Created room: ${roomNumber}`);
        } else {
          console.error(`❌ Failed to create room: ${roomNumber}`);
        }
      } catch (error) {
        console.error(`❌ Error creating room ${roomNumber}:`, error);
      }
    }

    return createdRooms;
  };

  const saveBranchCapacity = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      
      const payload = {
        ...editingCapacity,
        singleExtraBedCharge: editingExtraBedCharges.singleExtraBedCharge || 0,
        doubleExtraBedCharge: editingExtraBedCharges.doubleExtraBedCharge || 0,
        tripleExtraBedCharge: editingExtraBedCharges.tripleExtraBedCharge || 0,
        guardExtraBedCharge: editingExtraBedCharges.guardExtraBedCharge || 0,  // ✅ Correct field name
        suiteExtraBedCharge: editingExtraBedCharges.suiteExtraBedCharge || 0,
      };
      
      const url = `${API_URL}/room-capacity/branch/${selectedBranch}`;
      console.log('📤 Sending PUT request to:', url);
      console.log('📤 With body:', payload);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📊 Response status:', response.status);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        console.error('❌ Error response:', data);
        throw new Error(data.message || data.error || 'Failed to update capacity');
      }

      const data = await response.json();
      console.log('✅ Success:', data);

      // Check which room types have increased capacity and create rooms
      const roomTypes = ['Single', 'Double', 'Triple', 'Quard', 'Suite'];
      let createdCount = 0;
      
      for (const roomType of roomTypes) {
        const capKey = `${roomType.toLowerCase()}Cap`;
        const oldCount = originalCapacity[capKey] || 0;
        const newCount = editingCapacity[capKey] || 0;
        
        if (newCount > oldCount) {
          console.log(`📈 ${roomType}: ${oldCount} → ${newCount} (Creating ${newCount - oldCount} rooms)`);
          const newRooms = await createRoomsForType(roomType, oldCount, newCount);
          createdCount += newRooms.length;
          
          setOriginalCapacity(prev => ({ ...prev, [capKey]: newCount }));
        }
      }

      // Update original extra bed charges
      setOriginalExtraBedCharges(editingExtraBedCharges);

      let successMessage = '✅ Branch capacity and extra bed charges updated successfully!';
      if (createdCount > 0) {
        successMessage += ` Created ${createdCount} new room(s).`;
      }
      
      setSuccess(successMessage);
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('❌ Error saving capacity:', err);
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

      const currentRooms = rooms.filter(r => r.roomType === roomType);
      const currentCount = currentRooms.length;

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

      if (totalRooms > currentCount) {
        const newRooms = await createRoomsForType(roomType, currentCount, totalRooms);
        setSuccess(`✅ ${roomType} capacity updated! Created ${newRooms.length} new room(s).`);
      } else {
        setSuccess(`✅ ${roomType} capacity updated successfully!`);
      }
      
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
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
           branchCapacity.tripleCap + branchCapacity.quardCap + 
           (branchCapacity.suiteCap || 0);
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
    localStorage.setItem('selectedBranch', branch);
  };

  const hasCapacityChanged = () => {
    const roomTypes = ['singleCap', 'doubleCap', 'tripleCap', 'quardCap', 'suiteCap'];
    for (const key of roomTypes) {
      if ((editingCapacity[key] || 0) !== (originalCapacity[key] || 0)) {
        return true;
      }
    }
    return false;
  };

  const hasExtraBedChargesChanged = () => {
    const charges = ['singleExtraBedCharge', 'doubleExtraBedCharge', 'tripleExtraBedCharge', 'guardExtraBedCharge', 'suiteExtraBedCharge'];
    for (const key of charges) {
      if ((editingExtraBedCharges[key] || 0) !== (originalExtraBedCharges[key] || 0)) {
        return true;
      }
    }
    return false;
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return 'Rs. 0';
    return `Rs. ${amount.toLocaleString()}`;
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
              <p className="text-sm text-gray-500">Manage room capacity and extra bed charges for each branch</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
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
            {/* Branch Capacity Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FiHome className="mr-2" />
                {selectedBranch || 'Select Branch'} - Branch Capacity & Extra Bed Charges
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Room Capacity Section */}
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">Room Capacity</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Single</label>
                      <input
                        type="number"
                        value={editingCapacity.singleCap || 0}
                        onChange={(e) => handleCapacityChange('singleCap', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Double</label>
                      <input
                        type="number"
                        value={editingCapacity.doubleCap || 0}
                        onChange={(e) => handleCapacityChange('doubleCap', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Triple</label>
                      <input
                        type="number"
                        value={editingCapacity.tripleCap || 0}
                        onChange={(e) => handleCapacityChange('tripleCap', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quard</label>
                      <input
                        type="number"
                        value={editingCapacity.quardCap || 0}
                        onChange={(e) => handleCapacityChange('quardCap', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suite</label>
                      <input
                        type="number"
                        value={editingCapacity.suiteCap || 0}
                        onChange={(e) => handleCapacityChange('suiteCap', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Extra Bed Charges Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center">
                      <FiUserPlus className="mr-2 text-indigo-600" />
                      Extra Bed Charges (per night)
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Presets:</span>
                      <div className="flex space-x-1">
                        {EXTRA_BED_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => applyExtraBedPreset(preset)}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-indigo-100 rounded transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Single</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          value={editingExtraBedCharges.singleExtraBedCharge || 0}
                          onChange={(e) => handleExtraBedChargeChange('singleExtraBedCharge', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Double</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          value={editingExtraBedCharges.doubleExtraBedCharge || 0}
                          onChange={(e) => handleExtraBedChargeChange('doubleExtraBedCharge', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Triple</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          value={editingExtraBedCharges.tripleExtraBedCharge || 0}
                          onChange={(e) => handleExtraBedChargeChange('tripleExtraBedCharge', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guard</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          value={editingExtraBedCharges.guardExtraBedCharge || 0}
                          onChange={(e) => handleExtraBedChargeChange('guardExtraBedCharge', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suite</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          value={editingExtraBedCharges.suiteExtraBedCharge || 0}
                          onChange={(e) => handleExtraBedChargeChange('suiteExtraBedCharge', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
                <div className="text-sm text-gray-500">
                  {hasCapacityChanged() || hasExtraBedChargesChanged() ? (
                    <span className="text-yellow-600">⚠️ Changes detected. Click Save to apply.</span>
                  ) : (
                    <span className="text-green-600">✓ All settings are up to date.</span>
                  )}
                </div>
                <button
                  onClick={saveBranchCapacity}
                  disabled={saving || (!hasCapacityChanged() && !hasExtraBedChargesChanged())}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    saving || (!hasCapacityChanged() && !hasExtraBedChargesChanged())
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <FiSave className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
                </button>
              </div>
            </div>

            {/* Summary Cards */}
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

            {/* Room Type Capacity Table */}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Extra Bed Charge</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roomTypeCapacities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No room types configured
                        </td>
                      </tr>
                    ) : (
                      roomTypeCapacities.map((r) => {
                        // ✅ Map room type to the correct field name
                        const roomTypeMap: {[key: string]: string} = {
                          'Single': 'singleExtraBedCharge',
                          'Double': 'doubleExtraBedCharge',
                          'Triple': 'tripleExtraBedCharge',
                          'Quard': 'guardExtraBedCharge',  // ✅ Map Quard to guardExtraBedCharge
                          'Suite': 'suiteExtraBedCharge',
                        };
                        const extraBedKey = roomTypeMap[r.roomType] || `${r.roomType.toLowerCase()}ExtraBedCharge`;
                        return (
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
                            <td className="px-4 py-3 text-indigo-600 font-medium">
                              {formatCurrency(editingExtraBedCharges[extraBedKey] || 0)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => saveRoomCapacity(r.roomType)}
                                disabled={saving || (editingRoomCapacity[r.roomType] || r.totalRooms) === r.totalRooms}
                                className={`px-3 py-1 rounded-lg transition-colors flex items-center space-x-1 text-sm ${
                                  saving || (editingRoomCapacity[r.roomType] || r.totalRooms) === r.totalRooms
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                <FiSave className="w-4 h-4" />
                                <span>Save</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rooms List */}
            {rooms.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Rooms in {selectedBranch}
                  <span className="text-sm font-normal text-gray-500 ml-2">({rooms.length} rooms)</span>
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rooms.slice(0, 20).map((room) => (
                        <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{room.roomNumber}</td>
                          <td className="px-4 py-3">{room.roomType}</td>
                          <td className="px-4 py-3">{room.capacity}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              room.status === 'available' ? 'bg-green-100 text-green-700' :
                              room.status === 'occupied' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {room.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {rooms.length > 20 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-center text-gray-500 text-sm">
                            Showing 20 of {rooms.length} rooms
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}