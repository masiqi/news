// 管理员Markdown管理API路由
// 提供管理员查看和管理所有用户Markdown文件的功能

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents, sources, users } from '../db/schema';
import { eq, and, or, like, desc, isNull, isNotNull, sql } from 'drizzle-orm';
import type { CloudflareBindings } from '../env';
import { requireAuth } from '../middleware/auth';
import { AutoMarkdownStorageService } from '../services/auto-markdown-storage.service';

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
adminMarkdownRoutes.get('/admin/markdown/stats', requireAuth, requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    console.log('管理员获取Markdown文件统计');

    // 获取基本统计
    const stats = await db
      .select({
        totalEntries: sql`COUNT(*)`,
        withMarkdown: sql`COUNT(CASE WHEN markdown_content IS NOT NULL AND markdown_content != "" THEN 1 END)`,
        withoutMarkdown: sql`COUNT(CASE WHEN markdown_content IS NULL OR markdown_content = "" THEN 1 END)`,
        avgWordCount: sql`AVG(CASE WHEN word_count > 0 THEN word_count ELSE NULL END)`,
        totalWordCount: sql`SUM(word_count)`,
        maxWordCount: sql`MAX(word_count)`,
        minWordCount: sql`MIN(word_count)`
      })
      .from(processedContents)
      .all();

    // 按来源统计
    const sourceStats = await db
      .select({
        sourceId: rssEntries.sourceId,
        sourceName: sources.name,
        totalEntries: sql`COUNT(*)`,
        withMarkdown: sql`COUNT(CASE WHEN markdown_content IS NOT NULL AND markdown_content != "" THEN 1 END)`,
        avgWordCount: sql`AVG(CASE WHEN word_count > 0 THEN word_count ELSE NULL END)`
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .groupBy(rssEntries.sourceId, sources.name)
      .all();

    // 按日期统计（最近30天）
    const dateStats = await db
      .select({
        date: sql`DATE(created_at)`,
        count: sql`COUNT(*)`,
        wordCount: sql`SUM(word_count)`
      })
      .from(processedContents)
      .where(sql`created_at >= datetime('now', '-30 days')`)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at) DESC`)
      .limit(30)
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
        sourceStats,
        dateStats,
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
adminMarkdownRoutes.get('/admin/markdown/list', requireAuth, requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const sourceId = c.req.query('sourceId');
    const hasMarkdown = c.req.query('hasMarkdown');
    const searchQuery = c.req.query('searchQuery');
    const minWordCount = c.req.query('minWordCount');
    const maxWordCount = c.req.query('maxWordCount');
    
    console.log('管理员获取Markdown列表参数:', {
      page, pageSize, sourceId, hasMarkdown, searchQuery, minWordCount, maxWordCount
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

    if (minWordCount) {
      whereConditions.push(sql`word_count >= ${parseInt(minWordCount as string)}`);
    }

    if (maxWordCount) {
      whereConditions.push(sql`word_count <= ${parseInt(maxWordCount as string)}`);
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
adminMarkdownRoutes.get('/admin/markdown/:id', requireAuth, requireAdmin, async (c) => {
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
        analysis: processedContents.analysis,
        modelUsed: processedContents.modelUsed,
        processingTime: processedContents.processingTime,
        createdAt: processedContents.createdAt,
        updatedAt: processedContents.updatedAt
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
      keywords: content.keywords ? content.keywords.split(',').filter(k => k.trim()) : [],
      analysis: content.analysis ? JSON.parse(content.analysis) : null
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

/**
 * 重新生成指定条目的Markdown内容
 */
adminMarkdownRoutes.post('/admin/markdown/:id/regenerate', requireAuth, requireAdmin, async (c) => {
  const entryId = parseInt(c.req.param('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    // 检查条目是否存在
    const entry = await db
      .select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!entry) {
      return c.json({ error: "条目不存在" }, 404);
    }

    console.log(`管理员重新生成条目 ${entryId} 的Markdown内容`);

    // 使用统一LLM服务重新生成内容
    const { UnifiedLLMService } = await import('../services/unified-llm.service');
    
    await UnifiedLLMService.analyzeAndSave({
      entryId: entry.id,
      title: entry.title,
      content: entry.content,
      link: entry.link,
      apiKey: c.env.ZHIPUAI_API_KEY,
      db: db,
      env: c.env,
      forceRegenerate: true
    });

    // 获取重新生成后的内容
    const updatedContent = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        markdownContent: processedContents.markdownContent,
        wordCount: processedContents.wordCount,
        processingTime: processedContents.processingTime,
        updatedAt: processedContents.updatedAt
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .where(eq(rssEntries.id, entryId))
      .get();

    return c.json({
      success: true,
      message: "Markdown内容重新生成成功",
      content: updatedContent
    });

  } catch (error) {
    console.error('重新生成Markdown失败:', error);
    return c.json({ 
      error: "重新生成Markdown失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 批量重新生成Markdown内容
 */
adminMarkdownRoutes.post('/admin/markdown/batch-regenerate', requireAuth, requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    const body = await c.req.json();
    const { entryIds, force = false } = body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return c.json({
        success: false,
        message: '请提供有效的条目ID列表'
      }, 400);
    }

    if (entryIds.length > 50) {
      return c.json({
        success: false,
        message: '批量操作最多支持50个条目'
      }, 400);
    }

    console.log(`管理员批量重新生成Markdown内容，数量: ${entryIds.length}`);

    const { UnifiedLLMService } = await import('../services/unified-llm.service');
    
    const results = await Promise.allSettled(
      entryIds.map(async (entryId) => {
        try {
          const entry = await db
            .select()
            .from(rssEntries)
            .where(eq(rssEntries.id, entryId))
            .get();

          if (!entry) {
            return { entryId, success: false, error: "条目不存在" };
          }

          await UnifiedLLMService.analyzeAndSave({
            entryId: entry.id,
            title: entry.title,
            content: entry.content,
            link: entry.link,
            apiKey: c.env.ZHIPUAI_API_KEY,
            db: db,
            env: c.env,
            forceRegenerate: force
          });

          return { entryId, success: true };
        } catch (error) {
          return { 
            entryId, 
            success: false, 
            error: error instanceof Error ? error.message : '未知错误' 
          };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    return c.json({
      success: true,
      message: `批量重新生成完成，成功: ${successCount}, 失败: ${failureCount}`,
      results: {
        total: results.length,
        successCount,
        failureCount
      }
    });

  } catch (error) {
    console.error('批量重新生成Markdown失败:', error);
    return c.json({ 
      error: "批量重新生成失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 删除指定条目的Markdown内容
 */
adminMarkdownRoutes.delete('/admin/markdown/:id', requireAuth, requireAdmin, async (c) => {
  const entryId = parseInt(c.req.param('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    // 检查内容是否存在
    const existingContent = await db
      .select()
      .from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .get();

    if (!existingContent) {
      return c.json({ error: "Markdown内容不存在" }, 404);
    }

    console.log(`管理员删除条目 ${entryId} 的Markdown内容`);

    // 删除Markdown内容（保留其他字段）
    await db
      .update(processedContents)
      .set({
        markdownContent: '',
        wordCount: 0,
        updatedAt: new Date()
      })
      .where(eq(processedContents.entryId, entryId));

    return c.json({
      success: true,
      message: "Markdown内容删除成功"
    });

  } catch (error) {
    console.error('删除Markdown失败:', error);
    return c.json({ 
      error: "删除Markdown失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

/**
 * 获取Markdown导出数据
 */
adminMarkdownRoutes.get('/admin/markdown/export', requireAuth, requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    const format = c.req.query('format') || 'json';
    const sourceId = c.req.query('sourceId');
    
    console.log(`管理员导出Markdown数据，格式: ${format}`);

    // 构建查询条件
    let whereConditions = [
      isNotNull(processedContents.markdownContent),
      sql`markdown_content != ""`
    ];

    if (sourceId) {
      whereConditions.push(eq(rssEntries.sourceId, parseInt(sourceId as string)));
    }

    const whereClause = and(...whereConditions);

    // 获取所有Markdown内容
    const contents = await db
      .select({
        id: rssEntries.id,
        title: rssEntries.title,
        link: rssEntries.link,
        sourceName: sources.name,
        publishedAt: rssEntries.publishedAt,
        markdownContent: processedContents.markdownContent,
        wordCount: processedContents.wordCount,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        createdAt: processedContents.createdAt
      })
      .from(rssEntries)
      .leftJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(whereClause)
      .orderBy(desc(rssEntries.publishedAt))
      .all();

    if (format === 'csv') {
      // 生成CSV格式
      const headers = ['ID', '标题', '来源', '发布时间', '字数', '情感', '主题', '关键词', '内容预览'];
      const csvRows = [
        headers.join(','),
        ...contents.map(item => [
          item.id,
          `"${item.title.replace(/"/g, '""')}"`,
          `"${item.sourceName || ''}"`,
          item.publishedAt,
          item.wordCount,
          `"${item.sentiment || ''}"`,
          `"${(item.topics ? JSON.parse(item.topics) : []).join('; ')}"`,
          `"${(item.keywords || '').split(',').filter(k => k.trim()).join('; ')}"`,
          `"${item.markdownContent.substring(0, 100).replace(/"/g, '""')}..."`
        ].join(','))
      ].join('\n');

      return c.text(csvRows, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="markdown-export.csv"'
      });
    } else {
      // 返回JSON格式
      const formattedContents = contents.map(item => ({
        ...item,
        topics: item.topics ? JSON.parse(item.topics) : [],
        keywords: item.keywords ? item.keywords.split(',').filter(k => k.trim()) : []
      }));

      return c.json({
        success: true,
        export: {
          format: 'json',
          totalCount: formattedContents.length,
          exportedAt: new Date().toISOString(),
          contents: formattedContents
        }
      });
    }

  } catch (error) {
    console.error('导出Markdown数据失败:', error);
    return c.json({ 
      error: "导出Markdown数据失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default adminMarkdownRoutes;
