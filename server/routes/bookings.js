// backend/routes/bookings.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ✅ Middleware to verify token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ✅ POST /api/bookings - Create a new booking
router.post('/', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch, ...bookingData } = req.body;

    if (!branch) {
      return res.status(400).json({ error: 'Branch is required' });
    }

    console.log(`📋 Creating booking by ${user.role}: ${user.username} in branch: ${branch}`);

    // ✅ CHECK PERMISSION: Only OWNER and MANAGER can create bookings
    // ✅ VIEWER cannot create bookings
    if (user.role === 'VIEWER') {
      return res.status(403).json({ 
        error: 'You cannot create booking',
        message: 'Viewers cannot create bookings. Please contact the owner.',
        userRole: user.role
      });
    }

    // ✅ OWNER, MANAGER, ADMIN can create bookings in ANY branch
    if (user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
      // ✅ ALLOW ALL BRANCHES - No restriction
      console.log(`✅ ${user.role} ${user.username} is creating booking in ${branch}`);
    } else {
      return res.status(403).json({ 
        error: 'You cannot create booking',
        message: 'You do not have permission to create bookings.',
        userRole: user.role
      });
    }

    // ✅ Create the booking
    const booking = new Booking({
      ...bookingData,
      branch: branch,
      createdBy: user.username || user.email,
      createdByRole: user.role,
      createdAt: new Date().toISOString()
    });

    await booking.save();

    console.log(`✅ Booking #${booking.bookingNo} created successfully in ${branch}`);

    // ✅ Send real-time notifications to all managers and owner
    const notifications = [];

    // Notify all managers (except the creator)
    const allManagers = await User.find({
      role: 'MANAGER',
      _id: { $ne: user._id }
    });

    allManagers.forEach((manager) => {
      notifications.push({
        userId: manager._id,
        type: 'booking_created',
        title: 'New Booking Created',
        message: `New booking #${booking.bookingNo} created by ${user.username} for ${booking.agentName} in ${branch}`,
        branch: branch,
        bookingId: booking._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Notify the owner (if they are not the creator)
    const owner = await User.findOne({ role: 'OWNER' });
    if (owner && owner._id.toString() !== user._id.toString()) {
      notifications.push({
        userId: owner._id,
        type: 'booking_created',
        title: 'New Booking Created',
        message: `New booking #${booking.bookingNo} created by ${user.username} in ${branch} for ${booking.agentName}`,
        branch: branch,
        bookingId: booking._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // ✅ Create notification for the creator
    await Notification.create({
      userId: user._id,
      type: 'booking_created',
      title: 'Booking Created Successfully',
      message: `Booking #${booking.bookingNo} for ${booking.agentName} has been created successfully in ${branch}`,
      branch: branch,
      bookingId: booking._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      data: booking,
      notifiedUsers: notifications.length,
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/bookings - Get all bookings
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    console.log(`📋 ${user.role} ${user.username} fetching bookings`);

    // ✅ Filter bookings based on user role
    if (user.role === 'OWNER') {
      // Owner can see all bookings
      query = {};
    } else if (user.role === 'MANAGER') {
      // ✅ Manager can see ALL bookings (not restricted)
      query = {};
    } else if (user.role === 'VIEWER') {
      // Viewer can only see bookings from their assigned branch
      const userBranches = user.branches || [];
      if (userBranches.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          bookings: [],
          message: 'No branches assigned to this viewer'
        });
      }
      query = { branch: { $in: userBranches } };
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    
    // ✅ Get branch counts for the response
    const allBookings = await Booking.find({});
    const branchCounts = {};
    allBookings.forEach((b) => {
      const branch = b.branch || 'Unknown';
      branchCounts[branch] = (branchCounts[branch] || 0) + 1;
    });

    // ✅ Get branch status summary
    const branchStatusSummary = {};
    allBookings.forEach((b) => {
      const branch = b.branch || 'Unknown';
      const status = b.bookingStatus || 'Unknown';
      if (!branchStatusSummary[branch]) {
        branchStatusSummary[branch] = [];
      }
      const existing = branchStatusSummary[branch].find((s) => s.bookingStatus === status);
      if (existing) {
        existing.count += 1;
      } else {
        branchStatusSummary[branch].push({ bookingStatus: status, count: 1 });
      }
    });

    res.status(200).json({
      success: true,
      data: bookings,
      bookings: bookings,
      branchCounts: branchCounts,
      branchStatusSummary: branchStatusSummary,
      total: bookings.length
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/bookings/:id - Get single booking
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // ✅ Check if user has access to this booking
    let hasAccess = false;
    
    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      hasAccess = true;
    } else if (user.role === 'MANAGER') {
      // ✅ Manager can access ANY booking
      hasAccess = true;
    } else if (user.role === 'VIEWER') {
      const userBranches = user.branches || [];
      if (userBranches.includes(booking.branch)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PUT /api/bookings/:id - Update booking
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const bookingId = req.params.id;
    const { branch, ...updateData } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // ✅ Check if user has permission to update this booking
    let hasPermission = false;
    
    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      hasPermission = true;
    } else if (user.role === 'MANAGER') {
      // ✅ Manager can update ANY booking
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to update this booking' });
    }

    // Update the booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        ...updateData,
        branch: branch || booking.branch,
        lastUpdatedAt: new Date().toISOString(),
        updatedBy: user.username || user.email
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedBooking,
      message: 'Booking updated successfully'
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ DELETE /api/bookings/:id - Delete booking
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const bookingId = req.params.id;

    // ✅ Only OWNER can delete bookings
    if (user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can delete bookings' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await Booking.findByIdAndDelete(bookingId);

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/checkin/today - Get today's check-ins
router.get('/checkin/today', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let query = {
      checkIn: { $gte: today.toISOString(), $lt: tomorrow.toISOString() }
    };

    // ✅ Managers and Owners can see ALL check-ins
    if (user.role === 'VIEWER') {
      const userBranches = user.branches || [];
      if (userBranches.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      query.branch = { $in: userBranches };
    }

    const checkins = await Booking.find(query).sort({ checkIn: 1 });
    res.status(200).json({ success: true, data: checkins });
  } catch (error) {
    console.error('Error fetching today checkins:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/checkin/tomorrow - Get tomorrow's check-ins
router.get('/checkin/tomorrow', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    let query = {
      checkIn: { $gte: tomorrow.toISOString(), $lt: dayAfter.toISOString() }
    };

    if (user.role === 'VIEWER') {
      const userBranches = user.branches || [];
      if (userBranches.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      query.branch = { $in: userBranches };
    }

    const checkins = await Booking.find(query).sort({ checkIn: 1 });
    res.status(200).json({ success: true, data: checkins });
  } catch (error) {
    console.error('Error fetching tomorrow checkins:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/checkout/upcoming - Get upcoming checkouts
router.get('/checkout/upcoming', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 7);

    let query = {
      checkOut: { $gte: today.toISOString(), $lt: futureDate.toISOString() }
    };

    if (user.role === 'VIEWER') {
      const userBranches = user.branches || [];
      if (userBranches.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      query.branch = { $in: userBranches };
    }

    const checkouts = await Booking.find(query).sort({ checkOut: 1 });
    res.status(200).json({ success: true, data: checkouts });
  } catch (error) {
    console.error('Error fetching upcoming checkouts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/room-pricing/branch/:branch - Get room pricing for a branch
router.get('/room-pricing/branch/:branch', verifyToken, async (req, res) => {
  try {
    const { branch } = req.params;
    
    const pricing = {
      singlePrice: 2000,
      doublePrice: 3000,
      triplePrice: 4000,
      quardPrice: 5000,
      extraPersonPrice: 500
    };

    res.status(200).json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;