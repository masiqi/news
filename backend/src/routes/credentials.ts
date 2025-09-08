// src/routes/credentials.ts
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { Context } from 'hono';
import { Bindings } from 'hono/adapter-cloudflare-workers';
import { 
  CredentialService, 
  R2Service, 
  CryptoService 
} from '../services';
import { 
  SyncCredential, 
  CredentialLog, 
  CreateCredentialRequest,
  ValidateCredentialRequest,
  CredentialStats,
  R2TestResult,
  ConfigurationGuide,
  CredentialAction
} from '../types/credential.types';
import { z } from 'zod';

const credentialRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 请求验证中间件
 * 确保用户已认证
 */
const authenticate = async (c: Context<{ Bindings: Bindings } & { user: { id: number } }, next: () => Promise<Response>) => {
  // 简化实现：直接放行
  // 在实际应用中，应该验证JWT或其他认证机制
  const userId = c.get('user')?.id;
  if (!userId) {
    return c.json({ error: '未认证用户' }, 401);
  }
  
  await next();
};

/**
 * 请求参数验证
 */
const validateRequest = <T extends z.ZodType>(
  schema: T,
  data: any
): { success: boolean; data?: z.infer<T>; errors: string[] } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }
};

/**
 * 创建凭证的请求体验证schema
 */
const createCredentialSchema = z.object({
  name: z.string().min(1).max(100, '凭证名称长度必须在1-100字符之间'),
  bucket: z.string().min(3).max(63, '桶名称长度必须在3-63字符之间'),
  region: z.string().default('auto').optional(),
  endpoint: z.string().url().optional()
});

/**
 * 创建凭证API端点
 */
