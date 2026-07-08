// src/utils/eventBus.ts

type EventCallback = (data: any) => void;

class EventBus {
  private events: { [key: string]: EventCallback[] };

  constructor() {
    this.events = {};
    
    // Check if we're in the browser
    if (typeof window !== 'undefined') {
      console.log('📡 EventBus initialized on client side');
    }
  }

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    console.log(`📡 Subscribed to event: ${event}`);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
      console.log(`📡 Unsubscribed from event: ${event}`);
    };
  }

  /**
   * Publish an event
   * @param event - Event name
   * @param data - Data to pass to subscribers
   */
  publish(event: string, data: any): void {
    console.log(`📡 Publishing event: ${event}`, data);
    
    // Call local subscribers
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      });
    }
    
    // Also dispatch DOM event for cross-component communication
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = {};
    console.log('📡 All events cleared');
  }

  /**
   * Get all registered events
   */
  getEvents(): { [key: string]: EventCallback[] } {
    return this.events;
  }

  /**
   * Check if event has subscribers
   */
  hasSubscribers(event: string): boolean {
    return this.events[event] && this.events[event].length > 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Helper to listen for events (DOM version)
 */
export const onEvent = (event: string, callback: (data: any) => void): (() => void) => {
  if (typeof window !== 'undefined') {
    const handler = (e: CustomEvent) => callback(e.detail);
    window.addEventListener(event, handler as EventListener);
    console.log(`📡 DOM listener added for: ${event}`);
    return () => {
      window.removeEventListener(event, handler as EventListener);
      console.log(`📡 DOM listener removed for: ${event}`);
    };
  }
  return () => {};
};

/**
 * Helper to emit events (DOM version)
 */
export const emitEvent = (event: string, data: any): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
    console.log(`📡 DOM event emitted: ${event}`, data);
  }
};

/**
 * Event names constants for type safety
 */
export const EVENTS = {
  BOOKING_CREATED: 'bookingCreated',
  BOOKING_UPDATED: 'bookingUpdated',
  BOOKING_DELETED: 'bookingDeleted',
  BOOKING_CHECKED_IN: 'bookingCheckedIn',
  BOOKING_CHECKED_OUT: 'bookingCheckedOut',
  BRANCH_CHANGED: 'branchChanged',
  USER_LOGGED_IN: 'userLoggedIn',
  USER_LOGGED_OUT: 'userLoggedOut',
  DATA_REFRESHED: 'dataRefreshed',
} as const;

export type EventType = typeof EVENTS[keyof typeof EVENTS];