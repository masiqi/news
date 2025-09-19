// webdav-auth.middleware.ts
// WebDAV认证中间件，支持HTTP Basic Auth认证

import { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../routes/auth";

// 扩展Context类型
declare module "hono" {
  interface Context {
    get(key: 'webdavUser'): WebDAVAuthUser | undefined;
    set(key: 'webdavUser', value: WebDAVAuthUser): void;
  }
}

export interface WebDAVAuthUser {
  id: number;
  email: string;
  userPathPrefix: string;
}

/**
 * WebDAV认证中间件
 * 支持HTTP Basic Auth认证，复用现有用户系统
 */
export async function webdavAuthMiddleware(c: Context, next: () => Promise<void>): Promise<Response | void> {
  try {
    console.log(`[WEBDAV_AUTH] 开始认证检查`);
    
    // 获取Authorization头
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.log(`[WEBDAV_AUTH] 缺少或无效的Authorization头`);
      return new Response('Unauthorized', { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      } as ResponseInit);
    }

    // 解析Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      console.log(`[WEBDAV_AUTH] Basic Auth格式错误`);
      return new Response('Invalid credentials format', { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      } as ResponseInit);
    }

    console.log(`[WEBDAV_AUTH] 验证用户: ${username}`);

    // 查询用户
    const db = drizzle(c.env.DB);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, username))
      .get();

    if (!user) {
      console.log(`[WEBDAV_AUTH] 用户不存在: ${username}`);
      return new Response('User not found', { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      } as ResponseInit);
    }

    // 检查用户状态
    if (user.status !== 'active') {
      console.log(`[WEBDAV_AUTH] 用户状态异常: ${user.status}`);
      return new Response('User account is not active', { 
        status: 403
      } as ResponseInit);
    }

    // 验证密码
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      console.log(`[WEBDAV_AUTH] 密码验证失败: ${username}`);
      return new Response('Invalid password', { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      } as ResponseInit);
    }

    // 生成用户路径前缀
    const userPathPrefix = `user-${user.id}/`;
    
    console.log(`[WEBDAV_AUTH] 认证成功，用户ID: ${user.id}, 路径前缀: ${userPathPrefix}`);

    // 将用户信息存储到context中
    const authUser: WebDAVAuthUser = {
      id: user.id,
      email: user.email,
      userPathPrefix
    };
    
    c.set('webdavUser', authUser);
    
    await next();

  } catch (error) {
    console.error(`[WEBDAV_AUTH] 认证过程出错:`, error);
    return new Response('Authentication error', { 
      status: 500,
      'Content-Type': 'text/plain'
    });
  }
}

/**
 * 获取当前认证的用户信息
 */
export function getWebDAVUser(c: Context): WebDAVAuthUser | null {
  return c.get('webdavUser') || null;
}

/**
 * 验证用户是否可以访问指定路径
 */
export function canAccessPath(authUser: WebDAVAuthUser, requestPath: string): boolean {
  // 规范化路径
  const normalizedPath = requestPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const normalizedPrefix = authUser.userPathPrefix.replace(/\/+$/, '');
  
  // 检查路径是否以用户前缀开头
  if (!normalizedPath.startsWith(normalizedPrefix)) {
    console.log(`[WEBDAV_AUTH] 路径访问被拒绝: 用户${authUser.id}试图访问${requestPath}，允许范围：${authUser.userPathPrefix}`);
    return false;
  }
  
  // 检查路径遍历攻击
  if (normalizedPath.includes('..')) {
    console.log(`[WEBDAV_AUTH] 检测到路径遍历攻击: ${requestPath}`);
    return false;
  }
  
  return true;
}

/**
 * 将请求路径转换为R2键
 */
export function pathToR2Key(authUser: WebDAVAuthUser, requestPath: string): string {
  // 移除开头的斜杠并规范化
  const normalizedPath = requestPath.replace(/^\/+/, '').replace(/\/+$/, '');
  
  // 如果路径为空，返回用户根路径
  if (!normalizedPath) {
    return authUser.userPathPrefix;
  }
  
  // 确保路径以用户前缀开头
  if (normalizedPath.startsWith(authUser.userPathPrefix)) {
    return normalizedPath;
  }
  
  // 如果路径没有前缀，添加用户前缀
  return `${authUser.userPathPrefix}${normalizedPath}`;
}

/**
 * 将R2键转换为WebDAV路径
 */
export function r2KeyToPath(authUser: WebDAVAuthUser, r2Key: string): string {
  // 移除用户前缀
  const userPath = r2Key.substring(authUser.userPathPrefix.length);
  
  // 如果为空，返回根路径
  if (!userPath) {
    return '/';
  }
  
  // 确保以斜杠开头
  return `/${userPath}`;
}