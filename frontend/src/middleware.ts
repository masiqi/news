import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 定义受保护的路由
const protectedRoutes = ['/dashboard'];

// 定义不需要缓存的路由（登出后应该无法访问的页面）
const noCacheRoutes = ['/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 检查是否为受保护的路由
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // 如果是受保护的路由，添加缓存控制头
  if (isProtectedRoute) {
    const response = NextResponse.next();
    
    // 添加缓存控制头，防止页面被缓存
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // 检查是否存在有效的JWT令牌
    const token = request.cookies.get('token');
    
    // 如果没有令牌且是受保护的路由，重定向到登录页面
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirected', 'true');
      return NextResponse.redirect(loginUrl);
    }
    
    return response;
  }
  
  // 对于登出后的重定向，确保添加适当的缓存头
  if (pathname.startsWith('/login')) {
    const response = NextResponse.next();
    
    // 如果是登出后的重定向，添加额外的缓存控制
    if (request.nextUrl.searchParams.get('loggedOut') === 'true') {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response;
  }
  
  return NextResponse.next();
}

// 配置匹配器
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
  ],
};