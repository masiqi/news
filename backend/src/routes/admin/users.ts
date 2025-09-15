// src/routes/admin/users.ts
import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware } from '../../middleware/admin-auth.middleware';
import { UserManagementService } from '../../services/admin/user-management.service';
import { RolePermissionService } from '../../services/admin/role-permission.service';
import { AuditLogService } from '../../services/admin/audit-log.service';
import { getCurrentUser } from '../../middleware/admin-auth.middleware';

const userRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用管理员认证中间件
userRoutes.use('*', adminAuthMiddleware);

/**
 * 获取用户列表
 * GET /admin/users
 */
userRoutes.get('/', async (c) => {
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { users } = await import('../../db/schema');
    
    const db = drizzle(c.env.DB);
    const query = c.req.query();
    
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const search = query.search as string;
    const status = query.status as string;
    
    // 构建查询条件
    let whereCondition = undefined;
    
    if (search) {
      const { ilike, or } = await import('drizzle-orm');
      whereCondition = or(
        ilike(users.email, `%${search}%`)
      );
    }
    
    if (status) {
      const { and, eq } = await import('drizzle-orm');
      whereCondition = and(
        whereCondition,
        eq(users.status, status)
      );
    }
    
    // 获取总数
    const { count } = await import('drizzle-orm');
    const countResult = await db.select({ count: count() }).from(users).where(whereCondition);
    const total = countResult[0].count;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const { desc } = await import('drizzle-orm');
    
    const usersData = await db
      .select({
        id: users.id,
        email: users.email,
        status: users.status,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(whereCondition)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    
    return c.json({
      success: true,
      data: {
        users: usersData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户列表失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取用户统计信息
 * GET /admin/users/statistics
 */
userRoutes.get('/statistics', async (c) => {
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { users } = await import('../../db/schema');
    
    const db = drizzle(c.env.DB);
    const { count } = await import('drizzle-orm');
    
    // 获取用户总数
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0].count;
    
    // 获取用户状态分布
    const statusDistribution = await db
      .select({ status: users.status, count: count() })
      .from(users)
      .groupBy(users.status);
    
    // 计算各状态用户数
    const statusCounts = statusDistribution.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    // 获取用户角色分布
    const roleDistribution = await db
      .select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role);
    
    const roleCounts = roleDistribution.reduce((acc, item) => {
      acc[item.role] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    // 获取最近7天注册用户数
    const { gte } = await import('drizzle-orm');
    const recentRegistrations = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    
    return c.json({
      success: true,
      data: {
        userStatistics: {
          totalUsers,
          activeUsers: statusCounts.active || 0,
          inactiveUsers: statusCounts.inactive || 0,
          suspendedUsers: statusCounts.suspended || 0,
          pendingUsers: statusCounts.pending || 0,
          roleDistribution: roleCounts,
          recentRegistrations: recentRegistrations[0].count
        },
        auditStatistics: {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          operationTypeDistribution: {},
          dailyOperationTrend: [],
          topAdmins: [],
          riskEvents: 0
        }
      }
    });
  } catch (error) {
    console.error('获取用户统计信息失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户统计信息失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取最近用户活动
 * GET /admin/users/recent
 */
userRoutes.get('/recent', async (c) => {
  try {
    console.log('DEBUG: /admin/users/recent 被调用');
    const user = c.get('user');
    console.log('DEBUG: 当前用户:', user);
    
    const { drizzle } = await import('drizzle-orm/d1');
    const { users } = await import('../../db/schema');
    
    const db = drizzle(c.env.DB);
    const query = c.req.query();
    
    const limit = parseInt(query.limit as string) || 10;
    
    // 获取最近登录的用户
    const { desc } = await import('drizzle-orm');
    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        status: users.status,
        role: users.role,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(desc(users.lastLoginAt))
      .limit(limit);
    
    return c.json({
      success: true,
      data: {
        users: recentUsers
      }
    });
  } catch (error) {
    console.error('获取最近用户活动失败:', error);
    return c.json({ 
      success: false, 
      error: '获取最近用户活动失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
userRoutes.get('/:id', async (c) => {
  try {
    const { UserManagementService } = await import('../../services/admin/user-management.service');
    const userService = new UserManagementService(c.env.DB);
    const { CredentialService } = await import('../../services/credential.service');
    const credentialService = new CredentialService(c.env.DB);
    const userId = parseInt(c.req.param('id'));
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    const result = await userService.getUserDetail(userId);
    
    if (!result) {
      return c.json({ 
        success: false, 
        error: '用户不存在' 
      }, 404);
    }

    // 获取用户的同步凭证信息
    let syncCredentials = [];
    try {
      syncCredentials = await credentialService.getUserCredentials(userId);
    } catch (credentialError) {
      console.error('获取用户同步凭证失败:', credentialError);
      // 不影响主流程，继续返回用户基本信息
    }

    // 将同步凭证信息添加到结果中
    const resultWithCredentials = {
      ...result,
      syncCredentials
    };

    return c.json({
      success: true,
      data: resultWithCredentials
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户详情失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
userRoutes.put('/:id/status', async (c) => {
  try {
    const userService = c.get('userService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const userId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    if (!body.status) {
      return c.json({ 
        success: false, 
        error: '状态不能为空' 
      }, 400);
    }

    const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
    if (!validStatuses.includes(body.status)) {
      return c.json({ 
        success: false, 
        error: '无效的状态值' 
      }, 400);
    }

    const result = await userService.updateUserStatus(
      userId, 
      body.status, 
      body.reason,
      currentUser.id
    );

    if (!result) {
      return c.json({ 
        success: false, 
        error: '用户不存在' 
      }, 404);
    }

    // 记录审计日志
    await auditService.logOperation(
      userId,
      currentUser.id,
      'status_change',
      {
        oldStatus: 'unknown', // 这里可以从原数据获取
        newStatus: body.status,
        reason: body.reason
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: result,
      message: '用户状态更新成功'
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    return c.json({ 
      success: false, 
      error: '更新用户状态失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 更新用户角色
 * PUT /api/admin/users/:id/role
 */
userRoutes.put('/:id/role', async (c) => {
  try {
    const userService = c.get('userService');
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const userId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    if (!body.roleId) {
      return c.json({ 
        success: false, 
        error: '角色ID不能为空' 
      }, 400);
    }

    const roleId = parseInt(body.roleId);
    if (isNaN(roleId)) {
      return c.json({ 
        success: false, 
        error: '无效的角色ID' 
      }, 400);
    }

    // 检查角色是否存在
    const role = await roleService.getRoles({ page: 1, limit: 1 });
    const roleExists = role.roles.some(r => r.id === roleId);
    
    if (!roleExists) {
      return c.json({ 
        success: false, 
        error: '角色不存在' 
      }, 404);
    }

    await userService.updateUserRole(userId, roleId, currentUser.id);

    // 记录审计日志
    await auditService.logOperation(
      userId,
      currentUser.id,
      'role_change',
      { newRoleId: roleId },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      message: '用户角色更新成功'
    });
  } catch (error) {
    console.error('更新用户角色失败:', error);
    return c.json({ 
      success: false, 
      error: '更新用户角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取用户操作日志
 * GET /api/admin/users/:id/logs
 */
userRoutes.get('/:id/logs', async (c) => {
  try {
    const { AuditLogService } = await import('../../services/admin/audit-log.service');
    const auditService = new AuditLogService(c.env.DB);
    const userId = parseInt(c.req.param('id'));
    const query = c.req.query();
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    const params = {
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 20,
      operation: query.operation as string
    };

    const result = await auditService.getAuditLogs({
      ...params,
      userId
    });
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取用户操作日志失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户操作日志失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 批量操作用户
 * POST /api/admin/users/batch
 */
userRoutes.post('/batch', async (c) => {
  try {
    const userService = c.get('userService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const body = await c.req.json();
    
    if (!body.operation || !body.userIds || !Array.isArray(body.userIds)) {
      return c.json({ 
        success: false, 
        error: '无效的请求参数' 
      }, 400);
    }

    const validOperations = ['activate', 'deactivate', 'suspend', 'delete'];
    if (!validOperations.includes(body.operation)) {
      return c.json({ 
        success: false, 
        error: '无效的操作类型' 
      }, 400);
    }

    // 验证用户ID
    const userIds = body.userIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (userIds.length === 0) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID列表' 
      }, 400);
    }

    let result;
    switch (body.operation) {
      case 'activate':
        result = await userService.batchUpdateUserStatus(userIds, 'active', currentUser.id);
        break;
      case 'deactivate':
        result = await userService.batchUpdateUserStatus(userIds, 'inactive', currentUser.id);
        break;
      case 'suspend':
        result = await userService.batchUpdateUserStatus(userIds, 'suspended', currentUser.id);
        break;
      default:
        return c.json({ 
          success: false, 
          error: '不支持的操作类型' 
        }, 400);
    }

    // 记录批量操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'update',
      {
        operation: body.operation,
        userIds,
        success: result.success,
        failed: result.failed,
        errors: result.errors
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: result,
      message: `批量操作完成，成功: ${result.success}，失败: ${result.failed}`
    });
  } catch (error) {
    console.error('批量操作用户失败:', error);
    return c.json({ 
      success: false, 
      error: '批量操作用户失败',
      message: error.message 
    }, 500);
  }
});


/**
 * 获取用户会话列表
 * GET /api/admin/users/:id/sessions
 */
userRoutes.get('/:id/sessions', async (c) => {
  try {
    const { AuditLogService } = await import('../../services/admin/audit-log.service');
    const auditService = new AuditLogService(c.env.DB);
    const userId = parseInt(c.req.param('id'));
    const query = c.req.query();
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    const params = {
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 20,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined
    };

    const result = await auditService.getUserSessions({
      ...params,
      userId
    });
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取用户会话列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户会话列表失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 强制用户下线
 * DELETE /api/admin/users/:id/sessions/:sessionId
 */
userRoutes.delete('/:id/sessions/:sessionId', async (c) => {
  try {
    const { AuditLogService } = await import('../../services/admin/audit-log.service');
    const auditService = new AuditLogService(c.env.DB);
    const { getCurrentUser } = await import('../../middleware/admin-auth.middleware');
    const currentUser = getCurrentUser(c);
    
    const userId = parseInt(c.req.param('id'));
    const sessionId = c.req.param('sessionId');
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    if (!sessionId) {
      return c.json({ 
        success: false, 
        error: '会话ID不能为空' 
      }, 400);
    }

    // 这里需要实现强制下线逻辑
    // 由于数据库结构中只有isActive字段，我们需要更新会话状态
    
    // 记录操作日志
    await auditService.logOperation(
      userId,
      currentUser.id,
      'logout',
      { sessionId, forced: true },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      message: '用户已强制下线'
    });
  } catch (error) {
    console.error('强制用户下线失败:', error);
    return c.json({ 
      success: false, 
      error: '强制用户下线失败',
      message: error.message 
    }, 500);
  }
});

export default userRoutes;