// src/routes/simple-credentials.ts
import { Hono } from 'hono';
import { Context } from 'hono';

const simpleCredentialsRoutes = new Hono();

// 简化的凭证类型
interface SimpleCredential {
  id: number;
  userId: number;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 简化的认证中间件
const authenticate = async (c: any, next: () => Promise<void>) => {
  // 设置测试用户ID
  c.set('user', { id: 1 });
  await next();
};

// 获取凭证统计
simpleCredentialsRoutes.get('/stats', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    // 模拟统计数据
    const stats = {
      totalCredentials: 2,
      activeCredentials: 1,
      expiredCredentials: 0,
      mostRecentlyUsed: {
        id: 1,
        userId: 1,
        name: 'Obsidian同步',
        accessKeyId: 'AKIA...',
        secretAccessKey: '***',
        region: 'auto',
        bucket: 'news-storage',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      }
    };

    return c.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取凭证统计失败:', error);
    return c.json({
      error: '获取凭证统计失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取用户凭证列表
simpleCredentialsRoutes.get('/list', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    // 模拟凭证数据
    const credentials: SimpleCredential[] = [
      {
        id: 1,
        userId: 1,
        name: 'Obsidian同步',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'auto',
        bucket: 'news-storage',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 2,
        userId: 1,
        name: '测试凭证',
        accessKeyId: 'AKIA_TEST',
        secretAccessKey: 'TEST_SECRET',
        region: 'auto',
        bucket: 'news-storage',
        isActive: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      }
    ];

    return c.json({
      success: true,
      credentials,
      total: credentials.length
    });

  } catch (error) {
    console.error('获取凭证列表失败:', error);
    return c.json({
      error: '获取凭证列表失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 创建新凭证
simpleCredentialsRoutes.post('/create', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const { name, bucket = 'news-storage', region = 'auto' } = body;

    if (!name) {
      return c.json({ error: '凭证名称不能为空' }, 400);
    }

    // 模拟创建凭证
    const newCredential: SimpleCredential = {
      id: Date.now(),
      userId,
      name,
      accessKeyId: `AKIA${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
      secretAccessKey: Math.random().toString(36).substring(2, 30) + Math.random().toString(36).substring(2, 30),
      region,
      bucket,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({
      success: true,
      message: '同步凭证创建成功',
      credential: newCredential
    });

  } catch (error) {
    console.error('创建凭证失败:', error);
    return c.json({
      error: '创建凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// R2健康检查
simpleCredentialsRoutes.get('/r2/health', async (c) => {
  try {
    // 模拟R2健康检查
    return c.json({
      status: 'healthy',
      service: 'R2',
      message: 'R2存储服务正常运行',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      service: 'R2',
      message: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default simpleCredentialsRoutes;