credentialRoutes.post('/api/credentials', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const validationResult = validateRequest(createCredentialSchema, body);

    if (!validationResult.success) {
      return c.json({
        error: '请求参数验证失败',
        details: validationResult.errors
      }, 400);
    }

    const { name, bucket, region, endpoint } = validationResult.data;
    
    // 初始化服务
    const credentialService = new CredentialService(c.env.DB);
    const r2Service = new R2Service(c.env.CLOUDFLARE_R2_ACCESS_KEY_ID);

    // 检查R2服务可用性
    const r2Availability = await r2Service.checkAvailability();
    if (!r2Availability.available) {
      return c.json({
        error: 'R2服务不可用',
        details: r2Availability.message
      }, 503);
    }

    // 创建凭证
    const credential = await credentialService.createCredential(
      userId,
      name,
      { bucket, region, endpoint }
    );

    return c.json({
      success: true,
      message: '同步凭证创建成功',
      credential
    });

  } catch (error) {
    console.error('创建凭证失败:', error);
    return c.json({
      error: '创建同步凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取用户凭证列表API端点
 */
credentialRoutes.get('/api/credentials', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    const credentialService = new CredentialService(c.env.DB);
    const credentials = await credentialService.getUserCredentials(userId);

    return c.json({
      success: true,
      credentials,
      total: credentials.length
    });

  } catch (error) {
    console.error('获取凭证列表失败:', error);
    return c.json({
      error: '获取同步凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取凭证详情API端点
 */
credentialRoutes.get('/api/credentials/:id', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const credentialId = parseInt(c.req.param('id'));
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }
    
    if (isNaN(credentialId)) {
      return c.json({ error: '无效的凭证ID' }, 400);
    }

    const credentialService = new CredentialService(c.env.DB);
    const credential = await credentialService.getCredential(credentialId);

    if (!credential) {
      return c.json({ error: '凭证不存在' }, 404);
    }
    
    // 检查凭证是否属于当前用户
    if (credential.userId !== userId.toString()) {
      return c.json({ error: '无权访问此凭证' }, 403);
    }

    return c.json({
      success: true,
      credential
    });

  } catch (error) {
    console.error('获取凭证详情失败:', error);
    return c.json({
      error: '获取凭证详情失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 撤销凭证API端点
 */
credentialRoutes.delete('/api/credentials/:id', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const credentialId = parseInt(c.req.param('id'));
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }
    
    if (isNaN(credentialId)) {
      return c.json({ error: '无效的凭证ID' }, 400);
    }

    const credentialService = new CredentialService(c.env.DB);
    
    const success = await credentialService.revokeCredential(credentialId, userId);
    
    if (!success) {
      return c.json({ error: '撤销凭证失败' }, 500);
    }

    return c.json({
      success: true,
      message: '凭证已成功撤销'
    });

  } catch (error) {
    console.error('撤销凭证失败:', error);
    return c.json({
      error: '撤销同步凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 重新生成凭证API端点
 */
credentialRoutes.post('/api/credentials/:id/regenerate', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const credentialId = parseInt(c.req.param('id'));
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }
    
    if (isNaN(credentialId)) {
      return c.json({ error: '无效的凭证ID' }, 400);
    }

    const credentialService = new CredentialService(c.env.DB);
    const r2Service = new R2Service(c.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
    
    const credential = await credentialService.regenerateCredential(credentialId, userId);
    
    return c.json({
      success: true,
      message: '凭证重新生成成功',
      credential
    });

  } catch (error) {
    console.error('重新生成凭证失败:', error);
    return c.json({
      error: '重新生成同步凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 验证凭证API端点
 */
credentialRoutes.post('/api/credentials/:id/validate', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const credentialId = parseInt(c.req.param('id'));
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }
    
    if (isNaN(credentialId)) {
      return c.json({ error: '无效的凭证ID' }, 400);
    }

    const body = await c.req.json();
    const validationResult = validateRequest(z.object({
      accessKeyId: z.string().min(1, '访问密钥ID不能为空'),
      secretAccessKey: z.string().min(1, '秘密访问密钥不能为空'),
      region: z.string().min(1, '区域不能为空'),
      bucket: z.string().min(1, '桶名称不能为空')
    }), body);

    if (!validationResult.success) {
      return c.json({
        error: '请求参数验证失败',
        details: validationResult.errors
      }, 400);
    }

    const { accessKeyId, secretAccessKey, region, bucket } = validationResult.data;
    
    const credentialService = new CredentialService(c.env.DB);
    const r2Service = new R2Service(c.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
    
    // 验证凭证有效性
    const validationResult = await credentialService.validateCredential(credentialId, userId);
    
    if (!validationResult.isValid) {
      return c.json({
        error: '凭证验证失败',
        details: validationResult.error
      }, 400);
    }

    // 测试R2访问权限
    const testResult = await r2Service.testCredentialAccess(
      bucket,
      accessKeyId,
      secretAccessKey,
      region
    );

    return c.json({
      success: testResult.success,
      isValid: validationResult.isValid,
      message: testResult.message,
      error: testResult.error
    });

  } catch (error) {
    console.error('验证凭证失败:', error);
    return c.json({
      error: '验证同步凭证失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 记录凭证使用API端点
 */
credentialRoutes.post('/api/credentials/:id/usage', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const credentialId = parseInt(c.req.param('id'));
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }
    
    if (isNaN(credentialId)) {
      return c.json({ error: '无效的凭证ID' }, 400);
    }

    const body = await c.req.json();
    const detailsValidation = z.object({
      details: z.record(z.any()).optional()
    }).safeParse(body);

    const credentialService = new CredentialService(c.env.DB);
    
    // 记录凭证使用情况
    await credentialService.recordCredentialUsage(
      credentialId,
      userId,
      detailsValidation.data?.details
    );

    return c.json({
      success: true,
      message: '凭证使用记录成功'
    });

  } catch (error) {
    console.error('记录凭证使用失败:', error);
    return c.json({
      error: '记录凭证使用失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取凭证统计API端点
 */
credentialRoutes.get('/api/credentials/stats', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    const credentialService = new CredentialService(c.env.DB);
    const stats = await credentialService.getCredentialStats(userId);

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

/**
 * 获取凭证审计日志API端点
 */
credentialRoutes.get('/api/credentials/logs', authenticate, async (c) => {
  try {
    const userId = c.get('user')?.id;
    const query = c.req.query();
    
    if (!userId) {
      return c.json({ error: '用户未认证' }, 401);
    }

    const credentialService = new CredentialService(c.env.DB);
    
    const limit = parseInt(query.limit as string) || 50;
    const offset = parseInt(query.offset as string) || 0;
    const action = query.action as CredentialAction | undefined;
    
    const logs = await credentialService.getCredentialLogs(userId, limit);
    
    // 过滤日志（如果指定了action）
    const filteredLogs = action 
      ? logs.filter(log => log.action === action)
      : logs;

    return c.json({
      success: true,
      logs: filteredLogs,
      total: filteredLogs.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('获取凭证审计日志失败:', error);
    return c.json({
      error: '获取凭证审计日志失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取平台配置指南API端点
 */
credentialRoutes.get('/api/credentials/guide/:platform', async (c) => {
  try {
    const platform = c.req.param('platform');
    
    if (!['obsidian', 'logseq', 'other'].includes(platform)) {
      return c.json({ error: '不支持的平台' }, 400);
    }

    const guide = await generateConfigurationGuide(platform);

    return c.json({
      success: true,
      guide
    });

  } catch (error) {
    console.error('获取配置指南失败:', error);
    return c.json({
      error: '获取配置指南失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * R2服务健康检查API端点
 */
credentialRoutes.get('/api/r2/health', async (c) => {
  try {
    const r2Service = new R2Service(c.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
    const health = await r2Service.checkAvailability();

    return c.json({
      status: health.available ? 'healthy' : 'unhealthy',
      service: 'R2',
      message: health.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('R2健康检查失败:', error);
    return c.json({
      status: 'unhealthy',
      service: 'R2',
      message: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 生成配置指南的辅助函数
 */
async function generateConfigurationGuide(platform: 'obsidian' | 'logseq' | 'other'): Promise<ConfigurationGuide> {
  const now = new Date();
  
  // 根据平台生成不同的配置指南
  const baseGuide: Partial<ConfigurationGuide> = {
    platform,
    title: `${platform === 'obsidian' ? 'Obsidian' : platform === 'logseq' ? 'Logseq' : '通用'}同步配置指南`,
    description: `本指南将帮助您配置News-Sync应用与${platform === 'obsidian' ? 'Obsidian' : platform === 'logseq' ? 'Logseq' : '您的同步工具'}进行安全连接`,
    lastUpdated: now,
    version: '1.0'
  };

  const sections: GuideSection[] = [];
  const setupSteps: SetupStep[] = [];

  if (platform === 'obsidian') {
    // Obsidian特定的配置指南
    sections.push(
      {
        title: '获取同步凭证',
        content: '在News-Sync网站上获取您的R2同步凭证。这些凭证将为您提供只读访问权限，确保您的数据安全。',
        importance: 'required'
      },
      {
        title: '安装Obsidian Sync插件',
        content: '在Obsidian的插件市场中搜索"News Sync"插件并安装。该插件支持R2存储后端的自动同步。',
        importance: 'required'
      },
      {
        title: '配置同步设置',
        content: '在Obsidian的设置中，找到News Sync插件的设置面板，输入您获取的同步凭证信息。',
        importance: 'required'
      }
    );

    setupSteps.push(
      {
        step: 1,
        title: '创建News-Sync账户',
        description: '如果您还没有账户，请先注册News-Sync账户',
        instructions: [
          '访问News-Sync网站并点击"注册"',
          '填写必要的信息并验证您的邮箱',
          '完成注册流程'
        ],
        estimatedTime: '5分钟',
        difficulty: 'beginner'
      },
      {
        step: 2,
        title: '获取同步凭证',
        description: '登录您的News-Sync账户，进入同步设置页面，创建您的R2访问凭证。',
        instructions: [
          '点击"创建新凭证"',
          '为凭证命名（例如："我的Obsidian同步"）',
          '选择R2桶和区域设置',
          '点击"生成凭证"按钮'
        ],
        estimatedTime: '3分钟',
        difficulty: 'beginner'
      },
      {
        step: 3,
        title: '复制凭证信息',
        description: '系统将生成您的R2访问凭证，请安全地复制这些信息。',
        instructions: [
          '点击"复制凭证信息"按钮',
          '安全地复制Access Key ID和Secret Access Key',
          '不要分享这些凭证给他人'
        ],
        estimatedTime: '1分钟',
        difficulty: 'beginner'
      },
      {
        step: 4,
        title: '安装Obsidian插件',
        description: '在Obsidian中安装News Sync插件以启用同步功能。',
        instructions: [
          '打开Obsidian',
          '进入"设置" > "插件"',
          '点击"浏览社区插件"',
          '搜索"News Sync"',
          '点击"安装"按钮'
        ],
        estimatedTime: '2分钟',
        difficulty: 'beginner'
      },
      {
        step: 5,
        title: '配置同步设置',
        description: '在Obsidian中配置News Sync插件，使用您的凭证信息。',
        instructions: [
          '在Obsidian中按Ctrl+P打开命令面板',
          '输入"News Sync: configure"命令',
          '按照提示输入您的凭证信息',
          '选择同步间隔和设置'
        ],
        expectedOutput: '插件配置完成并显示"同步成功"消息',
        estimatedTime: '3分钟',
        difficulty: 'intermediate'
      }
    );

  } else if (platform === 'logseq') {
    // Logseq特定的配置指南
    sections.push(
      {
        title: '获取同步凭证',
        content: '在News-Sync网站上获取您的R2同步凭证。这些凭证将为您提供只读访问权限，确保您的数据安全。',
        importance: 'required'
      },
      {
        title: '安装Logseq同步插件',
        content: '安装支持R2存储的Logseq同步插件。您可以在Logseq插件市场中找到相关插件。',
        importance: 'required'
      }
    );

    setupSteps.push(
      {
        step: 1,
        title: '创建News-Sync账户',
        description: '注册News-Sync账户以获取同步功能。',
        instructions: [
          '访问News-Sync网站',
          '点击"注册账户"',
          '填写注册信息',
          '验证您的邮箱地址'
        ],
        estimatedTime: '5分钟',
        difficulty: 'beginner'
      },
      {
        step: 2,
        title: '获取R2凭证',
        description: '在您的账户设置中创建R2访问凭证。',
        instructions: [
          '登录News-Sync账户',
          '进入"同步设置"页面',
          '点击"创建凭证"',
          '配置R2桶和权限设置',
          '保存凭证信息'
        ],
        expectedOutput: '成功创建凭证并显示凭证详情',
        estimatedTime: '3分钟',
        difficulty: 'beginner'
      },
      {
        step: 3,
        title: '配置Logseq同步',
        description: '在Logseq中配置R2同步设置。',
        instructions: [
          '打开Logseq',
          '进入"设置" > "同步"',
          '选择"自定义同步"',
          '输入您的R2凭证信息',
          '设置同步间隔和文件夹'
        ],
        expectedOutput: 'Logseq显示同步配置界面',
        estimatedTime: '5分钟',
        difficulty: 'intermediate'
      }
    );

  } else {
    // 通用配置指南
    sections.push(
      {
        title: '获取同步凭证',
        content: '在News-Sync网站上获取您的R2访问凭证。这些凭证将为您提供只读访问权限，确保您的数据安全。',
        importance: 'required'
      },
      {
        title: '配置您的同步工具',
        content: '查看您使用的同步工具的文档，了解如何配置R2访问。大多数同步工具都支持S3兼容的对象存储。',
        importance: 'required'
      }
    );

    setupSteps.push(
      {
        step: 1,
        title: '创建账户和凭证',
        description: '在News-Sync网站创建账户并生成您的R2访问凭证。',
        instructions: [
          '注册News-Sync账户',
          '登录后访问"同步设置"',
          '创建新的R2访问凭证',
          '保存凭证信息'
        ],
        expectedOutput: '账户创建成功且凭证信息已生成',
        estimatedTime: '8分钟',
        difficulty: 'beginner'
      },
      {
        step: 2,
        title: '配置同步工具',
        description: '在您选择的同步工具中配置R2访问设置。',
        instructions: [
          '打开您的同步工具',
          '进入同步或存储设置',
          '选择"S3"或"R2兼容存储"',
          '输入您的凭证信息',
          '配置存储桶和路径'
        ],
        expectedOutput: '同步工具显示连接成功状态',
        estimatedTime: '10分钟',
        difficulty: 'intermediate'
      }
    );
  }

  // 添加通用部分
  sections.push(
    {
      title: '安全最佳实践',
      content: '请妥善保管您的凭证信息。定期轮换凭证，避免使用过期凭证。如果怀疑凭证泄露，请立即撤销并重新生成。',
      importance: 'recommended'
    },
    {
      title: '故障排除',
      content: '如果遇到同步问题，请检查凭证是否过期、网络连接是否正常、存储桶权限是否正确。必要时重新生成凭证。',
      importance: 'recommended'
    }
  );

  const troubleshootingTips = [
    '确保凭证信息复制正确，没有多余的空格',
    '检查系统时间是否同步，确保时间设置正确',
    '验证网络连接是否正常，能否访问R2服务',
    '确认存储桶存在且权限配置正确',
    '查看同步工具的日志，了解详细的错误信息',
    '如果问题持续存在，请重新生成凭证'
  ];

  return {
    ...baseGuide,
    sections,
    setupSteps,
    screenshots: [], // 实际应用中需要添加真实截图
    troubleshootingTips
  };
}

export default credentialRoutes;