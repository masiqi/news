import { Hono } from 'hono';
import { initDB } from '../../db/index';
import { sources, rssEntries, processedContents, userNotes } from '../../db/schema';
import { eq, and, or, like, desc, sql, isNull, inArray } from 'drizzle-orm';
import Parser from 'rss-parser';

const adminSimpleRssRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// RSS解析器
const parser = new Parser();

// 获取所有RSS源（分页，支持搜索和筛选）
adminSimpleRssRoutes.get('/sources', async (c) => {
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
      })
      .from(sources)
      .where(whereCondition)
      .orderBy(orderByClause)
      .limit(limitNum)
      .offset(offset);

    const sourcesWithStatus = sourcesList.map(source => ({
      ...source,
      isActive: source.fetchFailureCount < 5,
      status: source.fetchFailureCount >= 5 ? 'inactive' : 'active',
    }));

    return c.json({
      success: true,
      data: {
        sources: sourcesWithStatus,
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
adminSimpleRssRoutes.get('/sources/:id', async (c) => {
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

    return c.json({
      success: true,
      data: {
        source: {
          ...source,
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
adminSimpleRssRoutes.post('/sources', async (c) => {
  try {
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
        itemCount: feed.items?.length || 0
      };
      console.log(`[ADMIN] RSS源验证成功: ${feed.title}`);
    } catch (error) {
      console.error(`[ADMIN] RSS源验证失败: ${url}`, error);
      
      // 在开发环境中，如果RSS验证失败，我们仍然创建源但标记为待验证
      if (c.env.NODE_ENV === 'development') {
        console.log(`[ADMIN] 开发环境：跳过RSS验证，创建源但标记为待验证`);
        isValidRss = false;
        rssInfo = null;
      } else {
        return c.json({
          success: false,
          error: 'RSS源无效或无法访问',
          details: error instanceof Error ? error.message : '未知错误'
        }, 400);
      }
    }

    // 创建RSS源
    const defaultAvailability = 80;
    const fallbackAvailability = 60; // 仍满足 scheduler 的可用性阈值 (> 50)

    const [newSource] = await db
      .insert(sources)
      .values({
        userId: userId || 0,
        url,
        name,
        description: description || rssInfo?.description || null,
        isPublic,
        qualityAvailability: isValidRss ? defaultAvailability : fallbackAvailability,
        qualityContentQuality: isValidRss ? 70 : 60,
        qualityUpdateFrequency: isValidRss ? 60 : 60,
        qualityLastValidatedAt: isValidRss ? new Date() : null,
        qualityValidationStatus: isValidRss ? 'approved' : 'pending',
        qualityValidationNotes: isValidRss ? '自动验证通过' : '开发环境：跳过验证，待生产环境验证',
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
adminSimpleRssRoutes.put('/sources/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
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
adminSimpleRssRoutes.delete('/sources/:id', async (c) => {
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

    console.log(`[ADMIN] 删除RSS源 ${sourceId}: ${source.name}`);

    // 删除相关数据（按顺序删除以避免外键约束问题）
    
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

    // 删除RSS条目
    await db
      .delete(rssEntries)
      .where(eq(rssEntries.sourceId, sourceId));

    // 删除RSS源
    await db
      .delete(sources)
      .where(eq(sources.id, sourceId));

    return c.json({
      success: true,
      data: {
        deletedSource: source,
        message: 'RSS源及相关数据已删除'
      }
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
adminSimpleRssRoutes.post('/sources/:id/test', async (c) => {
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
      
      // 首先尝试使用fetch API直接测试连接
      console.log(`[ADMIN] 尝试使用fetch API测试RSS源: ${source.url}`);
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      console.log(`[ADMIN] fetch成功，内容长度: ${content.length} 字符`);
      
      // 然后尝试解析RSS内容
      const feed = await parser.parseString(content);
      const responseTime = Date.now() - startTime;

      testResult = {
        success: true,
        responseTime,
        feedInfo: {
          title: feed.title,
          description: feed.description,
          itemCount: feed.items?.length || 0
        },
        connectionTest: {
          httpStatus: response.status,
          contentLength: content.length,
          method: 'fetch API'
        }
      };

      console.log(`[ADMIN] RSS源测试成功: ${source.url}, 响应时间: ${responseTime}ms`);

    } catch (error) {
      console.error(`[ADMIN] RSS源测试失败: ${source.url}`, error);
      
      // 提供更详细的错误信息
      let errorMessage = error instanceof Error ? error.message : '未知错误';
      let errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      
      // 在开发环境中提供调试建议
      if (c.env.NODE_ENV === 'development') {
        if (errorMessage.includes('not implemented yet')) {
          errorMessage = '开发环境网络限制：无法直接测试RSS连接';
          testResult = {
            success: false,
            responseTime: 0,
            error: {
              message: errorMessage,
              type: errorType,
              debugInfo: {
                environment: 'development',
                suggestion: '请使用以下方法测试RSS连接：',
                methods: [
                  '1. 在生产环境中测试',
                  '2. 使用 curl 命令手动测试：curl -I [RSS_URL]',
                  '3. 在线RSS验证工具：https://validator.w3.org/feed/',
                  '4. 或者直接部署到Cloudflare进行测试'
                ],
                attemptedUrl: source.url
              }
            }
          };
        } else {
          testResult.error = {
            message: errorMessage,
            type: errorType,
            debugInfo: {
              environment: 'development',
              attemptedUrl: source.url,
              suggestion: '检查RSS URL是否正确，或尝试在其他环境中测试'
            }
          };
        }
      } else {
        // 生产环境直接返回错误
        testResult.error = {
          message: errorMessage,
          type: errorType
        };
      }
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
adminSimpleRssRoutes.post('/sources/:id/reset-failures', async (c) => {
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
adminSimpleRssRoutes.get('/statistics', async (c) => {
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

    return c.json({
      success: true,
      data: {
        overview: totalStats,
        status: statusStats
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

// 手动触发RSS源抓取（临时调试用）
adminSimpleRssRoutes.post('/sources/:id/trigger', async (c) => {
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

    console.log(`[ADMIN] 手动触发RSS源抓取: ${source.name} (${source.url})`);

    // 直接在这里进行RSS抓取和处理
    try {
      // 抓取RSS内容
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rssContent = await response.text();
      console.log(`[ADMIN] RSS内容获取成功，长度: ${rssContent.length}`);

      // 解析RSS内容
      const parser = new Parser();
      const feed = await parser.parseString(rssContent);
      console.log(`[ADMIN] RSS解析成功，条目数: ${feed.items?.length || 0}`);

      let newEntriesCount = 0;
      let existingEntriesCount = 0;

      // 处理每个条目
      for (const item of feed.items || []) {
        const guid = item.guid || item.id || item.link || `${item.title}-${item.pubDate}`;
        
        // 检查条目是否已存在
        const [existingEntry] = await db
          .select({ id: rssEntries.id })
          .from(rssEntries)
          .where(eq(rssEntries.guid, guid));

        if (existingEntry) {
          existingEntriesCount++;
          continue;
        }

        // 创建新条目
        const [newEntry] = await db
          .insert(rssEntries)
          .values({
            sourceId: source.id,
            userId: source.userId,
            guid: guid,
            title: item.title || '',
            link: item.link || '',
            content: item['content:encoded'] || item.content || item.summary || '',
            publishedAt: new Date(item.pubDate || item.isoDate || new Date()),
            createdAt: new Date(),
            status: 'pending',
            failureCount: 0
          })
          .returning();

        if (newEntry) {
          newEntriesCount++;
          console.log(`[ADMIN] 新条目已保存: ${item.title}`);
        }
      }

      // 更新源的获取状态
      await db
        .update(sources)
        .set({
          lastFetchedAt: new Date(),
          fetchFailureCount: 0,
          fetchErrorMessage: null
        })
        .where(eq(sources.id, sourceId));

      console.log(`[ADMIN] RSS源 ${source.name} 抓取完成，新增: ${newEntriesCount}, 已存在: ${existingEntriesCount}`);

      return c.json({
        success: true,
        data: {
          sourceId,
          sourceName: source.name,
          feedInfo: {
            title: feed.title,
            description: feed.description,
            totalItems: feed.items?.length || 0
          },
          processingResult: {
            newEntries: newEntriesCount,
            existingEntries: existingEntriesCount,
            totalProcessed: newEntriesCount + existingEntriesCount
          },
          timestamp: new Date().toISOString()
        },
        message: 'RSS源抓取完成'
      });

    } catch (error) {
      console.error(`[ADMIN] RSS源抓取失败: ${source.url}`, error);
      
      // 更新源的失败状态
      await db
        .update(sources)
        .set({
          fetchFailureCount: (source.fetchFailureCount || 0) + 1,
          fetchErrorMessage: error instanceof Error ? error.message : '未知错误',
          lastFetchedAt: new Date()
        })
        .where(eq(sources.id, sourceId));

      return c.json({
        success: false,
        error: 'RSS源抓取失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, 500);
    }

  } catch (error) {
    console.error('手动触发RSS抓取失败:', error);
    return c.json({
      success: false,
      error: '手动触发RSS抓取失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default adminSimpleRssRoutes;
