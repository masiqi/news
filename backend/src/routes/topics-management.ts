// src/routes/topics-management.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { 
  rssEntries, 
  processedContents, 
  userTopics, 
  topicEntryRelations,
  sources 
} from '../db/schema';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const topicsManagementRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
topicsManagementRoutes.use('*', requireAuth);

// 获取用户的主题列表（聚合统计）
topicsManagementRoutes.get("/list", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '50');
    const search = c.req.query('search');
    const sortBy = c.req.query('sortBy') || 'entryCount';
    const sortOrder = c.req.query('sortOrder') || 'desc';
    
    console.log(`[TOPICS] 用户 ${user.id} 获取主题列表 - 页码: ${page}, 搜索: ${search}`);

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereCondition = eq(userTopics.userId, user.id);
    
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = and(
        whereCondition,
        ilike(userTopics.topicName, searchTerm)
      );
    }

    // 获取总数
    const countResult = await db
      .select({ total: count() })
      .from(userTopics)
      .where(whereCondition)
      .get();

    const total = countResult?.total || 0;

    // 构建排序
    let orderBy;
    if (sortBy === 'name') {
      orderBy = sortOrder === 'desc' ? desc(userTopics.topicName) : userTopics.topicName;
    } else if (sortBy === 'lastUsed') {
      orderBy = sortOrder === 'desc' ? desc(userTopics.lastUsedAt) : userTopics.lastUsedAt;
    } else { // entryCount
      orderBy = sortOrder === 'desc' ? desc(userTopics.entryCount) : userTopics.entryCount;
    }

    // 获取主题列表
    const topics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        lastUsedAt: userTopics.lastUsedAt,
        createdAt: userTopics.createdAt,
        updatedAt: userTopics.updatedAt
      })
      .from(userTopics)
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset)
      .all();

    // 计算分页信息
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      topics,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取主题列表失败:', error);
    return c.json({ 
      error: "获取主题列表失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取主题详情和相关文章
topicsManagementRoutes.get("/:topicId", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const topicId = parseInt(c.req.param('topicId'));
  
  if (isNaN(topicId)) {
    return c.json({ error: "无效的主题ID" }, 400);
  }

  try {
    console.log(`[TOPICS] 用户 ${user.id} 获取主题详情 - 主题ID: ${topicId}`);

    // 获取主题详情
    const topic = await db
      .select()
      .from(userTopics)
      .where(and(
        eq(userTopics.id, topicId),
        eq(userTopics.userId, user.id)
      ))
      .get();

    if (!topic) {
      return c.json({ error: "主题不存在" }, 404);
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
        relationCreatedAt: topicEntryRelations.createdAt
      })
      .from(topicEntryRelations)
      .innerJoin(rssEntries, eq(topicEntryRelations.entryId, rssEntries.id))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(topicEntryRelations.processedContentId, processedContents.id))
      .where(and(
        eq(topicEntryRelations.topicId, topicId),
        eq(topicEntryRelations.userId, user.id)
      ))
      .orderBy(desc(rssEntries.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    // 获取总数
    const totalCount = await db
      .select({ total: count() })
      .from(topicEntryRelations)
      .where(and(
        eq(topicEntryRelations.topicId, topicId),
        eq(topicEntryRelations.userId, user.id)
      ))
      .get();

    const total = totalCount?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      topic: {
        ...topic,
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
    console.error('获取主题详情失败:', error);
    return c.json({ 
      error: "获取主题详情失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 重新聚合用户的主题数据（从processedContents中重新计算）
topicsManagementRoutes.post("/regenerate", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    console.log(`[TOPICS] 用户 ${user.id} 重新生成主题聚合数据`);

    // 获取用户所有已处理的内容
    const userContents = await db
      .select({
        entryId: rssEntries.id,
        processedContentId: processedContents.id,
        topics: processedContents.topics
      })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.id))
      .where(and(
        eq(sources.userId, user.id),
        isNotNull(processedContents.topics),
        sql`json_array_length(${processedContents.topics}) > 0`
      ))
      .all();

    console.log(`[TOPICS] 找到 ${userContents.length} 条包含主题的内容`);

    // 删除用户现有的主题数据
    await db.delete(userTopics).where(eq(userTopics.userId, user.id));
    await db.delete(topicEntryRelations).where(eq(topicEntryRelations.userId, user.id));

    // 重新聚合主题
    const topicMap = new Map<string, {
      count: number;
      entries: Array<{
        entryId: number;
        processedContentId: number;
      }>;
    }>();

    // 统计每个主题的出现次数和关联的文章
    for (const content of userContents) {
      if (content.topics) {
        try {
          const topics = JSON.parse(content.topics);
          if (Array.isArray(topics)) {
            for (const topicName of topics) {
              if (topicName && typeof topicName === 'string' && topicName.trim()) {
                const normalizedTopic = topicName.trim();
                if (!topicMap.has(normalizedTopic)) {
                  topicMap.set(normalizedTopic, {
                    count: 0,
                    entries: []
                  });
                }
                const topicData = topicMap.get(normalizedTopic)!;
                topicData.count++;
                topicData.entries.push({
                  entryId: content.entryId,
                  processedContentId: content.processedContentId
                });
              }
            }
          }
        } catch (parseError) {
          console.error(`解析主题JSON失败: ${content.topics}`, parseError);
        }
      }
    }

    console.log(`[TOPICS] 解析出 ${topicMap.size} 个唯一主题`);

    // 插入新的主题数据
    const now = new Date();
    for (const [topicName, data] of topicMap) {
      // 插入主题
      const [newTopic] = await db.insert(userTopics).values({
        userId: user.id,
        topicName,
        entryCount: data.count,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now
      }).returning();

      // 插入主题-文章关联
      for (const entry of data.entries) {
        await db.insert(topicEntryRelations).values({
          userId: user.id,
          topicId: newTopic.id,
          entryId: entry.entryId,
          processedContentId: entry.processedContentId,
          createdAt: now
        });
      }
    }

    return c.json({
      success: true,
      message: `成功重新生成主题数据，共处理 ${topicMap.size} 个主题`,
      processedTopics: topicMap.size,
      totalEntries: userContents.length
    });
  } catch (error) {
    console.error('重新生成主题数据失败:', error);
    return c.json({ 
      error: "重新生成主题数据失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 删除主题
topicsManagementRoutes.delete("/:topicId", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const topicId = parseInt(c.req.param('topicId'));
  
  if (isNaN(topicId)) {
    return c.json({ error: "无效的主题ID" }, 400);
  }

  try {
    console.log(`[TOPICS] 用户 ${user.id} 删除主题 - 主题ID: ${topicId}`);

    // 检查主题是否存在且属于当前用户
    const topic = await db
      .select()
      .from(userTopics)
      .where(and(
        eq(userTopics.id, topicId),
        eq(userTopics.userId, user.id)
      ))
      .get();

    if (!topic) {
      return c.json({ error: "主题不存在或无权限删除" }, 404);
    }

    // 删除主题关联
    await db.delete(topicEntryRelations).where(
      and(
        eq(topicEntryRelations.topicId, topicId),
        eq(topicEntryRelations.userId, user.id)
      )
    );

    // 删除主题
    await db.delete(userTopics).where(
      and(
        eq(userTopics.id, topicId),
        eq(userTopics.userId, user.id)
      )
    );

    return c.json({
      success: true,
      message: "主题删除成功",
      deletedTopic: topic.topicName
    });
  } catch (error) {
    console.error('删除主题失败:', error);
    return c.json({ 
      error: "删除主题失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取主题统计信息
topicsManagementRoutes.get("/stats", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    console.log(`[TOPICS] 用户 ${user.id} 获取主题统计信息`);

    // 获取主题总数
    const totalTopics = await db
      .select({ total: count() })
      .from(userTopics)
      .where(eq(userTopics.userId, user.id))
      .get();

    // 获取最热门的主题（按文章数量）
    const popularTopics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        lastUsedAt: userTopics.lastUsedAt
      })
      .from(userTopics)
      .where(eq(userTopics.userId, user.id))
      .orderBy(desc(userTopics.entryCount))
      .limit(10)
      .all();

    // 获取最近使用的主题
    const recentTopics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        lastUsedAt: userTopics.lastUsedAt
      })
      .from(userTopics)
      .where(eq(userTopics.userId, user.id))
      .orderBy(desc(userTopics.lastUsedAt))
      .limit(10)
      .all();

    // 获取主题分布统计
    const topicDistribution = await db
      .select({
        range: sql`CASE 
          WHEN ${userTopics.entryCount} < 5 THEN '1-4篇文章'
          WHEN ${userTopics.entryCount} < 10 THEN '5-9篇文章'
          WHEN ${userTopics.entryCount} < 20 THEN '10-19篇文章'
          WHEN ${userTopics.entryCount} < 50 THEN '20-49篇文章'
          ELSE '50+篇文章'
        END`,
        count: count()
      })
      .from(userTopics)
      .where(eq(userTopics.userId, user.id))
      .groupBy(sql`CASE 
        WHEN ${userTopics.entryCount} < 5 THEN '1-4篇文章'
        WHEN ${userTopics.entryCount} < 10 THEN '5-9篇文章'
        WHEN ${userTopics.entryCount} < 20 THEN '10-19篇文章'
        WHEN ${userTopics.entryCount} < 50 THEN '20-49篇文章'
        ELSE '50+篇文章'
      END`)
      .orderBy(sql`CASE 
        WHEN ${userTopics.entryCount} < 5 THEN 1
        WHEN ${userTopics.entryCount} < 10 THEN 2
        WHEN ${userTopics.entryCount} < 20 THEN 3
        WHEN ${userTopics.entryCount} < 50 THEN 4
        ELSE 5
      END`)
      .all();

    return c.json({
      success: true,
      stats: {
        totalTopics: totalTopics?.total || 0,
        popularTopics,
        recentTopics,
        topicDistribution
      }
    });
  } catch (error) {
    console.error('获取主题统计失败:', error);
    return c.json({ 
      error: "获取主题统计失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default topicsManagementRoutes;