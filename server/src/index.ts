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

// ✅ Register routes
app.use('/api/checkout', checkoutRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meal-pricing', mealPricingRoutes);

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ✅ Test endpoint for checkout
app.get('/api/checkout/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Checkout routes are working',
    timestamp: new Date().toISOString()
  });
});

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

// Booking routes
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

// Room capacity routes
app.get('/api/room-capacity/branch/:branch', async (req, res) => {
  try {
    const { branch } = req.params;
    const capacity = await prisma.branchCapacity.findFirst({
      where: { branch: branch as any },
    });
    res.json(capacity || { branch, singleCap: 10, doubleCap: 10, tripleCap: 5, quardCap: 5 });
  } catch (error) {
    console.error('Error getting capacity:', error);
    res.status(500).json({ error: 'Failed to get capacity' });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Checkout test: http://localhost:${PORT}/api/checkout/test`);
  console.log(`🍽️ Meal plan pricing: http://localhost:${PORT}/api/meal-pricing/current?branch=Pokhara`);
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