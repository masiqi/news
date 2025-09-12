// 简化版用户管理路由
import { Hono } from 'hono';
import { initDB } from '../../db/index-simple';
import { users, userRoles, userPermissions, userRoleRelations, userOperationLogs } from '../../db/schema-simple';
import { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';

const adminUsersRoutes = new Hono();

// 获取用户列表
adminUsersRoutes.get('/', async (c) => {
  try {
    const { search, status, role, page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc' } = c.req.query();
    
    const db = initDB(c.env.DB);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let whereConditions = [];
    
    if (status) {
      whereConditions.push(eq(users.status, status));
    }
    
    if (role) {
      whereConditions.push(eq(users.role, role));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.notes, `%${search}%`)
        )
      );
    }

    // 构建查询
    let query = db.select().from(users);
    
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // 排序
    const orderColumn = users[sortBy as keyof typeof users];
    const orderFn = sortOrder === 'desc' ? desc : asc;
    query = query.orderBy(orderFn(orderColumn));
    
    // 分页
    query = query.limit(limitNum).offset(offset);

    const userList = await query;
    
    // 获取总数
    const countQuery = db.select({ count: count() }).from(users);
    if (whereConditions.length > 0) {
      countQuery.where(and(...whereConditions));
    }
    const totalResult = await countQuery;
    const total = totalResult[0].count;
    
    return c.json({
      success: true,
      data: {
        users: userList,
        total: total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return c.json({ success: false, error: '获取用户列表失败' }, 500);
  }
});

// 获取用户统计信息
adminUsersRoutes.get('/statistics', async (c) => {
  try {
    const db = initDB(c.env.DB);
    
    // 总用户数
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0].count;
    
    // 按状态统计
    const statusStats = await db
      .select({ status: users.status, count: count() })
      .from(users)
      .groupBy(users.status);
    
    // 按角色统计
    const roleStats = await db
      .select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role);
    
    // 活跃用户数（最近30天登录）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        eq(users.status, 'active'),
        sql`${users.lastLoginAt} >= ${thirtyDaysAgo.getTime()}`
      ));
    const activeUsers = activeUsersResult[0].count;
    
    return c.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        statusDistribution: statusStats.reduce((acc, stat) => {
          acc[stat.status] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        roleDistribution: roleStats.reduce((acc, stat) => {
          acc[stat.role] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('获取用户统计信息失败:', error);
    return c.json({ success: false, error: '获取用户统计信息失败' }, 500);
  }
});

// 获取用户详情
adminUsersRoutes.get('/:id', async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const db = initDB(c.env.DB);
    
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    
    if (!user) {
      return c.json({ success: false, error: '用户不存在' }, 404);
    }
    
    return c.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return c.json({ success: false, error: '获取用户详情失败' }, 500);
  }
});

// 更新用户状态
adminUsersRoutes.put('/:id/status', async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const { status, reason } = await c.req.json();
    const db = initDB(c.env.DB);
    
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    
    if (!user) {
      return c.json({ success: false, error: '用户不存在' }, 404);
    }
    
    await db.update(users)
      .set({
        status: status,
        updatedAt: new Date(),
        notes: reason ? `${user.notes || ''}\n[${new Date().toISOString()}] ${reason}`.trim() : user.notes
      })
      .where(eq(users.id, userId));
    
    const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
    
    return c.json({
      success: true,
      data: { user: updatedUser },
      message: '用户状态更新成功'
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    return c.json({ success: false, error: '更新用户状态失败' }, 500);
  }
});

// 获取用户操作日志
adminUsersRoutes.get('/:id/logs', async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const { page = '1', limit = '10', operation } = c.req.query();
    
    const db = initDB(c.env.DB);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let whereConditions = [eq(userOperationLogs.userId, userId)];
    
    if (operation) {
      whereConditions.push(eq(userOperationLogs.operation, operation));
    }
    
    const logs = await db.select()
      .from(userOperationLogs)
      .where(and(...whereConditions))
      .orderBy(desc(userOperationLogs.timestamp))
      .limit(limitNum)
      .offset(offset);
    
    const totalResult = await db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(and(...whereConditions));
    const total = totalResult[0].count;
    
    return c.json({
      success: true,
      data: {
        logs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取用户操作日志失败:', error);
    return c.json({ success: false, error: '获取用户操作日志失败' }, 500);
  }
});

export default adminUsersRoutes;