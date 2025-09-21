import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { initDB } from '../../db/index';
import { sourceTags, sourceTagRelations, userTopics, userKeywords, rssEntries, topicEntryRelations, keywordEntryRelations, processedContents, sources } from '../../db/schema';
import { tagAggregationService } from '../../services/tag-aggregation.service';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';

const adminTagsRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用所有管理员路由的中间件
adminTagsRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// 获取所有标签
adminTagsRoutes.get('/', async (c) => {
  try {
    const { search, isActive, sortBy = 'usageCount', sortOrder = 'desc' } = c.req.query();
    
    let whereConditions = [];
    
    if (isActive !== undefined) {
      whereConditions.push(eq(sourceTags.isActive, isActive === 'true'));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(sourceTags.name, `%${search}%`),
          like(sourceTags.description, `%${search}%`)
        )
      );
    }

    // 构建查询
    let query = initDB(c.env.DB).select().from(sourceTags);
    
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // 排序
    const orderColumn = sourceTags[sortBy as keyof typeof sourceTags];
    const orderFn = sortOrder === 'desc' ? desc : asc;
    query = query.orderBy(orderFn(orderColumn));

    const tags = await query;
    
    return c.json({ tags });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return c.json({ error: '获取标签列表失败' }, 500);
  }
});

// 获取单个标签详情
adminTagsRoutes.get('/:id', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'));
    
    if (isNaN(tagId)) {
      return c.json({ error: '无效的标签ID' }, 400);
    }

    const [tag] = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.id, tagId));

    if (!tag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 获取该标签下的源数量
    const [sourceCount] = await initDB(c.env.DB)
      .select({ count: sql`count(*)` })
      .from(sourceTagRelations)
      .where(eq(sourceTagRelations.tagId, tagId));

    return c.json({ 
      tag,
      sourceCount: Number(sourceCount?.count || 0),
    });
  } catch (error) {
    console.error('获取标签详情失败:', error);
    return c.json({ error: '获取标签详情失败' }, 500);
  }
});

// 创建标签
adminTagsRoutes.post('/', async (c) => {
  try {
    const user = getCurrentUser(c);
    const {
      name,
      description,
      color,
      isActive = true,
    } = await c.req.json();

    // 验证必填字段
    if (!name) {
      return c.json({ error: '标签名称是必填项' }, 400);
    }

    // 检查名称是否已存在
    const [existingTag] = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.name, name));

    if (existingTag) {
      return c.json({ error: '标签名称已存在' }, 409);
    }

    const now = new Date();
    
    // 创建标签
    const [newTag] = await initDB(c.env.DB)
      .insert(sourceTags)
      .values({
        name,
        description,
        color,
        isActive,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ tag: newTag }, 201);
  } catch (error) {
    console.error('创建标签失败:', error);
    return c.json({ error: '创建标签失败' }, 500);
  }
});

// 更新标签
adminTagsRoutes.put('/:id', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'));
    
    if (isNaN(tagId)) {
      return c.json({ error: '无效的标签ID' }, 400);
    }

    const {
      name,
      description,
      color,
      isActive,
    } = await c.req.json();

    // 检查标签是否存在
    const [existingTag] = await db
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.id, tagId));

    if (!existingTag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 如果要修改名称，检查是否已存在
    if (name && name !== existingTag.name) {
      const [duplicateTag] = await initDB(c.env.DB)
        .select()
        .from(sourceTags)
        .where(
          and(
            eq(sourceTags.name, name),
            sql`${sourceTags.id} != ${tagId}`
          )
        );

      if (duplicateTag) {
        return c.json({ error: '标签名称已存在' }, 409);
      }
    }

    // 构建更新数据
    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    };

    // 更新标签
    const [updatedTag] = await initDB(c.env.DB)
      .update(sourceTags)
      .set(updateData)
      .where(eq(sourceTags.id, tagId))
      .returning();

    return c.json({ tag: updatedTag });
  } catch (error) {
    console.error('更新标签失败:', error);
    return c.json({ error: '更新标签失败' }, 500);
  }
});

