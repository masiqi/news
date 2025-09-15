// GLM 管理API路由 - 提供GLM配置和管理的RESTful接口
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { 
  glmConfigs, 
  glmUsageStats, 
  glmCallLogs,
  users 
} from '../../db/schema';
import { 
  eq, 
  and, 
  desc, 
  sql, 
  gte, 
  lt, 
  between,
  isNull 
} from 'drizzle-orm';
import { 
  createGLMIntegrationService,
  GLMIntegrationConfig 
} from '../ai/glm-integration';
import { GLMError } from '../config/glm.config';

// 创建路由
const glmRoutes = new Hono();

// 请求验证schema
const createGLMConfigSchema = z.object({
  name: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().default('https://open.bigmodel.cn/api/paas/v4'),
  model: z.string().default('glm-4'),
  maxTokens: z.number().min(1).max(128000).default(2000),
  temperature: z.number().min(0).max(2).default(0.7),
  timeout: z.number().min(1000).max(300000).default(30000),
  maxRetries: z.number().min(0).max(10).default(3),
  isActive: z.boolean().default(true),
  maxConcurrency: z.number().min(1).max(10).default(1),
  dailyLimit: z.number().min(0).optional(),
  monthlyLimit: z.number().min(0).optional()
});

const updateGLMConfigSchema = createGLMConfigSchema.partial();

const processRequestSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  priority: z.number().min(0).max(10).default(0),
  skipQueue: z.boolean().default(false)
});

const batchProcessSchema = z.object({
  requests: z.array(z.object({
    prompt: z.string().min(1),
    model: z.string().optional(),
    maxTokens: z.number().min(1).max(128000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    priority: z.number().min(0).max(10).default(0),
    contentId: z.string().min(1)
  })),
  priority: z.number().min(0).max(10).default(0),
  skipQueue: z.boolean().default(false)
});

// 全局GLM服务实例
let globalGLMService: any = null;

// 初始化GLM服务
async function initializeGLMService(): Promise<any> {
  if (globalGLMService) {
    return globalGLMService;
  }

  // 获取默认配置
  const defaultConfig = await db
    .select()
    .from(glmConfigs)
    .where(eq(glmConfigs.isActive, true))
    .limit(1);

  if (defaultConfig.length === 0) {
    throw new GLMError('no_default_config', 'No active GLM configuration found');
  }

  const config = defaultConfig[0];
  const integrationConfig: GLMIntegrationConfig = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    timeout: config.timeout,
    maxConcurrency: config.maxConcurrency,
    maxRetries: config.maxRetries,
    enableMonitoring: true
  };

  globalGLMService = createGLMIntegrationService(integrationConfig);
  return globalGLMService;
}

// 路由定义

// 获取用户的GLM配置列表
glmRoutes.get('/configs', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const configs = await db
      .select({
        id: glmConfigs.id,
        name: glmConfigs.name,
        model: glmConfigs.model,
        maxTokens: glmConfigs.maxTokens,
        temperature: glmConfigs.temperature,
        timeout: glmConfigs.timeout,
        maxRetries: glmConfigs.maxRetries,
        isActive: glmConfigs.isActive,
        maxConcurrency: glmConfigs.maxConcurrency,
        dailyLimit: glmConfigs.dailyLimit,
        monthlyLimit: glmConfigs.monthlyLimit,
        createdAt: glmConfigs.createdAt,
        updatedAt: glmConfigs.updatedAt
      })
      .from(glmConfigs)
      .where(eq(glmConfigs.userId, userId))
      .orderBy(desc(glmConfigs.updatedAt));

    return c.json({ 
      success: true, 
      data: configs,
      count: configs.length 
    });
  } catch (error) {
    console.error('Error fetching GLM configs:', error);
    return c.json({ 
      error: 'Failed to fetch GLM configurations' 
    }, 500);
  }
});

