import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { db } from "../db";
import bcrypt from "bcrypt";
import { R2Service } from "../services/r2.service";

const SALT_ROUNDS = 10;

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

    // 检查邮箱是否已被注册
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return c.json({ error: "该邮箱已被注册" }, 409);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建新用户
    const newUser = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      createdAt: new Date()
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

    return c.json({ 
      message: "注册成功", 
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

export default authRoutes;