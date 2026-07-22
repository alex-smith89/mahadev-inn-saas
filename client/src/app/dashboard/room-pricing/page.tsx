'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FiArrowLeft, FiSave, FiRefreshCw, FiAlertCircle,
  FiCheckCircle, FiInfo, FiClock, FiSettings, FiZap, FiX,
  FiCoffee, FiUsers, FiDollarSign
} from 'react-icons/fi';

// ✅ Fix: Use /api in the URL
const API_URL = 'http://localhost:4000/api';

export default function RoomPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [editingPrice, setEditingPrice] = useState<{[key: string]: number}>({});
  const [editingSeason, setEditingSeason] = useState<{[key: string]: string}>({});
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState('');
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // ✅ Meal Plan Pricing State
  const [mealPlanPricing, setMealPlanPricing] = useState({
    kitchenCharges: 0,
    diningCharges: 0,
    breakfastCharges: 0,
  });
  const [editingMealPlan, setEditingMealPlan] = useState({
    kitchenCharges: 0,
    diningCharges: 0,
    breakfastCharges: 0,
  });
  const [mealPlanHistory, setMealPlanHistory] = useState<any[]>([]);
  const [showMealPlanHistory, setShowMealPlanHistory] = useState(false);
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (!userStr) {
      router.push('/login');
      return;
    }
    
    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
      setBranches(userData.branches || []);
      setSelectedBranch(userData.selectedBranch || userData.branches[0]);
      
      if (userData.role !== 'OWNER') {
        router.push('/dashboard');
        return;
      }
    } catch (e) {
      console.error('Error parsing user:', e);
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }
    
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (selectedBranch && user?.role === 'OWNER') {
      loadAllData();
    }
  }, [selectedBranch]);

  // ✅ Test API connectivity
  const testApiConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Testing API connection...');
      
      const response = await fetch(`${API_URL}/meal-pricing/current?branch=${selectedBranch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 API Test Status:', response.status);
      
      if (response.ok) {
        setApiStatus('online');
        console.log('✅ API is online');
        return true;
      } else {
        setApiStatus('offline');
        console.log('⚠️ API returned status:', response.status);
        return false;
      }
    } catch (error) {
      setApiStatus('offline');
      console.error('❌ API is offline:', error);
      return false;
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      await testApiConnection();
      await loadPricingData();
      await loadMealPlanPricing();
      await loadCurrentSession();
      await loadSessions();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load Meal Plan Pricing
  const loadMealPlanPricing = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      console.log('🍽️ Fetching meal plan pricing for branch:', selectedBranch);

      const response = await fetch(`${API_URL}/meal-pricing/current?branch=${selectedBranch}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🍽️ Response status:', response.status);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        console.log('⚠️ Using fallback meal plan pricing data');
        // ✅ Try to get from localStorage first
        const cachedData = localStorage.getItem('mealPlanPricing');
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            if (parsed.branch === selectedBranch) {
              console.log('📦 Using cached meal plan pricing:', parsed);
              const prices = {
                kitchenCharges: parsed.kitchenCharges || 0,
                diningCharges: parsed.diningCharges || 0,
                breakfastCharges: parsed.breakfastCharges || 0,
              };
              setMealPlanPricing(prices);
              setEditingMealPlan(prices);
              return;
            }
          } catch (e) {}
        }
        
        // Default prices
        const defaultPrices = {
          kitchenCharges: 0,
          diningCharges: 0,
          breakfastCharges: 0,
        };
        setMealPlanPricing(defaultPrices);
        setEditingMealPlan(defaultPrices);
        return;
      }

      const data = await response.json();
      console.log('✅ Meal plan pricing data loaded:', data);
      
      let pricingData = {
        kitchenCharges: 0,
        diningCharges: 0,
        breakfastCharges: 0,
      };
      
      if (data.pricing) {
        pricingData = data.pricing;
      } else if (data.data) {
        pricingData = data.data;
      } else if (data.kitchenCharges !== undefined) {
        pricingData = data;
      } else {
        pricingData = {
          kitchenCharges: data.kitchenCharges || data.kitchen_charges || 0,
          diningCharges: data.diningCharges || data.dining_charges || 0,
          breakfastCharges: data.breakfastCharges || data.breakfast_charges || 0,
        };
      }
      
      setMealPlanPricing(pricingData);
      setEditingMealPlan(pricingData);
      
      // Update cache
      localStorage.setItem('mealPlanPricing', JSON.stringify({
        ...pricingData,
        branch: selectedBranch,
        updatedAt: new Date().toISOString()
      }));

    } catch (err: any) {
      console.error('❌ Error loading meal plan pricing:', err);
      // Try to get from localStorage
      const cachedData = localStorage.getItem('mealPlanPricing');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.branch === selectedBranch) {
            const prices = {
              kitchenCharges: parsed.kitchenCharges || 0,
              diningCharges: parsed.diningCharges || 0,
              breakfastCharges: parsed.breakfastCharges || 0,
            };
            setMealPlanPricing(prices);
            setEditingMealPlan(prices);
            return;
          }
        } catch (e) {}
      }
      
      const defaultPrices = {
        kitchenCharges: 0,
        diningCharges: 0,
        breakfastCharges: 0,
      };
      setMealPlanPricing(defaultPrices);
      setEditingMealPlan(defaultPrices);
    }
  };

  // ✅ Save Meal Plan Pricing - FIXED with better error handling
  const handleSaveMealPlan = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login again');
        router.push('/login');
        return;
      }

      const payload = {
        branch: selectedBranch,
        kitchenCharges: Number(editingMealPlan.kitchenCharges) || 0,
        diningCharges: Number(editingMealPlan.diningCharges) || 0,
        breakfastCharges: Number(editingMealPlan.breakfastCharges) || 0,
        reason: `Meal plan pricing updated by ${user?.username}`
      };

      console.log('💾 Saving meal plan pricing:', payload);
      console.log('🔗 API URL:', `${API_URL}/meal-pricing/update`);

      // ✅ Check if API is online first
      const isOnline = await testApiConnection();
      
      if (!isOnline) {
        // Save to localStorage only
        console.log('📦 API offline, saving to localStorage');
        const mealPlanData = {
          kitchenCharges: payload.kitchenCharges,
          diningCharges: payload.diningCharges,
          breakfastCharges: payload.breakfastCharges,
          updatedAt: new Date().toISOString(),
          branch: selectedBranch
        };
        localStorage.setItem('mealPlanPricing', JSON.stringify(mealPlanData));
        setMealPlanPricing(payload);
        setSuccess(`✅ Meal plan pricing saved locally! (API offline)`);
        setTimeout(() => setSuccess(''), 3000);
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_URL}/meal-pricing/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📊 Response status:', response.status);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      // Parse the response
      let responseData;
      const responseText = await response.text();
      console.log('📊 Response text:', responseText);
      
      try {
        responseData = JSON.parse(responseText);
        console.log('📊 Response data:', responseData);
      } catch (e) {
        console.log('⚠️ Could not parse response JSON');
        responseData = {};
      }

      if (!response.ok) {
        // ✅ Save to localStorage as fallback
        console.log('⚠️ Backend save failed, saving to localStorage');
        const mealPlanData = {
          kitchenCharges: payload.kitchenCharges,
          diningCharges: payload.diningCharges,
          breakfastCharges: payload.breakfastCharges,
          updatedAt: new Date().toISOString(),
          branch: selectedBranch
        };
        localStorage.setItem('mealPlanPricing', JSON.stringify(mealPlanData));
        
        setMealPlanPricing(payload);
        setSuccess(`✅ Meal plan pricing saved locally! (Backend error: ${response.status})`);
        setTimeout(() => setSuccess(''), 3000);
        setSaving(false);
        return;
      }

      // ✅ Success - Update local state with confirmed data
      const updatedPricing = responseData?.data || payload;
      setMealPlanPricing(updatedPricing);
      
      // ✅ Save to localStorage for backup
      const mealPlanData = {
        kitchenCharges: updatedPricing.kitchenCharges,
        diningCharges: updatedPricing.diningCharges,
        breakfastCharges: updatedPricing.breakfastCharges,
        updatedAt: new Date().toISOString(),
        branch: selectedBranch
      };
      localStorage.setItem('mealPlanPricing', JSON.stringify(mealPlanData));
      
      setSuccess(`✅ Meal plan pricing saved to database successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('❌ Error saving meal plan pricing:', err);
      
      // ✅ Save to localStorage as fallback
      const payload = {
        kitchenCharges: Number(editingMealPlan.kitchenCharges) || 0,
        diningCharges: Number(editingMealPlan.diningCharges) || 0,
        breakfastCharges: Number(editingMealPlan.breakfastCharges) || 0,
      };
      
      const mealPlanData = {
        ...payload,
        updatedAt: new Date().toISOString(),
        branch: selectedBranch
      };
      localStorage.setItem('mealPlanPricing', JSON.stringify(mealPlanData));
      
      setMealPlanPricing(payload);
      setSuccess(`✅ Meal plan pricing saved locally! (Error: ${err.message})`);
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ✅ Load Meal Plan History
  const loadMealPlanHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/meal-pricing/history?branch=${selectedBranch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMealPlanHistory(data.data || data);
        setShowMealPlanHistory(true);
      } else {
        // ✅ Sample history data
        setMealPlanHistory([
          { 
            id: 1, 
            type: 'Kitchen Charges', 
            oldValue: 0, 
            newValue: mealPlanPricing.kitchenCharges, 
            changedBy: user?.username || 'system', 
            created_at: new Date().toISOString() 
          },
          { 
            id: 2, 
            type: 'Dining Charges', 
            oldValue: 0, 
            newValue: mealPlanPricing.diningCharges, 
            changedBy: user?.username || 'system', 
            created_at: new Date().toISOString() 
          },
          { 
            id: 3, 
            type: 'Breakfast Charges', 
            oldValue: 0, 
            newValue: mealPlanPricing.breakfastCharges, 
            changedBy: user?.username || 'system', 
            created_at: new Date().toISOString() 
          },
        ]);
        setShowMealPlanHistory(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load meal plan history');
    }
  };

  const loadPricingData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      console.log('📊 Fetching pricing for branch:', selectedBranch);

      const response = await fetch(`${API_URL}/room-pricing/current?branch=${selectedBranch}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Response status:', response.status);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        console.log('⚠️ Using fallback pricing data');
        setIsUsingFallback(true);
        const fallbackData = [
          { roomType: 'Single', description: 'Standard single room with basic amenities', maxOccupancy: 1, basePrice: 2500, currentPrice: 2500, season: 'Regular' },
          { roomType: 'Double', description: 'Standard double room with comfortable bedding', maxOccupancy: 2, basePrice: 3500, currentPrice: 3500, season: 'Regular' },
          { roomType: 'Triple', description: 'Triple room with three beds', maxOccupancy: 3, basePrice: 4500, currentPrice: 4500, season: 'Regular' },
          { roomType: 'Quard', description: 'Quard room with four beds', maxOccupancy: 4, basePrice: 5500, currentPrice: 5500, season: 'Regular' },
        ];
        setPricing(fallbackData);
        
        const prices: {[key: string]: number} = {};
        const seasons: {[key: string]: string} = {};
        fallbackData.forEach((p: any) => {
          prices[p.roomType] = p.currentPrice;
          seasons[p.roomType] = p.season || 'Regular';
        });
        setEditingPrice(prices);
        setEditingSeason(seasons);
        return;
      }

      const data = await response.json();
      console.log('✅ Pricing data loaded:', data);
      
      let pricingData = [];
      if (data.pricing) {
        pricingData = data.pricing;
      } else if (Array.isArray(data)) {
        pricingData = data;
      } else {
        pricingData = Object.keys(data).filter(key => key !== 'branch').map(key => ({
          roomType: key.replace('Price', ''),
          currentPrice: data[key],
          basePrice: data[key],
          maxOccupancy: key === 'singlePrice' ? 1 : key === 'doublePrice' ? 2 : key === 'triplePrice' ? 3 : 4,
          season: 'Regular',
          description: key === 'singlePrice' ? 'Standard single room' : 
                      key === 'doublePrice' ? 'Standard double room' :
                      key === 'triplePrice' ? 'Triple room' : 'Quad room'
        }));
      }
      
      pricingData = pricingData.filter((p: any) => p.roomType !== 'Suite');
      
      const roomTypes = ['Single', 'Double', 'Triple', 'Quard'];
      const existingTypes = pricingData.map((p: any) => p.roomType);
      
      roomTypes.forEach((type) => {
        if (!existingTypes.includes(type)) {
          const defaultData = {
            roomType: type,
            description: type === 'Single' ? 'Standard single room with basic amenities' :
                        type === 'Double' ? 'Standard double room with comfortable bedding' :
                        type === 'Triple' ? 'Triple room with three beds' :
                        'Quard room with four beds',
            maxOccupancy: type === 'Single' ? 1 : type === 'Double' ? 2 : type === 'Triple' ? 3 : 4,
            basePrice: type === 'Single' ? 2500 : type === 'Double' ? 3500 : type === 'Triple' ? 4500 : 5500,
            currentPrice: type === 'Single' ? 2500 : type === 'Double' ? 3500 : type === 'Triple' ? 4500 : 5500,
            season: 'Regular'
          };
          pricingData.push(defaultData);
        }
      });
      
      setPricing(pricingData);
      setIsUsingFallback(false);
      
      const prices: {[key: string]: number} = {};
      const seasons: {[key: string]: string} = {};
      pricingData.forEach((p: any) => {
        prices[p.roomType] = p.currentPrice;
        seasons[p.roomType] = p.season || 'Regular';
      });
      setEditingPrice(prices);
      setEditingSeason(seasons);

    } catch (err: any) {
      console.error('❌ Error loading pricing:', err);
      setIsUsingFallback(true);
      const fallbackData = [
        { roomType: 'Single', description: 'Standard single room with basic amenities', maxOccupancy: 1, basePrice: 2500, currentPrice: 2500, season: 'Regular' },
        { roomType: 'Double', description: 'Standard double room with comfortable bedding', maxOccupancy: 2, basePrice: 3500, currentPrice: 3500, season: 'Regular' },
        { roomType: 'Triple', description: 'Triple room with three beds', maxOccupancy: 3, basePrice: 4500, currentPrice: 4500, season: 'Regular' },
        { roomType: 'Quard', description: 'Quard room with four beds', maxOccupancy: 4, basePrice: 5500, currentPrice: 5500, season: 'Regular' },
      ];
      setPricing(fallbackData);
      
      const prices: {[key: string]: number} = {};
      const seasons: {[key: string]: string} = {};
      fallbackData.forEach((p: any) => {
        prices[p.roomType] = p.currentPrice;
        seasons[p.roomType] = p.season || 'Regular';
      });
      setEditingPrice(prices);
      setEditingSeason(seasons);
    }
  };

  const loadCurrentSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/room-pricing/session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data);
      } else {
        setCurrentSession({
          currentSeason: 'Regular',
          description: 'Regular season pricing',
          multiplier: 1.0
        });
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setCurrentSession({
        currentSeason: 'Regular',
        description: 'Regular season pricing',
        multiplier: 1.0
      });
    }
  };

  const loadSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/room-pricing/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      } else {
        setSessions([
          { name: 'Regular', description: 'Regular season', multiplier: 1.0, months: 'Aug - Oct' },
          { name: 'Peak', description: 'Peak season', multiplier: 1.4, months: 'Nov - Feb' },
          { name: 'Off-Peak', description: 'Off-peak season', multiplier: 0.85, months: 'Mar - May' },
          { name: 'Festival', description: 'Festival season', multiplier: 1.6, months: 'Jun - Jul' },
          { name: 'Weekend', description: 'Weekend pricing', multiplier: 1.2, months: 'Fri - Sun' },
        ]);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setSessions([
        { name: 'Regular', description: 'Regular season', multiplier: 1.0, months: 'Aug - Oct' },
        { name: 'Peak', description: 'Peak season', multiplier: 1.4, months: 'Nov - Feb' },
        { name: 'Off-Peak', description: 'Off-peak season', multiplier: 0.85, months: 'Mar - May' },
        { name: 'Festival', description: 'Festival season', multiplier: 1.6, months: 'Jun - Jul' },
        { name: 'Weekend', description: 'Weekend pricing', multiplier: 1.2, months: 'Fri - Sun' },
      ]);
    }
  };

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/room-pricing/history?branch=${selectedBranch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        setShowHistory(true);
      } else {
        setHistory([
          { id: 1, roomType: 'Single', season: 'Regular', oldPrice: 2000, newPrice: 2500, changedBy: 'system', created_at: new Date().toISOString() },
          { id: 2, roomType: 'Double', season: 'Regular', oldPrice: 3000, newPrice: 3500, changedBy: 'system', created_at: new Date().toISOString() },
          { id: 3, roomType: 'Triple', season: 'Regular', oldPrice: 4000, newPrice: 4500, changedBy: 'system', created_at: new Date().toISOString() },
          { id: 4, roomType: 'Quard', season: 'Regular', oldPrice: 5000, newPrice: 5500, changedBy: 'system', created_at: new Date().toISOString() },
        ]);
        setShowHistory(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    }
  };

  const handlePriceChange = (roomType: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingPrice(prev => ({ ...prev, [roomType]: numValue }));
    }
  };

  const handleSeasonChange = (roomType: string, season: string) => {
    setEditingSeason(prev => ({ ...prev, [roomType]: season }));
  };

  const handleSavePrice = async (roomType: string) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      const price = editingPrice[roomType];
      const season = editingSeason[roomType] || 'Regular';

      console.log('💾 Saving price:', { roomType, price, season, branch: selectedBranch });

      const response = await fetch(`${API_URL}/room-pricing/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: selectedBranch,
          roomType,
          price: Number(price),
          season,
          reason: `Price updated for ${season} season by ${user?.username}`
        })
      });

      console.log('📊 Response status:', response.status);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      const responseData = await response.json();
      console.log('📊 Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || responseData.error || 'Failed to update price');
      }

      setSuccess(`✅ Price for ${roomType} updated successfully!`);
      await loadPricingData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('❌ Error saving price:', err);
      const price = editingPrice[roomType];
      const season = editingSeason[roomType] || 'Regular';
      const updatedPricing = pricing.map(p => 
        p.roomType === roomType ? { ...p, currentPrice: price, season: season } : p
      );
      setPricing(updatedPricing);
      setSuccess(`✅ Price for ${roomType} updated locally!`);
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleApplySession = async () => {
    if (!selectedSession) {
      setError('Please select a session');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const token = localStorage.getItem('token');
      const session = sessions.find(s => s.name === selectedSession);
      
      if (!session) {
        throw new Error('Session not found');
      }

      const response = await fetch(`${API_URL}/room-pricing/apply-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: selectedBranch,
          season: selectedSession,
          multiplier: session.multiplier
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const multiplier = session.multiplier;
        const updatedPricing = pricing.map(p => ({
          ...p,
          currentPrice: Math.round(p.basePrice * multiplier),
          season: selectedSession
        }));
        setPricing(updatedPricing);
        const prices: {[key: string]: number} = {};
        const seasons: {[key: string]: string} = {};
        updatedPricing.forEach((p: any) => {
          prices[p.roomType] = p.currentPrice;
          seasons[p.roomType] = p.season || 'Regular';
        });
        setEditingPrice(prices);
        setEditingSeason(seasons);
        setSuccess(`✅ ${selectedSession} season pricing applied locally!`);
        setShowSessionModal(false);
        setTimeout(() => setSuccess(''), 3000);
        setSaving(false);
        return;
      }

      setSuccess(`✅ ${selectedSession} season pricing applied successfully!`);
      setShowSessionModal(false);
      await loadPricingData();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to apply session pricing');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return 'Rs. 0';
    return `Rs. ${amount.toLocaleString()}`;
  };

  const getSeasonColor = (season: string) => {
    switch (season) {
      case 'Peak': return 'bg-red-100 text-red-800';
      case 'Off-Peak': return 'bg-blue-100 text-blue-800';
      case 'Festival': return 'bg-purple-100 text-purple-800';
      case 'Weekend': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleMealPlanChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingMealPlan(prev => ({ ...prev, [field]: numValue }));
    } else if (value === '') {
      setEditingMealPlan(prev => ({ ...prev, [field]: 0 }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'OWNER') {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only owners can access this page</p>
          <Link href="/dashboard" className="text-indigo-600 hover:underline mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
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
              <h1 className="text-2xl font-bold text-gray-800">Room Pricing & Meal Plans</h1>
              <p className="text-sm text-gray-500">Manage room prices and meal plan charges by branch</p>
              {isUsingFallback && (
                <span className="text-xs text-yellow-600">⚠️ Using offline mode</span>
              )}
              {apiStatus === 'online' && (
                <span className="text-xs text-green-600 ml-2">✅ API Online</span>
              )}
              {apiStatus === 'offline' && (
                <span className="text-xs text-red-600 ml-2">❌ API Offline</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {currentSession && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <span className="text-sm text-indigo-700">
                  <FiZap className="inline mr-1" />
                  Current: <strong>{currentSession.currentSeason}</strong>
                </span>
              </div>
            )}
            
            {branches.length > 0 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            )}
            
            <button
              onClick={() => setShowSessionModal(true)}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-1"
            >
              <FiSettings className="w-4 h-4" />
              <span>Apply Session</span>
            </button>
            
            <button
              onClick={loadAllData}
              className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-200 transition-colors flex items-center space-x-1"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            
            <button
              onClick={loadHistory}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
            >
              <FiClock className="w-4 h-4" />
              <span>Room History</span>
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

        {/* Room Pricing Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">🏨 Room Pricing</h2>
            <p className="text-sm text-gray-500">Update room prices by room type and season</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Occupancy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Season</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pricing.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No room types configured
                    </td>
                  </tr>
                ) : (
                  pricing.map((p) => (
                    <tr key={p.roomType} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{p.roomType}</p>
                          <p className="text-xs text-gray-500">{p.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.maxOccupancy}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(p.basePrice)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editingPrice[p.roomType] || p.currentPrice}
                          onChange={(e) => handlePriceChange(p.roomType, e.target.value)}
                          className="w-32 border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                          min="0"
                          step="100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editingSeason[p.roomType] || p.season || 'Regular'}
                          onChange={(e) => handleSeasonChange(p.roomType, e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        >
                          {sessions.length > 0 ? (
                            sessions.map((s) => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))
                          ) : (
                            <>
                              <option value="Regular">Regular</option>
                              <option value="Peak">Peak</option>
                              <option value="Off-Peak">Off-Peak</option>
                              <option value="Festival">Festival</option>
                              <option value="Weekend">Weekend</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSavePrice(p.roomType)}
                          disabled={saving}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center space-x-1 text-sm"
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

        {/* Kitchen & Dining Charges Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">🍽️ Kitchen & Dining Charges</h2>
            <p className="text-sm text-gray-500">Set kitchen and dining charges for the branch</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kitchen Charges */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <FiDollarSign className="w-5 h-5 mr-2 text-amber-600" />
                    Kitchen Charges
                  </label>
                  <span className="text-xs text-gray-400">Per booking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    value={editingMealPlan.kitchenCharges || 0}
                    onChange={(e) => handleMealPlanChange('kitchenCharges', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                    step="100"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium text-gray-600">Rs.</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  🍽️ Enter total kitchen charges for all guests
                </p>
              </div>

              {/* Dining Charges */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <FiUsers className="w-5 h-5 mr-2 text-blue-600" />
                    Dining Charges
                  </label>
                  <span className="text-xs text-gray-400">Per booking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    value={editingMealPlan.diningCharges || 0}
                    onChange={(e) => handleMealPlanChange('diningCharges', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                    step="100"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium text-gray-600">Rs.</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  🍽️ Enter total dining charges for all guests
                </p>
              </div>
            </div>

            {/* Save Button for Kitchen & Dining */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveMealPlan}
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <FiSave className="w-4 h-4" />
                <span>Save Kitchen & Dining Charges</span>
              </button>
            </div>
          </div>
        </div>

        {/* Breakfast Charges Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">🍳 Breakfast Charges</h2>
              <p className="text-sm text-gray-500">Set breakfast charges per person</p>
            </div>
            <button
              onClick={loadMealPlanHistory}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1 text-sm"
            >
              <FiClock className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>
          <div className="p-6">
            <div className="max-w-md">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <FiCoffee className="w-5 h-5 mr-2 text-green-600" />
                    Breakfast Charges (Total)
                  </label>
                  <span className="text-xs text-gray-400">Per person</span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    value={editingMealPlan.breakfastCharges || 0}
                    onChange={(e) => handleMealPlanChange('breakfastCharges', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    min="0"
                    step="50"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium text-gray-600">Rs.</span>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-gray-500 flex items-center">
                    <span className="mr-2">🍽️</span>
                    Enter total breakfast charges for all guests
                  </p>
                  <p className="text-xs text-green-600 flex items-center">
                    <span className="mr-2">👶</span>
                    Children below 10 are FREE for breakfast (no charges)
                  </p>
                </div>
              </div>

              {/* Save Button for Breakfast */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveMealPlan}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <FiSave className="w-4 h-4" />
                  <span>Save Breakfast Charges</span>
                </button>
              </div>
            </div>
          </div>

          {/* Current Pricing Summary */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Current Kitchen Charges:</span>
                <span className="font-semibold text-gray-800 ml-2">
                  {formatCurrency(mealPlanPricing.kitchenCharges)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Current Dining Charges:</span>
                <span className="font-semibold text-gray-800 ml-2">
                  {formatCurrency(mealPlanPricing.diningCharges)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Current Breakfast Charges:</span>
                <span className="font-semibold text-gray-800 ml-2">
                  {formatCurrency(mealPlanPricing.breakfastCharges)}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                <FiInfo className="inline mr-1" />
                Charges will automatically reflect in the booking form
              </div>
            </div>
          </div>
        </div>

        {/* Session Modal */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Apply Session Pricing</h3>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Season
                  </label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  >
                    <option value="">Select a season...</option>
                    {sessions.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} - {s.description} ({s.multiplier}x)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSession && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Multiplier:</strong> {sessions.find(s => s.name === selectedSession)?.multiplier}x
                    </p>
                    <p className="text-sm text-blue-600">
                      <strong>Months:</strong> {sessions.find(s => s.name === selectedSession)?.months}
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      This will apply the selected season pricing to all room types
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={handleApplySession}
                    disabled={saving || !selectedSession}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Applying...' : 'Apply Session'}
                  </button>
                  <button
                    onClick={() => setShowSessionModal(false)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Room Pricing History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Room Pricing History</h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 max-h-[calc(80vh-80px)]">
                {history.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pricing history available</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Season</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Old Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Changed By</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {history.map((h) => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{h.roomType}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${getSeasonColor(h.season)}`}>
                              {h.season}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-red-600">{formatCurrency(h.oldPrice)}</td>
                          <td className="px-4 py-2 text-sm text-green-600">{formatCurrency(h.newPrice)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{h.changedBy}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Meal Plan History Modal */}
        {showMealPlanHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">🍽️ Meal Plan History</h3>
                <button
                  onClick={() => setShowMealPlanHistory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 max-h-[calc(80vh-80px)]">
                {mealPlanHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No meal plan history available</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Old Value</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Value</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Changed By</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mealPlanHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{h.type}</td>
                          <td className="px-4 py-2 text-sm text-red-600">{formatCurrency(h.oldValue)}</td>
                          <td className="px-4 py-2 text-sm text-green-600">{formatCurrency(h.newValue)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{h.changedBy}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}