// 获取特定的GLM配置
glmRoutes.get('/configs/:id', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const configId = parseInt(c.req.param('id'));
    if (isNaN(configId)) {
      return c.json({ error: 'Invalid config ID' }, 400);
    }

    const config = await db
      .select()
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.id, configId),
        eq(glmConfigs.userId, userId)
      ))
      .limit(1);

    if (config.length === 0) {
      return c.json({ error: 'GLM configuration not found' }, 404);
    }

    // 隐藏敏感信息
    const { apiKey, ...configData } = config[0];
    
    return c.json({ 
      success: true, 
      data: configData 
    });
  } catch (error) {
    console.error('Error fetching GLM config:', error);
    return c.json({ 
      error: 'Failed to fetch GLM configuration' 
    }, 500);
  }
});

// 创建新的GLM配置
glmRoutes.post('/configs', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const body = await c.req.json();
    const validatedData = createGLMConfigSchema.parse(body);

    // 检查是否超过配置数量限制
    const existingConfigs = await db
      .select({ count: sql<number>`count(*)` })
      .from(glmConfigs)
      .where(eq(glmConfigs.userId, userId));

    if (existingConfigs[0].count >= 5) {
      return c.json({ 
        error: 'Maximum number of GLM configurations reached (5)' 
      }, 400);
    }

    // 创建配置
    const result = await db.insert(glmConfigs).values({
      userId,
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // 隐藏敏感信息
    const { apiKey, ...configData } = result[0];

    return c.json({ 
      success: true, 
      data: configData,
      message: 'GLM configuration created successfully' 
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Error creating GLM config:', error);
    return c.json({ 
      error: 'Failed to create GLM configuration' 
    }, 500);
  }
});

// 更新GLM配置
glmRoutes.put('/configs/:id', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const configId = parseInt(c.req.param('id'));
    if (isNaN(configId)) {
      return c.json({ error: 'Invalid config ID' }, 400);
    }

    const body = await c.req.json();
    const validatedData = updateGLMConfigSchema.parse(body);

    // 检查配置是否存在
    const existingConfig = await db
      .select()
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.id, configId),
        eq(glmConfigs.userId, userId)
      ))
      .limit(1);

    if (existingConfig.length === 0) {
      return c.json({ error: 'GLM configuration not found' }, 404);
    }

    // 更新配置
    const result = await db
      .update(glmConfigs)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(and(
        eq(glmConfigs.id, configId),
        eq(glmConfigs.userId, userId)
      ))
      .returning();

    // 隐藏敏感信息
    const { apiKey, ...configData } = result[0];

    // 重置全局服务实例以应用新配置
    if (globalGLMService && configData.isActive) {
      await globalGLMService.shutdown();
      globalGLMService = null;
    }

    return c.json({ 
      success: true, 
      data: configData,
      message: 'GLM configuration updated successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Error updating GLM config:', error);
    return c.json({ 
      error: 'Failed to update GLM configuration' 
    }, 500);
  }
});

// 删除GLM配置
glmRoutes.delete('/configs/:id', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const configId = parseInt(c.req.param('id'));
    if (isNaN(configId)) {
      return c.json({ error: 'Invalid config ID' }, 400);
    }

    // 检查配置是否存在
    const existingConfig = await db
      .select()
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.id, configId),
        eq(glmConfigs.userId, userId)
      ))
      .limit(1);

    if (existingConfig.length === 0) {
      return c.json({ error: 'GLM configuration not found' }, 404);
    }

    // 删除配置
    await db
      .delete(glmConfigs)
      .where(and(
        eq(glmConfigs.id, configId),
        eq(glmConfigs.userId, userId)
      ));

    // 重置全局服务实例
    if (globalGLMService) {
      await globalGLMService.shutdown();
      globalGLMService = null;
    }

    return c.json({ 
      success: true, 
      message: 'GLM configuration deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting GLM config:', error);
    return c.json({ 
      error: 'Failed to delete GLM configuration' 
    }, 500);
  }
});

