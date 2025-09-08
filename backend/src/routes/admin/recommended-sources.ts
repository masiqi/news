import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { SourceStateService, SourceFilterOptions, SourceStateUpdate } from '../../services/admin/source-state.service';
import { QualityAssessmentService } from '../../services/admin/quality-assessment.service';
import { db } from '../index';
import { sources, sourceCategories, sourceTags, sourceCategoryRelations, sourceTagRelations } from '../../db/schema';
import { eq, and, or, like, inArray } from 'drizzle-orm';

const adminRecommendedSourcesRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用所有管理员路由的中间件
adminRecommendedSourcesRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// 初始化服务
const sourceStateService = new SourceStateService();
const qualityAssessmentService = new QualityAssessmentService();

// 获取所有推荐源
adminRecommendedSourcesRoutes.get('/', async (c) => {
  try {
    const {
      isRecommended = 'true',
      recommendationLevel,
      validationStatus,
      categoryIds,
      tagIds,
      searchQuery,
      page = '1',
      limit = '20',
    } = c.req.query();

    const options: SourceFilterOptions = {
      isRecommended: isRecommended === 'true',
      recommendationLevel: recommendationLevel as any,
      validationStatus: validationStatus as any,
      categoryIds: categoryIds ? categoryIds.split(',').map(Number) : undefined,
      tagIds: tagIds ? tagIds.split(',').map(Number) : undefined,
      searchQuery,
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const result = await sourceStateService.getRecommendedSources(options);
    
    return c.json(result);
  } catch (error) {
    console.error('获取推荐源列表失败:', error);
    return c.json({ error: '获取推荐源列表失败' }, 500);
  }
});

// 获取推荐源统计信息
adminRecommendedSourcesRoutes.get('/statistics', async (c) => {
  try {
    const statistics = await sourceStateService.getRecommendedSourcesStatistics();
    return c.json({ statistics });
  } catch (error) {
    console.error('获取推荐源统计失败:', error);
    return c.json({ error: '获取推荐源统计失败' }, 500);
  }
});

// 获取单个推荐源详情
adminRecommendedSourcesRoutes.get('/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({ error: '无效的源ID' }, 400);
    }

    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({ error: '推荐源不存在' }, 404);
    }

    return c.json({ source });
  } catch (error) {
    console.error('获取推荐源详情失败:', error);
    return c.json({ error: '获取推荐源详情失败' }, 500);
  }
});

// 创建推荐源
adminRecommendedSourcesRoutes.post('/', async (c) => {
  try {
    const user = getCurrentUser(c);
    const {
      url,
      name,
      description,
      recommendationLevel = 'basic',
      categoryIds = [],
      tagIds = [],
    } = await c.req.json();

    // 验证必填字段
    if (!url || !name) {
      return c.json({ error: 'URL和名称是必填项' }, 400);
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return c.json({ error: '无效的URL格式' }, 400);
    }

    // 验证推荐级别
    const validLevels = ['basic', 'premium', 'featured'];
    if (!validLevels.includes(recommendationLevel)) {
      return c.json({ error: '无效的推荐级别' }, 400);
    }

    // 创建推荐源
    const [newSource] = await db
      .insert(sources)
      .values({
        userId: 0, // 管理员创建的源，userId设为0
        url,
        name,
        description,
        isPublic: true,
        isRecommended: true,
        recommendationLevel: recommendationLevel as any,
        recommendedBy: user?.id,
        recommendedAt: new Date(),
        createdAt: new Date(),
      })
      .returning();

    if (!newSource) {
      return c.json({ error: '创建推荐源失败' }, 500);
    }

    // 处理分类关联
    if (categoryIds.length > 0) {
      await db
        .insert(sourceCategoryRelations)
        .values(
          categoryIds.map((categoryId: number) => ({
            sourceId: newSource.id,
            categoryId,
            createdAt: new Date(),
          }))
        );
    }

    // 处理标签关联
    if (tagIds.length > 0) {
      await db
        .insert(sourceTagRelations)
        .values(
          tagIds.map((tagId: number) => ({
            sourceId: newSource.id,
            tagId,
            createdAt: new Date(),
          }))
        );
    }

    return c.json({ source: newSource }, 201);
  } catch (error) {
    console.error('创建推荐源失败:', error);
    return c.json({ error: '创建推荐源失败' }, 500);
  }
});

