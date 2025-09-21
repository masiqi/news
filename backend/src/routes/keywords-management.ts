// src/routes/keywords-management.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { 
  rssEntries, 
  processedContents, 
  userKeywords, 
  keywordEntryRelations,
  sources 
} from '../db/schema';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const keywordsManagementRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
keywordsManagementRoutes.use('*', requireAuth);

// 获取用户的关键词列表（聚合统计）
keywordsManagementRoutes.get("/list", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '50');
    const search = c.req.query('search');
    const sortBy = c.req.query('sortBy') || 'entryCount';
    const sortOrder = c.req.query('sortOrder') || 'desc';
    
    console.log(`[KEYWORDS] 用户 ${user.id} 获取关键词列表 - 页码: ${page}, 搜索: ${search}`);

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereCondition = eq(userKeywords.userId, user.id);
    
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = and(
        whereCondition,
        ilike(userKeywords.keywordName, searchTerm)
      );
    }

    // 获取总数
    const countResult = await db
      .select({ total: count() })
      .from(userKeywords)
      .where(whereCondition)
      .get();

    const total = countResult?.total || 0;

    // 构建排序
    let orderBy;
    if (sortBy === 'name') {
      orderBy = sortOrder === 'desc' ? desc(userKeywords.keywordName) : userKeywords.keywordName;
    } else if (sortBy === 'lastUsed') {
      orderBy = sortOrder === 'desc' ? desc(userKeywords.lastUsedAt) : userKeywords.lastUsedAt;
    } else { // entryCount
      orderBy = sortOrder === 'desc' ? desc(userKeywords.entryCount) : userKeywords.entryCount;
    }

    // 获取关键词列表
    const keywords = await db
      .select({
        id: userKeywords.id,
        keywordName: userKeywords.keywordName,
        entryCount: userKeywords.entryCount,
        lastUsedAt: userKeywords.lastUsedAt,
        createdAt: userKeywords.createdAt,
        updatedAt: userKeywords.updatedAt
      })
      .from(userKeywords)
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset)
      .all();

    // 计算分页信息
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      keywords,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取关键词列表失败:', error);
    return c.json({ 
      error: "获取关键词列表失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取关键词详情和相关文章
keywordsManagementRoutes.get("/:keywordId", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const keywordId = parseInt(c.req.param('keywordId'));
  
  if (isNaN(keywordId)) {
    return c.json({ error: "无效的关键词ID" }, 400);
  }

  try {
    console.log(`[KEYWORDS] 用户 ${user.id} 获取关键词详情 - 关键词ID: ${keywordId}`);

    // 获取关键词详情
    const keyword = await db
      .select()
      .from(userKeywords)
      .where(and(
        eq(userKeywords.id, keywordId),
        eq(userKeywords.userId, user.id)
      ))
      .get();

    if (!keyword) {
      return c.json({ error: "关键词不存在" }, 404);
    }

    // 获取相关文章
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const relatedContents = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        content: rssEntries.content,
        link: rssEntries.link,
        publishedAt: rssEntries.publishedAt,
        sourceName: sources.name,
        sentiment: processedContents.sentiment,
        analysis: processedContents.analysis,
        educationalValue: processedContents.educationalValue,
        relationCreatedAt: keywordEntryRelations.createdAt
      })
      .from(keywordEntryRelations)
      .innerJoin(rssEntries, eq(keywordEntryRelations.entryId, rssEntries.id))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(keywordEntryRelations.processedContentId, processedContents.id))
      .where(and(
        eq(keywordEntryRelations.keywordId, keywordId),
        eq(keywordEntryRelations.userId, user.id)
      ))
      .orderBy(desc(rssEntries.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    // 获取总数
    const totalCount = await db
      .select({ total: count() })
      .from(keywordEntryRelations)
      .where(and(
        eq(keywordEntryRelations.keywordId, keywordId),
        eq(keywordEntryRelations.userId, user.id)
      ))
      .get();

    const total = totalCount?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      keyword: {
        ...keyword,
        relatedContents,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取关键词详情失败:', error);
    return c.json({ 
      error: "获取关键词详情失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 重新聚合用户的关键词数据（从processedContents中重新计算）
keywordsManagementRoutes.post("/regenerate", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    console.log(`[KEYWORDS] 用户 ${user.id} 重新生成关键词聚合数据`);

    // 获取用户所有已处理的内容
    const userContents = await db
      .select({
        entryId: rssEntries.id,
        processedContentId: processedContents.id,
        keywords: processedContents.keywords
      })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.id))
      .where(and(
        eq(sources.userId, user.id),
        isNotNull(processedContents.keywords)
      ))
      .all();

    console.log(`[KEYWORDS] 找到 ${userContents.length} 条包含关键词的内容`);

    // 删除用户现有的关键词数据
    await db.delete(userKeywords).where(eq(userKeywords.userId, user.id));
    await db.delete(keywordEntryRelations).where(eq(keywordEntryRelations.userId, user.id));

    // 重新聚合关键词
    const keywordMap = new Map<string, {
      count: number;
      entries: Array<{
        entryId: number;
        processedContentId: number;
      }>;
    }>();

    // 统计每个关键词的出现次数和关联的文章
    for (const content of userContents) {
      if (content.keywords && content.keywords.trim()) {
        const keywords = content.keywords.split(',').map(k => k.trim()).filter(k => k);
        for (const keywordName of keywords) {
          if (keywordName && typeof keywordName === 'string' && keywordName.trim()) {
            const normalizedKeyword = keywordName.trim();
            if (!keywordMap.has(normalizedKeyword)) {
              keywordMap.set(normalizedKeyword, {
                count: 0,
                entries: []
              });
            }
            const keywordData = keywordMap.get(normalizedKeyword)!;
            keywordData.count++;
            keywordData.entries.push({
              entryId: content.entryId,
              processedContentId: content.processedContentId
            });
          }
        }
      }
    }

    console.log(`[KEYWORDS] 解析出 ${keywordMap.size} 个唯一关键词`);

    // 插入新的关键词数据
    const now = new Date();
    for (const [keywordName, data] of keywordMap) {
      // 插入关键词
      const [newKeyword] = await db.insert(userKeywords).values({
        userId: user.id,
        keywordName,
        entryCount: data.count,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now
      }).returning();

      // 插入关键词-文章关联
      for (const entry of data.entries) {
        await db.insert(keywordEntryRelations).values({
          userId: user.id,
          keywordId: newKeyword.id,
          entryId: entry.entryId,
          processedContentId: entry.processedContentId,
          createdAt: now
        });
      }
    }

    return c.json({
      success: true,
      message: `成功重新生成关键词数据，共处理 ${keywordMap.size} 个关键词`,
      processedKeywords: keywordMap.size,
      totalEntries: userContents.length
    });
  } catch (error) {
    console.error('重新生成关键词数据失败:', error);
    return c.json({ 
      error: "重新生成关键词数据失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 删除关键词
keywordsManagementRoutes.delete("/:keywordId", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const keywordId = parseInt(c.req.param('keywordId'));
  
  if (isNaN(keywordId)) {
    return c.json({ error: "无效的关键词ID" }, 400);
  }

  try {
    console.log(`[KEYWORDS] 用户 ${user.id} 删除关键词 - 关键词ID: ${keywordId}`);

    // 检查关键词是否存在且属于当前用户
    const keyword = await db
      .select()
      .from(userKeywords)
      .where(and(
        eq(userKeywords.id, keywordId),
        eq(userKeywords.userId, user.id)
      ))
      .get();

    if (!keyword) {
      return c.json({ error: "关键词不存在或无权限删除" }, 404);
    }

    // 删除关键词关联
    await db.delete(keywordEntryRelations).where(
      and(
        eq(keywordEntryRelations.keywordId, keywordId),
        eq(keywordEntryRelations.userId, user.id)
      )
    );

    // 删除关键词
    await db.delete(userKeywords).where(
      and(
        eq(userKeywords.id, keywordId),
        eq(userKeywords.userId, user.id)
      )
    );

    return c.json({
      success: true,
      message: "关键词删除成功",
      deletedKeyword: keyword.keywordName
    });
  } catch (error) {
    console.error('删除关键词失败:', error);
    return c.json({ 
      error: "删除关键词失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取关键词统计信息
keywordsManagementRoutes.get("/stats", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    console.log(`[KEYWORDS] 用户 ${user.id} 获取关键词统计信息`);

    // 获取关键词总数
    const totalKeywords = await db
      .select({ total: count() })
      .from(userKeywords)
      .where(eq(userKeywords.userId, user.id))
      .get();

    // 获取最热门的关键词（按文章数量）
    const popularKeywords = await db
      .select({
        id: userKeywords.id,
        keywordName: userKeywords.keywordName,
        entryCount: userKeywords.entryCount,
        lastUsedAt: userKeywords.lastUsedAt
      })
      .from(userKeywords)
      .where(eq(userKeywords.userId, user.id))
      .orderBy(desc(userKeywords.entryCount))
      .limit(10)
      .all();

    // 获取最近使用的关键词
    const recentKeywords = await db
      .select({
        id: userKeywords.id,
        keywordName: userKeywords.keywordName,
        entryCount: userKeywords.entryCount,
        lastUsedAt: userKeywords.lastUsedAt
      })
      .from(userKeywords)
      .where(eq(userKeywords.userId, user.id))
      .orderBy(desc(userKeywords.lastUsedAt))
      .limit(10)
      .all();

    // 获取关键词分布统计
    const keywordDistribution = await db
      .select({
        range: sql`CASE 
          WHEN ${userKeywords.entryCount} < 3 THEN '1-2篇文章'
          WHEN ${userKeywords.entryCount} < 5 THEN '3-4篇文章'
          WHEN ${userKeywords.entryCount} < 10 THEN '5-9篇文章'
          WHEN ${userKeywords.entryCount} < 20 THEN '10-19篇文章'
          ELSE '20+篇文章'
        END`,
        count: count()
      })
      .from(userKeywords)
      .where(eq(userKeywords.userId, user.id))
      .groupBy(sql`CASE 
        WHEN ${userKeywords.entryCount} < 3 THEN '1-2篇文章'
        WHEN ${userKeywords.entryCount} < 5 THEN '3-4篇文章'
        WHEN ${userKeywords.entryCount} < 10 THEN '5-9篇文章'
        WHEN ${userKeywords.entryCount} < 20 THEN '10-19篇文章'
        ELSE '20+篇文章'
      END`)
      .orderBy(sql`CASE 
        WHEN ${userKeywords.entryCount} < 3 THEN 1
        WHEN ${userKeywords.entryCount} < 5 THEN 2
        WHEN ${userKeywords.entryCount} < 10 THEN 3
        WHEN ${userKeywords.entryCount} < 20 THEN 4
        ELSE 5
      END`)
      .all();

    // 获取词频统计（按首字母分组）
    const firstLetterStats = await db
      .select({
        firstLetter: sql`UPPER(SUBSTR(${userKeywords.keywordName}, 1, 1))`,
        count: count()
      })
      .from(userKeywords)
      .where(eq(userKeywords.userId, user.id))
      .groupBy(sql`UPPER(SUBSTR(${userKeywords.keywordName}, 1, 1))`)
      .orderBy(sql`UPPER(SUBSTR(${userKeywords.keywordName}, 1, 1))`)
      .all();

    return c.json({
      success: true,
      stats: {
        totalKeywords: totalKeywords?.total || 0,
        popularKeywords,
        recentKeywords,
        keywordDistribution,
        firstLetterStats
      }
    });
  } catch (error) {
    console.error('获取关键词统计失败:', error);
    return c.json({ 
      error: "获取关键词统计失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 批量删除关键词
keywordsManagementRoutes.post("/batch-delete", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    const body = await c.req.json();
    const { keywordIds } = body;

    if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
      return c.json({ error: "请提供有效的关键词ID数组" }, 400);
    }

    console.log(`[KEYWORDS] 用户 ${user.id} 批量删除 ${keywordIds.length} 个关键词`);

    // 验证所有关键词都属于当前用户
    const validKeywords = await db
      .select({ id: userKeywords.id, keywordName: userKeywords.keywordName })
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, user.id),
        sql`${userKeywords.id} IN (${sql.join(keywordIds.map(id => sql`${id}`), sql`, `)})`
      ))
      .all();

    const validIds = validKeywords.map(k => k.id);
    const invalidIds = keywordIds.filter(id => !validIds.includes(id));

    if (validIds.length === 0) {
      return c.json({ error: "没有找到有效的关键词" }, 404);
    }

    // 删除关键词关联
    await db.delete(keywordEntryRelations).where(
      and(
        eq(keywordEntryRelations.userId, user.id),
        sql`${keywordEntryRelations.keywordId} IN (${sql.join(validIds.map(id => sql`${id}`), sql`, `)})`
      )
    );

    // 删除关键词
    await db.delete(userKeywords).where(
      and(
        eq(userKeywords.userId, user.id),
        sql`${userKeywords.id} IN (${sql.join(validIds.map(id => sql`${id}`), sql`, `)})`
      )
    );

    return c.json({
      success: true,
      message: `成功删除 ${validIds.length} 个关键词`,
      deletedKeywords: validKeywords.map(k => k.keywordName),
      invalidIds
    });
  } catch (error) {
    console.error('批量删除关键词失败:', error);
    return c.json({ 
      error: "批量删除关键词失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 搜索包含特定关键词的文章
keywordsManagementRoutes.get("/search-articles", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const keyword = c.req.query('keyword');
  
  if (!keyword || !keyword.trim()) {
    return c.json({ error: "请提供搜索关键词" }, 400);
  }

  try {
    console.log(`[KEYWORDS] 用户 ${user.id} 搜索关键词文章: ${keyword}`);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 搜索包含关键词的文章
    const articles = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        content: rssEntries.content,
        link: rssEntries.link,
        publishedAt: rssEntries.publishedAt,
        sourceName: sources.name,
        sentiment: processedContents.sentiment,
        analysis: processedContents.analysis,
        educationalValue: processedContents.educationalValue,
        keywords: processedContents.keywords,
        topics: processedContents.topics
      })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.id))
      .where(and(
        eq(sources.userId, user.id),
        ilike(processedContents.keywords, `%${keyword.trim()}%`)
      ))
      .orderBy(desc(rssEntries.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    // 获取总数
    const totalCount = await db
      .select({ total: count() })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.id))
      .where(and(
        eq(sources.userId, user.id),
        ilike(processedContents.keywords, `%${keyword.trim()}%`)
      ))
      .get();

    const total = totalCount?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      keyword: keyword.trim(),
      articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('搜索关键词文章失败:', error);
    return c.json({ 
      error: "搜索关键词文章失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default keywordsManagementRoutes;