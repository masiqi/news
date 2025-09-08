import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { db } from '../index';
import { sourceCategories, sourceCategoryRelations } from '../../db/schema';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';

const adminCategoriesRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用所有管理员路由的中间件
adminCategoriesRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// 获取所有分类
adminCategoriesRoutes.get('/', async (c) => {
  try {
    const { search, isActive, sortBy = 'sortOrder', sortOrder = 'asc' } = c.req.query();
    
    let whereConditions = [];
    
    if (isActive !== undefined) {
      whereConditions.push(eq(sourceCategories.isActive, isActive === 'true'));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(sourceCategories.name, `%${search}%`),
          like(sourceCategories.description, `%${search}%`)
        )
      );
    }

    // 构建查询
    let query = db.select().from(sourceCategories);
    
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // 排序
    const orderColumn = sourceCategories[sortBy as keyof typeof sourceCategories];
    const orderFn = sortOrder === 'desc' ? desc : asc;
    query = query.orderBy(orderFn(orderColumn));

    const categories = await query;
    
    return c.json({ categories });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return c.json({ error: '获取分类列表失败' }, 500);
  }
});

// 获取单个分类详情
adminCategoriesRoutes.get('/:id', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('id'));
    
    if (isNaN(categoryId)) {
      return c.json({ error: '无效的分类ID' }, 400);
    }

    const [category] = await db
      .select()
      .from(sourceCategories)
      .where(eq(sourceCategories.id, categoryId));

    if (!category) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 获取该分类下的源数量
    const [sourceCount] = await db
      .select({ count: sql`count(*)` })
      .from(sourceCategoryRelations)
      .where(eq(sourceCategoryRelations.categoryId, categoryId));

    return c.json({ 
      category,
      sourceCount: Number(sourceCount?.count || 0),
    });
  } catch (error) {
    console.error('获取分类详情失败:', error);
    return c.json({ error: '获取分类详情失败' }, 500);
  }
});

// 创建分类
adminCategoriesRoutes.post('/', async (c) => {
  try {
    const user = getCurrentUser(c);
    const {
      name,
      description,
      icon,
      color,
      isActive = true,
      sortOrder = 0,
    } = await c.req.json();

    // 验证必填字段
    if (!name) {
      return c.json({ error: '分类名称是必填项' }, 400);
    }

    // 检查名称是否已存在
    const [existingCategory] = await db
      .select()
      .from(sourceCategories)
      .where(eq(sourceCategories.name, name));

    if (existingCategory) {
      return c.json({ error: '分类名称已存在' }, 409);
    }

    const now = new Date();
    
    // 创建分类
    const [newCategory] = await db
      .insert(sourceCategories)
      .values({
        name,
        description,
        icon,
        color,
        isActive,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ category: newCategory }, 201);
  } catch (error) {
    console.error('创建分类失败:', error);
    return c.json({ error: '创建分类失败' }, 500);
  }
});

// 更新分类
adminCategoriesRoutes.put('/:id', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('id'));
    
    if (isNaN(categoryId)) {
      return c.json({ error: '无效的分类ID' }, 400);
    }

    const {
      name,
      description,
      icon,
      color,
      isActive,
      sortOrder,
    } = await c.req.json();

    // 检查分类是否存在
    const [existingCategory] = await db
      .select()
      .from(sourceCategories)
      .where(eq(sourceCategories.id, categoryId));

    if (!existingCategory) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 如果要修改名称，检查是否已存在
    if (name && name !== existingCategory.name) {
      const [duplicateCategory] = await db
        .select()
        .from(sourceCategories)
        .where(
          and(
            eq(sourceCategories.name, name),
            sql`${sourceCategories.id} != ${categoryId}`
          )
        );

      if (duplicateCategory) {
        return c.json({ error: '分类名称已存在' }, 409);
      }
    }

    // 构建更新数据
    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    };

    // 更新分类
    const [updatedCategory] = await db
      .update(sourceCategories)
      .set(updateData)
      .where(eq(sourceCategories.id, categoryId))
      .returning();

    return c.json({ category: updatedCategory });
  } catch (error) {
    console.error('更新分类失败:', error);
    return c.json({ error: '更新分类失败' }, 500);
  }
});

// 删除分类
adminCategoriesRoutes.delete('/:id', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('id'));
    
    if (isNaN(categoryId)) {
      return c.json({ error: '无效的分类ID' }, 400);
    }

    // 检查分类是否存在
    const [category] = await db
      .select()
      .from(sourceCategories)
      .where(eq(sourceCategories.id, categoryId));

    if (!category) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 检查是否有关联的源
    const [sourceCount] = await db
      .select({ count: sql`count(*)` })
      .from(sourceCategoryRelations)
      .where(eq(sourceCategoryRelations.categoryId, categoryId));

    if (Number(sourceCount?.count || 0) > 0) {
      return c.json({ 
        error: '该分类下还有关联的推荐源，无法删除',
        sourceCount: Number(sourceCount?.count || 0),
      }, 409);
    }

    // 删除分类
    await db.delete(sourceCategories).where(eq(sourceCategories.id, categoryId));

    return c.json({ success: true });
  } catch (error) {
    console.error('删除分类失败:', error);
    return c.json({ error: '删除分类失败' }, 500);
  }
});

// 批量更新分类排序
adminCategoriesRoutes.patch('/reorder', async (c) => {
  try {
    const { categoryOrders } = await c.req.json();

    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      return c.json({ error: '请提供有效的分类排序数据' }, 400);
    }

    // 验证数据格式
    for (const item of categoryOrders) {
      if (typeof item.id !== 'number' || typeof item.sortOrder !== 'number') {
        return c.json({ error: '排序数据格式错误' }, 400);
      }
    }

    // 批量更新排序
    const updatePromises = categoryOrders.map(item =>
      db
        .update(sourceCategories)
        .set({ 
          sortOrder: item.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(sourceCategories.id, item.id))
    );

    await Promise.all(updatePromises);

    return c.json({ success: true });
  } catch (error) {
    console.error('批量更新分类排序失败:', error);
    return c.json({ error: '批量更新分类排序失败' }, 500);
  }
});

// 启用/禁用分类
adminCategoriesRoutes.patch('/:id/toggle', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('id'));
    const { isActive } = await c.req.json();
    
    if (isNaN(categoryId)) {
      return c.json({ error: '无效的分类ID' }, 400);
    }

    if (typeof isActive !== 'boolean') {
      return c.json({ error: 'isActive必须是布尔值' }, 400);
    }

    // 检查分类是否存在
    const [category] = await db
      .select()
      .from(sourceCategories)
      .where(eq(sourceCategories.id, categoryId));

    if (!category) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 更新分类状态
    const [updatedCategory] = await db
      .update(sourceCategories)
      .set({ 
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(sourceCategories.id, categoryId))
      .returning();

    return c.json({ category: updatedCategory });
  } catch (error) {
    console.error('切换分类状态失败:', error);
    return c.json({ error: '切换分类状态失败' }, 500);
  }
});

export default adminCategoriesRoutes;