// 处理单个GLM请求
glmRoutes.post('/process', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const body = await c.req.json();
    const validatedData = processRequestSchema.parse(body);

    // 初始化GLM服务
    const glmService = await initializeGLMService();

    // 处理请求
    const result = await glmService.processRequest(
      {
        prompt: validatedData.prompt,
        model: validatedData.model,
        maxTokens: validatedData.maxTokens,
        temperature: validatedData.temperature,
        userId: userId.toString(),
        requestId: `glm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      userId,
      {
        priority: validatedData.priority,
        skipQueue: validatedData.skipQueue
      }
    );

    return c.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Error processing GLM request:', error);
    
    if (error instanceof GLMError) {
      return c.json({ 
        error: error.message,
        code: error.code,
        retryable: error.retryable 
      }, 400);
    }

    return c.json({ 
      error: 'Failed to process GLM request' 
    }, 500);
  }
});

// 批量处理GLM请求
glmRoutes.post('/batch-process', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const body = await c.req.json();
    const validatedData = batchProcessSchema.parse(body);

    // 检查批量请求大小
    if (validatedData.requests.length > 100) {
      return c.json({ 
        error: 'Batch size exceeds maximum limit (100 requests)' 
      }, 400);
    }

    // 初始化GLM服务
    const glmService = await initializeGLMService();

    // 准备批量请求
    const requests = validatedData.requests.map(req => ({
      request: {
        prompt: req.prompt,
        model: req.model,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        userId: userId.toString(),
        requestId: `glm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      contentId: req.contentId,
      priority: req.priority || validatedData.priority
    }));

    // 处理批量请求
    const result = await glmService.processBatch(
      requests,
      userId,
      {
        skipQueue: validatedData.skipQueue
      }
    );

    return c.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Error processing GLM batch request:', error);
    
    if (error instanceof GLMError) {
      return c.json({ 
        error: error.message,
        code: error.code,
        retryable: error.retryable 
      }, 400);
    }

    return c.json({ 
      error: 'Failed to process GLM batch request' 
    }, 500);
  }
});

// 获取队列状态
glmRoutes.get('/queue/status', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const glmService = await initializeGLMService();
    const status = await glmService.getQueueStatus(userId);

    return c.json({ 
      success: true, 
      data: status 
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return c.json({ 
      error: 'Failed to fetch queue status' 
    }, 500);
  }
});

// 获取用户队列详情
glmRoutes.get('/queue/details', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const glmService = await initializeGLMService();
    const details = await glmService.getUserQueueStatus(userId);

    return c.json({ 
      success: true, 
      data: details 
    });
  } catch (error) {
    console.error('Error fetching queue details:', error);
    return c.json({ 
      error: 'Failed to fetch queue details' 
    }, 500);
  }
});

// 取消队列中的请求
glmRoutes.delete('/queue/:queueId', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const queueId = c.req.param('queueId');
    const glmService = await initializeGLMService();
    
    const success = await glmService.cancelRequest(queueId, userId);
    
    if (!success) {
      return c.json({ 
        error: 'Request not found or already processed' 
      }, 404);
    }

    return c.json({ 
      success: true, 
      message: 'Request cancelled successfully' 
    });
  } catch (error) {
    console.error('Error cancelling request:', error);
    return c.json({ 
      error: 'Failed to cancel request' 
    }, 500);
  }
});

// 获取用户使用统计
glmRoutes.get('/stats/usage', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    // 获取查询参数
    const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate') as string) : undefined;
    const endDate = c.req.query('endDate') ? new Date(c.req.query('endDate') as string) : undefined;

    const glmService = await initializeGLMService();
    const stats = await glmService.getUserUsageStats(userId, startDate, endDate);

    return c.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return c.json({ 
      error: 'Failed to fetch usage statistics' 
    }, 500);
  }
});

// 获取用户成本统计
glmRoutes.get('/stats/cost', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    // 获取查询参数
    const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate') as string) : undefined;
    const endDate = c.req.query('endDate') ? new Date(c.req.query('endDate') as string) : undefined;

    const glmService = await initializeGLMService();
    const costStats = await glmService.getUserCostStats(userId, startDate, endDate);

    return c.json({ 
      success: true, 
      data: costStats 
    });
  } catch (error) {
    console.error('Error fetching cost stats:', error);
    return c.json({ 
      error: 'Failed to fetch cost statistics' 
    }, 500);
  }
});

// 生成用户使用报告
glmRoutes.get('/stats/report', async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const glmService = await initializeGLMService();
    const report = await glmService.generateUserUsageReport(userId);

    return c.json({ 
      success: true, 
      data: report 
    });
  } catch (error) {
    console.error('Error generating usage report:', error);
    return c.json({ 
      error: 'Failed to generate usage report' 
    }, 500);
  }
});

