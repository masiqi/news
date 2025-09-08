import { Hono } from 'hono';
import { cors } from 'hono/cors';
import adminRecommendedSourcesRoutes from './recommended-sources';
import adminCategoriesRoutes from './categories';
import adminTagsRoutes from './tags';
import adminStatisticsRoutes from './statistics';

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
    },
    authentication: {
      type: 'JWT Bearer Token',
      adminAuth: 'Required for all endpoints',
      adminLogin: 'POST /auth/admin-login',
    },
  });
});

export default adminRoutes;