import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { initDB } from '../../db/index';
import { sources, rssEntries, processedContents, userNotes } from '../../db/schema';
import { eq, and, or, like, desc, sql, isNull } from 'drizzle-orm';
import Parser from 'rss-parser';

const adminRssManagementRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用管理员认证和审计中间件
adminRssManagementRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// RSS解析器
const parser = new Parser();

// 获取所有RSS源（分页，支持搜索和筛选）
adminRssManagementRoutes.get('/sources', async (c) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      userId,
      isPublic,
      isActive = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const db = initDB(c.env.DB);
    
    // 构建查询条件
    let whereCondition: any = sql`1=1`;
    
    if (search) {
      whereCondition = and(
        whereCondition,
        or(
          like(sources.name, `%${search}%`),
          like(sources.url, `%${search}%`),
          like(sources.description, `%${search}%`)
        )
      );
    }
    
    if (userId) {
      whereCondition = and(whereCondition, eq(sources.userId, parseInt(userId)));
    }
    
    if (isPublic !== undefined) {
      whereCondition = and(whereCondition, eq(sources.isPublic, isPublic === 'true'));
    }
    
    // 活跃状态：失败次数小于5次
    if (isActive === 'active') {
      whereCondition = and(whereCondition, sql`${sources.fetchFailureCount} < 5`);
    } else if (isActive === 'inactive') {
      whereCondition = and(whereCondition, sql`${sources.fetchFailureCount} >= 5`);
    }

    // 构建排序
    let orderByClause: any = desc(sources.createdAt);
    if (sortBy === 'name') {
      orderByClause = sql`${sources.name} ${sortOrder === 'asc' ? sql`ASC` : sql`DESC`}`;
    } else if (sortBy === 'lastFetchedAt') {
      orderByClause = sql`${sources.lastFetchedAt} ${sortOrder === 'asc' ? sql`ASC` : sql`DESC`} NULLS LAST`;
    } else if (sortBy === 'fetchFailureCount') {
      orderByClause = sql`${sources.fetchFailureCount} ${sortOrder === 'asc' ? sql`ASC` : sql`DESC`}`;
    }

    // 获取总数
    const totalCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sources)
      .where(whereCondition);

    const totalCount = totalCountResult[0]?.count || 0;

    // 获取分页数据
    const sourcesList = await db
      .select({
        id: sources.id,
        userId: sources.userId,
        url: sources.url,
        name: sources.name,
        description: sources.description,
        isPublic: sources.isPublic,
        lastFetchedAt: sources.lastFetchedAt,
        fetchFailureCount: sources.fetchFailureCount,
        fetchErrorMessage: sources.fetchErrorMessage,
        isRecommended: sources.isRecommended,
        recommendationLevel: sources.recommendationLevel,
        qualityAvailability: sources.qualityAvailability,
        qualityContentQuality: sources.qualityContentQuality,
        createdAt: sources.createdAt,
        
        // 添加统计信息
        entryCount: sql<number>`(SELECT COUNT(*) FROM ${rssEntries} WHERE ${rssEntries.sourceId} = ${sources.id})`,
        lastEntryAt: sql<string>`(SELECT MAX(${rssEntries.publishedAt}) FROM ${rssEntries} WHERE ${rssEntries.sourceId} = ${sources.id})`,
      })
      .from(sources)
      .where(whereCondition)
      .orderBy(orderByClause)
      .limit(limitNum)
      .offset(offset);

    // 获取用户信息（如果需要）
    const userIds = [...new Set(sourcesList.map(s => s.userId).filter(Boolean))];
    let userMap: Record<number, any> = {};
    
    if (userIds.length > 0) {
      const { users } = await import('../../db/schema');
      const userList = await db
        .select({ id: users.id, username: users.username, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      
      userMap = userList.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<number, any>);
    }

    const sourcesWithUserInfo = sourcesList.map(source => ({
      ...source,
      user: source.userId ? userMap[source.userId] || null : null,
      isActive: source.fetchFailureCount < 5,
      status: source.fetchFailureCount >= 5 ? 'inactive' : 'active',
    }));

    return c.json({
      success: true,
      data: {
        sources: sourcesWithUserInfo,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNext: pageNum * limitNum < totalCount,
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('获取RSS源列表失败:', error);
    return c.json({
      success: false,
      error: '获取RSS源列表失败'
    }, 500);
  }
});

// 获取单个RSS源详情
adminRssManagementRoutes.get('/sources/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({
        success: false,
        error: '无效的源ID'
      }, 400);
    }

    const db = initDB(c.env.DB);
    
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({
        success: false,
        error: 'RSS源不存在'
      }, 404);
    }

    // 获取统计信息
    const [entryStats] = await db
      .select({
        totalEntries: sql<number>`COUNT(*)`,
        lastEntryAt: sql<string>`MAX(${rssEntries.publishedAt})`,
        lastProcessedAt: sql<string>`MAX(${processedContents.createdAt})`
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .where(eq(rssEntries.sourceId, sourceId));

    // 获取最近的条目
    const recentEntries = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        link: rssEntries.link,
        publishedAt: rssEntries.publishedAt,
        processed: sql<boolean>`EXISTS (SELECT 1 FROM ${processedContents} WHERE ${processedContents.entryId} = ${rssEntries.id})`
      })
      .from(rssEntries)
      .where(eq(rssEntries.sourceId, sourceId))
      .orderBy(desc(rssEntries.publishedAt))
      .limit(5);

    return c.json({
      success: true,
      data: {
        source: {
          ...source,
          stats: entryStats,
          recentEntries,
          isActive: source.fetchFailureCount < 5,
          status: source.fetchFailureCount >= 5 ? 'inactive' : 'active'
        }
      }
    });

  } catch (error) {
    console.error('获取RSS源详情失败:', error);
    return c.json({
      success: false,
      error: '获取RSS源详情失败'
    }, 500);
  }
});

