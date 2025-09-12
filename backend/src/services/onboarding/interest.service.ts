import { initDB } from '../../db/index';
import { interestCategories, userInterests, sources, sourceCategoryRelations, sourceTagRelations } from '../../db/schema';
import { eq, and, or, inArray, desc, asc, sql, like, isNull, gte } from 'drizzle-orm';

export interface InterestCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: number;
  sortOrder: number;
  isActive: boolean;
  relatedTags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInterest {
  id: number;
  userId: number;
  categoryId: number;
  level: 'low' | 'medium' | 'high';
  priority: number;
  selectedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterestWithStats extends InterestCategory {
  userCount: number;
  averagePriority: number;
}

export class InterestService {
  constructor(private db: any = null) {}

  /**
   * 获取所有兴趣分类
   */
  async getAllCategories(dbConnection?: any): Promise<InterestCategory[]> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const categories = await database
        .select()
        .from(interestCategories)
        .where(eq(interestCategories.isActive, true))
        .orderBy(asc(interestCategories.sortOrder), asc(interestCategories.name));

      return categories.map(category => ({
        ...category,
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      }));
    } catch (error) {
      console.error('获取兴趣分类失败:', error);
      throw new Error('获取兴趣分类失败');
    }
  }

  /**
   * 获取树状结构分类
   */
  async getCategoriesTree(): Promise<(InterestCategory & { children?: InterestCategory[] })[]> {
    try {
      const categories = await this.getAllCategories();
      
      // 构建树状结构
      const categoryMap = new Map<number, InterestCategory & { children?: InterestCategory[] }>();
      
      // 初始化所有节点
      for (const category of categories) {
        categoryMap.set(category.id, { ...category, children: [] });
      }
      
      // 构建层级关系
      const rootCategories: (InterestCategory & { children?: InterestCategory[] })[] = [];
      
      for (const category of categories) {
        if (category.parentId) {
          const parent = categoryMap.get(category.parentId);
          if (parent) {
            parent.children!.push(categoryMap.get(category.id)!);
          }
        } else {
          rootCategories.push(categoryMap.get(category.id)!);
        }
      }
      
      return rootCategories;
    } catch (error) {
      console.error('获取分类树失败:', error);
      throw new Error('获取分类树失败');
    }
  }

  /**
   * 获取用户兴趣
   */
  async getUserInterests(userId: number, dbConnection?: any): Promise<(UserInterest & { category?: InterestCategory })[]> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const interests = await database
        .select({
          id: userInterests.id,
          userId: userInterests.userId,
          categoryId: userInterests.categoryId,
          level: userInterests.level,
          priority: userInterests.priority,
          selectedAt: userInterests.selectedAt,
          isActive: userInterests.isActive,
          createdAt: userInterests.createdAt,
          updatedAt: userInterests.updatedAt,
        })
        .from(userInterests)
        .leftJoin(interestCategories, eq(interestCategories.id, userInterests.categoryId))
        .where(and(eq(userInterests.userId, userId), eq(userInterests.isActive, true)))
        .orderBy(desc(userInterests.selectedAt));

      return interests as any;
    } catch (error) {
      console.error('获取用户兴趣失败:', error);
      throw new Error('获取用户兴趣失败');
    }
  }

  /**
   * 保存用户兴趣
   */
  async saveUserInterests(userId: number, interests: { categoryId: number; level: 'low' | 'medium' | 'high' }[], dbConnection?: any): Promise<void> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      await database.transaction(async (tx) => {
        // 停用用户现有的兴趣
        await tx
          .update(userInterests)
          .set({ 
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(userInterests.userId, userId));

        // 插入新的兴趣
        for (const interest of interests) {
          const priority = interest.level === 'high' ? 8 : 
                            interest.level === 'medium' ? 5 : 3;
          
          await tx
            .insert(userInterests)
            .values({
              userId,
              categoryId: interest.categoryId,
              level: interest.level,
              priority,
              selectedAt: new Date(),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
        }
      });

      console.log(`用户 ${userId} 的兴趣保存成功`);
    } catch (error) {
      console.error('保存用户兴趣失败:', error);
      throw new Error('保存用户兴趣失败');
    }
  }

  /**
   * 更新用户兴趣
   */
  async updateUserInterest(userId: number, interestId: number, level: 'low' | 'medium' | 'high', dbConnection?: any): Promise<UserInterest> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const priority = level === 'high' ? 8 : level === 'medium' ? 5 : 3;
      
      const [updatedInterest] = await database
        .update(userInterests)
        .set({
          level,
          priority,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userInterests.id, interestId),
            eq(userInterests.userId, userId)
          )
        )
        .returning();

      if (!updatedInterest) {
        throw new Error('用户兴趣不存在');
      }

      return updatedInterest;
    } catch (error) {
      console.error('更新用户兴趣失败:', error);
      throw new Error('更新用户兴趣失败');
    }
  }

  /**
   * 删除用户兴趣
   */
  async deleteUserInterest(userId: number, interestId: number, dbConnection?: any): Promise<void> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      await database
        .update(userInterests)
        .set({ 
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userInterests.id, interestId),
            eq(userInterests.userId, userId)
          )
        );

      console.log(`用户 ${userId} 的兴趣 ${interestId} 删除成功`);
    } catch (error) {
      console.error('删除用户兴趣失败:', error);
      throw new Error('删除用户兴趣失败');
    }
  }

  /**
   * 获取热门分类
   */
  async getPopularCategories(limit: number = 10, dbConnection?: any): Promise<InterestWithStats[]> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const categories = await database
        .select({
          id: interestCategories.id,
          name: interestCategories.name,
          description: interestCategories.description,
          icon: interestCategories.icon,
          color: interestCategories.color,
          parentId: interestCategories.parentId,
          sortOrder: interestCategories.sortOrder,
          isActive: interestCategories.isActive,
          relatedTags: interestCategories.relatedTags,
          createdAt: interestCategories.createdAt,
          updatedAt: interestCategories.updatedAt,
        })
        .from(interestCategories)
        .leftJoin(userInterests, eq(userInterests.categoryId, interestCategories.id))
        .where(eq(interestCategories.isActive, true))
        .groupBy(
          interestCategories.id,
          interestCategories.name,
          interestCategories.description,
          interestCategories.icon,
          interestCategories.color,
          interestCategories.parentId,
          interestCategories.sortOrder,
          interestCategories.isActive,
          interestCategories.relatedTags,
          interestCategories.createdAt,
          interestCategories.updatedAt
        )
        .orderBy(desc(sql`count(${userInterests.id})`))
        .limit(limit);

      return categories.map(category => ({
        ...category,
        userCount: Number(category.userCount || 0),
        averagePriority: 5, // 默认中等优先级
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      }));
    } catch (error) {
      console.error('获取热门分类失败:', error);
      throw new Error('获取热门分类失败');
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStatistics(categoryId: number, dbConnection?: any): Promise<{
    userCount: number;
    averagePriority: number;
    relatedSourcesCount: number;
    popularityTrend: 'increasing' | 'decreasing' | 'stable';
  }> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      // 获取用户数量和平均优先级
      const [stats] = await database
        .select({
          userCount: sql`count(*)`.mapWith(Number),
          averagePriority: sql`avg(${userInterests.priority})`.mapWith(Number),
        })
        .from(userInterests)
        .where(eq(userInterests.categoryId, categoryId));

      // 获取相关源数量
      const [sourceStats] = await database
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(sources)
        .innerJoin(sourceCategoryRelations, eq(sourceCategoryRelations.sourceId, sources.id))
        .where(eq(sourceCategoryRelations.categoryId, categoryId));

      // 简化的趋势分析
      const popularityTrend = 'stable'; // 实际实现中应该基于历史数据计算
      
      return {
        userCount: Number(stats?.userCount || 0),
        averagePriority: Number(stats?.averagePriority || 5),
        relatedSourcesCount: Number(sourceStats?.count || 0),
        popularityTrend,
      };
    } catch (error) {
      console.error('获取分类统计失败:', error);
      throw new Error('获取分类统计失败');
    }
  }

  /**
   * 搜索分类
   */
  async searchCategories(query: string, dbConnection?: any): Promise<InterestCategory[]> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const categories = await database
        .select()
        .from(interestCategories)
        .where(
          and(
            eq(interestCategories.isActive, true),
            or(
              like(interestCategories.name, `%${query}%`),
              like(interestCategories.description, `%${query}%`)
            )
          )
        )
        .orderBy(asc(interestCategories.sortOrder), asc(interestCategories.name))
        .limit(20);

      return categories.map(category => ({
        ...category,
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      }));
    } catch (error) {
      console.error('搜索分类失败:', error);
      throw new Error('搜索分类失败');
    }
  }

  /**
   * 获取推荐分类（基于用户潜在兴趣）
   */
  async getRecommendedCategories(userId: number, limit: number = 8): Promise<InterestCategory[]> {
    try {
      // 获取用户已有的兴趣分类
      const userCategories = await this.db
        .select({ categoryId: userInterests.categoryId })
        .from(userInterests)
        .where(and(eq(userInterests.userId, userId), eq(userInterests.isActive, true)));

      const excludedCategoryIds = userCategories.map(uc => uc.categoryId);
      
      // 获取同级或相关分类
      const recommendedCategories = await this.db
        .select()
        .from(interestCategories)
        .where(
          and(
            eq(interestCategories.isActive, true),
            // 排除用户已有的分类
            excludedCategoryIds.length > 0 ? sql`${interestCategories.id} NOT IN (${excludedCategoryIds.join(',')})` : sql`1=1`,
            // 优先推荐父级分类或具有相同父级的分类
            or(
              isNull(interestCategories.parentId),
              inArray(
                interestCategories.parentId,
                userCategories.map(uc => {
                  const [category] = await this.db
                    .select({ parentId: interestCategories.parentId })
                    .from(interestCategories)
                    .where(eq(interestCategories.id, uc.categoryId))
                    .limit(1);
                  return category?.parentId;
                }).filter(Boolean)
              )
            )
          )
        )
        )
        .orderBy(desc(interestCategories.sortOrder))
        .limit(limit);

      return recommendedCategories.map(category => ({
        ...category,
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      }));
    } catch (error) {
      console.error('获取推荐分类失败:', error);
      throw new Error('获取推荐分类失败');
    }
  }

  /**
   * 更新分类排序
   */
  async updateCategoryOrder(categoryIds: number[], orders: number[], dbConnection?: any): Promise<void> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      if (categoryIds.length !== orders.length) {
        throw new Error('分类ID和排序数组长度不匹配');
      }

      await database.transaction(async (tx) => {
        for (let i = 0; i < categoryIds.length; i++) {
          await tx
            .update(interestCategories)
            .set({ 
              sortOrder: orders[i],
              updatedAt: new Date(),
            })
            .where(eq(interestCategories.id, categoryIds[i]));
        }
      });

      console.log('分类排序更新成功');
    } catch (error) {
      console.error('更新分类排序失败:', error);
      throw new Error('更新分类排序失败');
    }
  }

  /**
   * 验证分类名称是否可用
   */
  async validateCategoryName(name: string, excludeId?: number, dbConnection?: any): Promise<boolean> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      let query = database
        .select({ id: interestCategories.id })
        .from(interestCategories)
        .where(eq(interestCategories.name, name));

      if (excludeId) {
        query = query.where(sql`${interestCategories.id} != ${excludeId}`);
      }

      const result = await query.limit(1);
      return result.length === 0;
    } catch (error) {
      console.error('验证分类名称失败:', error);
      return false;
    }
  }

  /**
   * 获取分类详情
   */
  async getCategoryDetails(categoryId: number, dbConnection?: any): Promise<(InterestCategory & {
    userCount: number;
    averagePriority: number;
    subcategories: InterestCategory[];
  }) | null> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const [category] = await database
        .select()
        .from(interestCategories)
        .where(eq(interestCategories.id, categoryId))
        .limit(1);

      if (!category) {
        return null;
      }

      // 获取统计信息
      const [stats] = await database
        .select({
          userCount: sql`count(*)`.mapWith(Number),
          averagePriority: sql`avg(${userInterests.priority})`.mapWith(Number),
        })
        .from(userInterests)
        .where(eq(userInterests.categoryId, categoryId));

      // 获取子分类
      const subcategories = await database
        .select()
        .from(interestCategories)
        .where(
          and(
            eq(interestCategories.parentId, categoryId),
            eq(interestCategories.isActive, true)
          )
        )
        .orderBy(asc(interestCategories.sortOrder), asc(interestCategories.name));

      return {
        ...category,
        userCount: Number(stats?.userCount || 0),
        averagePriority: Number(stats?.averagePriority || 5),
        subcategories: subcategories.map(sub => ({
          ...sub,
          relatedTags: sub.relatedTags ? JSON.parse(sub.relatedTags) : [],
        })),
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      };
    } catch (error) {
      console.error('获取分类详情失败:', error);
      throw new Error('获取分类详情失败');
    }
  }
}