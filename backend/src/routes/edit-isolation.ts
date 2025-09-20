// 用户编辑隔离管理API路由
// 提供用户编辑副本管理、编辑历史查看和编辑统计功能

import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { userStorageRefs, users } from '../db/schema';
import { UserEditIsolationService } from '../services/user-edit-isolation.service';

const editIsolationRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 获取用户编辑统计信息
 */
editIsolationRoutes.get("/stats/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const db = drizzle(c.env.DB);
    const isolationService = new UserEditIsolationService(db, c.env);
    
    // 验证用户存在
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1).get();
    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }
    
    const stats = await isolationService.getUserEditStats(userId);
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取用户编辑统计失败:', error);
    return c.json({ 
      error: "获取用户编辑统计失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 获取用户编辑历史
 */
editIsolationRoutes.get("/history/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    
    const db = drizzle(c.env.DB);
    const isolationService = new UserEditIsolationService(db, c.env);
    
    // 验证用户存在
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1).get();
    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }
    
    const { events, total } = await isolationService.getUserEditHistory(userId, limit, offset);
    
    return c.json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取用户编辑历史失败:', error);
    return c.json({ 
      error: "获取用户编辑历史失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 获取用户的编辑副本列表
 */
editIsolationRoutes.get("/copies/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    
    const db = drizzle(c.env.DB);
    
    // 验证用户存在
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1).get();
    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }
    
    // 获取用户的编辑副本
    const copies = await db.select({
      id: userStorageRefs.id,
      originalPath: userStorageRefs.userPath,
      contentHash: userStorageRefs.contentHash,
      fileSize: userStorageRefs.fileSize,
      isModified: userStorageRefs.isModified,
      createdAt: userStorageRefs.createdAt,
      modifiedAt: userStorageRefs.modifiedAt,
      accessCount: userStorageRefs.accessCount,
      lastAccessedAt: userStorageRefs.lastAccessedAt,
      entryId: userStorageRefs.entryId
    })
    .from(userStorageRefs)
    .where(
      and(
        eq(userStorageRefs.userId, userId),
        eq(userStorageRefs.isModified, true)
      )
    )
    .orderBy(desc(userStorageRefs.modifiedAt))
    .limit(limit)
    .offset(offset);
    
    // 获取总数
    const totalCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userStorageRefs)
      .where(
        and(
          eq(userStorageRefs.userId, userId),
          eq(userStorageRefs.isModified, true)
        )
      );
    
    return c.json({
      success: true,
      data: {
        copies,
        pagination: {
          page,
          limit,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取用户编辑副本失败:', error);
    return c.json({ 
      error: "获取用户编辑副本失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 检查用户是否有编辑权限
 */
editIsolationRoutes.post("/check-permission", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, contentHash } = body;
    
    if (!userId || !contentHash) {
      return c.json({ error: "缺少必要参数" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const isolationService = new UserEditIsolationService(db, c.env);
    
    const permission = await isolationService.canEditContent(userId, contentHash);
    
    return c.json({
      success: true,
      data: permission
    });
    
  } catch (error) {
    console.error('检查编辑权限失败:', error);
    return c.json({ 
      error: "检查编辑权限失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 恢复编辑副本到原始状态
 */
editIsolationRoutes.post("/revert/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { copyPath, originalPath } = body;
    
    if (!copyPath || !originalPath) {
      return c.json({ error: "缺少必要参数" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    
    // 验证用户存在
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1).get();
    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }
    
    // 查找编辑副本
    const copyRef = await db.select()
      .from(userStorageRefs)
      .where(
        and(
          eq(userStorageRefs.userId, userId),
          eq(userStorageRefs.userPath, copyPath),
          eq(userStorageRefs.isModified, true)
        )
      )
      .limit(1)
      .get();
    
    if (!copyRef) {
      return c.json({ error: "编辑副本不存在" }, 404);
    }
    
    // 恢复到原始路径和状态
    await db.update(userStorageRefs)
      .set({
        userPath: originalPath,
        isModified: false,
        modifiedAt: null
      })
      .where(eq(userStorageRefs.id, copyRef.id));
    
    console.log(`[EDIT_ISOLATION] 用户${userId}恢复编辑副本: ${copyPath} -> ${originalPath}`);
    
    return c.json({
      success: true,
      message: "编辑副本已恢复到原始状态"
    });
    
  } catch (error) {
    console.error('恢复编辑副本失败:', error);
    return c.json({ 
      error: "恢复编辑副本失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 删除编辑副本（谨慎使用）
 */
editIsolationRoutes.delete("/copy/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const copyPath = c.req.query('path');
    
    if (!copyPath) {
      return c.json({ error: "缺少副本路径参数" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    
    // 验证用户存在
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1).get();
    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }
    
    // 查找并删除编辑副本
    const deleteResult = await db.delete(userStorageRefs)
      .where(
        and(
          eq(userStorageRefs.userId, userId),
          eq(userStorageRefs.userPath, copyPath),
          eq(userStorageRefs.isModified, true)
        )
      )
      .run();
    
    if (deleteResult.changes === 0) {
      return c.json({ error: "编辑副本不存在" }, 404);
    }
    
    console.log(`[EDIT_ISOLATION] 用户${userId}删除编辑副本: ${copyPath}`);
    
    return c.json({
      success: true,
      message: "编辑副本已删除"
    });
    
  } catch (error) {
    console.error('删除编辑副本失败:', error);
    return c.json({ 
      error: "删除编辑副本失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 批量清理过期编辑副本
 */
editIsolationRoutes.post("/cleanup", async (c) => {
  try {
    const body = await c.req.json();
    const { maxAge } = body; // 最大年龄，毫秒
    
    const db = drizzle(c.env.DB);
    const isolationService = new UserEditIsolationService(db, c.env);
    
    const result = await isolationService.cleanupExpiredCopies(maxAge);
    
    return c.json({
      success: true,
      message: "清理完成",
      data: {
        cleaned: result.cleaned,
        errors: result.errors.length,
        errorDetails: result.errors
      }
    });
    
  } catch (error) {
    console.error('清理过期编辑副本失败:', error);
    return c.json({ 
      error: "清理过期编辑副本失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

/**
 * 获取系统级别的编辑隔离统计
 */
editIsolationRoutes.get("/system/stats", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    
    // 获取系统级别的统计信息
    const totalModified = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userStorageRefs)
      .where(eq(userStorageRefs.isModified, true));
    
    const totalStorageUsed = await db.select({ total: sql<number>`SUM(${userStorageRefs.fileSize})` })
      .from(userStorageRefs)
      .where(eq(userStorageRefs.isModified, true));
    
    const usersWithEdits = await db.select({ count: sql<number>`COUNT(DISTINCT ${userStorageRefs.userId})` })
      .from(userStorageRefs)
      .where(eq(userStorageRefs.isModified, true));
    
    // 获取最近的编辑活动
    const recentActivity = await db.select({
      userId: userStorageRefs.userId,
      path: userStorageRefs.userPath,
      modifiedAt: userStorageRefs.modifiedAt,
      fileSize: userStorageRefs.fileSize
    })
    .from(userStorageRefs)
    .where(eq(userStorageRefs.isModified, true))
    .orderBy(desc(userStorageRefs.modifiedAt))
    .limit(10);
    
    return c.json({
      success: true,
      data: {
        summary: {
          totalModifiedCopies: totalModified[0]?.count || 0,
          totalStorageUsed: totalStorageUsed[0]?.total || 0,
          activeUsers: usersWithEdits[0]?.count || 0
        },
        recentActivity
      }
    });
    
  } catch (error) {
    console.error('获取系统编辑隔离统计失败:', error);
    return c.json({ 
      error: "获取系统编辑隔离统计失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

export default editIsolationRoutes;