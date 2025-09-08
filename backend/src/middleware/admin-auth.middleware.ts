import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { initDB } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: number;
  email?: string;
  username?: string;
  isAdmin: boolean;
}

export interface AdminContext extends Context {
  user: AuthUser;
}

/**
 * JWT认证中间件 - 验证普通用户和管理员
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response> {
  try {
    // 获取Authorization头
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
    
    // 验证用户是否存在（如果是普通用户）
    if (decoded.email) {
      const db = initDB(c.env.DB);
      const user = await db.select().from(users).where(eq(users.id, decoded.id)).get();
      
      if (!user) {
        return c.json({ error: '用户不存在' }, 401);
      }

      // 将用户信息添加到上下文
      c.set('user', {
        id: decoded.id,
        email: decoded.email,
        isAdmin: false,
      } as AuthUser);
    } else if (decoded.isAdmin) {
      // 管理用户
      c.set('user', {
        id: decoded.id,
        username: decoded.username,
        isAdmin: true,
      } as AuthUser);
    } else {
      return c.json({ error: '无效的令牌格式' }, 401);
    }

    await next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: '无效的认证令牌' }, 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return c.json({ error: '认证令牌已过期' }, 401);
    }
    console.error('认证中间件错误:', error);
    return c.json({ error: '服务器内部错误' }, 500);
  }
}

/**
 * 管理员权限验证中间件 - 仅允许管理员访问
 */
export async function adminAuthMiddleware(c: Context, next: Next): Promise<Response> {
  try {
    // 首先通过普通认证中间件
    await authMiddleware(c, async () => {
      const user = c.get('user') as AuthUser;
      
      if (!user.isAdmin) {
        throw new Error('权限不足');
      }
      
      await next();
    });
  } catch (error) {
    if (error.message === '权限不足') {
      return c.json({ error: '需要管理员权限' }, 403);
    }
    throw error;
  }
}

/**
 * 可选认证中间件 - 不强制要求认证，但如果提供了令牌会进行验证
 */
export async function optionalAuthMiddleware(c: Context, next: Next): Promise<Response> {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      const secret = c.env.JWT_SECRET;
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as any;
          
          if (decoded.email) {
            const db = initDB(c.env.DB);
            const user = await db.select().from(users).where(eq(users.id, decoded.id)).get();
            
            if (user) {
              c.set('user', {
                id: decoded.id,
                email: decoded.email,
                isAdmin: false,
              } as AuthUser);
            }
          } else if (decoded.isAdmin) {
            c.set('user', {
              id: decoded.id,
              username: decoded.username,
              isAdmin: true,
            } as AuthUser);
          }
        } catch (tokenError) {
          // 令牌无效，但不阻止请求继续
          console.warn('可选认证中间件令牌验证失败:', tokenError);
        }
      }
    }
    
    await next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    await next();
  }
}

/**
 * 获取当前认证用户的辅助函数
 */
export function getCurrentUser(c: Context): AuthUser | null {
  return c.get('user') as AuthUser || null;
}

/**
 * 检查用户是否具有管理员权限的辅助函数
 */
export function isAdmin(c: Context): boolean {
  const user = getCurrentUser(c);
  return user?.isAdmin || false;
}

/**
 * 检查用户是否已认证的辅助函数
 */
export function isAuthenticated(c: Context): boolean {
  return getCurrentUser(c) !== null;
}

/**
 * 要求特定权限的中间件生成器
 */
export function requirePermission(permission: string) {
  return async (c: Context, next: Next): Promise<Response> => {
    const user = getCurrentUser(c);
    
    if (!user) {
      return c.json({ error: '需要认证' }, 401);
    }
    
    if (!user.isAdmin) {
      // 这里可以扩展更细粒度的权限控制
      return c.json({ error: `权限不足，需要 ${permission} 权限` }, 403);
    }
    
    await next();
  };
}

/**
 * 记录管理员操作的中间件
 */
export async function adminAuditMiddleware(c: Context, next: Next): Promise<Response> {
  const startTime = Date.now();
  const user = getCurrentUser(c);
  
  if (user && user.isAdmin) {
    const originalMethod = c.req.method;
    const originalUrl = c.req.url;
    
    console.log(`管理员操作开始: ${user.username || user.email} - ${originalMethod} ${originalUrl}`);
    
    try {
      await next();
      
      const duration = Date.now() - startTime;
      const status = c.res.status;
      
      console.log(`管理员操作完成: ${user.username || user.email} - ${originalMethod} ${originalUrl} - ${status} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`管理员操作失败: ${user.username || user.email} - ${originalMethod} ${originalUrl} - ${duration}ms`, error);
      throw error;
    }
  } else {
    await next();
  }
}