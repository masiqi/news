import { Hono } from 'hono';
import { cors } from 'hono/cors';
import adminRecommendedSourcesRoutes from './recommended-sources';
import adminCategoriesRoutes from './categories';
import adminTagsRoutes from './tags';
import adminStatisticsRoutes from './statistics';
import adminUsersRoutes from './users';
import adminRolesRoutes from './roles';
// import adminMonitoringRoutes from './monitoring-simple';
import testRoutes from './test';

const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用CORS中间件
adminRoutes.use('*', cors({
  origin: (origin) => {
    // 允许前端域名，在生产环境应该配置具体域名
    return origin ? origin : '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24小时
}));

// 健康检查端点
adminRoutes.get('/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-api',
    version: '1.0.0',
  });
});

// 挂载子路由
adminRoutes.route('/recommended-sources', adminRecommendedSourcesRoutes);
adminRoutes.route('/categories', adminCategoriesRoutes);
adminRoutes.route('/tags', adminTagsRoutes);
adminRoutes.route('/statistics', adminStatisticsRoutes);
adminRoutes.route('/users', adminUsersRoutes);
adminRoutes.route('/roles', adminRolesRoutes);
// adminRoutes.route('/monitoring', adminMonitoringRoutes);
// 测试端点
adminRoutes.get('/test/ping', (c) => {
  return c.json({ message: 'pong' });
});

// 管理员RSS源管理接口
adminRoutes.get('/sources', async (c) => {
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { count } = await import('drizzle-orm');
    const { sources } = await import('../../db/schema');
    
    const db = drizzle(c.env.DB);
    
    // 获取查询参数
    const query = c.req.query();
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const search = query.search as string;
    const status = query.status as string;
    
    // 构建查询
    let whereCondition = undefined;
    
    // 如果有搜索条件
    if (search) {
      const { ilike, or } = await import('drizzle-orm');
      whereCondition = or(
        ilike(sources.name, `%${search}%`),
        ilike(sources.url, `%${search}%`),
        ilike(sources.description, `%${search}%`)
      );
    }
    
    // 获取总数
    const countResult = await db.select({ count: count() }).from(sources).where(whereCondition);
    const total = countResult[0].count;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const { desc } = await import('drizzle-orm');
    
    const sourcesData = await db
      .select()
      .from(sources)
      .where(whereCondition)
      .orderBy(desc(sources.createdAt))
      .limit(limit)
      .offset(offset);
    
    return c.json({
      success: true,
      data: {
        sources: sourcesData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取RSS源列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取RSS源列表失败',
      message: error.message 
    }, 500);
  }
});


// 调试统计接口
adminRoutes.get('/debug/statistics', async (c) => {
  try {
    console.log('DEBUG: 开始统计测试...');
    
    // 直接使用简单的数据库查询
    const { drizzle } = await import('drizzle-orm/d1');
    const { users } = await import('../../db/schema');
    const { count } = await import('drizzle-orm');
    
    const db = drizzle(c.env.DB);
    const result = await db.select({ count: count() }).from(users);
    
    console.log('DEBUG: 查询结果:', result);
    
    return c.json({
      success: true,
      data: {
        totalUsers: result[0].count,
        message: 'Debug statistics successful'
      }
    });
  } catch (error) {
    console.error('DEBUG: 统计测试失败:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

adminRoutes.route('/test', testRoutes);

// 根路径返回API信息
adminRoutes.get('/', (c) => {
  return c.json({
    message: 'Admin API',
    version: '1.0.0',
    endpoints: {
      'GET /health': '健康检查',
      'GET /recommended-sources': '获取推荐源列表',
      'POST /recommended-sources': '创建推荐源',
      'GET /recommended-sources/:id': '获取推荐源详情',
      'PUT /recommended-sources/:id': '更新推荐源',
      'DELETE /recommended-sources/:id': '删除推荐源',
      'POST /recommended-sources/:id/validate': '验证推荐源',
      'GET /recommended-sources/statistics': '获取推荐源统计',
      'GET /categories': '获取分类列表',
      'POST /categories': '创建分类',
      'GET /categories/:id': '获取分类详情',
      'PUT /categories/:id': '更新分类',
      'DELETE /categories/:id': '删除分类',
      'GET /tags': '获取标签列表',
      'POST /tags': '创建标签',
      'GET /tags/:id': '获取标签详情',
      'PUT /tags/:id': '更新标签',
      'DELETE /tags/:id': '删除标签',
      'GET /statistics/overview': '获取总体统计',
      'GET /statistics/timeline': '获取时间序列统计',
      'GET /statistics/sources/:id': '获取源详情统计',
      'GET /statistics/categories/:id': '获取分类统计',
      // 用户管理API
      'GET /users': '获取用户列表',
      'GET /users/:id': '获取用户详情',
      'PUT /users/:id/status': '更新用户状态',
      'PUT /users/:id/role': '更新用户角色',
      'GET /users/:id/logs': '获取用户操作日志',
      'POST /users/batch': '批量操作用户',
      'GET /users/statistics': '获取用户统计信息',
      'GET /users/:id/sessions': '获取用户会话列表',
      'DELETE /users/:id/sessions/:sessionId': '强制用户下线',
      // 角色权限API
      'GET /roles': '获取角色列表',
      'POST /roles': '创建角色',
      'PUT /roles/:id': '更新角色',
      'DELETE /roles/:id': '删除角色',
      'GET /permissions': '获取权限列表',
      'POST /permissions': '创建权限',
      'PUT /permissions/:id': '更新权限',
      'DELETE /permissions/:id': '删除权限',
      'POST /roles/assign': '为用户分配角色',
      'DELETE /roles/:roleId/users/:userId': '移除用户角色',
      'GET /users/:userId/roles': '获取用户角色',
      'GET /permissions/resources': '获取权限资源类型',
      'GET /permissions/:resource/actions': '获取特定资源的操作类型',
      // 监控系统API
      'GET /monitoring/overview': '获取系统概览指标',
      'GET /monitoring/metrics': '获取性能指标历史',
      'GET /monitoring/health': '获取服务健康状态',
      'GET /monitoring/queues': '获取队列状态',
      'GET /monitoring/users': '获取用户活动统计',
      'GET /monitoring/alerts/rules': '获取报警规则',
      'POST /monitoring/alerts/rules': '创建报警规则',
      'PUT /monitoring/alerts/rules/:id': '更新报警规则',
      'GET /monitoring/alerts/history': '获取报警记录',
      'GET /monitoring/export': '导出监控数据',
    },
    authentication: {
      type: 'JWT Bearer Token',
      adminAuth: 'Required for all endpoints',
      adminLogin: 'POST /auth/admin-login',
    },
  });
});

export default adminRoutes;