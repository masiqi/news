import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware } from '../../middleware/admin-auth.middleware';
import { SourceStateService } from '../../services/admin/source-state.service';
import { initDB } from '../../db/index';
import { sources, sourceCategories, sourceTags, sourceValidationHistories, sourceCategoryRelations, sourceTagRelations } from '../../db/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

const adminStatisticsRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用所有管理员路由的中间件
adminStatisticsRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// 注意：不要在模块级别持有未绑定数据库的服务实例。
// 在每个请求中根据 env.DB 初始化 db，并传入服务，避免 "Database connection not provided" 错误。

// 获取总体统计信息
adminStatisticsRoutes.get('/overview', async (c) => {
  try {
    const db = initDB(c.env.DB);
    const sourceStateService = new SourceStateService(db);
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 获取推荐源统计
    const recommendedStats = await sourceStateService.getRecommendedSourcesStatistics(db);

    // 获取所有源统计
    const [totalSourcesResult] = await initDB(c.env.DB)
      .select({ count: count() })
      .from(sources);

    const [recommendedSourcesResult] = await initDB(c.env.DB)
      .select({ count: count() })
      .from(sources)
      .where(eq(sources.isRecommended, true));

    // 获取分类统计
    const [totalCategoriesResult] = await initDB(c.env.DB)
      .select({ count: count() })
      .from(sourceCategories)
      .where(eq(sourceCategories.isActive, true));

    // 获取标签统计
    const [totalTagsResult] = await initDB(c.env.DB)
      .select({ count: count() })
      .from(sourceTags)
      .where(eq(sourceTags.isActive, true));

    // 获取最近30天新增的推荐源
    const [recentSourcesResult] = await db
      .select({ count: count() })
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          gte(sources.recommendedAt, last30Days)
        )
      );

    // 获取最近7天验证的源
    const [recentValidationsResult] = await db
      .select({ count: count() })
      .from(sourceValidationHistories)
      .where(gte(sourceValidationHistories.validatedAt, last7Days));

    // 获取质量分布
    const qualityDistribution = await db
      .select({
        status: sourceValidationHistories.status,
        count: count(),
      })
      .from(sourceValidationHistories)
      .where(gte(sourceValidationHistories.validatedAt, last30Days))
      .groupBy(sourceValidationHistories.status);

    // 获取推荐级别分布
    const levelDistribution = await db
      .select({
        level: sources.recommendationLevel,
        count: count(),
      })
      .from(sources)
      .where(eq(sources.isRecommended, true))
      .groupBy(sources.recommendationLevel);

    // 获取活跃度最高的分类
    const activeCategories = await db
      .select({
        id: sourceCategories.id,
        name: sourceCategories.name,
        sourceCount: count(),
      })
      .from(sourceCategories)
      .leftJoin(sourceCategoryRelations, eq(sourceCategories.id, sourceCategoryRelations.categoryId))
      .where(eq(sourceCategories.isActive, true))
      .groupBy(sourceCategories.id, sourceCategories.name)
      .orderBy(desc(sql`count(${sourceCategoryRelations.sourceId})`))
      .limit(5);

    // 获取使用量最高的标签
    const popularTags = await db
      .select({
        id: sourceTags.id,
        name: sourceTags.name,
        usageCount: sourceTags.usageCount,
      })
      .from(sourceTags)
      .where(eq(sourceTags.isActive, true))
      .orderBy(desc(sourceTags.usageCount))
      .limit(5);

    const overview = {
      sources: {
        total: Number(totalSourcesResult?.count || 0),
        recommended: Number(recommendedSourcesResult?.count || 0),
        recentGrowth: Number(recentSourcesResult?.count || 0),
      },
      categories: {
        total: Number(totalCategoriesResult?.count || 0),
        active: activeCategories,
      },
      tags: {
        total: Number(totalTagsResult?.count || 0),
        popular: popularTags,
      },
      quality: {
        distribution: qualityDistribution,
        averageScore: recommendedStats.averageQuality,
        recentValidations: Number(recentValidationsResult?.count || 0),
      },
      levels: {
        distribution: levelDistribution,
        totalSubscribers: recommendedStats.totalSubscribers,
      },
      timestamp: now.toISOString(),
    };

    return c.json({ overview });
  } catch (error) {
    console.error('获取总体统计失败:', error);
    return c.json({ error: '获取总体统计失败' }, 500);
  }
});

