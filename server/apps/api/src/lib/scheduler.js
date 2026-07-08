// src/lib/scheduler.js
// ✅ Server-side scheduler

const cron = require('node-cron');
const automationService = require('../services/automationService');

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running scheduled automation...');
  try {
    await automationService.runFullAutomation();
    console.log('✅ Scheduled automation completed');
  } catch (error) {
    console.error('❌ Scheduled automation failed:', error);
  }
});

console.log('✅ Scheduler started');