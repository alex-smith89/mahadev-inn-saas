// server.js - Complete working version with PostgreSQL
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());

// Database connection - PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
    console.log('⚠️ Please make sure PostgreSQL is running and the database exists');
    return;
  }
  console.log('✅ Database connected successfully');
  release();
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

// Get user info
app.get('/api/auth/user-info/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const result = await pool.query(
      'SELECT id, username, role, canViewAllBranches, canCreateBookings FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    
    const branchesResult = await pool.query(
      'SELECT branch_name FROM user_branches WHERE user_id = $1',
      [user.id]
    );

    const userBranches = branchesResult.rows.map(row => row.branch_name);

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

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const branchesResult = await pool.query(
      'SELECT branch_name FROM user_branches WHERE user_id = $1',
      [user.id]
    );

    const userBranches = branchesResult.rows.map(row => row.branch_name);

    if (!userBranches.includes(branch)) {
      return res.status(400).json({ 
        message: `Branch "${branch}" is not assigned to this user. Available: ${userBranches.join(', ')}` 
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        branches: userBranches,
        selectedBranch: branch,
        canViewAllBranches: user.canviewallbranches === true,
        canCreateBookings: user.cancreatebookings === true
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
      canViewAllBranches: user.canviewallbranches === true,
      canCreateBookings: user.cancreatebookings === true
    };

    res.json({
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== BOOKINGS ENDPOINTS ====================

// Get bookings with branch-wise filtering
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    const userBranches = user.branches || [];

    await updateBookingStatuses();

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (canViewAllBranches && selectedBranch === 'all') {
      // Owner can see all branches
    } else if (canViewAllBranches && selectedBranch) {
      query += ` AND branch = $${paramCount}`;
      params.push(selectedBranch);
      paramCount++;
    } else {
      if (selectedBranch) {
        query += ` AND branch = $${paramCount}`;
        params.push(selectedBranch);
        paramCount++;
      } else if (userBranches.length > 0) {
        const placeholders = userBranches.map((_, i) => `$${paramCount + i}`).join(',');
        query += ` AND branch IN (${placeholders})`;
        params.push(...userBranches);
      } else {
        return res.json({ bookings: [], total: 0 });
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Get branch counts
    const branchCounts = {};
    for (const branch of userBranches) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM bookings WHERE branch = $1',
        [branch]
      );
      branchCounts[branch] = parseInt(countResult.rows[0].count);
    }

    const branchInfo = {
      selectedBranch: selectedBranch || 'none',
      availableBranches: userBranches,
      canViewAllBranches: canViewAllBranches,
      currentBranch: selectedBranch || (userBranches.length > 0 ? userBranches[0] : 'none')
    };

    res.json({ 
      success: true, 
      bookings: result.rows,
      total: result.rows.length,
      branchInfo: branchInfo,
      branchCounts: branchCounts,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Create booking with real-time branch updates
app.post('/api/bookings', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const {
      bookingNo,
      agentName,
      agentContact,
      email,
      branch,
      roomType,
      roomsCount,
      mealPlan,
      facility,
      checkIn,
      checkOut,
      bookingStatus,
      roomCharges,
      extraPersonCharges,
      totalCost,
      currency,
      heads,
      remark
    } = req.body;

    console.log('📝 Creating booking:', {
      agentName,
      branch,
      user: user.username,
      role: user.role,
      userBranches: user.branches
    });

    // Validate branch permission
    if (!user.canViewAllBranches) {
      if (!user.branches.includes(branch)) {
        return res.status(403).json({ 
          message: `You do not have permission to create bookings in branch: ${branch}` 
        });
      }
    }

    // Insert booking
    const result = await pool.query(
      `INSERT INTO bookings 
      (bookingNo, agentName, agentContact, email, branch, roomType, roomsCount, 
       mealPlan, facility, checkIn, checkOut, bookingStatus, roomCharges, 
       extraPersonCharges, totalCost, currency, heads, remark, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *`,
      [bookingNo, agentName, agentContact, email, branch, roomType, roomsCount,
       mealPlan, facility, checkIn, checkOut, bookingStatus || 'Confirm', roomCharges || 0,
       extraPersonCharges || 0, totalCost || 0, currency || 'NPR', heads || 0, remark || '']
    );

    const newBooking = result.rows[0];

    // Create notification for ALL users in this branch
    const notificationTitle = `📋 New Booking in ${branch}`;
    const notificationMessage = `New booking #${bookingNo} created for ${agentName} at ${branch} by ${user.username}`;
    
    await pool.query(
      `INSERT INTO notifications 
      (title, message, branch, bookingId, type, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW())`,
      [notificationTitle, notificationMessage, branch, newBooking.id, 'booking_created']
    );

    // Get notification ID
    const notificationResult = await pool.query(
      'SELECT id FROM notifications WHERE bookingId = $1 ORDER BY created_at DESC LIMIT 1',
      [newBooking.id]
    );
    const notificationId = notificationResult.rows[0].id;

    // Get all users for this branch
    const branchUsersResult = await pool.query(
      `SELECT u.id, u.username, u.role 
       FROM users u 
       JOIN user_branches ub ON u.id = ub.user_id 
       WHERE ub.branch_name = $1`,
      [branch]
    );

    // Create user notifications for ALL users in this branch
    for (const branchUser of branchUsersResult.rows) {
      await pool.query(
        `INSERT INTO user_notifications (user_id, notification_id, isRead, created_at) 
         VALUES ($1, $2, false, NOW())`,
        [branchUser.id, notificationId]
      );
    }

    // Update branch stats
    await pool.query(
      `INSERT INTO branch_stats (branch, totalBookings, lastBookingDate, lastUpdatedBy) 
       VALUES ($1, 1, NOW(), $2) 
       ON CONFLICT (branch) DO UPDATE SET 
       totalBookings = branch_stats.totalBookings + 1, 
       lastBookingDate = NOW(),
       lastUpdatedBy = $2`,
      [branch, user.username]
    );

    console.log(`✅ Booking created in branch: ${branch} by ${user.username}`);
    console.log(`📢 Notified ${branchUsersResult.rows.length} users in branch: ${branch}`);

    res.status(201).json({ 
      success: true, 
      data: newBooking,
      message: `Booking created successfully in ${branch}`,
      notifiedUsers: branchUsersResult.rows.length,
      branch: branch,
      bookingNo: bookingNo
    });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating booking',
      error: error.message 
    });
  }
});

// Update booking statuses automatically
async function updateBookingStatuses() {
  try {
    await pool.query(
      `UPDATE bookings 
       SET bookingStatus = 'CheckedIn', updated_at = NOW() 
       WHERE bookingStatus IN ('Confirm', 'Confirmed', 'Pending') 
       AND DATE(checkIn) <= CURRENT_DATE`
    );

    await pool.query(
      `UPDATE bookings 
       SET bookingStatus = 'CheckedOut', updated_at = NOW() 
       WHERE bookingStatus IN ('Confirm', 'Confirmed', 'CheckedIn') 
       AND DATE(checkOut) < CURRENT_DATE`
    );

    const currentHour = new Date().getHours();
    if (currentHour >= 12) {
      await pool.query(
        `UPDATE bookings 
         SET bookingStatus = 'CheckedOut', updated_at = NOW() 
         WHERE bookingStatus IN ('Confirm', 'Confirmed', 'CheckedIn') 
         AND DATE(checkOut) = CURRENT_DATE`
      );
    }

    console.log('✅ Booking statuses auto-updated');
  } catch (error) {
    console.error('Error updating booking statuses:', error);
  }
}

// ==================== AUTOMATION ENDPOINTS ====================

// ✅ AUTO CHECK-IN ENDPOINT
app.post('/api/automation/checkin', authenticate, async (req, res) => {
  console.log('🔄 Auto check-in API called');
  
  try {
    const user = req.user;
    const userBranches = user.branches || [];
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    
    let targetBranches = [];
    if (canViewAllBranches && selectedBranch === 'all') {
      const allBranchesResult = await pool.query('SELECT DISTINCT branch FROM bookings');
      targetBranches = allBranchesResult.rows.map(row => row.branch);
    } else if (selectedBranch) {
      targetBranches = [selectedBranch];
    } else {
      targetBranches = userBranches;
    }
    
    console.log('📋 Processing check-in for branches:', targetBranches.join(', '));

    const bookingsResult = await pool.query(
      `SELECT * FROM bookings 
       WHERE branch = ANY($1::text[]) 
       AND bookingStatus IN ($2, $3, $4) 
       AND DATE(checkIn) <= CURRENT_DATE`,
      [targetBranches, 'Confirm', 'Confirmed', 'Pending']
    );

    console.log(`📋 Found ${bookingsResult.rows.length} bookings to check-in`);

    let checkedIn = 0;
    const checkedInBookings = [];

    for (const booking of bookingsResult.rows) {
      try {
        await pool.query(
          'UPDATE bookings SET bookingStatus = $1, updated_at = NOW() WHERE id = $2',
          ['CheckedIn', booking.id]
        );
        
        await pool.query(
          `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          ['🔄 Automated Check-in', 
           `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked in at ${booking.branch}.`,
           booking.branch, booking.id, 'auto_checkin']
        );
        
        checkedIn++;
        checkedInBookings.push(booking);
        console.log(`✅ Checked in: ${booking.agentName} (${booking.bookingNo}) at ${booking.branch}`);
        
      } catch (error) {
        console.error(`Error checking in booking ${booking.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        checkedIn: checkedIn,
        bookings: checkedInBookings.map(b => ({
          id: b.id,
          agentName: b.agentName,
          bookingNo: b.bookingNo,
          branch: b.branch,
          roomType: b.roomType
        }))
      },
      message: `Successfully checked in ${checkedIn} guests`
    });
  } catch (error) {
    console.error('Error in check-in automation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run check-in automation'
    });
  }
});

// ✅ AUTO CHECK-OUT ENDPOINT
app.post('/api/automation/checkout', authenticate, async (req, res) => {
  console.log('🔄 Auto checkout API called');
  
  try {
    const user = req.user;
    const userBranches = user.branches || [];
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    
    let targetBranches = [];
    if (canViewAllBranches && selectedBranch === 'all') {
      const allBranchesResult = await pool.query('SELECT DISTINCT branch FROM bookings');
      targetBranches = allBranchesResult.rows.map(row => row.branch);
    } else if (selectedBranch) {
      targetBranches = [selectedBranch];
    } else {
      targetBranches = userBranches;
    }
    
    console.log('📋 Processing checkout for branches:', targetBranches.join(', '));

    const bookingsResult = await pool.query(
      `SELECT * FROM bookings 
       WHERE branch = ANY($1::text[]) 
       AND bookingStatus IN ($2, $3, $4) 
       AND DATE(checkOut) <= CURRENT_DATE`,
      [targetBranches, 'Confirm', 'Confirmed', 'CheckedIn']
    );

    console.log(`📋 Found ${bookingsResult.rows.length} bookings to check-out`);

    let checkedOut = 0;
    const checkedOutBookings = [];

    for (const booking of bookingsResult.rows) {
      try {
        await pool.query(
          'UPDATE bookings SET bookingStatus = $1, updated_at = NOW() WHERE id = $2',
          ['CheckedOut', booking.id]
        );
        
        await pool.query(
          `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          ['📤 Automated Checkout', 
           `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.branch}. Room is now vacant.`,
           booking.branch, booking.id, 'auto_checkout']
        );
        
        checkedOut++;
        checkedOutBookings.push(booking);
        console.log(`✅ Checked out: ${booking.agentName} (${booking.bookingNo}) from ${booking.branch}`);
        
      } catch (error) {
        console.error(`Error checking out booking ${booking.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        checkedOut: checkedOut,
        bookings: checkedOutBookings.map(b => ({
          id: b.id,
          agentName: b.agentName,
          bookingNo: b.bookingNo,
          branch: b.branch,
          roomType: b.roomType
        }))
      },
      message: `Successfully checked out ${checkedOut} guests`
    });
  } catch (error) {
    console.error('Error in checkout automation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run checkout automation'
    });
  }
});

// ✅ SEND REMINDERS ENDPOINT
app.post('/api/automation/reminders', authenticate, async (req, res) => {
  console.log('📧 Reminders API called');
  
  try {
    const user = req.user;
    const userBranches = user.branches || [];
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    
    let targetBranches = [];
    if (canViewAllBranches && selectedBranch === 'all') {
      const allBranchesResult = await pool.query('SELECT DISTINCT branch FROM bookings');
      targetBranches = allBranchesResult.rows.map(row => row.branch);
    } else if (selectedBranch) {
      targetBranches = [selectedBranch];
    } else {
      targetBranches = userBranches;
    }
    
    console.log('📋 Sending reminders for branches:', targetBranches.join(', '));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let checkoutReminders = 0;
    let checkinReminders = 0;

    // Checkout reminders (1-3 days)
    const checkoutResult = await pool.query(
      `SELECT * FROM bookings 
       WHERE branch = ANY($1::text[]) 
       AND bookingStatus IN ($2, $3, $4) 
       AND DATE(checkOut) >= CURRENT_DATE
       AND DATE(checkOut) <= CURRENT_DATE + INTERVAL '3 days'`,
      [targetBranches, 'Confirm', 'Confirmed', 'CheckedIn']
    );

    for (const booking of checkoutResult.rows) {
      const checkOutDate = new Date(booking.checkout);
      checkOutDate.setHours(0, 0, 0, 0);
      const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilCheckout > 0 && daysUntilCheckout <= 3) {
        await pool.query(
          `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [`📅 Checkout Reminder - ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`,
           `Guest ${booking.agentName} (${booking.bookingNo}) has checkout in ${daysUntilCheckout} days at ${booking.branch}.`,
           booking.branch, booking.id, 'checkout_reminder']
        );
        checkoutReminders++;
      }
    }

    // Check-in reminders (tomorrow)
    const checkinResult = await pool.query(
      `SELECT * FROM bookings 
       WHERE branch = ANY($1::text[]) 
       AND bookingStatus IN ($2, $3, $4) 
       AND DATE(checkIn) = CURRENT_DATE + INTERVAL '1 day'`,
      [targetBranches, 'Confirm', 'Confirmed', 'Pending']
    );

    for (const booking of checkinResult.rows) {
      await pool.query(
        `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        ['📅 Check-in Tomorrow',
         `Guest ${booking.agentName} (${booking.bookingNo}) is scheduled to check-in tomorrow at ${booking.branch}.`,
         booking.branch, booking.id, 'checkin_reminder']
      );
      checkinReminders++;
    }

    res.json({
      success: true,
      data: {
        checkoutReminders: checkoutReminders,
        checkinReminders: checkinReminders
      },
      message: `Sent ${checkoutReminders} checkout reminders and ${checkinReminders} check-in reminders`
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reminders'
    });
  }
});

// ✅ FULL AUTOMATION ENDPOINT
app.post('/api/automation/run', authenticate, async (req, res) => {
  console.log('🚀 Full automation run API called');
  
  try {
    const user = req.user;
    const selectedBranch = user.selectedBranch;
    const userBranches = user.branches || [];
    const canViewAllBranches = user.canViewAllBranches;

    let targetBranches = [];
    if (canViewAllBranches && selectedBranch === 'all') {
      const allBranchesResult = await pool.query('SELECT DISTINCT branch FROM bookings');
      targetBranches = allBranchesResult.rows.map(row => row.branch);
    } else if (selectedBranch) {
      targetBranches = [selectedBranch];
    } else {
      targetBranches = userBranches;
    }

    console.log(`📋 Running full automation for branches: ${targetBranches.join(', ')}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = {
      checkins: { checkedIn: 0 },
      checkouts: { checkedOut: 0 },
      reminders: { checkoutReminders: 0, checkinReminders: 0 },
      notifications: {
        checkinToday: [],
        checkinTomorrow: [],
        checkoutToday: [],
        checkoutTomorrow: [],
        checkoutIn2Days: [],
        checkoutIn3Days: []
      },
      timestamp: new Date().toISOString(),
      branches: targetBranches
    };

    let checkedInCount = 0;
    let checkedOutCount = 0;
    let checkoutReminderCount = 0;
    let checkinReminderCount = 0;

    const bookingsResult = await pool.query(
      `SELECT * FROM bookings 
       WHERE branch = ANY($1::text[]) 
       AND bookingStatus IN ($2, $3, $4, $5)`,
      [targetBranches, 'Confirm', 'Confirmed', 'Pending', 'CheckedIn']
    );

    console.log(`📋 Found ${bookingsResult.rows.length} active bookings`);

    for (const booking of bookingsResult.rows) {
      const checkInDate = new Date(booking.checkin);
      checkInDate.setHours(0, 0, 0, 0);
      
      const checkOutDate = new Date(booking.checkout);
      checkOutDate.setHours(0, 0, 0, 0);

      const daysUntilCheckin = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check-in Today
      if (daysUntilCheckin === 0 && booking.bookingstatus !== 'CheckedIn') {
        console.log(`✅ Check-in TODAY: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkinToday.push(booking);
        checkedInCount++;
        
        try {
          await pool.query(
            'UPDATE bookings SET bookingStatus = $1, updated_at = NOW() WHERE id = $2',
            ['CheckedIn', booking.id]
          );
          
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['🔔 Check-in Today', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking in TODAY at ${booking.branch}.`, 
             booking.branch, booking.id, 'checkin_today']
          );
        } catch (error) {
          console.error(`Error processing check-in for ${booking.agentname}:`, error);
        }
      }

      // Check-in Tomorrow
      if (daysUntilCheckin === 1) {
        console.log(`📅 Check-in TOMORROW: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkinTomorrow.push(booking);
        checkinReminderCount++;
        
        try {
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['📅 Check-in Tomorrow', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking in TOMORROW at ${booking.branch}.`,
             booking.branch, booking.id, 'checkin_tomorrow']
          );
        } catch (error) {
          console.error(`Error creating check-in reminder:`, error);
        }
      }

      // Checkout Today
      if (daysUntilCheckout === 0 && booking.bookingstatus !== 'CheckedOut') {
        console.log(`📤 Checkout TODAY: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkoutToday.push(booking);
        
        try {
          const currentHour = new Date().getHours();
          if (currentHour >= 12) {
            await pool.query(
              'UPDATE bookings SET bookingStatus = $1, updated_at = NOW() WHERE id = $2',
              ['CheckedOut', booking.id]
            );
            checkedOutCount++;
          }
          
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['📤 Check-out Today', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking out TODAY at ${booking.branch}.`,
             booking.branch, booking.id, 'checkout_today']
          );
        } catch (error) {
          console.error(`Error processing checkout for ${booking.agentname}:`, error);
        }
      }

      // Checkout Tomorrow
      if (daysUntilCheckout === 1) {
        console.log(`📅 Checkout TOMORROW: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkoutTomorrow.push(booking);
        checkoutReminderCount++;
        
        try {
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['📅 Check-out Tomorrow', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking out TOMORROW at ${booking.branch}.`,
             booking.branch, booking.id, 'checkout_tomorrow']
          );
        } catch (error) {
          console.error(`Error creating checkout reminder:`, error);
        }
      }

      // Checkout in 2 days
      if (daysUntilCheckout === 2) {
        console.log(`📅 Checkout in 2 days: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkoutIn2Days.push(booking);
        checkoutReminderCount++;
        
        try {
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['📅 Check-out in 2 days', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking out in 2 days at ${booking.branch}.`,
             booking.branch, booking.id, 'checkout_2days']
          );
        } catch (error) {
          console.error(`Error creating 2-day reminder:`, error);
        }
      }

      // Checkout in 3 days
      if (daysUntilCheckout === 3) {
        console.log(`📅 Checkout in 3 days: ${booking.agentname} (${booking.branch})`);
        results.notifications.checkoutIn3Days.push(booking);
        checkoutReminderCount++;
        
        try {
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['📅 Check-out in 3 days', 
             `Guest ${booking.agentname} (${booking.bookingno}) is checking out in 3 days at ${booking.branch}.`,
             booking.branch, booking.id, 'checkout_3days']
          );
        } catch (error) {
          console.error(`Error creating 3-day reminder:`, error);
        }
      }

      // Overdue checkout
      if (daysUntilCheckout < 0 && booking.bookingstatus !== 'CheckedOut') {
        console.log(`⚠️ Overdue checkout: ${booking.agentname} (${booking.branch})`);
        
        try {
          await pool.query(
            'UPDATE bookings SET bookingStatus = $1, updated_at = NOW() WHERE id = $2',
            ['CheckedOut', booking.id]
          );
          checkedOutCount++;
          
          await pool.query(
            `INSERT INTO notifications (title, message, branch, bookingId, type, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['🔄 Auto Checkout Completed', 
             `Guest ${booking.agentname} (${booking.bookingno}) has been automatically checked out from ${booking.branch}.`,
             booking.branch, booking.id, 'auto_checkout']
          );
        } catch (error) {
          console.error(`Error processing overdue checkout:`, error);
        }
      }
    }

    results.checkins.checkedIn = checkedInCount;
    results.checkouts.checkedOut = checkedOutCount;
    results.reminders.checkoutReminders = checkoutReminderCount;
    results.reminders.checkinReminders = checkinReminderCount;

    console.log(`📊 Full Automation Summary for branches: ${targetBranches.join(', ')}`);
    console.log(`   ✅ Checked in: ${checkedInCount}`);
    console.log(`   📤 Checked out: ${checkedOutCount}`);
    console.log(`   📧 Checkout reminders: ${checkoutReminderCount}`);
    console.log(`   📧 Check-in reminders: ${checkinReminderCount}`);

    res.json({
      success: true,
      data: results,
      message: `Automation completed for ${targetBranches.length} branch(es)`
    });
    
  } catch (error) {
    console.error('❌ Error running automation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run automation'
    });
  }
});

// ==================== NOTIFICATIONS ENDPOINTS ====================

// Get user-specific notifications
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    const userBranches = user.branches || [];

    let query = `
      SELECT n.*, un.isRead, un.createdAt as readAt 
      FROM notifications n
      JOIN user_notifications un ON n.id = un.notification_id
      WHERE un.user_id = $1
    `;
    const params = [user.id];
    let paramCount = 2;

    if (!canViewAllBranches || selectedBranch !== 'all') {
      const branchFilter = selectedBranch || (userBranches.length > 0 ? userBranches[0] : '');
      if (branchFilter) {
        query += ` AND n.branch = $${paramCount}`;
        params.push(branchFilter);
        paramCount++;
      }
    }

    query += ' AND un.isRead = false ORDER BY n.created_at DESC LIMIT 20';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    await pool.query(
      'UPDATE user_notifications SET isRead = true, readAt = NOW() WHERE notification_id = $1 AND user_id = $2',
      [id, user.id]
    );

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
app.post('/api/notifications/mark-all-read', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    await pool.query(
      'UPDATE user_notifications SET isRead = true, readAt = NOW() WHERE user_id = $1 AND isRead = false',
      [user.id]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// ==================== ROOM PRICING ENDPOINTS ====================

// Get room pricing for a branch
app.get('/api/room-pricing/branch/:branch', authenticate, async (req, res) => {
  try {
    const { branch } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM room_pricing WHERE branch = $1',
      [branch]
    );

    if (result.rows.length === 0) {
      return res.json({
        data: {
          branch: branch,
          singlePrice: 2000,
          doublePrice: 3000,
          triplePrice: 4000,
          quardPrice: 5000,
          extraPersonPrice: 500
        }
      });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching room pricing:', error);
    res.status(500).json({ message: 'Error fetching room pricing' });
  }
});

// ==================== OTHER ENDPOINTS ====================

// Today's check-ins
app.get('/api/checkin/today', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    const userBranches = user.branches || [];

    await updateBookingStatuses();

    let query = 'SELECT * FROM bookings WHERE DATE(checkIn) = CURRENT_DATE AND bookingStatus IN ($1, $2, $3)';
    const params = ['Confirm', 'Confirmed', 'Pending'];
    let paramCount = 4;

    if (!canViewAllBranches || selectedBranch !== 'all') {
      const branchFilter = selectedBranch || (userBranches.length > 0 ? userBranches[0] : '');
      if (branchFilter) {
        query += ` AND branch = $${paramCount}`;
        params.push(branchFilter);
      }
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching today checkins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today checkins'
    });
  }
});

// Upcoming checkouts
app.get('/api/checkout/upcoming', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const selectedBranch = user.selectedBranch;
    const canViewAllBranches = user.canViewAllBranches;
    const userBranches = user.branches || [];

    await updateBookingStatuses();

    let query = 'SELECT * FROM bookings WHERE checkOut >= CURRENT_DATE AND bookingStatus IN ($1, $2, $3)';
    const params = ['Confirm', 'Confirmed', 'CheckedIn'];
    let paramCount = 4;

    if (!canViewAllBranches || selectedBranch !== 'all') {
      const branchFilter = selectedBranch || (userBranches.length > 0 ? userBranches[0] : '');
      if (branchFilter) {
        query += ` AND branch = $${paramCount}`;
        params.push(branchFilter);
      }
    }

    query += ' ORDER BY checkOut ASC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching upcoming checkouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming checkouts'
    });
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
app.listen(PORT, function() {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🤖 Automation endpoints:`);
  console.log(`   - POST /api/automation/checkin`);
  console.log(`   - POST /api/automation/checkout`);
  console.log(`   - POST /api/automation/reminders`);
  console.log(`   - POST /api/automation/run`);
});