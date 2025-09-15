// 用户访问控制API路由
// 提供用户R2访问配置的创建、管理和查询功能

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { jwt } from 'hono/jwt';
import { 
  userR2Access, 
  r2Permissions, 
  r2AccessLogs, 
  userDirectoryQuotas,
  accessTokens,
  users 
} from '../db/schema';
import { AccessControlService, type R2Permission } from '../services/access-control.service';
import { requireAuth as authMiddleware } from '../middleware/auth';

// 创建路由
const userAccessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
const initializeServices = (c: any) => {
  const db = drizzle(c.env.DB);
  const accessControlService = new AccessControlService(c.env.DB);
  return { db, accessControlService };
};

/**
 * 获取用户R2访问配置
 */
userAccessRoutes.get('/user/r2-access', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    console.log(`获取用户 ${userId} 的R2访问配置`);

    const accessConfig = await accessControlService.getUserAccess(userId);

    if (!accessConfig) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限',
        access: null
      }, 404);
    }

    return c.json({
      success: true,
      message: '获取成功',
      access: accessConfig
    });

  } catch (error) {
    console.error('获取用户R2访问配置失败:', error);
    return c.json({
      success: false,
      message: '获取用户访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 创建用户R2访问配置
 */
userAccessRoutes.post('/user/r2-access', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    const body = await c.req.json();
    const {
      bucketName,
      region = 'auto',
      endpoint,
      permissions,
      maxStorageBytes,
      maxFileCount,
      isReadonly,
      expiresInSeconds
    } = body;

    // 验证必填字段
    if (!bucketName || !endpoint) {
      return c.json({
        success: false,
        message: 'bucketName 和 endpoint 为必填字段'
      }, 400);
    }

    console.log(`用户 ${userId} 创建R2访问配置`);

    // 检查用户是否已有访问配置
    const existingAccess = await accessControlService.getUserAccess(userId);
    if (existingAccess) {
      return c.json({
        success: false,
        message: '用户已有R2访问配置，请先删除现有配置'
      }, 409);
    }

    // 创建访问配置
    const accessConfig = await accessControlService.createUserAccess(userId, {
      bucketName,
      region,
      endpoint,
      permissions,
      maxStorageBytes,
      maxFileCount,
      isReadonly,
      expiresInSeconds
    });

    return c.json({
      success: true,
      message: 'R2访问配置创建成功',
      access: accessConfig
    }, 201);

  } catch (error) {
    console.error('创建用户R2访问配置失败:', error);
    return c.json({
      success: false,
      message: '创建访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 更新用户R2访问配置
 */
userAccessRoutes.put('/user/r2-access', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    const body = await c.req.json();
    const {
      permissions,
      maxStorageBytes,
      maxFileCount,
      isReadonly,
      expiresInSeconds
    } = body;

    console.log(`更新用户 ${userId} 的R2访问配置`);

    // 获取现有配置
    const existingAccess = await accessControlService.getUserAccess(userId);
    if (!existingAccess) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限'
      }, 404);
    }

    // 计算新的过期时间
    const expiresAt = expiresInSeconds 
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : existingAccess.expiresAt;

    // 更新访问配置
    await db.update(userR2Access)
      .set({
        permissionsJson: JSON.stringify(permissions || existingAccess.permissions),
        maxStorageBytes: maxStorageBytes || existingAccess.maxStorageBytes,
        maxFileCount: maxFileCount || existingAccess.maxFileCount,
        isReadonly: isReadonly !== undefined ? isReadonly : existingAccess.isReadonly,
        expiresAt,
        updatedAt: new Date()
      })
      .where(eq(userR2Access.userId, userId));

    // 更新配额
    if (maxStorageBytes || maxFileCount) {
      await db.update(userDirectoryQuotas)
        .set({
          maxStorageBytes: maxStorageBytes || existingAccess.maxStorageBytes,
          maxFileCount: maxFileCount || existingAccess.maxFileCount,
          lastUpdated: new Date()
        })
        .where(eq(userDirectoryQuotas.userId, userId));
    }

    // 更新权限记录
    if (permissions) {
      // 删除现有权限
      await db.delete(r2Permissions)
        .where(eq(r2Permissions.accessId, parseInt(existingAccess.id)));

      // 添加新权限
      for (const permission of permissions) {
        await db.insert(r2Permissions).values({
          accessId: parseInt(existingAccess.id),
          resourcePattern: permission.resource,
          actions: JSON.stringify(permission.actions),
          conditions: permission.conditions ? JSON.stringify(permission.conditions) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 获取更新后的配置
    const updatedAccess = await accessControlService.getUserAccess(userId);

    return c.json({
      success: true,
      message: 'R2访问配置更新成功',
      access: updatedAccess
    });

  } catch (error) {
    console.error('更新用户R2访问配置失败:', error);
    return c.json({
      success: false,
      message: '更新访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 删除用户R2访问配置
 */
userAccessRoutes.delete('/user/r2-access', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    console.log(`删除用户 ${userId} 的R2访问配置`);

    // 获取现有配置
    const existingAccess = await accessControlService.getUserAccess(userId);
    if (!existingAccess) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限'
      }, 404);
    }

    // 标记为非激活状态（软删除）
    await db.update(userR2Access)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(userR2Access.userId, userId));

    // 撤销所有访问令牌
    await db.update(accessTokens)
      .set({
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(eq(accessTokens.userId, userId));

    return c.json({
      success: true,
      message: 'R2访问配置已删除'
    });

  } catch (error) {
    console.error('删除用户R2访问配置失败:', error);
    return c.json({
      success: false,
      message: '删除访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 创建访问令牌
 */
userAccessRoutes.post('/user/r2-access/tokens', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    const body = await c.req.json();
    const {
      scope = 'r2:read',
      expiresInSeconds,
      ipWhitelist
    } = body;

    console.log(`用户 ${userId} 创建访问令牌`);

    // 获取用户访问配置
    const accessConfig = await accessControlService.getUserAccess(userId);
    if (!accessConfig) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限'
      }, 404);
    }

    // 创建访问令牌
    const tokenConfig = await accessControlService.createAccessToken(
      userId,
      parseInt(accessConfig.id),
      {
        scope,
        expiresInSeconds,
        ipWhitelist
      }
    );

    return c.json({
      success: true,
      message: '访问令牌创建成功',
      token: tokenConfig
    }, 201);

  } catch (error) {
    console.error('创建访问令牌失败:', error);
    return c.json({
      success: false,
      message: '创建访问令牌失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取用户的访问令牌列表
 */
userAccessRoutes.get('/user/r2-access/tokens', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    console.log(`获取用户 ${userId} 的访问令牌列表`);

    // 获取用户的访问令牌
    const tokens = await db.select({
      id: accessTokens.id,
      tokenType: accessTokens.tokenType,
      scope: accessTokens.scope,
      expiresAt: accessTokens.expiresAt,
      isRevoked: accessTokens.isRevoked,
      usageCount: accessTokens.usageCount,
      lastUsedAt: accessTokens.lastUsedAt,
      ipWhitelist: accessTokens.ipWhitelist,
      createdAt: accessTokens.createdAt,
      updatedAt: accessTokens.updatedAt
    })
    .from(accessTokens)
    .where(eq(accessTokens.userId, userId))
    .orderBy(desc(accessTokens.createdAt))
    .all();

    // 解析IP白名单
    const formattedTokens = tokens.map(token => ({
      ...token,
      ipWhitelist: token.ipWhitelist ? JSON.parse(token.ipWhitelist) : undefined
    }));

    return c.json({
      success: true,
      message: '获取成功',
      tokens: formattedTokens
    });

  } catch (error) {
    console.error('获取用户访问令牌失败:', error);
    return c.json({
      success: false,
      message: '获取访问令牌失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 撤销访问令牌
 */
userAccessRoutes.delete('/user/r2-access/tokens/:tokenId', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);
    const tokenId = parseInt(c.req.param('tokenId'));

    console.log(`用户 ${userId} 撤销访问令牌 ${tokenId}`);

    // 验证令牌所有权
    const token = await db.select()
      .from(accessTokens)
      .where(and(
        eq(accessTokens.id, tokenId),
        eq(accessTokens.userId, userId)
      ))
      .get();

    if (!token) {
      return c.json({
        success: false,
        message: '令牌不存在或不属于当前用户'
      }, 404);
    }

    // 撤销令牌
    await db.update(accessTokens)
      .set({
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(eq(accessTokens.id, tokenId));

    return c.json({
      success: true,
      message: '访问令牌已撤销'
    });

  } catch (error) {
    console.error('撤销访问令牌失败:', error);
    return c.json({
      success: false,
      message: '撤销访问令牌失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取访问统计
 */
userAccessRoutes.get('/user/r2-access/statistics', authMiddleware, async (c) => {
  try {
    const { accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    console.log(`获取用户 ${userId} 的访问统计`);

    const statistics = await accessControlService.getAccessStatistics(userId);

    // 获取配额信息
    const quota = await accessControlService.getUserAccess(userId);
    const quotaInfo = quota ? {
      maxStorageBytes: quota.maxStorageBytes,
      currentStorageBytes: quota.currentStorageBytes,
      maxFileCount: quota.maxFileCount,
      currentFileCount: quota.currentFileCount,
      storageUsagePercent: Math.round((quota.currentStorageBytes / quota.maxStorageBytes) * 100),
      fileUsagePercent: Math.round((quota.currentFileCount / quota.maxFileCount) * 100)
    } : null;

    return c.json({
      success: true,
      message: '获取成功',
      statistics: {
        ...statistics,
        quota: quotaInfo
      }
    });

  } catch (error) {
    console.error('获取访问统计失败:', error);
    return c.json({
      success: false,
      message: '获取访问统计失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取访问日志
 */
userAccessRoutes.get('/user/r2-access/logs', authMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log(`获取用户 ${userId} 的访问日志`);

    // 获取访问日志
    const logs = await db.select({
      id: r2AccessLogs.id,
      operation: r2AccessLogs.operation,
      resourcePath: r2AccessLogs.resourcePath,
      resourceSize: r2AccessLogs.resourceSize,
      statusCode: r2AccessLogs.statusCode,
      responseTime: r2AccessLogs.responseTime,
      bytesTransferred: r2AccessLogs.bytesTransferred,
      ipAddress: r2AccessLogs.ipAddress,
      userAgent: r2AccessLogs.userAgent,
      errorMessage: r2AccessLogs.errorMessage,
      timestamp: r2AccessLogs.timestamp
    })
    .from(r2AccessLogs)
    .where(eq(r2AccessLogs.userId, userId))
    .orderBy(desc(r2AccessLogs.timestamp))
    .limit(limit)
    .offset(offset)
    .all();

    // 获取总数
    const totalCount = await db.select({ count: r2AccessLogs.id })
      .from(r2AccessLogs)
      .where(eq(r2AccessLogs.userId, userId))
      .all();

    return c.json({
      success: true,
      message: '获取成功',
      logs: logs,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        totalPages: Math.ceil(totalCount.length / limit)
      }
    });

  } catch (error) {
    console.error('获取访问日志失败:', error);
    return c.json({
      success: false,
      message: '获取访问日志失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 验证访问配置的健康状态
 */
userAccessRoutes.get('/user/r2-access/health', authMiddleware, async (c) => {
  try {
    const { accessControlService } = initializeServices(c);
    const user = c.get('user');
    const userId = parseInt(user.id);

    console.log(`检查用户 ${userId} 的访问配置健康状态`);

    const accessConfig = await accessControlService.getUserAccess(userId);

    if (!accessConfig) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限',
        health: {
          status: 'not_configured',
          details: {
            reason: '用户未配置R2访问权限'
          }
        }
      });
    }

    // 检查配置状态
    const now = new Date();
    const isExpired = accessConfig.expiresAt && now > accessConfig.expiresAt;
    const isStorageFull = accessConfig.currentStorageBytes >= accessConfig.maxStorageBytes;
    const isFileLimitReached = accessConfig.currentFileCount >= accessConfig.maxFileCount;

    const health = {
      status: isExpired ? 'expired' : isStorageFull ? 'storage_full' : isFileLimitReached ? 'file_limit_reached' : 'healthy',
      details: {
        isExpired,
        isStorageFull,
        isFileLimitReached,
        storageUsage: {
          used: accessConfig.currentStorageBytes,
          limit: accessConfig.maxStorageBytes,
          percentage: Math.round((accessConfig.currentStorageBytes / accessConfig.maxStorageBytes) * 100)
        },
        fileUsage: {
          used: accessConfig.currentFileCount,
          limit: accessConfig.maxFileCount,
          percentage: Math.round((accessConfig.currentFileCount / accessConfig.maxFileCount) * 100)
        },
        expiresAt: accessConfig.expiresAt,
        lastUsedAt: accessConfig.lastUsedAt
      }
    };

    return c.json({
      success: true,
      message: '健康状态检查完成',
      health
    });

  } catch (error) {
    console.error('检查访问配置健康状态失败:', error);
    return c.json({
      success: false,
      message: '健康状态检查失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default userAccessRoutes;