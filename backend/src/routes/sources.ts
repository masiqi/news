// src/routes/sources.ts
import { Hono } from "hono";
import { eq, and, or } from "drizzle-orm";
import { sources } from "../db/schema";
import { SourceService } from "../services/source.service";
import { ContentCacheService } from "../services/content-cache.service";
import type { Source, NewSource } from "../db/types";

const sourceRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
sourceRoutes.use('*', async (c, next) => {
  c.set('sourceService', new SourceService(c.env.DB));
  c.set('contentCacheService', new ContentCacheService(c.env.DB));
  await next();
});

// 获取所有公共RSS源
sourceRoutes.get("/public", async (c) => {
  try {
    const sourceService = c.get('sourceService') as SourceService;
    const publicSources = await sourceService.getPublicSources();
    return c.json({ sources: publicSources }, 200);
  } catch (error) {
    console.error("获取公共RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 获取当前用户的所有RSS源
sourceRoutes.get("/my", async (c) => {
  try {
    // 从JWT令牌中获取用户ID
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并提取用户ID
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const userId = 1; // 示例用户ID，实际应该从令牌中提取

    const sourceService = c.get('sourceService') as SourceService;
    const userSources = await sourceService.getUserSources(userId);
    return c.json({ sources: userSources }, 200);
  } catch (error) {
    console.error("获取用户RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 创建新的RSS源
sourceRoutes.post("/", async (c) => {
  try {
    // 从JWT令牌中获取用户ID
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并提取用户ID
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const userId = 1; // 示例用户ID，实际应该从令牌中提取

    const body = await c.req.json();
    const { url, name, isPublic } = body;

    // 验证输入
    if (!url || !name) {
      return c.json({ error: "URL和名称是必填项" }, 400);
    }

    const newSource: NewSource = {
      userId,
      url,
      name,
      isPublic: isPublic || false,
      createdAt: new Date(),
    };

    const sourceService = c.get('sourceService') as SourceService;
    const source = await sourceService.createSource(newSource);
    return c.json({ source }, 201);
  } catch (error) {
    console.error("创建RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 复制公共RSS源到用户账户
sourceRoutes.post("/:id/copy", async (c) => {
  try {
    // 从JWT令牌中获取用户ID
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并提取用户ID
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const userId = 1; // 示例用户ID，实际应该从令牌中提取

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const sourceService = c.get('sourceService') as SourceService;
    const copiedSource = await sourceService.copySource(sourceId, userId);
    
    if (!copiedSource) {
      return c.json({ error: "无法复制源，源可能不存在或不是公共源" }, 404);
    }

    return c.json({ source: copiedSource }, 201);
  } catch (error) {
    console.error("复制RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 更新RSS源
sourceRoutes.put("/:id", async (c) => {
  try {
    // 从JWT令牌中获取用户ID
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并提取用户ID
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const userId = 1; // 示例用户ID，实际应该从令牌中提取

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const body = await c.req.json();
    const { url, name, isPublic } = body;

    const sourceService = c.get('sourceService') as SourceService;
    const updatedSource = await sourceService.updateSource(sourceId, { url, name, isPublic }, userId);
    
    if (!updatedSource) {
      return c.json({ error: "无法更新源，源可能不存在或无权限" }, 404);
    }

    return c.json({ source: updatedSource }, 200);
  } catch (error) {
    console.error("更新RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 删除RSS源
sourceRoutes.delete("/:id", async (c) => {
  try {
    // 从JWT令牌中获取用户ID
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "未提供有效的认证令牌" }, 401);
    }

    // 这里应该验证JWT令牌并提取用户ID
    // 简化处理，实际应用中应该使用jwt库验证令牌
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const userId = 1; // 示例用户ID，实际应该从令牌中提取

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const sourceService = c.get('sourceService') as SourceService;
    const deleted = await sourceService.deleteSource(sourceId, userId);
    
    if (!deleted) {
      return c.json({ error: "无法删除源，源可能不存在或无权限" }, 404);
    }

    return c.json({ message: "源删除成功" }, 200);
  } catch (error) {
    console.error("删除RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

export default sourceRoutes;