// 删除标签
adminTagsRoutes.delete('/:id', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'));
    
    if (isNaN(tagId)) {
      return c.json({ error: '无效的标签ID' }, 400);
    }

    // 检查标签是否存在
    const [tag] = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.id, tagId));

    if (!tag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 检查是否有关联的源
    const [sourceCount] = await initDB(c.env.DB)
      .select({ count: sql`count(*)` })
      .from(sourceTagRelations)
      .where(eq(sourceTagRelations.tagId, tagId));

    if (Number(sourceCount?.count || 0) > 0) {
      return c.json({ 
        error: '该标签下还有关联的推荐源，无法删除',
        sourceCount: Number(sourceCount?.count || 0),
      }, 409);
    }

    // 删除标签
    await initDB(c.env.DB).delete(sourceTags).where(eq(sourceTags.id, tagId));

    return c.json({ success: true });
  } catch (error) {
    console.error('删除标签失败:', error);
    return c.json({ error: '删除标签失败' }, 500);
  }
});

// 启用/禁用标签
adminTagsRoutes.patch('/:id/toggle', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'));
    const { isActive } = await c.req.json();
    
    if (isNaN(tagId)) {
      return c.json({ error: '无效的标签ID' }, 400);
    }

    if (typeof isActive !== 'boolean') {
      return c.json({ error: 'isActive必须是布尔值' }, 400);
    }

    // 检查标签是否存在
    const [tag] = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.id, tagId));

    if (!tag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 更新标签状态
    const [updatedTag] = await db
      .update(sourceTags)
      .set({ 
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(sourceTags.id, tagId))
      .returning();

    return c.json({ tag: updatedTag });
  } catch (error) {
    console.error('切换标签状态失败:', error);
    return c.json({ error: '切换标签状态失败' }, 500);
  }
});

// 获取热门标签（按使用量排序）
adminTagsRoutes.get('/popular/limit/:limit', async (c) => {
  try {
    const limit = parseInt(c.req.param('limit')) || 10;
    
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      return c.json({ error: '无效的limit参数，必须在1-100之间' }, 400);
    }

    const popularTags = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.isActive, true))
      .orderBy(desc(sourceTags.usageCount))
      .limit(limit);

    return c.json({ tags: popularTags });
  } catch (error) {
    console.error('获取热门标签失败:', error);
    return c.json({ error: '获取热门标签失败' }, 500);
  }
});

// 更新标签使用量
adminTagsRoutes.patch('/:id/update-usage', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'));
    const { increment = 1 } = await c.req.json();
    
    if (isNaN(tagId)) {
      return c.json({ error: '无效的标签ID' }, 400);
    }

    if (typeof increment !== 'number') {
      return c.json({ error: 'increment必须是数字' }, 400);
    }

    // 检查标签是否存在
    const [tag] = await initDB(c.env.DB)
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.id, tagId));

    if (!tag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 更新使用量
    const [updatedTag] = await initDB(c.env.DB)
      .update(sourceTags)
      .set({ 
        usageCount: sql`${sourceTags.usageCount} + ${increment}`,
        updatedAt: new Date(),
      })
      .where(eq(sourceTags.id, tagId))
      .returning();

    return c.json({ tag: updatedTag });
  } catch (error) {
    console.error('更新标签使用量失败:', error);
    return c.json({ error: '更新标签使用量失败' }, 500);
  }
});

// 批量更新标签使用量
adminTagsRoutes.patch('/batch-update-usage', async (c) => {
  try {
    const { tagUpdates } = await c.req.json();

    if (!Array.isArray(tagUpdates) || tagUpdates.length === 0) {
      return c.json({ error: '请提供有效的标签更新数据' }, 400);
    }

    // 验证数据格式
    for (const item of tagUpdates) {
      if (typeof item.id !== 'number' || typeof item.increment !== 'number') {
        return c.json({ error: '更新数据格式错误' }, 400);
      }
    }

    // 批量更新使用量
    const updatePromises = tagUpdates.map(item =>
      initDB(c.env.DB)
        .update(sourceTags)
        .set({ 
          usageCount: sql`${sourceTags.usageCount} + ${item.increment}`,
          updatedAt: new Date(),
        })
        .where(eq(sourceTags.id, item.id))
    );

    await Promise.all(updatePromises);

    return c.json({ success: true });
  } catch (error) {
    console.error('批量更新标签使用量失败:', error);
    return c.json({ error: '批量更新标签使用量失败' }, 500);
  }
});