// 获取系统统计（管理员）
glmRoutes.get('/admin/stats/system', async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // 获取查询参数
    const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate') as string) : undefined;
    const endDate = c.req.query('endDate') ? new Date(c.req.query('endDate') as string) : undefined;

    const glmService = await initializeGLMService();
    const stats = await glmService.getSystemStats(startDate, endDate);

    return c.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return c.json({ 
      error: 'Failed to fetch system statistics' 
    }, 500);
  }
});

// 生成系统报告（管理员）
glmRoutes.get('/admin/stats/report', async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // 获取查询参数
    const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate') as string) : undefined;
    const endDate = c.req.query('endDate') ? new Date(c.req.query('endDate') as string) : undefined;

    const glmService = await initializeGLMService();
    const report = await glmService.generateSystemReport(startDate, endDate);

    return c.json({ 
      success: true, 
      data: report 
    });
  } catch (error) {
    console.error('Error generating system report:', error);
    return c.json({ 
      error: 'Failed to generate system report' 
    }, 500);
  }
});

// 获取当前监控指标（管理员）
glmRoutes.get('/admin/monitoring', async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const glmService = await initializeGLMService();
    const metrics = await glmService.getCurrentMetrics();

    return c.json({ 
      success: true, 
      data: metrics 
    });
  } catch (error) {
    console.error('Error fetching monitoring metrics:', error);
    return c.json({ 
      error: 'Failed to fetch monitoring metrics' 
    }, 500);
  }
});

// 健康检查
glmRoutes.get('/health', async (c) => {
  try {
    let serviceHealth = {
      status: 'unknown',
      components: {
        database: false,
        glmService: false
      }
    };

    // 检查数据库连接
    try {
      await db.select({ count: sql<number>`count(*)` }).from(glmConfigs).limit(1);
      serviceHealth.components.database = true;
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
    }

    // 检查GLM服务
    try {
      const glmService = await initializeGLMService();
      const health = await glmService.healthCheck();
      serviceHealth.components.glmService = health.status === 'healthy';
    } catch (glmError) {
      console.error('GLM service health check failed:', glmError);
    }

    // 确定整体状态
    const healthyComponents = Object.values(serviceHealth.components).filter(Boolean).length;
    if (healthyComponents === Object.keys(serviceHealth.components).length) {
      serviceHealth.status = 'healthy';
    } else if (healthyComponents > 0) {
      serviceHealth.status = 'degraded';
    } else {
      serviceHealth.status = 'unhealthy';
    }

    const statusCode = serviceHealth.status === 'healthy' ? 200 : 
                       serviceHealth.status === 'degraded' ? 207 : 503;

    return c.json({ 
      success: true, 
      data: serviceHealth 
    }, statusCode);
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json({ 
      success: false, 
      error: 'Health check failed',
      status: 'unhealthy'
    }, 503);
  }
});

// 获取支持的模型列表
glmRoutes.get('/models', async (c) => {
  try {
    const models = [
      {
        id: 'glm-4',
        name: 'GLM-4',
        description: 'Latest general-purpose model',
        maxTokens: 8192,
        capabilities: ['text-generation', 'conversation', 'code-generation']
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4-Air',
        description: 'Lightweight model for fast inference',
        maxTokens: 8192,
        capabilities: ['text-generation', 'conversation']
      },
      {
        id: 'glm-4-airx',
        name: 'GLM-4-AirX',
        description: 'Extended context model',
        maxTokens: 32768,
        capabilities: ['text-generation', 'conversation', 'long-context']
      },
      {
        id: 'glm-4-long',
        name: 'GLM-4-Long',
        description: 'Long context model for complex tasks',
        maxTokens: 32768,
        capabilities: ['text-generation', 'conversation', 'long-context', 'analysis']
      },
      {
        id: 'glm-3-turbo',
        name: 'GLM-3-Turbo',
        description: 'Fast and efficient model',
        maxTokens: 128000,
        capabilities: ['text-generation', 'conversation']
      }
    ];

    return c.json({ 
      success: true, 
      data: models 
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return c.json({ 
      error: 'Failed to fetch model list' 
    }, 500);
  }
});

export default glmRoutes;