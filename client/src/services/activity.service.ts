// src/services/activity.service.ts

export interface Activity {
  id: string;
  type: 'booking' | 'checkin' | 'checkout' | 'payment';
  message: string;
  time: string;
  timestamp: number;
}

class ActivityService {
  private activities: Activity[] = [];
  private listeners: ((activities: Activity[]) => void)[] = [];
  private isClient: boolean;

  constructor() {
    // ✅ Check if running in browser
    this.isClient = typeof window !== 'undefined';
    
    // Only load from localStorage if in browser
    if (this.isClient) {
      this.loadFromStorage();
    }
  }

  // ✅ Safe storage access
  private loadFromStorage() {
    if (!this.isClient) return;
    
    try {
      const stored = localStorage.getItem('activities');
      if (stored) {
        this.activities = JSON.parse(stored);
        console.log('📋 Loaded activities from storage:', this.activities.length);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  }

  private saveToStorage() {
    if (!this.isClient) return;
    
    try {
      localStorage.setItem('activities', JSON.stringify(this.activities));
    } catch (error) {
      console.error('Failed to save activities:', error);
    }
  }

  addActivity(type: Activity['type'], message: string) {
    const activity: Activity = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      type,
      message,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
    };

    this.activities.unshift(activity);

    // Keep only last 50 activities
    if (this.activities.length > 50) {
      this.activities = this.activities.slice(0, 50);
    }

    this.saveToStorage();
    this.notifyListeners();
    
    return activity;
  }

  addBookingActivity(booking: any) {
    const message = `📋 New booking: ${booking.bookingNo} - ${booking.agentName}`;
    return this.addActivity('booking', message);
  }

  addCheckinActivity(booking: any) {
    const message = `✅ Check-in: ${booking.bookingNo} - ${booking.agentName}`;
    return this.addActivity('checkin', message);
  }

  addCheckoutActivity(booking: any) {
    const message = `📤 Check-out: ${booking.bookingNo} - ${booking.agentName}`;
    return this.addActivity('checkout', message);
  }

  addPaymentActivity(booking: any, amount: number) {
    const message = `💰 Payment: ${booking.bookingNo} - ${booking.agentName} (Rs. ${amount})`;
    return this.addActivity('payment', message);
  }

  getRecentActivities(limit: number = 10): Activity[] {
    return this.activities.slice(0, limit);
  }

  getAllActivities(): Activity[] {
    return this.activities;
  }

  clearActivities() {
    this.activities = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(callback: (activities: Activity[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.activities));
  }
}

// ✅ Create singleton instance only on client side
export const activityService = new ActivityService();