// 获取时间序列统计
adminStatisticsRoutes.get('/timeline', async (c) => {
  try {
    const db = initDB(c.env.DB);
    const { period = '30d', granularity = 'day' } = c.req.query();
    
    let daysBack = 30;
    switch (period) {
      case '7d': daysBack = 7; break;
      case '30d': daysBack = 30; break;
      case '90d': daysBack = 90; break;
      case '1y': daysBack = 365; break;
      default: daysBack = 30;
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // 获取推荐源增长趋势
    const sourceGrowth = await db
      .select({
        date: sql`DATE(${sources.recommendedAt})`,
        count: count(),
      })
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          gte(sources.recommendedAt, startDate)
        )
      )
      .groupBy(sql`DATE(${sources.recommendedAt})`)
      .orderBy(sql`DATE(${sources.recommendedAt})`);

    // 获取验证活动趋势
    const validationActivity = await db
      .select({
        date: sql`DATE(${sourceValidationHistories.validatedAt})`,
        count: count(),
        avgScore: sql`AVG(${sourceValidationHistories.overallScore})`,
      })
      .from(sourceValidationHistories)
      .where(gte(sourceValidationHistories.validatedAt, startDate))
      .groupBy(sql`DATE(${sourceValidationHistories.validatedAt})`)
      .orderBy(sql`DATE(${sourceValidationHistories.validatedAt})`);

    // 获取质量趋势
    const qualityTrend = await db
      .select({
        date: sql`DATE(${sourceValidationHistories.validatedAt})`,
        avgAvailability: sql`AVG(${sourceValidationHistories.availabilityScore})`,
        avgContentQuality: sql`AVG(${sourceValidationHistories.contentQualityScore})`,
        avgUpdateFrequency: sql`AVG(${sourceValidationHistories.updateFrequencyScore})`,
        avgOverall: sql`AVG(${sourceValidationHistories.overallScore})`,
      })
      .from(sourceValidationHistories)
      .where(gte(sourceValidationHistories.validatedAt, startDate))
      .groupBy(sql`DATE(${sourceValidationHistories.validatedAt})`)
      .orderBy(sql`DATE(${sourceValidationHistories.validatedAt})`);

    const timeline = {
      period,
      granularity,
      sourceGrowth,
      validationActivity,
      qualityTrend,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };

    return c.json({ timeline });
  } catch (error) {
    console.error('获取时间序列统计失败:', error);
    return c.json({ error: '获取时间序列统计失败' }, 500);
  }
});