// ===== 标签聚合系统管理端点 =====

// 获取标签统计信息
adminTagsRoutes.get('/aggregation/statistics', async (c) => {
  try {
    const db = initDB(c.env.DB);
    
    // 获取总主题数
    const [topicsResult] = await db.select({ count: sql`count(*)` }).from(userTopics);
    
    // 获取总关键词数
    const [keywordsResult] = await db.select({ count: sql`count(*)` }).from(userKeywords);
    
    // 获取今日新增标签
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISOString = today.toISOString();
    const [todayTopicsResult] = await db
      .select({ count: sql`count(*)` })
      .from(userTopics)
      .where(sql`${userTopics.createdAt} >= ${todayISOString}`);
    
    const [todayKeywordsResult] = await db
      .select({ count: sql`count(*)` })
      .from(userKeywords)
      .where(sql`${userKeywords.createdAt} >= ${todayISOString}`);
    
    // 获取活跃标签数（过去7天有使用的）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISOString = sevenDaysAgo.toISOString();
    
    const [activeTopicsResult] = await db
      .select({ count: sql`count(*)` })
      .from(userTopics)
      .where(sql`${userTopics.lastUsedAt} >= ${sevenDaysAgoISOString}`);
    
    const [activeKeywordsResult] = await db
      .select({ count: sql`count(*)` })
      .from(userKeywords)
      .where(sql`${userKeywords.lastUsedAt} >= ${sevenDaysAgoISOString}`);

    const statistics = {
      totalTopics: Number(topicsResult?.count || 0),
      totalKeywords: Number(keywordsResult?.count || 0),
      todayNewTags: Number(todayTopicsResult?.count || 0) + Number(todayKeywordsResult?.count || 0),
      activeTags: Number(activeTopicsResult?.count || 0) + Number(activeKeywordsResult?.count || 0)
    };
    
    return c.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('获取标签统计失败:', error);
    return c.json({ error: '获取标签统计失败' }, 500);
  }
});

// 获取主题列表
adminTagsRoutes.get('/aggregation/topics', async (c) => {
  try {
    const { search, limit = '50', offset = '0' } = c.req.query();
    const db = initDB(c.env.DB);
    
    let query = db
      .select()
      .from(userTopics)
      .orderBy(desc(userTopics.entryCount))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    
    // 搜索过滤
    if (search) {
      query = query.where(like(userTopics.topicName, `%${search}%`));
    }
    
    const topics = await query;
    
    return c.json({
      success: true,
      data: { topics }
    });
  } catch (error) {
    console.error('获取主题列表失败:', error);
    return c.json({ error: '获取主题列表失败' }, 500);
  }
});

// 获取关键词列表
adminTagsRoutes.get('/aggregation/keywords', async (c) => {
  try {
    const { search, limit = '50', offset = '0' } = c.req.query();
    const db = initDB(c.env.DB);
    
    let query = db
      .select()
      .from(userKeywords)
      .orderBy(desc(userKeywords.entryCount))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    
    // 搜索过滤
    if (search) {
      query = query.where(like(userKeywords.keywordName, `%${search}%`));
    }
    
    const keywords = await query;
    
    return c.json({
      success: true,
      data: { keywords }
    });
  } catch (error) {
    console.error('获取关键词列表失败:', error);
    return c.json({ error: '获取关键词列表失败' }, 500);
  }
});