// 创建新的RSS源
adminRssManagementRoutes.post('/sources', async (c) => {
  try {
    const user = getCurrentUser(c);
    const {
      userId,
      url,
      name,
      description,
      isPublic = false
    } = await c.req.json();

    // 验证必填字段
    if (!url || !name) {
      return c.json({
        success: false,
        error: 'URL和名称是必填项'
      }, 400);
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return c.json({
        success: false,
        error: '无效的URL格式'
      }, 400);
    }

    const db = initDB(c.env.DB);

    // 检查URL是否已存在
    const [existingSource] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.url, url));

    if (existingSource) {
      return c.json({
        success: false,
        error: '该URL已存在'
      }, 400);
    }

    // 验证RSS源是否有效
    let isValidRss = false;
    let rssInfo = null;
    
    try {
      console.log(`[ADMIN] 验证RSS源: ${url}`);
      const feed = await parser.parseURL(url);
      isValidRss = true;
      rssInfo = {
        title: feed.title,
        description: feed.description,
        lastBuildDate: feed.lastBuildDate,
        itemCount: feed.items?.length || 0
      };
      console.log(`[ADMIN] RSS源验证成功: ${feed.title}`);
    } catch (error) {
      console.error(`[ADMIN] RSS源验证失败: ${url}`, error);
      return c.json({
        success: false,
        error: 'RSS源无效或无法访问',
        details: error instanceof Error ? error.message : '未知错误'
      }, 400);
    }

    // 创建RSS源
    const defaultAvailability = 80;
    const fallbackAvailability = 60;

    const [newSource] = await db
      .insert(sources)
      .values({
        userId: userId || user?.id || 0,
        url,
        name,
        description: description || rssInfo?.description || null,
        isPublic,
        qualityAvailability: isValidRss ? defaultAvailability : fallbackAvailability,
        qualityContentQuality: isValidRss ? 70 : 60,
        qualityUpdateFrequency: isValidRss ? 60 : 60,
        qualityLastValidatedAt: isValidRss ? new Date() : null,
        qualityValidationStatus: isValidRss ? 'approved' : 'pending',
        qualityValidationNotes: isValidRss ? '自动验证通过' : 'RSS验证失败',
        createdAt: new Date(),
      })
      .returning();

    if (!newSource) {
      return c.json({
        success: false,
        error: '创建RSS源失败'
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        source: {
          ...newSource,
          isActive: true,
          status: 'active',
          validation: {
            isValid: isValidRss,
            info: rssInfo
          }
        }
      },
      message: 'RSS源创建成功'
    }, 201);

  } catch (error) {
    console.error('创建RSS源失败:', error);
    return c.json({
      success: false,
      error: '创建RSS源失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 更新RSS源
adminRssManagementRoutes.put('/sources/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const user = getCurrentUser(c);
    
    if (isNaN(sourceId)) {
      return c.json({
        success: false,
        error: '无效的源ID'
      }, 400);
    }

    const {
      url,
      name,
      description,
      isPublic,
      resetFailureCount
    } = await c.req.json();

    const db = initDB(c.env.DB);

    // 检查源是否存在
    const [existingSource] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!existingSource) {
      return c.json({
        success: false,
        error: 'RSS源不存在'
      }, 404);
    }

    // 如果要修改URL，检查是否与其他源冲突
    if (url && url !== existingSource.url) {
      // 验证URL格式
      try {
        new URL(url);
      } catch {
        return c.json({
          success: false,
          error: '无效的URL格式'
        }, 400);
      }

      const [duplicateSource] = await db
        .select({ id: sources.id })
        .from(sources)
        .and(
          eq(sources.url, url),
          sql`${sources.id} != ${sourceId}`
        );

      if (duplicateSource) {
        return c.json({
          success: false,
          error: '该URL已被其他源使用'
        }, 400);
      }

      // 验证新的RSS源
      try {
        console.log(`[ADMIN] 重新验证RSS源: ${url}`);
        await parser.parseURL(url);
        console.log(`[ADMIN] RSS源重新验证成功: ${url}`);
      } catch (error) {
        console.error(`[ADMIN] RSS源重新验证失败: ${url}`, error);
        return c.json({
          success: false,
          error: 'RSS源无效或无法访问',
          details: error instanceof Error ? error.message : '未知错误'
        }, 400);
      }
    }

    // 构建更新数据
    const updateData: any = {
      ...(url && { url }),
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(isPublic !== undefined && { isPublic }),
      ...(resetFailureCount && { 
        fetchFailureCount: 0,
        fetchErrorMessage: null 
      }),
    };

    // 执行更新
    const [updatedSource] = await db
      .update(sources)
      .set(updateData)
      .where(eq(sources.id, sourceId))
      .returning();

    return c.json({
      success: true,
      data: {
        source: {
          ...updatedSource,
          isActive: updatedSource.fetchFailureCount < 5,
          status: updatedSource.fetchFailureCount >= 5 ? 'inactive' : 'active'
        }
      },
      message: 'RSS源更新成功'
    });

  } catch (error) {
    console.error('更新RSS源失败:', error);
    return c.json({
      success: false,
      error: '更新RSS源失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 删除RSS源
adminRssManagementRoutes.delete('/sources/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({
        success: false,
        error: '无效的源ID'
      }, 400);
    }

    const db = initDB(c.env.DB);

    // 检查源是否存在
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({
        success: false,
        error: 'RSS源不存在'
      }, 404);
    }

    // 获取相关数据统计
    const [entryCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(rssEntries)
      .where(eq(rssEntries.sourceId, sourceId));

    const [processedCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(processedContents)
      .innerJoin(rssEntries, eq(processedContents.entryId, rssEntries.id))
      .where(eq(rssEntries.sourceId, sourceId));

    console.log(`[ADMIN] 删除RSS源 ${sourceId}: ${source.name}`);
    console.log(`[ADMIN] 相关数据 - 条目: ${entryCount.count}, 处理内容: ${processedCount.count}`);

    // 删除相关数据（按顺序删除以避免外键约束问题）
    if (processedCount.count > 0) {
      // 删除用户笔记
      await db
        .delete(userNotes)
        .where(
          sql`${userNotes.entryId} IN (SELECT ${rssEntries.id} FROM ${rssEntries} WHERE ${rssEntries.sourceId} = ${sourceId})`
        );

      // 删除处理后的内容
      await db
        .delete(processedContents)
        .where(
          sql`${processedContents.entryId} IN (SELECT ${rssEntries.id} FROM ${rssEntries} WHERE ${rssEntries.sourceId} = ${sourceId})`
        );
    }

    // 删除RSS条目
    if (entryCount.count > 0) {
      await db
        .delete(rssEntries)
        .where(eq(rssEntries.sourceId, sourceId));
    }

    // 删除RSS源
    await db
      .delete(sources)
      .where(eq(sources.id, sourceId));

    return c.json({
      success: true,
      data: {
        deletedSource: source,
        affectedData: {
          entriesDeleted: entryCount.count,
          processedContentsDeleted: processedCount.count
        }
      },
      message: 'RSS源及相关数据已删除'
    });

  } catch (error) {
    console.error('删除RSS源失败:', error);
    return c.json({
      success: false,
      error: '删除RSS源失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 测试RSS源连接
adminRssManagementRoutes.post('/sources/:id/test', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({
        success: false,
        error: '无效的源ID'
      }, 400);
    }

    const db = initDB(c.env.DB);

    // 获取源信息
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return c.json({
        success: false,
        error: 'RSS源不存在'
      }, 404);
    }

    console.log(`[ADMIN] 测试RSS源连接: ${source.url}`);

    // 测试连接和解析
    let testResult: any = {
      success: false,
      timestamp: new Date().toISOString()
    };

    try {
      const startTime = Date.now();
      const feed = await parser.parseURL(source.url);
      const responseTime = Date.now() - startTime;

      testResult = {
        success: true,
        responseTime,
        feedInfo: {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          lastBuildDate: feed.lastBuildDate,
          itemCount: feed.items?.length || 0,
          language: feed.language,
          generator: feed.generator
        },
        recentItems: feed.items?.slice(0, 3).map((item: any) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          guid: item.guid
        })) || []
      };

      console.log(`[ADMIN] RSS源测试成功: ${source.url}, 响应时间: ${responseTime}ms`);

    } catch (error) {
      testResult.error = {
        message: error instanceof Error ? error.message : '未知错误',
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      };
      console.error(`[ADMIN] RSS源测试失败: ${source.url}`, error);
    }

    // 更新源的质量信息
    if (testResult.success) {
      await db
        .update(sources)
        .set({
          qualityAvailability: Math.min(100, source.qualityAvailability + 5),
          qualityContentQuality: Math.min(100, source.qualityContentQuality + 3),
          qualityUpdateFrequency: Math.min(100, source.qualityUpdateFrequency + 4),
          qualityLastValidatedAt: new Date(),
          qualityValidationStatus: 'approved',
          qualityValidationNotes: `连接测试成功 - ${new Date().toISOString()}`
        })
        .where(eq(sources.id, sourceId));
    } else {
      await db
        .update(sources)
        .set({
          qualityAvailability: Math.max(0, source.qualityAvailability - 10),
          qualityValidationStatus: 'rejected',
          qualityValidationNotes: `连接测试失败 - ${testResult.error.message} - ${new Date().toISOString()}`
        })
        .where(eq(sources.id, sourceId));
    }

    return c.json({
      success: true,
      data: {
        sourceId,
        test: testResult
      },
      message: testResult.success ? 'RSS源测试成功' : 'RSS源测试失败'
    });

  } catch (error) {
    console.error('测试RSS源失败:', error);
    return c.json({
      success: false,
      error: '测试RSS源失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 重置RSS源失败计数
adminRssManagementRoutes.post('/sources/:id/reset-failures', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    if (isNaN(sourceId)) {
      return c.json({
        success: false,
        error: '无效的源ID'
      }, 400);
    }

    const db = initDB(c.env.DB);

    const [updatedSource] = await db
      .update(sources)
      .set({
        fetchFailureCount: 0,
        fetchErrorMessage: null
      })
      .where(eq(sources.id, sourceId))
      .returning();

    if (!updatedSource) {
      return c.json({
        success: false,
        error: 'RSS源不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        source: {
          ...updatedSource,
          isActive: true,
          status: 'active'
        }
      },
      message: 'RSS源失败计数已重置'
    });

  } catch (error) {
    console.error('重置RSS源失败计数失败:', error);
    return c.json({
      success: false,
      error: '重置RSS源失败计数失败'
    }, 500);
  }
});

// 获取RSS源统计信息
adminRssManagementRoutes.get('/statistics', async (c) => {
  try {
    const db = initDB(c.env.DB);

    // 基础统计
    const [totalStats] = await db
      .select({
        totalSources: sql<number>`COUNT(*)`,
        activeSources: sql<number>`COUNT(CASE WHEN ${sources.fetchFailureCount} < 5 THEN 1 END)`,
        publicSources: sql<number>`COUNT(CASE WHEN ${sources.isPublic} = true THEN 1 END)`,
        recommendedSources: sql<number>`COUNT(CASE WHEN ${sources.isRecommended} = true THEN 1 END)`
      })
      .from(sources);

    // 按状态统计
    const [statusStats] = await db
      .select({
        active: sql<number>`COUNT(CASE WHEN ${sources.fetchFailureCount} < 5 THEN 1 END)`,
        inactive: sql<number>`COUNT(CASE WHEN ${sources.fetchFailureCount} >= 5 THEN 1 END)`,
        neverFetched: sql<number>`COUNT(CASE WHEN ${sources.lastFetchedAt} IS NULL THEN 1 END)`
      })
      .from(sources);

    // 按推荐级别统计
    const [recommendationStats] = await db
      .select({
        basic: sql<number>`COUNT(CASE WHEN ${sources.recommendationLevel} = 'basic' THEN 1 END)`,
        premium: sql<number>`COUNT(CASE WHEN ${sources.recommendationLevel} = 'premium' THEN 1 END)`,
        featured: sql<number>`COUNT(CASE WHEN ${sources.recommendationLevel} = 'featured' THEN 1 END)`
      })
      .from(sources);

    // 质量评分统计
    const [qualityStats] = await db
      .select({
        avgAvailability: sql<number>`AVG(${sources.qualityAvailability})`,
        avgContentQuality: sql<number>`AVG(${sources.qualityContentQuality})`,
        avgUpdateFrequency: sql<number>`AVG(${sources.qualityUpdateFrequency})`
      })
      .from(sources);

    // 最近创建的源
    const recentSources = await db
      .select({
        id: sources.id,
        name: sources.name,
        url: sources.url,
        createdAt: sources.createdAt,
        fetchFailureCount: sources.fetchFailureCount
      })
      .from(sources)
      .orderBy(desc(sources.createdAt))
      .limit(5);

    return c.json({
      success: true,
      data: {
        overview: totalStats,
        status: statusStats,
        recommendation: recommendationStats,
        quality: {
          ...qualityStats,
          avgAvailability: Math.round(qualityStats.avgAvailability || 0),
          avgContentQuality: Math.round(qualityStats.avgContentQuality || 0),
          avgUpdateFrequency: Math.round(qualityStats.avgUpdateFrequency || 0)
        },
        recentSources: recentSources.map(s => ({
          ...s,
          isActive: s.fetchFailureCount < 5
        }))
      }
    });

  } catch (error) {
    console.error('获取RSS统计失败:', error);
    return c.json({
      success: false,
      error: '获取RSS统计失败'
    }, 500);
  }
});

export default adminRssManagementRoutes;
