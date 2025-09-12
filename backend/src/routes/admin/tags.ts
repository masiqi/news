import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { initDB } from '../../db/index';
import { sourceTags, sourceTagRelations } from '../../db/schema';
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

export default adminTagsRoutes;