import { Context } from 'hono';
import jwt from 'jsonwebtoken';

// 定义用户信息接口
export interface AuthUser {
  id: number;
  email?: string;
  username?: string;
  isAdmin?: boolean;
}

// JWT认证中间件
export const requireAuth = async (c: Context<{ Bindings: CloudflareBindings }>, next: () => Promise<void>) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '未提供有效的认证令牌' }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证JWT令牌
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET环境变量未配置');
      return c.json({ error: '服务器配置错误' }, 500);
    }

    const decoded = jwt.verify(token, secret) as any;
    
    if (!decoded || decoded.id === undefined || decoded.id === null) {
      return c.json({ error: '无效的认证令牌' }, 401);
    }

    // 将用户信息添加到上下文中
    c.set('user', {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      isAdmin: decoded.isAdmin
    });

    await next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: '无效的认证令牌' }, 401);
    }
    return c.json({ error: '认证失败' }, 500);
  }
};

// 管理员认证中间件
export const requireAdmin = async (c: Context<{ Bindings: CloudflareBindings }>, next: () => Promise<void>) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '未提供有效的认证令牌' }, 401);
    }

    const token = authHeader.substring(7);
    
    // 验证JWT令牌
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET环境变量未配置');
      return c.json({ error: '服务器配置错误' }, 500);
    }

    const decoded = jwt.verify(token, secret) as any;
    
    if (!decoded || decoded.id === undefined || decoded.id === null) {
      return c.json({ error: '无效的认证令牌' }, 401);
    }

    // 检查是否是管理员（通过检查用户名或特定字段）
    const isAdmin = decoded.username === 'admin' || decoded.isAdmin === true;
    
    if (!isAdmin) {
      return c.json({ error: '需要管理员权限' }, 403);
    }

    // 将用户信息添加到上下文中
    c.set('user', {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      isAdmin: decoded.isAdmin
    });

    await next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: '无效的认证令牌' }, 401);
    }
    return c.json({ error: '权限验证失败' }, 500);
  }
};

// 获取当前认证用户的辅助函数
export const getAuthUser = (c: Context<{ Bindings: CloudflareBindings }>): AuthUser | null => {
  return c.get('user') || null;
};