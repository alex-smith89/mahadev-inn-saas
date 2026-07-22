// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  const userStr = request.cookies.get('user')?.value;
  
  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));
  
  // If trying to access public path with token, redirect to dashboard
  if (isPublicPath && token && userStr) {
    try {
      const userData = JSON.parse(decodeURIComponent(userStr));
      if (userData.branches && userData.branches.length > 0) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (e) {
      // Invalid user data, let them login
    }
  }
  
  // If trying to access protected path without token, redirect to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/bookings/:path*',
    '/rooms/:path*',
    '/reports/:path*',
    '/login'
  ]
};