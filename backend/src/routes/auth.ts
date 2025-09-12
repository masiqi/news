import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { initDB } from "../db";
import { R2Service } from "../services/r2.service";
import jwt from "jsonwebtoken";

// 简单的JWT令牌黑名单存储（在生产环境中应使用Redis等外部存储）
const tokenBlacklist = new Set<string>();

// 使用Web Crypto API进行密码哈希
async function hashPassword(password: string): Promise<string> {
  // 生成随机盐值
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 将密码和盐值组合
  const encoder = new TextEncoder();
  const data = encoder.encode(password + Array.from(salt).join(''));
  
  // 使用SHA-256进行哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // 将盐值和哈希值组合成字符串存储
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

// 验证密码
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const [saltHex, hashHex] = hashedPassword.split(':');
  
  // 将十六进制盐值转换为字节数组
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  // 将密码和盐值组合
  const encoder = new TextEncoder();
  const data = encoder.encode(password + Array.from(salt).join(''));
  
  // 使用SHA-256进行哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHashHex === hashHex;
}

const authRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 注册端点
authRoutes.post("/register", async (c) => {
  try {
    const { email, password } = await c.req.json();

    // 验证输入
    if (!email || !password) {
      return c.json({ error: "邮箱和密码是必填项" }, 400);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "请输入有效的邮箱地址" }, 400);
    }

    // 验证密码强度
    if (password.length < 8) {
      return c.json({ error: "密码至少需要8位字符" }, 400);
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return c.json({ error: "密码必须包含字母和数字" }, 400);
    }

    // 初始化数据库连接
    const db = initDB(c.env.DB);
    
    // 检查邮箱是否已被注册
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return c.json({ error: "该邮箱已被注册" }, 409);
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);
    
    // 创建新用户
    const newUser = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // 获取创建的用户（注意：D1的RETURNING可能不返回完整数据）
    const user = newUser[0] || await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      return c.json({ error: "注册失败，请稍后再试" }, 500);
    }

    // 创建用户在R2中的存储目录
    const r2Service = new R2Service(c.env);
    const directoryCreated = await r2Service.createUserDirectory(user.id);
    
    if (!directoryCreated) {
      // 如果目录创建失败，可以记录日志但不阻止注册流程
      console.warn(`为用户${user.id}创建R2存储目录失败`);
    }

    // 生成JWT令牌实现自动登录
    const payload = {
      id: user.id,
      email: user.email
    };

    // 使用环境变量中的JWT密钥，如果没有则抛出错误（生产环境必须配置JWT密钥）
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET环境变量未配置");
      return c.json({ error: "服务器配置错误" }, 500);
    }
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    return c.json({ 
      message: "注册成功", 
      token,
      user: { 
        id: user.id, 
        email: user.email 
      } 
    }, 201);
  } catch (error) {
    console.error("注册错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 登录端点
authRoutes.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    // 验证输入
    if (!email || !password) {
      return c.json({ error: "邮箱和密码是必填项" }, 400);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "请输入有效的邮箱地址" }, 400);
    }

    // 初始化数据库连接
    const db = initDB(c.env.DB);
    
    // 查找用户
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      // 为了安全，不透露具体错误原因
      return c.json({ error: "邮箱或密码错误" }, 401);
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      // 为了安全，不透露具体错误原因
      return c.json({ error: "邮箱或密码错误" }, 401);
    }

    // 生成JWT令牌
    const payload = {
      id: user.id,
      email: user.email
    };

    // 使用环境变量中的JWT密钥，如果没有则抛出错误（生产环境必须配置JWT密钥）
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET环境变量未配置");
      return c.json({ error: "服务器配置错误" }, 500);
    }
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    return c.json({ 
      message: "登录成功",
      token,
      user: { 
        id: user.id, 
        email: user.email 
      } 
    }, 200);
  } catch (error) {
    console.error("登录错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 管理员登录端点
authRoutes.post("/admin-login", async (c) => {
  try {
    const { username, password } = await c.req.json();

    // 验证输入
    if (!username || !password) {
      return c.json({ error: "用户名和密码是必填项" }, 400);
    }

    // 从环境变量获取管理员凭证
    const adminUsername = c.env.ADMIN_USERNAME || 'admin';
    const adminPassword = c.env.ADMIN_PASSWORD || 'admin123';

    // 验证管理员凭证
    if (username !== adminUsername || password !== adminPassword) {
      return c.json({ error: "用户名或密码错误" }, 401);
    }

    // 生成管理员JWT令牌
    const payload = {
      id: 0, // 管理员ID为0
      username: username,
      isAdmin: true
    };

    // 使用环境变量中的JWT密钥
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET环境变量未配置");
      return c.json({ error: "服务器配置错误" }, 500);
    }
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    return c.json({ 
      message: "管理员登录成功",
      token,
      user: { 
        id: 0,
        username: username,
        isAdmin: true
      } 
    }, 200);
  } catch (error) {
    console.error("管理员登录错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 登出端点
authRoutes.post("/logout", async (c) => {
  try {
    // 获取JWT令牌
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证令牌是否已在黑名单中
    if (tokenBlacklist.has(token)) {
      return c.json({ error: "令牌已失效" }, 401);
    }

    // 将令牌添加到黑名单中
    tokenBlacklist.add(token);

    // 在实际应用中，这里还应该：
    // 1. 记录登出事件用于审计
    // 2. 如果使用刷新令牌，也应清除刷新令牌

    return c.json({ 
      message: "登出成功" 
    }, 200);
  } catch (error) {
    console.error("登出错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

export default authRoutes;