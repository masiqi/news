import { initDB } from '../../db/index';
import { sources, sourceCategories, sourceTags, sourceCategoryRelations, sourceTagRelations } from '../../db/schema';
import { eq, and, inArray, or, like, desc, asc, isNull, lte, sql } from 'drizzle-orm';

export interface SourceFilterOptions {
  isRecommended?: boolean;
  recommendationLevel?: 'basic' | 'premium' | 'featured';
  validationStatus?: 'pending' | 'approved' | 'rejected';
  categoryIds?: number[];
  tagIds?: number[];
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export interface SourceStateUpdate {
  isRecommended?: boolean;
  recommendationLevel?: 'basic' | 'premium' | 'featured';
  validationStatus?: 'pending' | 'approved' | 'rejected';
  validationNotes?: string;
}

export class SourceStateService {
  constructor(private db: any = null) {}

  /**
   * 更新推荐源状态
   */
  async updateSourceState(sourceId: number, updates: SourceStateUpdate, updatedBy?: number, dbConnection?: any): Promise<typeof sources.$inferSelect | null> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const updateData: any = {
        ...updates,
        recommendedBy: updatedBy,
        recommendedAt: updates.isRecommended ? new Date() : null,
      };

      if (updates.validationStatus) {
        updateData.qualityValidationStatus = updates.validationStatus;
        updateData.qualityValidationNotes = updates.validationNotes;
        updateData.qualityLastValidatedAt = new Date();
      }

      const [updatedSource] = await database
        .update(sources)
        .set(updateData)
        .where(eq(sources.id, sourceId))
        .returning();

