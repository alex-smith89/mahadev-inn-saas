// src/services/auth.service.ts

export class AuthService {
  private static instance: AuthService;
  private tokenCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;
      if (exp && Date.now() >= exp * 1000) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
    window.location.href = '/login';
  }

  async refreshToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;
      
      // In a real app, you would call a refresh endpoint
      // For now, just check if token is valid
      return this.isAuthenticated();
    } catch {
      return false;
    }
  }

  getAuthHeaders(): { Authorization: string } | {} {
    const token = this.getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  startTokenCheck(intervalMs: number = 60000): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }
    this.tokenCheckInterval = setInterval(() => {
      if (this.isAuthenticated()) {
        const token = this.getToken();
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp;
            const now = Math.floor(Date.now() / 1000);
            if (exp && exp - now < 300) {
              console.log('⏰ Token expiring soon, refreshing...');
              this.refreshToken();
            }
          } catch (e) {
            console.error('Error checking token expiry:', e);
          }
        }
      }
    }, intervalMs);
  }

  stopTokenCheck(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
  }
}

export const authService = AuthService.getInstance();