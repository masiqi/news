// src/routes/content.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents, sources } from '../db/schema';
import { eq, and, or, like, ilike, desc, isNull, isNotNull, sql } from 'drizzle-orm';

const contentRoutes = new Hono<{ Bindings: CloudflareBindings }>();

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type TagLinkType = 'topics' | 'keywords';

const buildTagLink = (type: TagLinkType, label: string): string => {
  const rawValue = typeof label === 'string' ? label : String(label ?? '');
  const safeLabel = escapeHtml(rawValue);
  const encodedValue = encodeURIComponent(rawValue);
  const color = type === 'topics' ? '#e3f2fd' : '#f3e5f5';
  const textColor = type === 'topics' ? '#1976d2' : '#7b1fa2';
  const title = type === 'topics' ? '点击查看相关主题内容' : '点击查看相关关键词内容';

  return `<a href="#/tags" data-tag="${encodedValue}" onclick="return window.handleTagLinkClick ? window.handleTagLinkClick('${type}', decodeURIComponent(this.dataset.tag)) : true;" style="display: inline-block; margin: 2px; padding: 4px 12px; background: ${color}; color: ${textColor}; text-decoration: none; border-radius: 16px; font-size: 13px; font-weight: 500;" title="${title}">${safeLabel}</a>`;
};

// 获取内容列表
contentRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const sourceId = c.req.query('sourceId');
    const hasWebContent = c.req.query('hasWebContent');
    const hasTopics = c.req.query('hasTopics');
    const searchQuery = c.req.query('searchQuery');
    
    console.log(`[CONTENT] 获取内容列表 - 页码: ${page}, 每页: ${pageSize}${sourceId ? `, 源ID: ${sourceId}` : ''}${searchQuery ? ', 搜索: ' + searchQuery : ''}`);

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereConditions = [];

    if (sourceId) {
      whereConditions.push(eq(rssEntries.sourceId, parseInt(sourceId as string)));
    }

    if (hasWebContent === 'true') {
      whereConditions.push(and(
        isNotNull(processedContents.markdownContent),
        like(processedContents.markdownContent, '%%')
      ));
    } else if (hasWebContent === 'false') {
      whereConditions.push(or(
        isNull(processedContents.markdownContent),
        ilike(processedContents.markdownContent, '')
      ));
    }

    if (hasTopics === 'true') {
      whereConditions.push(and(
        isNotNull(processedContents.topics),
        like(processedContents.topics, '%[%]%')
      ));
    } else if (hasTopics === 'false') {
      whereConditions.push(or(
        isNull(processedContents.topics),
        ilike(processedContents.topics, '[]')
      ));
    }

    if (searchQuery) {
      const searchTerm = `%${searchQuery}%`;
      whereConditions.push(or(
        like(rssEntries.title, searchTerm),
        like(rssEntries.content, searchTerm),
        like(processedContents.markdownContent, searchTerm)
      ));
    }

    // 构建完整查询条件
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 计算总数 - 使用GROUP BY避免重复计数
    const countQuery = db
      .select({ id: rssEntries.id })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .groupBy(rssEntries.id);  // 确保每个RSS条目只计数一次
    
    if (whereClause) {
      countQuery.where(whereClause);
    }
    
    const allIds = await countQuery.all();
    const total = allIds.length;

    // 使用更简单的方法：直接使用LEFT JOIN然后使用GROUP BY避免重复
    const contentsQuery = db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        content: rssEntries.content,
        link: rssEntries.link,
        sourceId: rssEntries.sourceId,
        sourceName: sources.name,
        publishedAt: rssEntries.publishedAt,
        processedAt: rssEntries.processedAt,
        webContent: processedContents.markdownContent,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        analysis: processedContents.analysis,
        educationalValue: processedContents.educationalValue,
        wordCount: processedContents.wordCount
      })
      .from(rssEntries)
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .groupBy(rssEntries.id)  // 确保每个RSS条目只返回一行
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
      webContent: item.webContent || null
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
    console.error('获取内容列表失败:', error);
    return c.json({ 
      error: "获取内容列表失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取单个内容的详细信息
contentRoutes.get("/:id", async (c) => {
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
        webContent: processedContents.markdownContent,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        analysis: processedContents.analysis,
        educationalValue: processedContents.educationalValue,
        modelUsed: processedContents.modelUsed,
        processingTime: processedContents.processingTime
      })
      .from(rssEntries)
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!content) {
      return c.json({ error: "内容不存在" }, 404);
    }

    // 格式化主题和关键词
    let topicsArray = [];
    let keywordsArray = [];
    
    try {
      topicsArray = content.topics ? JSON.parse(content.topics) : [];
    } catch (e) {
      topicsArray = [];
    }
    
    try {
      keywordsArray = content.keywords ? content.keywords.split(',').filter(k => k.trim()) : [];
    } catch (e) {
      keywordsArray = [];
    }
    
    // 生成主题和关键词的HTML显示
    const topicsDisplay = topicsArray.length > 0 
      ? topicsArray.map(topic => buildTagLink('topics', topic)).join(' ')
      : '暂无主题';
      
    const keywordsDisplay = keywordsArray.length > 0 
      ? keywordsArray.map(keyword => buildTagLink('keywords', keyword)).join(' ')
      : '暂无关键词';

    const formattedContent = {
      ...content,
      topics: topicsArray,
      keywords: keywordsArray,
      topics_display: topicsDisplay,
      keywords_display: keywordsDisplay
    };

    return c.json({
      success: true,
      content: formattedContent
    });
  } catch (error) {
    console.error('获取内容详情失败:', error);
    return c.json({ 
      error: "获取内容详情失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default contentRoutes;
