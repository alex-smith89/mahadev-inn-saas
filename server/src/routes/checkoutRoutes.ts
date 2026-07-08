import { Router } from 'express';
import { CheckoutService } from '../services/checkoutService';
import { PrismaClient } from '@prisma/client';

// ✅ Use Router from express
const router = Router();
const checkoutService = new CheckoutService();
const prisma = new PrismaClient();

// Get today's checkouts
router.get('/today', async (req, res) => {
  try {
    const checkouts = await checkoutService.checkTodayCheckouts();
    res.json({ success: true, data: checkouts });
  } catch (error) {
    console.error('Error getting today\'s checkouts:', error);
    res.status(500).json({ success: false, error: 'Failed to get today\'s checkouts' });
  }
});

// Get upcoming checkouts (24-48 hours)
router.get('/upcoming', async (req, res) => {
  try {
    const checkouts = await checkoutService.checkUpcomingCheckouts();
    res.json({ success: true, data: checkouts });
  } catch (error) {
    console.error('Error getting upcoming checkouts:', error);
    res.status(500).json({ success: false, error: 'Failed to get upcoming checkouts' });
  }
});

// Run automated checkout
router.post('/run-auto-checkout', async (req, res) => {
  try {
    console.log('📥 Received auto checkout request');
    
    if (!checkoutService || typeof checkoutService.runAutoCheckout !== 'function') {
      console.error('❌ Checkout service not available');
      return res.status(503).json({ 
        success: false, 
        error: 'Checkout service not available' 
      });
    }
    
    const result = await checkoutService.runAutoCheckout();
    console.log('✅ Auto checkout result:', result);
    
    res.json({ 
      success: true, 
      ...result,
      message: `Processed ${result.processed || 0} checkouts, sent ${result.reminders || 0} reminders`
    });
  } catch (error: any) {
    console.error('❌ Error running auto checkout:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to run automated checkout',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get vacant rooms for cleanup
router.get('/vacant-rooms', async (req, res) => {
  try {
    const { branch } = req.query;
    const vacantRooms = await checkoutService.getVacantRooms(branch as string);
    res.json({ success: true, data: vacantRooms });
  } catch (error) {
    console.error('Error getting vacant rooms:', error);
    res.status(500).json({ success: false, error: 'Failed to get vacant rooms' });
  }
});

// Mark room as cleaned
router.post('/mark-cleaned', async (req, res) => {
  try {
    const { bookingId, branch } = req.body;
    
    await prisma.notification.create({
      data: {
        type: 'ROOM_CLEANED',
        title: '🧹 Room Cleaned',
        message: `Room has been cleaned and is now ready for next guest.`,
        branch: branch || 'Main',
        bookingId: bookingId,
        isRead: false,
      },
    });
    
    res.json({ success: true, message: 'Room marked as cleaned' });
  } catch (error) {
    console.error('Error marking room as cleaned:', error);
    res.status(500).json({ success: false, error: 'Failed to mark room as cleaned' });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Checkout routes are working!',
    timestamp: new Date().toISOString(),
    serviceAvailable: !!checkoutService
  });
});

export default router;