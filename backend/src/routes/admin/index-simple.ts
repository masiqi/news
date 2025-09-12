// 简化版管理员路由
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import adminUsersRoutes from './users-simple';
import adminRolesRoutes from './roles-simple';

const adminRoutes = new Hono();

// 应用CORS中间件
adminRoutes.use('*', cors({
  origin: (origin) => {
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
adminRoutes.route('/users', adminUsersRoutes);
adminRoutes.route('/roles', adminRolesRoutes);

// 根路径返回API信息
adminRoutes.get('/', (c) => {
  return c.json({
    message: 'Admin API',
    version: '1.0.0',
    endpoints: {
      'GET /health': '健康检查',
      'GET /users': '获取用户列表',
      'GET /users/:id': '获取用户详情',
      'PUT /users/:id/status': '更新用户状态',
      'GET /users/statistics': '获取用户统计信息',
      'GET /roles': '获取角色列表',
      'GET /permissions': '获取权限列表',
    },
    authentication: {
      type: 'JWT Bearer Token',
      adminAuth: 'Required for all endpoints',
      adminLogin: 'POST /auth/admin-login',
    },
  });
});

export default adminRoutes;