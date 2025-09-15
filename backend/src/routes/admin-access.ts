// 管理员访问控制API路由
// 提供管理员对用户R2访问配置的管理和监控功能

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, or, isNull, gt, lt } from 'drizzle-orm';
import { jwt } from 'hono/jwt';
import { 
  userR2Access, 
  r2Permissions, 
  r2AccessLogs, 
  userDirectoryQuotas,
  accessTokens,
  r2AuditLogs,
  users 
} from '../db/schema';
import { AccessControlService, type R2Permission } from '../services/access-control.service';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';

// 创建路由
const adminAccessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
const initializeServices = (c: any) => {
  const db = drizzle(c.env.DB);
  const accessControlService = new AccessControlService(c.env.DB);
  return { db, accessControlService };
};

/**
 * 获取所有用户访问配置
 */
adminAccessRoutes.get('/admin/r2-access', adminAuthMiddleware, async (c) => {
  try {
    const { db } = initializeServices(c);

    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status');

    console.log(`管理员获取用户访问配置列表`);

    // 构建查询条件
    let whereCondition = undefined;
    if (userId) {
      whereCondition = eq(userR2Access.userId, parseInt(userId));
    } else if (status) {
      const now = new Date();
      switch (status) {
        case 'active':
          whereCondition = and(
            eq(userR2Access.isActive, true),
            or(
              isNull(userR2Access.expiresAt),
              gt(userR2Access.expiresAt, now)
            )
          );
          break;
        case 'expired':
          whereCondition = lt(userR2Access.expiresAt, now);
          break;
        case 'inactive':
          whereCondition = eq(userR2Access.isActive, false);
          break;
      }
    }

    // 获取访问配置列表
    const query = db.select({
      id: userR2Access.id,
      userId: userR2Access.userId,
      userEmail: users.email,
      accessKeyId: userR2Access.accessKeyId,
      pathPrefix: userR2Access.pathPrefix,
      bucketName: userR2Access.bucketName,
      region: userR2Access.region,
      isActive: userR2Access.isActive,
      maxStorageBytes: userR2Access.maxStorageBytes,
      currentStorageBytes: userR2Access.currentStorageBytes,
      maxFileCount: userR2Access.maxFileCount,
      currentFileCount: userR2Access.currentFileCount,
      isReadonly: userR2Access.isReadonly,
      expiresAt: userR2Access.expiresAt,
      lastUsedAt: userR2Access.lastUsedAt,
      createdAt: userR2Access.createdAt,
      updatedAt: userR2Access.updatedAt
    })
    .from(userR2Access)
    .leftJoin(users, eq(userR2Access.userId, users.id));

    if (whereCondition) {
      query.where(whereCondition);
    }

    const accesses = await query
      .orderBy(desc(userR2Access.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // 获取总数
    const totalCountQuery = db.select({ count: userR2Access.id })
      .from(userR2Access);
    
    if (whereCondition) {
      totalCountQuery.where(whereCondition);
    }
    
    const totalCount = await totalCountQuery.all();

    // 计算使用百分比
    const formattedAccesses = accesses.map(access => ({
      ...access,
      storageUsagePercent: Math.round((access.currentStorageBytes / access.maxStorageBytes) * 100),
      fileUsagePercent: Math.round((access.currentFileCount / access.maxFileCount) * 100),
      isExpired: access.expiresAt && new Date() > access.expiresAt
    }));

    return c.json({
      success: true,
      message: '获取成功',
      accesses: formattedAccesses,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        totalPages: Math.ceil(totalCount.length / limit)
      }
    });

  } catch (error) {
    console.error('管理员获取用户访问配置失败:', error);
    return c.json({
      success: false,
      message: '获取用户访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取系统访问统计
 */
adminAccessRoutes.get('/admin/r2-access/statistics', adminAuthMiddleware, async (c) => {
  try {
    const { db } = initializeServices(c);

    console.log('管理员获取系统访问统计');

    // 获取基本统计
    const totalUsers = await db.select({ count: userR2Access.id })
      .from(userR2Access)
      .all();

    const activeUsers = await db.select({ count: userR2Access.id })
      .from(userR2Access)
      .where(eq(userR2Access.isActive, true))
      .all();

    const now = new Date();
    const expiredUsers = await db.select({ count: userR2Access.id })
      .from(userR2Access)
      .where(lt(userR2Access.expiresAt, now))
      .all();

    // 获取存储统计
    const storageStats = await db.select({
      totalStorage: userR2Access.currentStorageBytes,
      totalFiles: userR2Access.currentFileCount,
      maxStorage: userR2Access.maxStorageBytes,
      maxFiles: userR2Access.maxFileCount
    })
    .from(userR2Access)
    .where(eq(userR2Access.isActive, true))
    .all();

    const totalStorageUsed = storageStats.reduce((sum, stat) => sum + stat.totalStorage, 0);
    const totalFilesCount = storageStats.reduce((sum, stat) => sum + stat.totalFiles, 0);
    const totalStorageLimit = storageStats.reduce((sum, stat) => sum + stat.maxStorage, 0);
    const totalFilesLimit = storageStats.reduce((sum, stat) => sum + stat.maxFiles, 0);

    // 获取访问统计（最近7天）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentAccessStats = await db.select({
      operation: r2AccessLogs.operation,
      count: r2AccessLogs.id,
      totalBytes: r2AccessLogs.bytesTransferred,
      avgResponseTime: r2AccessLogs.responseTime
    })
    .from(r2AccessLogs)
    .where(gt(r2AccessLogs.timestamp, sevenDaysAgo))
    .all();

    const operationStats = recentAccessStats.reduce((acc, stat) => {
      if (!acc[stat.operation]) {
        acc[stat.operation] = {
          count: 0,
          totalBytes: 0,
          totalResponseTime: 0,
          avgResponseTime: 0
        };
      }
      acc[stat.operation].count += stat.count;
      acc[stat.operation].totalBytes += stat.totalBytes || 0;
      acc[stat.operation].totalResponseTime += stat.avgResponseTime || 0;
      acc[stat.operation].avgResponseTime = acc[stat.operation].totalResponseTime / acc[stat.operation].count;
      return acc;
    }, {} as Record<string, any>);

    // 获取风险统计
    const suspiciousActivities = await db.select({ count: r2AuditLogs.id })
      .from(r2AuditLogs)
      .where(eq(r2AuditLogs.isSuspicious, true))
      .all();

    const flaggedForReview = await db.select({ count: r2AuditLogs.id })
      .from(r2AuditLogs)
      .where(eq(r2AuditLogs.flaggedForReview, true))
      .all();

    const statistics = {
      overview: {
        totalUsers: totalUsers.length,
        activeUsers: activeUsers.length,
        expiredUsers: expiredUsers.length,
        storageUsage: {
          used: totalStorageUsed,
          limit: totalStorageLimit,
          percentage: Math.round((totalStorageUsed / totalStorageLimit) * 100)
        },
        fileUsage: {
          used: totalFilesCount,
          limit: totalFilesLimit,
          percentage: Math.round((totalFilesCount / totalFilesLimit) * 100)
        }
      },
      operations: operationStats,
      security: {
        suspiciousActivities: suspiciousActivities.length,
        flaggedForReview: flaggedForReview.length
      }
    };

    return c.json({
      success: true,
      message: '获取成功',
      statistics
    });

  } catch (error) {
    console.error('管理员获取系统统计失败:', error);
    return c.json({
      success: false,
      message: '获取系统统计失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 管理用户访问权限
 */
adminAccessRoutes.put('/admin/r2-access/:userId', adminAuthMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const adminUser = c.get('user');
    const targetUserId = parseInt(c.req.param('userId'));

    const body = await c.req.json();
    const {
      permissions,
      isActive,
      maxStorageBytes,
      maxFileCount,
      isReadonly,
      expiresInSeconds
    } = body;

    console.log(`管理员 ${adminUser.id} 修改用户 ${targetUserId} 的访问权限`);

    // 获取目标用户的访问配置
    const targetAccess = await accessControlService.getUserAccess(targetUserId);
    if (!targetAccess) {
      return c.json({
        success: false,
        message: '目标用户未配置R2访问权限'
      }, 404);
    }

    // 计算新的过期时间
    const expiresAt = expiresInSeconds 
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : targetAccess.expiresAt;

    // 更新访问配置
    await db.update(userR2Access)
      .set({
        isActive: isActive !== undefined ? isActive : targetAccess.isActive,
        maxStorageBytes: maxStorageBytes || targetAccess.maxStorageBytes,
        maxFileCount: maxFileCount || targetAccess.maxFileCount,
        isReadonly: isReadonly !== undefined ? isReadonly : targetAccess.isReadonly,
        expiresAt,
        updatedAt: new Date()
      })
      .where(eq(userR2Access.userId, targetUserId));

    // 更新配额
    if (maxStorageBytes || maxFileCount) {
      await db.update(userDirectoryQuotas)
        .set({
          maxStorageBytes: maxStorageBytes || targetAccess.maxStorageBytes,
          maxFileCount: maxFileCount || targetAccess.maxFileCount,
          lastUpdated: new Date()
        })
        .where(eq(userDirectoryQuotas.userId, targetUserId));
    }

    // 更新权限记录
    if (permissions) {
      // 删除现有权限
      await db.delete(r2Permissions)
        .where(eq(r2Permissions.accessId, parseInt(targetAccess.id)));

      // 添加新权限
      for (const permission of permissions) {
        await db.insert(r2Permissions).values({
          accessId: parseInt(targetAccess.id),
          resourcePattern: permission.resource,
          actions: JSON.stringify(permission.actions),
          conditions: permission.conditions ? JSON.stringify(permission.conditions) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 记录管理员操作
    await db.insert(r2AuditLogs).values({
      userId: targetUserId,
      accessId: parseInt(targetAccess.id),
      operation: 'admin_permission_update',
      details: JSON.stringify({
        adminId: adminUser.id,
        changes: {
          permissions: !!permissions,
          isActive,
          maxStorageBytes,
          maxFileCount,
          isReadonly,
          expiresInSeconds
        }
      }),
      riskLevel: 'medium',
      isSuspicious: false,
      flaggedForReview: false,
      timestamp: new Date()
    });

    // 获取更新后的配置
    const updatedAccess = await accessControlService.getUserAccess(targetUserId);

    return c.json({
      success: true,
      message: '用户访问权限更新成功',
      access: updatedAccess
    });

  } catch (error) {
    console.error('管理员修改用户访问权限失败:', error);
    return c.json({
      success: false,
      message: '修改用户访问权限失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取用户详细访问信息
 */
adminAccessRoutes.get('/admin/r2-access/:userId/details', adminAuthMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const targetUserId = parseInt(c.req.param('userId'));

    console.log(`管理员获取用户 ${targetUserId} 的详细访问信息`);

    // 获取访问配置
    const accessConfig = await accessControlService.getUserAccess(targetUserId);
    if (!accessConfig) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限'
      }, 404);
    }

    // 获取权限详情
    const permissions = await db.select({
      resourcePattern: r2Permissions.resourcePattern,
      actions: r2Permissions.actions,
      conditions: r2Permissions.conditions
    })
    .from(r2Permissions)
    .where(eq(r2Permissions.accessId, parseInt(accessConfig.id)))
    .all();

    const formattedPermissions = permissions.map(perm => ({
      resource: perm.resourcePattern,
      actions: JSON.parse(perm.actions),
      conditions: perm.conditions ? JSON.parse(perm.conditions) : undefined
    }));

    // 获取访问令牌
    const tokens = await db.select({
      id: accessTokens.id,
      tokenType: accessTokens.tokenType,
      scope: accessTokens.scope,
      expiresAt: accessTokens.expiresAt,
      isRevoked: accessTokens.isRevoked,
      usageCount: accessTokens.usageCount,
      lastUsedAt: accessTokens.lastUsedAt,
      createdAt: accessTokens.createdAt
    })
    .from(accessTokens)
    .where(eq(accessTokens.userId, targetUserId))
    .orderBy(desc(accessTokens.createdAt))
    .all();

    // 获取最近访问日志
    const recentLogs = await db.select({
      operation: r2AccessLogs.operation,
      resourcePath: r2AccessLogs.resourcePath,
      statusCode: r2AccessLogs.statusCode,
      responseTime: r2AccessLogs.responseTime,
      bytesTransferred: r2AccessLogs.bytesTransferred,
      ipAddress: r2AccessLogs.ipAddress,
      timestamp: r2AccessLogs.timestamp
    })
    .from(r2AccessLogs)
    .where(eq(r2AccessLogs.userId, targetUserId))
    .orderBy(desc(r2AccessLogs.timestamp))
    .limit(20)
    .all();

    const userDetails = {
      accessConfig: {
        ...accessConfig,
        permissions: formattedPermissions
      },
      tokens,
      recentAccessLogs: recentLogs
    };

    return c.json({
      success: true,
      message: '获取成功',
      userDetails
    });

  } catch (error) {
    console.error('管理员获取用户详细信息失败:', error);
    return c.json({
      success: false,
      message: '获取用户详细信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取系统安全日志
 */
adminAccessRoutes.get('/admin/r2-access/security-logs', adminAuthMiddleware, async (c) => {
  try {
    const { db } = initializeServices(c);

    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const riskLevel = url.searchParams.get('riskLevel');
    const operation = url.searchParams.get('operation');

    console.log('管理员获取系统安全日志');

    // 构建查询条件
    let whereCondition = undefined;
    if (riskLevel) {
      whereCondition = eq(r2AuditLogs.riskLevel, riskLevel);
    }
    if (operation) {
      const opCondition = eq(r2AuditLogs.operation, operation);
      whereCondition = whereCondition ? and(whereCondition, opCondition) : opCondition;
    }

    // 获取安全日志
    const query = db.select({
      id: r2AuditLogs.id,
      userId: r2AuditLogs.userId,
      userEmail: users.email,
      operation: r2AuditLogs.operation,
      details: r2AuditLogs.details,
      riskLevel: r2AuditLogs.riskLevel,
      isSuspicious: r2AuditLogs.isSuspicious,
      flaggedForReview: r2AuditLogs.flaggedForReview,
      timestamp: r2AuditLogs.timestamp
    })
    .from(r2AuditLogs)
    .leftJoin(users, eq(r2AuditLogs.userId, users.id));

    if (whereCondition) {
      query.where(whereCondition);
    }

    const logs = await query
      .orderBy(desc(r2AuditLogs.timestamp))
      .limit(limit)
      .offset(offset)
      .all();

    // 格式化详情
    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : undefined
    }));

    // 获取总数
    const totalCountQuery = db.select({ count: r2AuditLogs.id })
      .from(r2AuditLogs);
    
    if (whereCondition) {
      totalCountQuery.where(whereCondition);
    }
    
    const totalCount = await totalCountQuery.all();

    return c.json({
      success: true,
      message: '获取成功',
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        totalPages: Math.ceil(totalCount.length / limit)
      }
    });

  } catch (error) {
    console.error('管理员获取安全日志失败:', error);
    return c.json({
      success: false,
      message: '获取安全日志失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取系统使用趋势
 */
adminAccessRoutes.get('/admin/r2-access/trends', adminAuthMiddleware, async (c) => {
  try {
    const { db } = initializeServices(c);

    const url = new URL(c.req.url);
    const period = url.searchParams.get('period') || '7d'; // 7d, 30d, 90d

    console.log(`管理员获取系统使用趋势 (${period})`);

    // 计算时间范围
    const now = new Date();
    let startTime: Date;
    switch (period) {
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 获取每日访问统计
    const dailyStats = await db.select({
      date: r2AccessLogs.timestamp,
      operation: r2AccessLogs.operation,
      count: r2AccessLogs.id,
      totalBytes: r2AccessLogs.bytesTransferred,
      avgResponseTime: r2AccessLogs.responseTime
    })
    .from(r2AccessLogs)
    .where(gt(r2AccessLogs.timestamp, startTime))
    .all();

    // 按日期分组统计
    const groupedStats = dailyStats.reduce((acc, stat) => {
      const date = stat.timestamp.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          totalRequests: 0,
          totalBytes: 0,
          operations: {},
          avgResponseTime: 0,
          totalResponseTime: 0
        };
      }
      
      acc[date].totalRequests += stat.count;
      acc[date].totalBytes += stat.totalBytes || 0;
      acc[date].totalResponseTime += stat.avgResponseTime || 0;
      
      if (!acc[date].operations[stat.operation]) {
        acc[date].operations[stat.operation] = 0;
      }
      acc[date].operations[stat.operation] += stat.count;
      
      return acc;
    }, {} as Record<string, any>);

    // 计算平均响应时间
    Object.values(groupedStats).forEach((stat: any) => {
      stat.avgResponseTime = stat.totalResponseTime / stat.totalRequests;
    });

    // 获取存储增长趋势
    const storageGrowth = await db.select({
      date: userR2Access.updatedAt,
      totalStorage: userR2Access.currentStorageBytes,
      totalFiles: userR2Access.currentFileCount
    })
    .from(userR2Access)
    .where(gt(userR2Access.updatedAt, startTime))
    .all();

    const trends = {
      period,
      dailyUsage: Object.values(groupedStats),
      storageGrowth: storageGrowth,
      summary: {
        totalRequests: Object.values(groupedStats).reduce((sum: number, stat: any) => sum + stat.totalRequests, 0),
        totalBytes: Object.values(groupedStats).reduce((sum: number, stat: any) => sum + stat.totalBytes, 0),
        avgResponseTime: Object.values(groupedStats).reduce((sum: number, stat: any) => sum + stat.avgResponseTime, 0) / Object.values(groupedStats).length || 0
      }
    };

    return c.json({
      success: true,
      message: '获取成功',
      trends
    });

  } catch (error) {
    console.error('管理员获取系统趋势失败:', error);
    return c.json({
      success: false,
      message: '获取系统趋势失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 重置用户访问配置
 */
adminAccessRoutes.post('/admin/r2-access/:userId/reset', adminAuthMiddleware, async (c) => {
  try {
    const { db, accessControlService } = initializeServices(c);
    const adminUser = c.get('user');
    const targetUserId = parseInt(c.req.param('userId'));

    console.log(`管理员 ${adminUser.id} 重置用户 ${targetUserId} 的访问配置`);

    // 获取现有配置
    const existingAccess = await accessControlService.getUserAccess(targetUserId);
    if (!existingAccess) {
      return c.json({
        success: false,
        message: '用户未配置R2访问权限'
      }, 404);
    }

    // 重置使用统计
    await db.update(userR2Access)
      .set({
        currentStorageBytes: 0,
        currentFileCount: 0,
        updatedAt: new Date()
      })
      .where(eq(userR2Access.userId, targetUserId));

    await db.update(userDirectoryQuotas)
      .set({
        currentStorageBytes: 0,
        currentFileCount: 0,
        lastUpdated: new Date()
      })
      .where(eq(userDirectoryQuotas.userId, targetUserId));

    // 撤销所有访问令牌
    await db.update(accessTokens)
      .set({
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(eq(accessTokens.userId, targetUserId));

    // 记录重置操作
    await db.insert(r2AuditLogs).values({
      userId: targetUserId,
      accessId: parseInt(existingAccess.id),
      operation: 'admin_access_reset',
      details: JSON.stringify({
        adminId: adminUser.id,
        reason: '管理员重置访问配置'
      }),
      riskLevel: 'medium',
      isSuspicious: false,
      flaggedForReview: false,
      timestamp: new Date()
    });

    return c.json({
      success: true,
      message: '用户访问配置重置成功'
    });

  } catch (error) {
    console.error('管理员重置用户访问配置失败:', error);
    return c.json({
      success: false,
      message: '重置用户访问配置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default adminAccessRoutes;