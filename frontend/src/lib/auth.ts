import { NextRequest } from 'next/server';

// 定义用户类型
export interface AuthUser {
  id: number;
  email: string;
  token: string;
}

// 从请求中获取认证用户
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // 从cookie中获取token
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return null;
    }

    // 解析JWT令牌获取用户信息
    const userData = parseJwt(token);
    
    if (!userData || !userData.email || !userData.id) {
      return null;
    }

    // 检查令牌是否过期
    if (isTokenExpired(token)) {
      return null;
    }

    return {
      id: userData.id,
      email: userData.email,
      token: token
    };
  } catch (error) {
    console.error('获取认证用户失败:', error);
    return null;
  }
}

// 解析JWT令牌
function parseJwt(token: string): any {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return null;
    }
    
    const base64Url = parts[1];
    
    if (!base64Url) {
      return null;
    }
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('解析JWT令牌失败:', error);
    return null;
  }
}

// 检查令牌是否过期
function isTokenExpired(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') {
      return true;
    }
    
    const parsed = parseJwt(token);
    
    if (!parsed || !parsed.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime > parsed.exp;
  } catch (error) {
    console.error('验证令牌过期时间失败:', error);
    return true;
  }
}