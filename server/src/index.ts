import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import checkoutRoutes from './routes/checkoutRoutes';
import notificationRoutes from './routes/notificationRoutes';
import mealPricingRoutes from './routes/mealPricingRoutes';
import cron from 'node-cron';
import { CheckoutService } from './services/checkoutService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const checkoutService = new CheckoutService();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(express.json());

// ============================================
// ✅ REGISTER ALL ROUTES
// ============================================
app.use('/api/checkout', checkoutRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meal-pricing', mealPricingRoutes);

// ============================================
// ✅ HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ✅ TEST ENDPOINTS
// ============================================
app.get('/api/checkout/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Checkout routes are working',
    timestamp: new Date().toISOString()
  });
});

// ✅ Test endpoint to list all registered routes
app.get('/api/routes', (req, res) => {
  res.json({ 
    success: true, 
    message: 'All registered routes',
    routes: [
      '/api/health',
      '/api/checkout',
      '/api/checkout/test',
      '/api/notifications',
      '/api/notifications/history',
      '/api/notifications/:id/read',
      '/api/notifications/mark-all-read',
      '/api/meal-pricing',
      '/api/meal-pricing/current',
      '/api/meal-pricing/update',
      '/api/meal-pricing/history',
      '/api/meal-pricing/breakdown',
      '/api/meal-pricing/seed',
      '/api/meal-pricing/test',
      '/api/checkin/today',
      '/api/checkin/tomorrow',
      '/api/bookings',
      '/api/room-capacity/branch/:branch',
      '/api/room-capacity/room-types/:branch',
      '/api/room-capacity/room-type/:branch/:roomType',
      '/api/room-capacity/summary',
    ],
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ✅ CHECK-IN ROUTES
// ============================================

// GET /api/checkin/today - Today's check-ins
app.get('/api/checkin/today', async (req, res) => {
  try {
    const { branch } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
      bookingStatus: { in: ['Confirm', 'Confirmed'] },
    };

    if (branch) {
      where.branch = branch as any;
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'asc' },
    });

    res.json({ 
      success: true, 
      data: bookings,
      count: bookings.length 
    });
  } catch (error) {
    console.error('Error fetching today\'s check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// GET /api/checkin/tomorrow - Tomorrow's check-ins
app.get('/api/checkin/tomorrow', async (req, res) => {
  try {
    const { branch } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const where: any = {
      checkIn: {
        gte: tomorrow,
        lt: dayAfterTomorrow,
      },
      bookingStatus: { in: ['Confirm', 'Confirmed'] },
    };

    if (branch) {
      where.branch = branch as any;
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'asc' },
    });

    res.json({ 
      success: true, 
      data: bookings,
      count: bookings.length 
    });
  } catch (error) {
    console.error('Error fetching tomorrow\'s check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// ============================================
// ✅ NOTIFICATION ROUTES
// ============================================

// GET /api/notifications - Get notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { branch } = req.query;
    const where: any = {};

    if (branch) {
      where.branch = branch as any;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ 
      success: true, 
      data: notifications 
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/history - Get notification history
app.get('/api/notifications/history', async (req, res) => {
  try {
    const { branch } = req.query;
    const where: any = {
      isRead: true,
    };

    if (branch) {
      where.branch = branch as any;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ 
      success: true, 
      data: notifications 
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ 
      success: true, 
      data: notification 
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
app.patch('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const { branch } = req.body;
    const where: any = { isRead: false };

    if (branch) {
      where.branch = branch as any;
    }

    const result = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ============================================
// ✅ MEAL PRICING ROUTES
// ============================================

// GET /api/meal-pricing/test - Test endpoint
app.get('/api/meal-pricing/test', (req, res) => {
  res.json({
    success: true,
    message: 'Meal pricing API is working!',
    timestamp: new Date().toISOString()
  });
});

// GET /api/meal-pricing/current - Get current meal plan pricing
app.get('/api/meal-pricing/current', async (req, res) => {
  try {
    const { branch } = req.query;
    
    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'Branch is required'
      });
    }

    const pricing = await prisma.mealPlanPricing.findUnique({
      where: { branch: branch as any },
    });

    if (!pricing) {
      return res.json({
        success: true,
        data: {
          kitchenCharges: 0,
          diningCharges: 0,
          breakfastCharges: 0,
        }
      });
    }

    res.json({
      success: true,
      data: {
        kitchenCharges: pricing.kitchenCharges,
        diningCharges: pricing.diningCharges,
        breakfastCharges: pricing.breakfastCharges,
      }
    });
  } catch (error) {
    console.error('Error getting meal plan pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal plan pricing'
    });
  }
});

// PUT /api/meal-pricing/update - Update meal plan pricing
app.put('/api/meal-pricing/update', async (req, res) => {
  try {
    const { branch, kitchenCharges, diningCharges, breakfastCharges, reason } = req.body;

    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'Branch is required'
      });
    }

    // Get current pricing for history
    const currentPricing = await prisma.mealPlanPricing.findUnique({
      where: { branch: branch as any },
    });

    // Update or create pricing
    const updated = await prisma.mealPlanPricing.upsert({
      where: { branch: branch as any },
      update: {
        kitchenCharges: Number(kitchenCharges),
        diningCharges: Number(diningCharges),
        breakfastCharges: Number(breakfastCharges),
        updatedAt: new Date(),
        updatedBy: 'system',
      },
      create: {
        branch: branch as any,
        kitchenCharges: Number(kitchenCharges),
        diningCharges: Number(diningCharges),
        breakfastCharges: Number(breakfastCharges),
        createdBy: 'system',
        updatedBy: 'system',
      },
    });

    // Create history entries
    if (currentPricing) {
      if (currentPricing.kitchenCharges !== Number(kitchenCharges)) {
        await prisma.mealPlanHistory.create({
          data: {
            branch: branch as any,
            type: 'Kitchen Charges',
            oldValue: currentPricing.kitchenCharges,
            newValue: Number(kitchenCharges),
            changedBy: 'system',
            pricingId: currentPricing.id,
          },
        });
      }
      if (currentPricing.diningCharges !== Number(diningCharges)) {
        await prisma.mealPlanHistory.create({
          data: {
            branch: branch as any,
            type: 'Dining Charges',
            oldValue: currentPricing.diningCharges,
            newValue: Number(diningCharges),
            changedBy: 'system',
            pricingId: currentPricing.id,
          },
        });
      }
      if (currentPricing.breakfastCharges !== Number(breakfastCharges)) {
        await prisma.mealPlanHistory.create({
          data: {
            branch: branch as any,
            type: 'Breakfast Charges',
            oldValue: currentPricing.breakfastCharges,
            newValue: Number(breakfastCharges),
            changedBy: 'system',
            pricingId: currentPricing.id,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Meal plan pricing updated successfully',
      data: {
        kitchenCharges: updated.kitchenCharges,
        diningCharges: updated.diningCharges,
        breakfastCharges: updated.breakfastCharges,
      },
      reason,
    });
  } catch (error) {
    console.error('Error updating meal plan pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update meal plan pricing'
    });
  }
});

// GET /api/meal-pricing/history - Get meal plan history
app.get('/api/meal-pricing/history', async (req, res) => {
  try {
    const { branch } = req.query;
    
    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'Branch is required'
      });
    }

    const history = await prisma.mealPlanHistory.findMany({
      where: { branch: branch as any },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting meal plan history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal plan history'
    });
  }
});

// GET /api/meal-pricing/breakdown - Get meal plan breakdown
app.get('/api/meal-pricing/breakdown', async (req, res) => {
  try {
    const { branch, mealPlan, adults, children, nights } = req.query;

    if (!branch || !mealPlan) {
      return res.status(400).json({
        success: false,
        error: 'Branch and meal plan are required'
      });
    }

    const numberOfAdults = parseInt(adults as string) || 1;
    const numberOfChildren = parseInt(children as string) || 0;
    const numberOfNights = parseInt(nights as string) || 1;

    const pricing = await prisma.mealPlanPricing.findUnique({
      where: { branch: branch as any },
    });

    const p = pricing || { kitchenCharges: 0, diningCharges: 0, breakfastCharges: 0 };

    let kitchenCharges = 0;
    let diningCharges = 0;
    let breakfastCharges = 0;
    let totalMealCharges = 0;
    let breakdownParts: string[] = [];

    switch (mealPlan) {
      case 'EP':
        breakdownParts.push('EP: Room only - No meal charges');
        totalMealCharges = 0;
        break;
      case 'CP':
        breakfastCharges = p.breakfastCharges * numberOfAdults * numberOfNights;
        kitchenCharges = p.kitchenCharges;
        totalMealCharges = breakfastCharges + kitchenCharges;
        breakdownParts.push(`CP: Breakfast included`);
        break;
      case 'MAP':
        breakfastCharges = p.breakfastCharges * numberOfAdults * numberOfNights;
        diningCharges = p.diningCharges * 2;
        kitchenCharges = p.kitchenCharges;
        totalMealCharges = breakfastCharges + diningCharges + kitchenCharges;
        breakdownParts.push(`MAP: Breakfast + Dinner included`);
        break;
      case 'AP':
        breakfastCharges = p.breakfastCharges * numberOfAdults * numberOfNights;
        diningCharges = p.diningCharges * 3;
        kitchenCharges = p.kitchenCharges;
        totalMealCharges = breakfastCharges + diningCharges + kitchenCharges;
        breakdownParts.push(`AP: All meals included`);
        break;
      case 'EPKitchen':
        kitchenCharges = p.kitchenCharges * 1.5;
        totalMealCharges = kitchenCharges;
        breakdownParts.push(`EPKitchen: Room with kitchen facilities`);
        break;
      default:
        breakdownParts.push('Unknown meal plan');
        totalMealCharges = 0;
    }

    res.json({
      success: true,
      kitchenCharges,
      diningCharges,
      breakfastCharges,
      totalMealCharges,
      breakdown: breakdownParts.join('; '),
    });
  } catch (error) {
    console.error('Error getting meal plan breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal plan breakdown'
    });
  }
});

// POST /api/meal-pricing/seed - Seed default pricing
app.post('/api/meal-pricing/seed', async (req, res) => {
  try {
    const branches = ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
    const results = [];

    for (const branch of branches) {
      const pricing = await prisma.mealPlanPricing.upsert({
        where: { branch: branch as any },
        update: {},
        create: {
          branch: branch as any,
          kitchenCharges: 0,
          diningCharges: 0,
          breakfastCharges: 0,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
      results.push(pricing);
    }

    res.json({
      success: true,
      message: 'Default meal plan pricing seeded successfully',
      data: results
    });
  } catch (error) {
    console.error('Error seeding meal plan pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed meal plan pricing'
    });
  }
});

// ============================================
// ✅ ROOM CAPACITY ROUTES
// ============================================

// GET /api/room-capacity/branch/:branch - Get branch capacity
app.get('/api/room-capacity/branch/:branch', async (req, res) => {
  try {
    const { branch } = req.params;
    const capacity = await prisma.branchCapacity.findFirst({
      where: { branch: branch as any },
    });
    
    if (!capacity) {
      return res.json({
        branch,
        singleCap: 0,
        doubleCap: 0,
        tripleCap: 0,
        quardCap: 0,
        suiteCap: 0,
        singleExtraBedCharge: 0,
        doubleExtraBedCharge: 0,
        tripleExtraBedCharge: 0,
        quardExtraBedCharge: 0,
        suiteExtraBedCharge: 0,
      });
    }
    
    res.json(capacity);
  } catch (error) {
    console.error('Error getting capacity:', error);
    res.status(500).json({ error: 'Failed to get capacity' });
  }
});

// PUT /api/room-capacity/branch/:branch - Update branch capacity
app.put('/api/room-capacity/branch/:branch', async (req, res) => {
  try {
    const { branch } = req.params;
    const data = req.body;

    const updated = await prisma.branchCapacity.upsert({
      where: { branch: branch as any },
      update: {
        singleCap: data.singleCap || 0,
        doubleCap: data.doubleCap || 0,
        tripleCap: data.tripleCap || 0,
        quardCap: data.quardCap || 0,
        suiteCap: data.suiteCap || 0,
        singleExtraBedCharge: data.singleExtraBedCharge || 0,
        doubleExtraBedCharge: data.doubleExtraBedCharge || 0,
        tripleExtraBedCharge: data.tripleExtraBedCharge || 0,
        quardExtraBedCharge: data.quardExtraBedCharge || 0,
        suiteExtraBedCharge: data.suiteExtraBedCharge || 0,
        updatedAt: new Date(),
      },
      create: {
        branch: branch as any,
        singleCap: data.singleCap || 0,
        doubleCap: data.doubleCap || 0,
        tripleCap: data.tripleCap || 0,
        quardCap: data.quardCap || 0,
        suiteCap: data.suiteCap || 0,
        singleExtraBedCharge: data.singleExtraBedCharge || 0,
        doubleExtraBedCharge: data.doubleExtraBedCharge || 0,
        tripleExtraBedCharge: data.tripleExtraBedCharge || 0,
        quardExtraBedCharge: data.quardExtraBedCharge || 0,
        suiteExtraBedCharge: data.suiteExtraBedCharge || 0,
      },
    });

    res.json({ 
      success: true, 
      message: 'Branch capacity updated successfully',
      data: updated 
    });
  } catch (error) {
    console.error('Error updating capacity:', error);
    res.status(500).json({ error: 'Failed to update capacity' });
  }
});

// GET /api/room-capacity/room-types/:branch - Get room type capacities
app.get('/api/room-capacity/room-types/:branch', async (req, res) => {
  try {
    const { branch } = req.params;
    
    const capacities = await prisma.roomTypeCapacity.findMany({
      where: { branch: branch as any },
      orderBy: { roomType: 'asc' },
    });

    res.json(capacities);
  } catch (error) {
    console.error('Error getting room type capacities:', error);
    res.status(500).json({ error: 'Failed to get room type capacities' });
  }
});

// PUT /api/room-capacity/room-type/:branch/:roomType - Update room type capacity
app.put('/api/room-capacity/room-type/:branch/:roomType', async (req, res) => {
  try {
    const { branch, roomType } = req.params;
    const { totalRooms } = req.body;

    const updated = await prisma.roomTypeCapacity.upsert({
      where: {
        branch_roomType: {
          branch: branch as any,
          roomType: roomType,
        },
      },
      update: {
        totalRooms: totalRooms || 0,
        availableRooms: totalRooms || 0,
        updated_at: new Date(),
      },
      create: {
        branch: branch as any,
        roomType: roomType,
        totalRooms: totalRooms || 0,
        occupiedRooms: 0,
        availableRooms: totalRooms || 0,
      },
    });

    res.json({ 
      success: true, 
      message: 'Room type capacity updated successfully',
      data: updated 
    });
  } catch (error) {
    console.error('Error updating room type capacity:', error);
    res.status(500).json({ error: 'Failed to update room type capacity' });
  }
});

// GET /api/room-capacity/summary - Get summary of all branches
app.get('/api/room-capacity/summary', async (req, res) => {
  try {
    const capacities = await prisma.branchCapacity.findMany();
    const summary = capacities.map(c => ({
      branch: c.branch,
      totalRooms: c.singleCap + c.doubleCap + c.tripleCap + c.quardCap + (c.suiteCap || 0),
      occupiedRooms: 0,
      availableRooms: c.singleCap + c.doubleCap + c.tripleCap + c.quardCap + (c.suiteCap || 0),
      occupancyRate: 0,
    }));

    res.json(summary);
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// GET /api/rooms/branch/:branch - Get rooms for a branch
app.get('/api/rooms/branch/:branch', async (req, res) => {
  try {
    const { branch } = req.params;
    
    const rooms = await prisma.room.findMany({
      where: { branch: branch as any },
      orderBy: { roomNumber: 'asc' },
    });

    res.json(rooms);
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// POST /api/rooms - Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const room = await prisma.room.create({
      data: req.body,
    });
    res.json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ============================================
// ✅ BOOKING ROUTES
// ============================================

// GET /api/bookings - Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const { branch } = req.query;
    const where: any = {};
    
    if (branch) {
      where.OR = [
        { branch: branch as any },
        { branchName: branch as string }
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📋 Found ${bookings.length} bookings${branch ? ` for branch: ${branch}` : ''}`);
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/bookings - Create a new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await prisma.booking.create({
      data: req.body,
    });
    console.log(`✅ Booking created: ${booking.bookingNo} for branch: ${booking.branch}`);
    res.json({ booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id - Update a booking
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.update({
      where: { id },
      data: req.body,
    });
    res.json({ booking });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.booking.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ============================================
// ✅ SCHEDULED TASKS
// ============================================

// Schedule automated checkout
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running scheduled automated checkout check...');
  try {
    await checkoutService.runAutoCheckout();
  } catch (error) {
    console.error('❌ Scheduled checkout failed:', error);
  }
});

cron.schedule('0 12 * * *', async () => {
  console.log('⏰ Running noon checkout processing...');
  try {
    await checkoutService.runAutoCheckout();
  } catch (error) {
    console.error('❌ Noon checkout failed:', error);
  }
});

// ============================================
// ✅ START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Checkout test: http://localhost:${PORT}/api/checkout/test`);
  console.log(`🍽️ Meal plan pricing: http://localhost:${PORT}/api/meal-pricing/current?branch=Pokhara`);
  console.log(`📋 Routes list: http://localhost:${PORT}/api/routes`);
  console.log(`📅 Check-in today: http://localhost:${PORT}/api/checkin/today?branch=Pokhara`);
  console.log(`🔔 Notifications: http://localhost:${PORT}/api/notifications?branch=Pokhara`);
  console.log('🔄 Automated checkout scheduler started (runs every hour and at 12 PM)');
  
  // ✅ Check for missed checkouts on startup
  try {
    console.log('🔄 Checking for missed checkouts on startup...');
    const result = await checkoutService.runAutoCheckout();
    console.log('✅ Startup checkout check completed:', result);
  } catch (error) {
    console.error('❌ Startup checkout check failed:', error);
  }
});