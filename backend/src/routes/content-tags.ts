// src/routes/content-tags.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { 
  rssEntries, 
  processedContents, 
  userTopics, 
  userKeywords,
  topicEntryRelations,
  keywordEntryRelations,
  sources 
} from '../db/schema';
import { eq, and, desc, count, ilike, or, sql, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const contentTagsRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
contentTagsRoutes.use('*', requireAuth);

// 获取包含特定主题的文章列表
contentTagsRoutes.get("/topic/:topicName/articles", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const topicName = decodeURIComponent(c.req.param('topicName'));
  
  try {
    console.log(`[CONTENT-TAGS] 用户 ${user.id} 获取主题 "${topicName}" 的文章`);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 首先找到用户的主题ID
    const userTopic = await db
      .select({ id: userTopics.id })
      .from(userTopics)
      .where(and(
        eq(userTopics.userId, user.id),
        eq(userTopics.topicName, topicName)
      ))
      .get();

    if (!userTopic) {
      return c.json({ error: "主题不存在" }, 404);
    }

    // 获取包含该主题的文章
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
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        relationCreatedAt: topicEntryRelations.createdAt
      })
      .from(topicEntryRelations)
      .innerJoin(rssEntries, eq(topicEntryRelations.entryId, rssEntries.id))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(topicEntryRelations.processedContentId, processedContents.id))
      .where(and(
        eq(topicEntryRelations.topicId, userTopic.id),
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
        eq(topicEntryRelations.topicId, userTopic.id),
        eq(topicEntryRelations.userId, user.id)
      ))
      .get();

    const total = totalCount?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      topic: topicName,
      articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取主题文章失败:', error);
    return c.json({ 
      error: "获取主题文章失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取包含特定关键词的文章列表
contentTagsRoutes.get("/keyword/:keywordName/articles", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const keywordName = decodeURIComponent(c.req.param('keywordName'));
  
  try {
    console.log(`[CONTENT-TAGS] 用户 ${user.id} 获取关键词 "${keywordName}" 的文章`);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 首先找到用户的关键词ID
    const userKeyword = await db
      .select({ id: userKeywords.id })
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, user.id),
        eq(userKeywords.keywordName, keywordName)
      ))
      .get();

    if (!userKeyword) {
      return c.json({ error: "关键词不存在" }, 404);
    }

    // 获取包含该关键词的文章
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
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        relationCreatedAt: keywordEntryRelations.createdAt
      })
      .from(keywordEntryRelations)
      .innerJoin(rssEntries, eq(keywordEntryRelations.entryId, rssEntries.id))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(keywordEntryRelations.processedContentId, processedContents.id))
      .where(and(
        eq(keywordEntryRelations.keywordId, userKeyword.id),
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
        eq(keywordEntryRelations.keywordId, userKeyword.id),
        eq(keywordEntryRelations.userId, user.id)
      ))
      .get();

    const total = totalCount?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      keyword: keywordName,
      articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取关键词文章失败:', error);
    return c.json({ 
      error: "获取关键词文章失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取文章的所有主题和关键词
contentTagsRoutes.get("/article/:articleId/tags", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const articleId = parseInt(c.req.param('articleId'));
  
  if (isNaN(articleId)) {
    return c.json({ error: "无效的文章ID" }, 400);
  }

  try {
    console.log(`[CONTENT-TAGS] 用户 ${user.id} 获取文章 ${articleId} 的标签`);

    // 验证文章属于用户
    const article = await db
      .select({ id: rssEntries.id })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(and(
        eq(rssEntries.id, articleId),
        eq(sources.userId, user.id)
      ))
      .get();

    if (!article) {
      return c.json({ error: "文章不存在或无权限访问" }, 404);
    }

    // 获取文章的主题
    const topics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount
      })
      .from(topicEntryRelations)
      .innerJoin(userTopics, eq(topicEntryRelations.topicId, userTopics.id))
      .where(and(
        eq(topicEntryRelations.entryId, articleId),
        eq(topicEntryRelations.userId, user.id)
      ))
      .all();

    // 获取文章的关键词
    const keywords = await db
      .select({
        id: userKeywords.id,
        keywordName: userKeywords.keywordName,
        entryCount: userKeywords.entryCount
      })
      .from(keywordEntryRelations)
      .innerJoin(userKeywords, eq(keywordEntryRelations.keywordId, userKeywords.id))
      .where(and(
        eq(keywordEntryRelations.entryId, articleId),
        eq(keywordEntryRelations.userId, user.id)
      ))
      .all();

    // 获取原始processedContents中的数据
    const processedContent = await db
      .select({
        topics: processedContents.topics,
        keywords: processedContents.keywords
      })
      .from(processedContents)
      .where(eq(processedContents.entryId, articleId))
      .get();

    let originalTopics = [];
    let originalKeywords = [];

    if (processedContent?.topics) {
      try {
        originalTopics = JSON.parse(processedContent.topics);
      } catch (e) {
        console.error('解析原始主题失败:', e);
      }
    }

    if (processedContent?.keywords) {
      originalKeywords = processedContent.keywords.split(',').map(k => k.trim()).filter(k => k);
    }

    return c.json({
      success: true,
      articleId,
      aggregatedTopics: topics,
      aggregatedKeywords: keywords,
      originalTopics,
      originalKeywords
    });
  } catch (error) {
    console.error('获取文章标签失败:', error);
    return c.json({ 
      error: "获取文章标签失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 查找相关主题（基于相似性）
contentTagsRoutes.get("/topics/similar/:topicName", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const topicName = decodeURIComponent(c.req.param('topicName'));
  
  try {
    console.log(`[CONTENT-TAGS] 用户 ${user.id} 查找与 "${topicName}" 相似的主题`);

    // 查找包含相似文章的主题
    const similarTopics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        commonArticles: count(topicEntryRelations.entryId).as('commonArticles')
      })
      .from(userTopics)
      .innerJoin(topicEntryRelations, eq(userTopics.id, topicEntryRelations.topicId))
      .where(and(
        eq(userTopics.userId, user.id),
        eq(userTopics.topicName, topicName)
      ))
      .groupBy(userTopics.id, userTopics.topicName, userTopics.entryCount)
      .having(sql`count(${topicEntryRelations.entryId}) > 1`)
      .orderBy(desc(sql`count(${topicEntryRelations.entryId})`))
      .limit(10)
      .all();

    // 找到与当前主题共享文章的其他主题
    const targetTopicArticles = await db
      .select({ entryId: topicEntryRelations.entryId })
      .from(topicEntryRelations)
      .innerJoin(userTopics, eq(topicEntryRelations.topicId, userTopics.id))
      .where(and(
        eq(userTopics.userId, user.id),
        eq(userTopics.topicName, topicName)
      ))
      .all();

    const targetArticleIds = targetTopicArticles.map(a => a.entryId);

    if (targetArticleIds.length === 0) {
      return c.json({
        success: true,
        topicName,
        similarTopics: []
      });
    }

    const relatedTopics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        commonArticles: count(topicEntryRelations.entryId).as('commonArticles')
      })
      .from(topicEntryRelations)
      .innerJoin(userTopics, eq(topicEntryRelations.topicId, userTopics.id))
      .where(and(
        eq(userTopics.userId, user.id),
        neq(userTopics.topicName, topicName),
        inArray(topicEntryRelations.entryId, targetArticleIds)
      ))
      .groupBy(userTopics.id, userTopics.topicName, userTopics.entryCount)
      .orderBy(desc(sql`count(${topicEntryRelations.entryId})`))
      .limit(10)
      .all();

    return c.json({
      success: true,
      topicName,
      similarTopics: relatedTopics.map(t => ({
        ...t,
        similarityScore: Math.round((t.commonArticles / targetArticleIds.length) * 100)
      }))
    });
  } catch (error) {
    console.error('查找相似主题失败:', error);
    return c.json({ 
      error: "查找相似主题失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取主题和关键词的热门趋势
contentTagsRoutes.get("/trends", async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    const days = parseInt(c.req.query('days') || '30');
    console.log(`[CONTENT-TAGS] 用户 ${user.id} 获取最近 ${days} 天的趋势`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 获取热门主题
    const trendingTopics = await db
      .select({
        id: userTopics.id,
        topicName: userTopics.topicName,
        entryCount: userTopics.entryCount,
        recentEntries: sql`COUNT(CASE WHEN ${topicEntryRelations.createdAt} >= ${cutoffDate.toISOString()} THEN 1 END)`.as('recentEntries')
      })
      .from(userTopics)
      .leftJoin(topicEntryRelations, eq(userTopics.id, topicEntryRelations.topicId))
      .where(and(
        eq(userTopics.userId, user.id),
        eq(topicEntryRelations.userId, user.id)
      ))
      .groupBy(userTopics.id, userTopics.topicName, userTopics.entryCount)
      .orderBy(desc(sql`COUNT(CASE WHEN ${topicEntryRelations.createdAt} >= ${cutoffDate.toISOString()} THEN 1 END)`))
      .limit(10)
      .all();

    // 获取热门关键词
    const trendingKeywords = await db
      .select({
        id: userKeywords.id,
        keywordName: userKeywords.keywordName,
        entryCount: userKeywords.entryCount,
        recentEntries: sql`COUNT(CASE WHEN ${keywordEntryRelations.createdAt} >= ${cutoffDate.toISOString()} THEN 1 END)`.as('recentEntries')
      })
      .from(userKeywords)
      .leftJoin(keywordEntryRelations, eq(userKeywords.id, keywordEntryRelations.keywordId))
      .where(and(
        eq(userKeywords.userId, user.id),
        eq(keywordEntryRelations.userId, user.id)
      ))
      .groupBy(userKeywords.id, userKeywords.keywordName, userKeywords.entryCount)
      .orderBy(desc(sql`COUNT(CASE WHEN ${keywordEntryRelations.createdAt} >= ${cutoffDate.toISOString()} THEN 1 END)`))
      .limit(10)
      .all();

    return c.json({
      success: true,
      trends: {
        days,
        trendingTopics: trendingTopics.map(t => ({
          ...t,
          trendScore: Math.round((t.recentEntries / Math.max(t.entryCount, 1)) * 100)
        })),
        trendingKeywords: trendingKeywords.map(k => ({
          ...k,
          trendScore: Math.round((k.recentEntries / Math.max(k.entryCount, 1)) * 100)
        }))
      }
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    return c.json({ 
      error: "获取趋势数据失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default contentTagsRoutes;