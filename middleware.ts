import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  // 检查用户是否需要引导流程
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('获取引导状态失败');
      return NextResponse.next();
    }

    const data = await response.json();
    
    // 如果没有状态记录或者状态不是completed/skipped，则重定向到引导流程
    if (!data.status || !['completed', 'skipped'].includes(data.status.step)) {
      const url = new URL('/onboarding', request.url);
      url.searchParams.set('returnTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('检查引导状态时出错:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/dashboard', '/sources', '/topics'], // 需要检查引导状态的页面
};