// 获取源详情统计
adminStatisticsRoutes.get('/sources/:id', async (c) => {
  try {
    const db = initDB(c.env.DB);
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

    // 获取验证历史
    const validationHistory = await db
      .select()
      .from(sourceValidationHistories)
      .where(eq(sourceValidationHistories.sourceId, sourceId))
      .orderBy(desc(sourceValidationHistories.validatedAt))
      .limit(10);

    // 获取分类信息
    const categories = await db
      .select({
        id: sourceCategories.id,
        name: sourceCategories.name,
        icon: sourceCategories.icon,
        color: sourceCategories.color,
      })
      .from(sourceCategories)
      .innerJoin(sourceCategoryRelations, eq(sourceCategories.id, sourceCategoryRelations.categoryId))
      .where(eq(sourceCategoryRelations.sourceId, sourceId));

    // 获取标签信息
    const tags = await db
      .select({
        id: sourceTags.id,
        name: sourceTags.name,
        color: sourceTags.color,
      })
      .from(sourceTags)
      .innerJoin(sourceTagRelations, eq(sourceTags.id, sourceTagRelations.tagId))
      .where(eq(sourceTagRelations.sourceId, sourceId));

    // 计算质量趋势
    const qualityTrend = await db
      .select({
        date: sql`DATE(${sourceValidationHistories.validatedAt})`,
        avgOverall: sql`AVG(${sourceValidationHistories.overallScore})`,
        avgAvailability: sql`AVG(${sourceValidationHistories.availabilityScore})`,
        avgContentQuality: sql`AVG(${sourceValidationHistories.contentQualityScore})`,
        avgUpdateFrequency: sql`AVG(${sourceValidationHistories.updateFrequencyScore})`,
      })
      .from(sourceValidationHistories)
      .where(eq(sourceValidationHistories.sourceId, sourceId))
      .groupBy(sql`DATE(${sourceValidationHistories.validatedAt})`)
      .orderBy(desc(sql`DATE(${sourceValidationHistories.validatedAt})`))
      .limit(30);

    const sourceStats = {
      source: {
        id: source.id,
        name: source.name,
        description: source.description,
        url: source.url,
        recommendationLevel: source.recommendationLevel,
        isRecommended: source.isRecommended,
        qualityValidationStatus: source.qualityValidationStatus,
      },
      quality: {
        availability: source.qualityAvailability,
        contentQuality: source.qualityContentQuality,
        updateFrequency: source.qualityUpdateFrequency,
        lastValidatedAt: source.qualityLastValidatedAt,
      },
      statistics: {
        totalSubscribers: source.statisticsTotalSubscribers,
        activeSubscribers: source.statisticsActiveSubscribers,
        averageUsage: source.statisticsAverageUsage,
        satisfaction: source.statisticsSatisfaction,
      },
      categories,
      tags,
      validationHistory,
      qualityTrend,
      lastUpdated: new Date().toISOString(),
    };

    return c.json({ sourceStats });
  } catch (error) {
    console.error('获取源详情统计失败:', error);
    return c.json({ error: '获取源详情统计失败' }, 500);
  }
});

// 获取分类统计
adminStatisticsRoutes.get('/categories/:id', async (c) => {
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

    // 获取分类下的源
    const categorySources = await db
      .select({
        id: sources.id,
        name: sources.name,
        recommendationLevel: sources.recommendationLevel,
        qualityValidationStatus: sources.qualityValidationStatus,
        qualityAvailability: sources.qualityAvailability,
        statisticsTotalSubscribers: sources.statisticsTotalSubscribers,
      })
      .from(sources)
      .innerJoin(sourceCategoryRelations, eq(sources.id, sourceCategoryRelations.sourceId))
      .where(eq(sourceCategoryRelations.categoryId, categoryId));

    // 计算分类统计
    const totalSources = categorySources.length;
    const totalSubscribers = categorySources.reduce((sum, s) => sum + s.statisticsTotalSubscribers, 0);
    const averageQuality = totalSources > 0 
      ? Math.round(categorySources.reduce((sum, s) => sum + s.qualityAvailability, 0) / totalSources)
      : 0;

    const levelDistribution = categorySources.reduce((acc, source) => {
      acc[source.recommendationLevel] = (acc[source.recommendationLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusDistribution = categorySources.reduce((acc, source) => {
      acc[source.qualityValidationStatus] = (acc[source.qualityValidationStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryStats = {
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
      },
      sources: {
        total: totalSources,
        topBySubscribers: categorySources
          .sort((a, b) => b.statisticsTotalSubscribers - a.statisticsTotalSubscribers)
          .slice(0, 5),
        topByQuality: categorySources
          .sort((a, b) => b.qualityAvailability - a.qualityAvailability)
          .slice(0, 5),
      },
      statistics: {
        totalSubscribers,
        averageQuality,
        levelDistribution,
        statusDistribution,
      },
      lastUpdated: new Date().toISOString(),
    };

    return c.json({ categoryStats });
  } catch (error) {
    console.error('获取分类统计失败:', error);
    return c.json({ error: '获取分类统计失败' }, 500);
  }
});

export default adminStatisticsRoutes;
