// 用户自动存储设置API路由
// 提供用户自动存储偏好设置的管理功能

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { UserAutoStorageService } from '../services/user-auto-storage.service';
import { AutoMarkdownStorageService } from '../services/auto-markdown-storage.service';
import type { UserAutoStorageConfig } from '../services/user-auto-storage.service';

const autoStorageRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 初始化服务
const initializeServices = (c: any) => {
  const db = drizzle(c.env.DB);
  const storageConfigService = new UserAutoStorageService(c.env.DB);
  const autoStorageService = new AutoMarkdownStorageService(c.env);
  return { db, storageConfigService, autoStorageService };
};

/**
 * 获取用户自动存储设置
 */
autoStorageRoutes.get('/user/auto-storage/settings', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { storageConfigService } = initializeServices(c);

    console.log(`获取用户${userId}的自动存储设置`);

    const config = await storageConfigService.getUserConfig(userId);

    return c.json({
      success: true,
      message: '获取设置成功',
      settings: {
        ...config,
        supportedFormats: storageConfigService.getSupportedFormats()
      }
    });

  } catch (error) {
    console.error('获取用户自动存储设置失败:', error);
    return c.json({
      success: false,
      message: '获取设置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 更新用户自动存储设置
 */
autoStorageRoutes.put('/user/auto-storage/settings', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { storageConfigService } = initializeServices(c);

    const body = await c.req.json();
    const {
      enabled,
      storagePath,
      filenamePattern,
      maxFileSize,
      maxFilesPerDay,
      includeMetadata,
      fileFormat
    } = body;

    console.log(`更新用户${userId}的自动存储设置`);

    // 验证配置
    const validation = storageConfigService.validateConfig({
      enabled,
      storagePath,
      filenamePattern,
      maxFileSize,
      maxFilesPerDay,
      includeMetadata,
      fileFormat
    });

    if (!validation.isValid) {
      return c.json({
        success: false,
        message: '配置验证失败',
        errors: validation.errors
      }, 400);
    }

    // 更新配置
    const updatedConfig = await storageConfigService.updateConfig(userId, {
      enabled,
      storagePath,
      filenamePattern,
      maxFileSize,
      maxFilesPerDay,
      includeMetadata,
      fileFormat
    });

    return c.json({
      success: true,
      message: '设置更新成功',
      settings: updatedConfig
    });

  } catch (error) {
    console.error('更新用户自动存储设置失败:', error);
    return c.json({
      success: false,
      message: '更新设置失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取用户存储的markdown文件列表
 */
autoStorageRoutes.get('/user/auto-storage/files', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { autoStorageService } = initializeServices(c);

    console.log(`获取用户${userId}的markdown文件列表`);

    const files = await autoStorageService.getUserMarkdownFiles(userId);

    return c.json({
      success: true,
      message: '获取文件列表成功',
      files,
      total: files.length
    });

  } catch (error) {
    console.error('获取用户markdown文件列表失败:', error);
    return c.json({
      success: false,
      message: '获取文件列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取用户存储统计信息
 */
autoStorageRoutes.get('/user/auto-storage/statistics', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { autoStorageService, storageConfigService } = initializeServices(c);

    console.log(`获取用户${userId}的存储统计`);

    const storageStats = await autoStorageService.getUserStorageStats(userId);
    const userConfig = await storageConfigService.getUserConfig(userId);
    const quotaCheck = await storageConfigService.checkDailyQuota(userId);

    return c.json({
      success: true,
      message: '获取统计信息成功',
      statistics: {
        ...storageStats,
        quota: {
          maxFilesPerDay: userConfig.maxFilesPerDay,
          usedToday: quotaCheck.usedCount,
          remainingToday: Math.max(0, userConfig.maxFilesPerDay - quotaCheck.usedCount),
          withinLimit: quotaCheck.withinLimit
        },
        config: {
          enabled: userConfig.enabled,
          storagePath: userConfig.storagePath,
          fileFormat: userConfig.fileFormat
        }
      }
    });

  } catch (error) {
    console.error('获取用户存储统计失败:', error);
    return c.json({
      success: false,
      message: '获取统计信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 删除用户的markdown文件
 */
autoStorageRoutes.delete('/user/auto-storage/files/:fileName', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const fileName = c.req.param('fileName');
    const { autoStorageService } = initializeServices(c);

    console.log(`删除用户${userId}的markdown文件: ${fileName}`);

    const success = await autoStorageService.deleteUserMarkdownFile(userId, fileName);

    if (!success) {
      return c.json({
        success: false,
        message: '删除文件失败'
      }, 500);
    }

    return c.json({
      success: true,
      message: '文件删除成功'
    });

  } catch (error) {
    console.error('删除用户markdown文件失败:', error);
    return c.json({
      success: false,
      message: '删除文件失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 重新生成特定条目的markdown文件
 */
autoStorageRoutes.post('/user/auto-storage/regenerate/:entryId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const entryId = parseInt(c.req.param('entryId'));
    const { autoStorageService } = initializeServices(c);

    const body = await c.req.json();
    const { force = false } = body;

    console.log(`重新生成用户${userId}的markdown文件，条目ID: ${entryId}`);

    const result = await autoStorageService.regenerateMarkdown({
      userId,
      entryId,
      force
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: '重新生成失败',
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      message: '重新生成成功',
      result: {
        filePath: result.filePath,
        fileSize: result.fileSize,
        processingTime: result.processingTime
      }
    });

  } catch (error) {
    console.error('重新生成markdown文件失败:', error);
    return c.json({
      success: false,
      message: '重新生成失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 批量重新生成markdown文件
 */
autoStorageRoutes.post('/user/auto-storage/batch-regenerate', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { autoStorageService } = initializeServices(c);

    const body = await c.req.json();
    const { entryIds, force = false } = body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return c.json({
        success: false,
        message: '请提供有效的条目ID列表'
      }, 400);
    }

    if (entryIds.length > 20) {
      return c.json({
        success: false,
        message: '批量操作最多支持20个条目'
      }, 400);
    }

    console.log(`批量重新生成用户${userId}的markdown文件，数量: ${entryIds.length}`);

    const results = await Promise.allSettled(
      entryIds.map(entryId => 
        autoStorageService.regenerateMarkdown({ userId, entryId, force })
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    return c.json({
      success: true,
      message: `批量处理完成，成功: ${successCount}, 失败: ${failureCount}`,
      results: {
        total: results.length,
        successCount,
        failureCount
      }
    });

  } catch (error) {
    console.error('批量重新生成markdown文件失败:', error);
    return c.json({
      success: false,
      message: '批量处理失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 测试文件名生成模式
 */
autoStorageRoutes.post('/user/auto-storage/test-filename', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { storageConfigService } = initializeServices(c);

    const body = await c.req.json();
    const { pattern, title } = body;

    if (!pattern || !title) {
      return c.json({
        success: false,
        message: '请提供文件名模式和标题'
      }, 400);
    }

    console.log(`测试用户${userId}的文件名模式`);

    const testFileName = storageConfigService.generateFileName(pattern, {
      title,
      id: 12345,
      date: new Date(),
      sourceName: '测试源'
    });

    return c.json({
      success: true,
      message: '文件名生成测试成功',
      result: {
        pattern,
        title,
        generatedFileName: testFileName
      }
    });

  } catch (error) {
    console.error('测试文件名生成失败:', error);
    return c.json({
      success: false,
      message: '测试失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 预览不同格式的markdown输出
 */
autoStorageRoutes.post('/user/auto-storage/preview-formats', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = parseInt(user.id);
    const { storageConfigService } = initializeServices(c);

    const body = await c.req.json();
    const { title, content, summary } = body;

    if (!title || !content) {
      return c.json({
        success: false,
        message: '请提供标题和内容'
      }, 400);
    }

    console.log(`预览用户${userId}的markdown格式`);

    // 创建模拟的分析结果
    const mockResult = {
      id: 'preview',
      title,
      content,
      summary: summary || '这是预览摘要',
      keywords: ['关键词1', '关键词2', '关键词3'],
      categories: ['分类1', '分类2'],
      sentiment: '中性',
      importance: 3,
      readability: 4,
      processingTime: 1000,
      aiTokensUsed: 500,
      aiModel: 'glm-4.5-flash',
      aiProvider: 'ZhipuAI',
      status: 'completed'
    };

    const { MarkdownGenerator } = await import('../services/ai/markdown-generator');
    const markdownGenerator = new MarkdownGenerator();

    const formats = {
      standard: markdownGenerator.generateSimpleMarkdown(mockResult),
      academic: markdownGenerator.generateAcademicMarkdown(mockResult),
      concise: markdownGenerator.generateConciseMarkdown(mockResult)
    };

    return c.json({
      success: true,
      message: '格式预览生成成功',
      formats
    });

  } catch (error) {
    console.error('预览markdown格式失败:', error);
    return c.json({
      success: false,
      message: '预览失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default autoStorageRoutes;