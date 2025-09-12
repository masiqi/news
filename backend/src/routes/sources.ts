// src/routes/sources.ts
import { Hono } from "hono";
import { eq, and, or, desc } from "drizzle-orm";
import { sources, rssEntries, processedContents } from "../db/schema";
import { SourceService } from "../services/source.service";
import { ContentCacheService } from "../services/content-cache.service";
import { RssSchedulerService } from "../services/rss-scheduler.service";
import { requireAuth, getAuthUser } from "../middleware/auth";
import type { Source, NewSource } from "../db/types";

const sourceRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
sourceRoutes.use('*', async (c, next) => {
  c.set('sourceService', new SourceService(c.env.DB));
  c.set('contentCacheService', new ContentCacheService(c.env.DB));
  c.set('rssSchedulerService', new RssSchedulerService(c.env.DB, c.env.RSS_FETCHER_QUEUE));
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
sourceRoutes.get("/my", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceService = c.get('sourceService') as SourceService;
    const userSources = await sourceService.getUserSources(user.id);
    return c.json({ sources: userSources }, 200);
  } catch (error) {
    console.error("获取用户RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 创建新的RSS源
sourceRoutes.post("/", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const body = await c.req.json();
    const { url, name, description, isPublic } = body;

    // 验证输入
    if (!url || !name) {
      return c.json({ error: "URL和名称是必填项" }, 400);
    }

    const newSource: NewSource = {
      userId: user.id,
      url,
      name,
      description: description || null,
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
sourceRoutes.post("/:id/copy", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const sourceService = c.get('sourceService') as SourceService;
    const copiedSource = await sourceService.copySource(sourceId, user.id);
    
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
sourceRoutes.put("/:id", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const body = await c.req.json();
    const { url, name, description, isPublic } = body;

    const sourceService = c.get('sourceService') as SourceService;
    const updatedSource = await sourceService.updateSource(sourceId, { url, name, description, isPublic }, user.id);
    
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
sourceRoutes.delete("/:id", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    const sourceService = c.get('sourceService') as SourceService;
    const deleted = await sourceService.deleteSource(sourceId, user.id);
    
    if (!deleted) {
      return c.json({ error: "无法删除源，源可能不存在或无权限" }, 404);
    }

    return c.json({ message: "源删除成功" }, 200);
  } catch (error) {
    console.error("删除RSS源错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 手动触发RSS源抓取
sourceRoutes.post("/:id/trigger-fetch", requireAuth, async (c) => {
  try {
    console.log(`后端API: 收到RSS源触发获取请求`);
    
    const user = getAuthUser(c);
    if (!user) {
      console.log(`后端API: 用户未认证`);
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      console.log(`后端API: 无效的源ID: ${c.req.param("id")}`);
      return c.json({ error: "无效的源ID" }, 400);
    }

    console.log(`后端API: 用户 ${user.email} 请求触发RSS源 ${sourceId} 获取`);

    const rssSchedulerService = c.get('rssSchedulerService') as RssSchedulerService;
    const success = await rssSchedulerService.triggerSourceFetch(sourceId);
    
    if (!success) {
      console.log(`后端API: 触发RSS源 ${sourceId} 获取失败`);
      return c.json({ error: "无法触发抓取，源可能不存在" }, 404);
    }

    console.log(`后端API: 成功触发RSS源 ${sourceId} 获取`);
    return c.json({ message: "手动抓取已触发", sourceId }, 200);
  } catch (error) {
    console.error("后端API: 触发RSS源抓取错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 获取RSS源的抓取内容列表
sourceRoutes.get("/:id/entries", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    const sourceId = parseInt(c.req.param("id"));
    if (isNaN(sourceId)) {
      return c.json({ error: "无效的源ID" }, 400);
    }

    // 获取分页参数
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("perPage") || "10");
    const offset = (page - 1) * perPage;

    const contentCacheService = c.get('contentCacheService') as ContentCacheService;
    
    // 获取RSS条目和处理后的内容
    const entries = await contentCacheService.getSourceEntries(sourceId, perPage, offset);
    const totalCount = await contentCacheService.getSourceEntriesCount(sourceId);
    
    return c.json({ 
      entries, 
      pagination: {
        page,
        perPage,
        total: totalCount,
        pages: Math.ceil(totalCount / perPage)
      }
    }, 200);
  } catch (error) {
    console.error("获取RSS源条目错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

// 获取所有RSS条目（管理后台用）
sourceRoutes.get("/entries/all", requireAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: "用户未认证" }, 401);
    }

    // 获取分页参数
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("perPage") || "20");
    const offset = (page - 1) * perPage;

    const contentCacheService = c.get('contentCacheService') as ContentCacheService;
    
    // 获取所有RSS条目
    const entries = await contentCacheService.getAllEntries(perPage, offset);
    const totalCount = await contentCacheService.getAllEntriesCount();
    
    return c.json({ 
      entries, 
      pagination: {
        page,
        perPage,
        total: totalCount,
        pages: Math.ceil(totalCount / perPage)
      }
    }, 200);
  } catch (error) {
    console.error("获取所有RSS条目错误:", error);
    return c.json({ error: "服务器内部错误" }, 500);
  }
});

export default sourceRoutes;