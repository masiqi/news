// src/routes/users.ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { initDB } from "../db";
import { UserService } from "../services/user.service";

const userRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
userRoutes.use('*', async (c, next) => {
  c.set('userService', new UserService(c.env.DB));
  await next();
});

// 获取所有用户（仅管理员可用）
userRoutes.get("/", async (c) => {
  try {
    // 验证管理员权限
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并检查是否为管理员
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证管理员令牌（简化处理）
    // 实际应用中应该使用jwt库验证令牌内容
    try {
      const payload = token.split('.')[1];
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      if (!decodedPayload.includes('"isAdmin":true')) {
        return c.json({ error: "无权限访问" }, 403);
      }
    } catch (e) {
      console.error("令牌解析错误:", e);
      return c.json({ error: "无效的认证令牌" }, 401);
    }

    // 初始化数据库连接
    const db = initDB(c.env.DB);
    
    // 获取所有用户
    const allUsers = await db.select().from(users);
    
    // 返回用户列表（不包含密码哈希）
    const userList = allUsers.map(user => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }));

    return c.json({ 
      users: userList
    }, 200);
  } catch (error) {
    console.error("获取用户列表错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 创建新用户（仅管理员可用）
userRoutes.post("/", async (c) => {
  try {
    // 验证管理员权限
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证管理员令牌
    try {
      const payload = token.split('.')[1];
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      if (!decodedPayload.includes('"isAdmin":true')) {
        return c.json({ error: "无权限访问" }, 403);
      }
    } catch (e) {
      console.error("令牌解析错误:", e);
      return c.json({ error: "无效的认证令牌" }, 401);
    }

    const body = await c.req.json();
    const { email, password } = body;

    // 验证输入
    if (!email || !password) {
      return c.json({ error: "邮箱和密码是必填项" }, 400);
    }

    // 简化的密码哈希处理（实际应用中应该使用bcrypt等库）
    const passwordHash = Buffer.from(password).toString('base64');

    const userService = c.get('userService') as UserService;
    const newUser = await userService.createUser({
      email,
      passwordHash,
      createdAt: new Date(),
    });

    // 返回创建的用户信息（不包含密码哈希）
    const userResponse = {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt
    };

    return c.json({ user: userResponse }, 201);
  } catch (error) {
    console.error("创建用户错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 更新用户（仅管理员可用）
userRoutes.put("/:id", async (c) => {
  try {
    // 验证管理员权限
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证管理员令牌
    try {
      const payload = token.split('.')[1];
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      if (!decodedPayload.includes('"isAdmin":true')) {
        return c.json({ error: "无权限访问" }, 403);
      }
    } catch (e) {
      console.error("令牌解析错误:", e);
      return c.json({ error: "无效的认证令牌" }, 401);
    }

    const userId = parseInt(c.req.param("id"));
    if (isNaN(userId)) {
      return c.json({ error: "无效的用户ID" }, 400);
    }

    const body = await c.req.json();
    const { email, password } = body;

    // 准备更新数据
    const updateData: any = {};
    if (email) {
      updateData.email = email;
    }
    if (password) {
      // 简化的密码哈希处理（实际应用中应该使用bcrypt等库）
      updateData.passwordHash = Buffer.from(password).toString('base64');
    }

    const userService = c.get('userService') as UserService;
    const updatedUser = await userService.updateUser(userId, updateData);
    
    if (!updatedUser) {
      return c.json({ error: "无法更新用户，用户可能不存在" }, 404);
    }

    // 返回更新后的用户信息（不包含密码哈希）
    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt
    };

    return c.json({ user: userResponse }, 200);
  } catch (error) {
    console.error("更新用户错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 删除用户（仅管理员可用）
userRoutes.delete("/:id", async (c) => {
  try {
    // 验证管理员权限
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证管理员令牌
    try {
      const payload = token.split('.')[1];
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      if (!decodedPayload.includes('"isAdmin":true')) {
        return c.json({ error: "无权限访问" }, 403);
      }
    } catch (e) {
      console.error("令牌解析错误:", e);
      return c.json({ error: "无效的认证令牌" }, 401);
    }

    const userId = parseInt(c.req.param("id"));
    if (isNaN(userId)) {
      return c.json({ error: "无效的用户ID" }, 400);
    }

    const userService = c.get('userService') as UserService;
    const deleted = await userService.deleteUser(userId);
    
    if (!deleted) {
      return c.json({ error: "无法删除用户，用户可能不存在" }, 404);
    }

    return c.json({ message: "用户删除成功" }, 200);
  } catch (error) {
    console.error("删除用户错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

export default userRoutes;