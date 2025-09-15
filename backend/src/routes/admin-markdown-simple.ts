// 管理员Markdown管理API路由（简化版）
// 提供管理员查看和管理所有用户Markdown文件的功能

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents, sources } from '../db/schema';
import { eq, and, or, like, desc, isNull, isNotNull, sql } from 'drizzle-orm';
import type { CloudflareBindings } from '../env';

const adminMarkdownRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 管理员权限检查中间件
const requireAdmin = (c: any, next: any) => {
  const user = c.get('user');
  if (!user.isAdmin) {
    return c.json({ error: "需要管理员权限" }, 403);
  }
  return next();
};

/**
 * 获取所有用户的Markdown文件统计
 */
adminMarkdownRoutes.get('/stats', async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    console.log('管理员获取Markdown文件统计');

    // 获取基本统计
    const stats = await db
      .select({
        totalEntries: sql`COUNT(*)`,
        withMarkdown: sql`COUNT(CASE WHEN markdown_content IS NOT NULL AND markdown_content != "" THEN 1 END)`,
        withoutMarkdown: sql`COUNT(CASE WHEN markdown_content IS NULL OR markdown_content = "" THEN 1 END)`,
        avgWordCount: sql`AVG(CASE WHEN word_count > 0 THEN word_count ELSE NULL END)`
      })
      .from(processedContents)
      .all();

    // 获取最受欢迎的内容（按字数排序）
    const popularContent = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        sourceName: sources.name,
        wordCount: processedContents.wordCount,
        createdAt: processedContents.createdAt,
        topics: processedContents.topics
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(and(
        isNotNull(processedContents.markdownContent),
        sql`markdown_content != ""`
      ))
      .orderBy(desc(processedContents.wordCount))
      .limit(10)
      .all();

    return c.json({
      success: true,
      data: {
        overview: stats[0] || {},
        popularContent: popularContent.map(item => ({
          ...item,
          topics: item.topics ? JSON.parse(item.topics) : []
        }))
      }
    });

  } catch (error) {
    console.error('获取Markdown统计失败:', error);
    return c.json({ 
      error: "获取Markdown统计失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取所有Markdown内容列表
 */
adminMarkdownRoutes.get('/list', async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const sourceId = c.req.query('sourceId');
    const hasMarkdown = c.req.query('hasMarkdown');
    const searchQuery = c.req.query('searchQuery');
    
    console.log('管理员获取Markdown列表参数:', {
      page, pageSize, sourceId, hasMarkdown, searchQuery
    });

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereConditions = [];

    if (sourceId) {
      whereConditions.push(eq(rssEntries.sourceId, parseInt(sourceId as string)));
    }

    if (hasMarkdown === 'true') {
      whereConditions.push(and(
        isNotNull(processedContents.markdownContent),
        sql`markdown_content != ""`
      ));
    } else if (hasMarkdown === 'false') {
      whereConditions.push(or(
        isNull(processedContents.markdownContent),
        sql`markdown_content = ""`
      ));
    }

    if (searchQuery) {
      const searchTerm = `%${searchQuery}%`;
      whereConditions.push(or(
        like(rssEntries.title, searchTerm),
        like(processedContents.markdownContent, searchTerm)
      ));
    }

    // 构建完整查询条件
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 计算总数
    const countQuery = db
      .select({ id: rssEntries.id })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .groupBy(rssEntries.id);
    
    if (whereClause) {
      countQuery.where(whereClause);
    }
    
    const allIds = await countQuery.all();
    const total = allIds.length;

    // 获取内容列表
    const contentsQuery = db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        link: rssEntries.link,
        sourceId: rssEntries.sourceId,
        sourceName: sources.name,
        publishedAt: rssEntries.publishedAt,
        processedAt: rssEntries.processedAt,
        markdownContent: processedContents.markdownContent,
        wordCount: processedContents.wordCount,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        modelUsed: processedContents.modelUsed,
        processingTime: processedContents.processingTime,
        createdAt: processedContents.createdAt
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .orderBy(desc(rssEntries.publishedAt))
      .limit(pageSize)
      .offset(offset);

    if (whereClause) {
      contentsQuery.where(whereClause);
    }

    const contents = await contentsQuery.all();

    // 转换数据格式
    const formattedContents = contents.map(item => ({
      ...item,
      topics: item.topics ? JSON.parse(item.topics) : [],
      keywords: item.keywords ? item.keywords.split(',').filter(k => k.trim()) : [],
      hasMarkdown: !!item.markdownContent && item.markdownContent.length > 0,
      contentPreview: item.markdownContent ? item.markdownContent.substring(0, 200) + '...' : null
    }));

    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      contents: formattedContents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('获取Markdown列表失败:', error);
    return c.json({ 
      error: "获取Markdown列表失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取单个Markdown内容的详细信息
 */
adminMarkdownRoutes.get('/:id', async (c) => {
  const entryId = parseInt(c.req.param('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    const content = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        content: rssEntries.content,
        link: rssEntries.link,
        sourceId: rssEntries.sourceId,
        sourceName: sources.name,
        publishedAt: rssEntries.publishedAt,
        processedAt: rssEntries.processedAt,
        markdownContent: processedContents.markdownContent,
        wordCount: processedContents.wordCount,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        modelUsed: processedContents.modelUsed,
        processingTime: processedContents.processingTime,
        createdAt: processedContents.createdAt
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!content) {
      return c.json({ error: "内容不存在" }, 404);
    }

    // 格式化主题和关键词
    const formattedContent = {
      ...content,
      topics: content.topics ? JSON.parse(content.topics) : [],
      keywords: content.keywords ? content.keywords.split(',').filter(k => k.trim()) : []
    };

    return c.json({
      success: true,
      content: formattedContent
    });

  } catch (error) {
    console.error('获取Markdown详情失败:', error);
    return c.json({ 
      error: "获取Markdown详情失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default adminMarkdownRoutes;