const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotel_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ==================== AUTH ENDPOINTS ====================

// Get user info (for login page)
app.get('/api/auth/user-info/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    console.log('🔍 Fetching user info for:', username);

    const [users] = await pool.execute(
      'SELECT id, username, role, canViewAllBranches, canCreateBookings FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    console.log('✅ User found:', user);
    
    // Get user branches
    const [branches] = await pool.execute(
      'SELECT branch_name FROM user_branches WHERE user_id = ?',
      [user.id]
    );

    const userBranches = branches.map(b => b.branch_name);
    console.log('📋 User branches:', userBranches);

    res.json({
      ...user,
      branches: userBranches
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, branch } = req.body;

    console.log('🔐 Login attempt:', { username, branch });

    // Get user from database
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get user branches
    const [branches] = await pool.execute(
      'SELECT branch_name FROM user_branches WHERE user_id = ?',
      [user.id]
    );

    const userBranches = branches.map(b => b.branch_name);
    console.log('📋 User branches:', userBranches);

    // Verify selected branch is valid
    if (!userBranches.includes(branch)) {
      console.log('❌ Invalid branch:', branch, 'Available:', userBranches);
      return res.status(400).json({ 
        message: `Branch "${branch}" is not assigned to this user. Available: ${userBranches.join(', ')}` 
      });
    }

    // Generate JWT token with permissions
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        branches: userBranches,
        selectedBranch: branch,
        canViewAllBranches: user.canViewAllBranches === 1,
        canCreateBookings: user.canCreateBookings === 1
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      branches: userBranches,
      selectedBranch: branch,
      canViewAllBranches: user.canViewAllBranches === 1,
      canCreateBookings: user.canCreateBookings === 1
    };

    console.log('✅ Login successful for:', username);

    res.json({
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ==================== BOOKINGS ENDPOINTS ====================

// Get bookings based on user permissions
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    const user = req.user;
    let query = 'SELECT * FROM bookings';
    const params = [];

    console.log('📊 Fetching bookings for user:', user.username, 'Role:', user.role);
    console.log('📋 User branches:', user.branches);
    console.log('👁️ Can view all branches:', user.canViewAllBranches);

    // Branch-based filtering
    if (!user.canViewAllBranches) {
      // User can only see their assigned branches
      if (user.branches && user.branches.length > 0) {
        const placeholders = user.branches.map(() => '?').join(',');
        query += ` WHERE branch IN (${placeholders})`;
        params.push(...user.branches);
      } else {
        // User has no branches assigned
        return res.json({ bookings: [], total: 0 });
      }
    }

    // If user has selected a specific branch, filter by it
    if (user.selectedBranch && !user.canViewAllBranches) {
      if (params.length > 0) {
        query += ` AND branch = ?`;
      } else {
        query += ` WHERE branch = ?`;
      }
      params.push(user.selectedBranch);
    }

    query += ' ORDER BY created_at DESC';

    console.log('📝 Query:', query);
    console.log('📝 Params:', params);

    const [bookings] = await pool.execute(query, params);
    
    // Filter by selected branch if owner selected a specific branch
    let filteredBookings = bookings;
    if (user.canViewAllBranches && user.selectedBranch) {
      filteredBookings = bookings.filter(b => b.branch === user.selectedBranch);
    }

    console.log(`✅ Found ${filteredBookings.length} bookings`);

    res.json({ 
      success: true, 
      bookings: filteredBookings,
      total: filteredBookings.length,
      user: {
        role: user.role,
        branches: user.branches,
        selectedBranch: user.selectedBranch,
        canViewAllBranches: user.canViewAllBranches
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Get single booking (with permission check)
app.get('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const [bookings] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = bookings[0];

    // Check permission
    if (!user.canViewAllBranches) {
      if (!user.branches.includes(booking.branch)) {
        return res.status(403).json({ 
          message: 'You do not have permission to view this booking' 
        });
      }
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Error fetching booking' });
  }
});

// Create booking (with permission check)
app.post('/api/bookings', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const {
      bookingNo,
      agentName,
      branch,
      checkIn,
      checkOut,
      roomsCount,
      totalCost,
      roomCharges,
      price,
      bookingStatus
    } = req.body;

    // Check permission to create booking
    if (!user.canCreateBookings) {
      return res.status(403).json({ 
        message: 'You do not have permission to create bookings' 
      });
    }

    // Check if user can create booking in this branch
    if (!user.canViewAllBranches && !user.branches.includes(branch)) {
      return res.status(403).json({ 
        message: 'You do not have permission to create bookings in this branch' 
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO bookings 
      (bookingNo, agentName, branch, checkIn, checkOut, roomsCount, totalCost, roomCharges, price, bookingStatus, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [bookingNo, agentName, branch, checkIn, checkOut, roomsCount, totalCost, roomCharges, price, bookingStatus || 'Pending']
    );

    const [newBooking] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newBooking[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Error creating booking' });
  }
});

// Update booking (with permission check)
app.put('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const updates = req.body;

    // Get existing booking
    const [existing] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = existing[0];

    // Check permission
    if (!user.canViewAllBranches) {
      if (!user.branches.includes(booking.branch)) {
        return res.status(403).json({ 
          message: 'You do not have permission to update this booking' 
        });
      }
    }

    // Check if branch is being changed
    if (updates.branch && !user.canViewAllBranches) {
      if (!user.branches.includes(updates.branch)) {
        return res.status(403).json({ 
          message: 'You do not have permission to move bookings to this branch' 
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at' && key !== 'createdAt') {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    updateValues.push(new Date());
    updateValues.push(id);

    await pool.execute(
      `UPDATE bookings SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?`,
      updateValues
    );

    const [updated] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ message: 'Error updating booking' });
  }
});

// Delete booking (with permission check)
app.delete('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get existing booking
    const [existing] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = existing[0];

    // Check permission
    if (!user.canViewAllBranches) {
      if (!user.branches.includes(booking.branch)) {
        return res.status(403).json({ 
          message: 'You do not have permission to delete this booking' 
        });
      }
    }

    await pool.execute(
      'DELETE FROM bookings WHERE id = ?',
      [id]
    );

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

// ==================== DASHBOARD STATS ====================

// Get dashboard statistics based on permissions
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const user = req.user;
    let query = 'SELECT * FROM bookings';
    const params = [];

    // Branch-based filtering
    if (!user.canViewAllBranches) {
      if (user.branches && user.branches.length > 0) {
        const placeholders = user.branches.map(() => '?').join(',');
        query += ` WHERE branch IN (${placeholders})`;
        params.push(...user.branches);
      }
    }

    // If user selected a specific branch
    if (user.selectedBranch) {
      if (params.length > 0) {
        query += ` AND branch = ?`;
      } else {
        query += ` WHERE branch = ?`;
      }
      params.push(user.selectedBranch);
    }

    const [bookings] = await pool.execute(query, params);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const confirmed = bookings.filter((b: any) => 
      b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
    );
    const pending = bookings.filter((b: any) => 
      b.bookingStatus === 'Pending'
    );

    let totalRevenue = 0;
    confirmed.forEach((b: any) => {
      totalRevenue += (b.totalCost || b.roomCharges || b.price || 0);
    });

    const uniqueCustomers = new Set();
    bookings.forEach((b: any) => {
      if (b.agentName) uniqueCustomers.add(b.agentName);
    });

    const occupied = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      
      return (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') &&
             checkIn <= today && 
             checkOut > today;
    });

    const occupiedRooms = occupied.reduce((sum: number, b: any) => sum + (b.roomsCount || 1), 0);
    const TOTAL_ROOMS = 50;
    const availableRooms = Math.max(0, TOTAL_ROOMS - occupiedRooms);
    const occupancyRate = TOTAL_ROOMS > 0 ? Math.round((occupiedRooms / TOTAL_ROOMS) * 100) : 0;

    const todayStr = today.toDateString();
    const todayCheckIns = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      return checkIn.toDateString() === todayStr && 
             (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn');
    }).length;

    const todayCheckOuts = bookings.filter((b: any) => {
      const checkOut = new Date(b.checkOut);
      return checkOut.toDateString() === todayStr && 
             (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut');
    }).length;

    res.json({
      totalCustomers: uniqueCustomers.size,
      totalBookings: bookings.length,
      availableRooms: availableRooms,
      occupiedRooms: occupiedRooms,
      totalRevenue: totalRevenue,
      averageBookingValue: confirmed.length > 0 ? totalRevenue / confirmed.length : 0,
      occupancyRate: occupancyRate,
      todayCheckIns: todayCheckIns,
      todayCheckOuts: todayCheckOuts,
      activeBookings: occupied.length,
      pendingBookings: pending.length,
      confirmedBookings: confirmed.length,
      branches: user.branches,
      selectedBranch: user.selectedBranch,
      canViewAllBranches: user.canViewAllBranches
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📋 Check user info at http://localhost:${PORT}/api/auth/user-info/manager`);
});