// 更新推荐源
adminRecommendedSourcesRoutes.put('/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({ error: '无效的源ID' }, 400);
    }

    const {
      url,
      name,
      description,
      isRecommended,
      recommendationLevel,
      categoryIds,
      tagIds,
    } = await c.req.json();

    // 检查源是否存在
    const [existingSource] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!existingSource) {
      return c.json({ error: '推荐源不存在' }, 404);
    }

    // 构建更新数据
    const updateData: any = {
      ...(url && { url }),
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(isRecommended !== undefined && { isRecommended }),
      ...(recommendationLevel && { recommendationLevel: recommendationLevel as any }),
    };

    // 更新源信息
    const [updatedSource] = await db
      .update(sources)
      .set(updateData)
      .where(eq(sources.id, sourceId))
      .returning();

    // 更新分类关联
    if (categoryIds !== undefined) {
      // 先删除现有关联
      await db
        .delete(sourceCategoryRelations)
        .where(eq(sourceCategoryRelations.sourceId, sourceId));

      // 添加新关联
      if (categoryIds.length > 0) {
        await db
          .insert(sourceCategoryRelations)
          .values(
            categoryIds.map((categoryId: number) => ({
              sourceId,
              categoryId,
              createdAt: new Date(),
            }))
          );
      }
    }

    // 更新标签关联
    if (tagIds !== undefined) {
      // 先删除现有关联
      await db
        .delete(sourceTagRelations)
        .where(eq(sourceTagRelations.sourceId, sourceId));

      // 添加新关联
      if (tagIds.length > 0) {
        await db
          .insert(sourceTagRelations)
          .values(
            tagIds.map((tagId: number) => ({
              sourceId,
              tagId,
              createdAt: new Date(),
            }))
          );
      }
    }

    return c.json({ source: updatedSource });
  } catch (error) {
    console.error('更新推荐源失败:', error);
    return c.json({ error: '更新推荐源失败' }, 500);
  }
});

// 删除推荐源
adminRecommendedSourcesRoutes.delete('/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({ error: '无效的源ID' }, 400);
    }

    // 检查源是否存在
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({ error: '推荐源不存在' }, 404);
    }

    // 删除源（相关的关联会通过级联删除自动处理）
    await db.delete(sources).where(eq(sources.id, sourceId));

    return c.json({ success: true });
  } catch (error) {
    console.error('删除推荐源失败:', error);
    return c.json({ error: '删除推荐源失败' }, 500);
  }
});

// 验证推荐源
adminRecommendedSourcesRoutes.post('/:id/validate', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const user = getCurrentUser(c);
    
    if (isNaN(sourceId)) {
      return c.json({ error: '无效的源ID' }, 400);
    }

    // 检查源是否存在
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({ error: '推荐源不存在' }, 404);
    }

    // 执行质量评估
    const validationResult = await qualityAssessmentService.assessSourceQuality(sourceId);
    
    // 记录验证历史
    await qualityAssessmentService.recordValidationHistory(
      validationResult,
      'manual',
      user?.id
    );

    // 更新源的质量信息
    await sourceStateService.updateSourceState(sourceId, {
      validationStatus: validationResult.status,
      validationNotes: validationResult.errorMessage,
    }, user?.id);

    return c.json({ validation: validationResult });
  } catch (error) {
    console.error('验证推荐源失败:', error);
    return c.json({ error: '验证推荐源失败' }, 500);
  }
});

// 批量验证推荐源
adminRecommendedSourcesRoutes.post('/batch-validate', async (c) => {
  try {
    const { sourceIds } = await c.req.json();

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return c.json({ error: '请提供有效的源ID列表' }, 400);
    }

    const results = await qualityAssessmentService.batchValidateSources(sourceIds);

    return c.json({ 
      results,
      processed: results.length,
      success: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warning: results.filter(r => r.status === 'warning').length,
    });
  } catch (error) {
    console.error('批量验证推荐源失败:', error);
    return c.json({ error: '批量验证推荐源失败' }, 500);
  }
});

// 启用/禁用推荐源
adminRecommendedSourcesRoutes.patch('/:id/toggle', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const user = getCurrentUser(c);
    const { isRecommended } = await c.req.json();
    
    if (isNaN(sourceId)) {
      return c.json({ error: '无效的源ID' }, 400);
    }

    if (typeof isRecommended !== 'boolean') {
      return c.json({ error: 'isRecommended必须是布尔值' }, 400);
    }

    const updatedSource = await sourceStateService.toggleSourceRecommendation(
      sourceId,
      isRecommended,
      user?.id
    );

    if (!updatedSource) {
      return c.json({ error: '推荐源不存在' }, 404);
    }

    return c.json({ source: updatedSource });
  } catch (error) {
    console.error('切换推荐源状态失败:', error);
    return c.json({ error: '切换推荐源状态失败' }, 500);
  }
});

export default adminRecommendedSourcesRoutes;