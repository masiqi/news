// src/routes/system.ts
import { Hono } from "hono";
import { eq, count, sum } from "drizzle-orm";
import { users, sources } from "../db/schema";
import { initDB } from "../db";

const systemRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 系统统计API（仅管理员可用）
systemRoutes.get("/stats", async (c) => {
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

    // 初始化数据库连接
    const db = initDB(c.env.DB);
    
    // 获取用户总数
    const userCountResult = await db.select({ count: count() }).from(users);
    const userCount = userCountResult[0]?.count || 0;
    
    // 获取RSS源总数
    const sourceCountResult = await db.select({ count: count() }).from(sources);
    const sourceCount = sourceCountResult[0]?.count || 0;
    
    // 获取失败源数量（失败次数>=3）
    const failedSourceCountResult = await db.select({ count: count() }).from(sources).where(eq(sources.fetchFailureCount, 3));
    const failedSourceCount = failedSourceCountResult[0]?.count || 0;

    return c.json({ 
      userCount,
      sourceCount,
      failedSourceCount
    }, 200);
  } catch (error) {
    console.error("获取系统统计错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

export default systemRoutes;