// 获取主题详情
adminTagsRoutes.get('/aggregation/topics/:topicName/detail', async (c) => {
  try {
    const topicName = decodeURIComponent(c.req.param('topicName'));
    const db = initDB(c.env.DB);
    
    const [topic] = await db
      .select()
      .from(userTopics)
      .where(eq(userTopics.topicName, topicName))
      .limit(1);
    
    if (!topic) {
      return c.json({ error: '主题不存在' }, 404);
    }
    
    // 获取相关条目示例
    const relatedEntries = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        link: rssEntries.link,
        publishedAt: rssEntries.publishedAt
      })
      .from(topicEntryRelations)
      .innerJoin(rssEntries, eq(topicEntryRelations.entryId, rssEntries.id))
      .where(eq(topicEntryRelations.topicId, topic.id))
      .limit(5);
    
    return c.json({
      success: true,
      data: {
        ...topic,
        relatedEntries
      }
    });
  } catch (error) {
    console.error('获取主题详情失败:', error);
    return c.json({ error: '获取主题详情失败' }, 500);
  }
});

// 获取关键词详情
adminTagsRoutes.get('/aggregation/keywords/:keywordName/detail', async (c) => {
  try {
    const keywordName = decodeURIComponent(c.req.param('keywordName'));
    const db = initDB(c.env.DB);
    
    const [keyword] = await db
      .select()
      .from(userKeywords)
      .where(eq(userKeywords.keywordName, keywordName))
      .limit(1);
    
    if (!keyword) {
      return c.json({ error: '关键词不存在' }, 404);
    }
    
    // 获取相关条目示例
    const relatedEntries = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        link: rssEntries.link,
        publishedAt: rssEntries.publishedAt
      })
      .from(keywordEntryRelations)
      .innerJoin(rssEntries, eq(keywordEntryRelations.entryId, rssEntries.id))
      .where(eq(keywordEntryRelations.keywordId, keyword.id))
      .limit(5);
    
    return c.json({
      success: true,
      data: {
        ...keyword,
        relatedEntries
      }
    });
  } catch (error) {
    console.error('获取关键词详情失败:', error);
    return c.json({ error: '获取关键词详情失败' }, 500);
  }
});

// 标签操作（重新聚合、清理等）
adminTagsRoutes.post('/aggregation/operations', async (c) => {
  try {
    const { operation, userId, reason } = await c.req.json();
    const db = initDB(c.env.DB);
    
    let result;
    
    switch (operation) {
      case 'reaggregate':
        // 重新聚合指定用户或所有用户的标签
        if (userId) {
          // 为指定用户重新聚合
          const contents = await db
            .select({ id: processedContents.id })
            .from(processedContents)
            .innerJoin(rssEntries, eq(processedContents.entryId, rssEntries.id))
            .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
            .where(eq(sources.userId, parseInt(userId)));
          
          let successCount = 0;
          for (const content of contents) {
            try {
              await tagAggregationService.processContentTags(content.id, db);
              successCount++;
            } catch (error) {
              console.error(`重新聚合内容失败: ${content.id}`, error);
            }
          }
          
          result = { successCount, total: contents.length };
        } else {
          // 为所有用户重新聚合（简化版本）
          result = { message: '全量重新聚合功能开发中，请指定具体用户ID' };
        }
        break;
        
      case 'cleanup':
        // 清理无效标签（entryCount为0的标签）
        const [deletedTopics] = await db
          .delete(userTopics)
          .where(eq(userTopics.entryCount, 0))
          .then(() => [{ count: '清理完成' }]);
        
        const [deletedKeywords] = await db
          .delete(userKeywords)
          .where(eq(userKeywords.entryCount, 0))
          .then(() => [{ count: '清理完成' }]);
        
        result = { topics: deletedTopics, keywords: deletedKeywords };
        break;
        
      case 'statistics':
        // 重新统计标签使用情况
        result = { message: '统计功能开发中' };
        break;
        
      default:
        return c.json({ error: '不支持的操作类型' }, 400);
    }
    
    // 记录操作日志
    const currentUser = getCurrentUser(c);
    console.log(`[ADMIN] 标签操作: ${operation} by ${currentUser?.email || 'admin'}`, {
      operation,
      userId,
      reason,
      result
    });
    
    return c.json({
      success: true,
      data: result,
      operation
    });
  } catch (error) {
    console.error('标签操作失败:', error);
    return c.json({ error: '标签操作失败' }, 500);
  }
});

export default adminTagsRoutes;