      return updatedSource || null;
    } catch (error) {
      throw new Error(`Failed to update source state: ${error}`);
    }
  }

  /**
   * 批量更新推荐源状态
   */
  async batchUpdateSourceStates(sourceIds: number[], updates: SourceStateUpdate, updatedBy?: number, dbConnection?: any): Promise<typeof sources.$inferSelect[]> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      const updateData: any = {
        ...updates,
        recommendedBy: updatedBy,
        recommendedAt: updates.isRecommended ? new Date() : null,
      };

      if (updates.validationStatus) {
        updateData.qualityValidationStatus = updates.validationStatus;
        updateData.qualityValidationNotes = updates.validationNotes;
        updateData.qualityLastValidatedAt = new Date();
      }

      const updatedSources = await database
        .update(sources)
        .set(updateData)
        .where(inArray(sources.id, sourceIds))
        .returning();

      return updatedSources;
    } catch (error) {
      throw new Error(`Failed to batch update source states: ${error}`);
    }
  }

  /**
   * 获取推荐源列表
   */
  async getRecommendedSources(options: SourceFilterOptions = {}, dbConnection?: any): Promise<{
    sources: typeof sources.$inferSelect[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      isRecommended = true,
      recommendationLevel,
      validationStatus,
      categoryIds,
      tagIds,
      searchQuery,
      page = 1,
      limit = 20,
    } = options;

    const database = dbConnection || this.db;
    if (!database) {
      throw new Error('Database connection not provided');
    }

    const offset = (page - 1) * limit;
    let whereConditions = [eq(sources.isRecommended, isRecommended)];

    if (recommendationLevel) {
      whereConditions.push(eq(sources.recommendationLevel, recommendationLevel));
    }

    if (validationStatus) {
      whereConditions.push(eq(sources.qualityValidationStatus, validationStatus));
    }

    if (searchQuery) {
      whereConditions.push(
        or(
          like(sources.name, `%${searchQuery}%`),
          like(sources.description, `%${searchQuery}%`),
          like(sources.url, `%${searchQuery}%`)
        )
      );
    }

    // 构建查询
    let query = db
      .select()
      .from(sources)
      .where(and(...whereConditions));

    // 如果有分类或标签过滤，需要添加JOIN
    if (categoryIds && categoryIds.length > 0) {
      query = query
        .innerJoin(sourceCategoryRelations, eq(sources.id, sourceCategoryRelations.sourceId))
        .where(inArray(sourceCategoryRelations.categoryId, categoryIds));
    }

    if (tagIds && tagIds.length > 0) {
      query = query
        .innerJoin(sourceTagRelations, eq(sources.id, sourceTagRelations.sourceId))
        .where(inArray(sourceTagRelations.tagId, tagIds));
    }

    // 获取总数
    const [countResult] = await database
      .select({ count: sql`count(*)` })
      .from(sources)
      .where(and(...whereConditions));

    const total = Number(countResult?.count || 0);

    // 获取分页数据
    const result = await query
      .orderBy(desc(sources.recommendedAt), desc(sources.createdAt))
      .limit(limit)
      .offset(offset);

    const sourcesList = result.map(row => {
      // 如果有JOIN，需要提取source信息
      if ('sources' in row) {
        return row.sources;
      }
      return row;
    });

    return {
      sources: sourcesList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取推荐源统计信息
   */
  async getRecommendedSourcesStatistics(dbConnection?: any): Promise<{
    total: number;
    byLevel: Record<'basic' | 'premium' | 'featured', number>;
    byStatus: Record<'pending' | 'approved' | 'rejected', number>;
    averageQuality: number;
    totalSubscribers: number;
  }> {
    try {
      const database = dbConnection || this.db;
      if (!database) {
        throw new Error('Database connection not provided');
      }

      // 获取所有推荐源
      const allSources = await database
        .select()
        .from(sources)
        .where(eq(sources.isRecommended, true));

      const total = allSources.length;
      
      // 按级别统计
      const byLevel = {
        basic: allSources.filter(s => s.recommendationLevel === 'basic').length,
        premium: allSources.filter(s => s.recommendationLevel === 'premium').length,
        featured: allSources.filter(s => s.recommendationLevel === 'featured').length,
      };

      // 按状态统计
      const byStatus = {
        pending: allSources.filter(s => s.qualityValidationStatus === 'pending').length,
        approved: allSources.filter(s => s.qualityValidationStatus === 'approved').length,
        rejected: allSources.filter(s => s.qualityValidationStatus === 'rejected').length,
      };

      // 计算平均质量分数
      const averageQuality = total > 0 
        ? Math.round(
            allSources.reduce((sum, s) => 
              sum + s.qualityAvailability + s.qualityContentQuality + s.qualityUpdateFrequency, 0
            ) / (total * 3)
          )
        : 0;

      // 总订阅数
      const totalSubscribers = allSources.reduce((sum, s) => sum + s.statisticsTotalSubscribers, 0);

      return {
        total,
        byLevel,
        byStatus,
        averageQuality,
        totalSubscribers,
      };
    } catch (error) {
      throw new Error(`Failed to get recommended sources statistics: ${error}`);
    }
  }

  /**
   * 启用/禁用推荐源
   */
  async toggleSourceRecommendation(sourceId: number, isRecommended: boolean, updatedBy?: number, dbConnection?: any): Promise<typeof sources.$inferSelect | null> {
    return await this.updateSourceState(sourceId, { isRecommended }, updatedBy, dbConnection);
  }

  /**
   * 更新推荐级别
   */
  async updateRecommendationLevel(
    sourceId: number, 
    level: 'basic' | 'premium' | 'featured',
    updatedBy?: number,
    dbConnection?: any
  ): Promise<typeof sources.$inferSelect | null> {
    return await this.updateSourceState(sourceId, { recommendationLevel: level }, updatedBy, dbConnection);
  }

  /**
   * 验证推荐源
   */
  async validateSource(
    sourceId: number, 
    status: 'pending' | 'approved' | 'rejected',
    notes?: string,
    validatedBy?: number,
    dbConnection?: any
  ): Promise<typeof sources.$inferSelect | null> {
    return await this.updateSourceState(
      sourceId, 
      { 
        validationStatus: status, 
        validationNotes: notes 
      }, 
      validatedBy,
      dbConnection
    );
  }

  /**
   * 获取状态为待审核的推荐源
   */
  async getPendingValidationSources(dbConnection?: any): Promise<typeof sources.$inferSelect[]> {
    const database = dbConnection || this.db;
    if (!database) {
      throw new Error('Database connection not provided');
    }

    return await database
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          eq(sources.qualityValidationStatus, 'pending')
        )
      )
      .orderBy(desc(sources.recommendedAt));
  }

  /**
   * 获取即将过期或需要重新验证的推荐源
   */
  async getSourcesNeedingRevalidation(daysThreshold: number = 7, dbConnection?: any): Promise<typeof sources.$inferSelect[]> {
    const database = dbConnection || this.db;
    if (!database) {
      throw new Error('Database connection not provided');
    }

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await database
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          or(
            lte(sources.qualityLastValidatedAt, thresholdDate),
            isNull(sources.qualityLastValidatedAt)
          )
        )
      )
      .orderBy(asc(sources.qualityLastValidatedAt));
  }
}