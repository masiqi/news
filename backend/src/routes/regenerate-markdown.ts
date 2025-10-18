// 批量重新生成 Markdown 文件
// 从数据库中读取已有的 LLM 分析结果，生成 Markdown 文件到 R2

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, isNotNull } from 'drizzle-orm';
import { rssEntries, processedContents, sources } from '../db/schema';
import { AutoMarkdownStorageService } from '../services/auto-markdown-storage.service';

const regenerateRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST /api/v1/admin/regenerate-markdown
 * 批量重新生成 Markdown 文件
 */
regenerateRoutes.post('/regenerate-markdown', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const storageService = new AutoMarkdownStorageService(c.env);

    // 查询所有已处理的条目（有 LLM 分析结果的）
    const processedEntries = await db
      .select({
        entryId: processedContents.entryId,
        entry: rssEntries,
        source: sources,
        analysis: processedContents
      })
      .from(processedContents)
      .innerJoin(rssEntries, eq(processedContents.entryId, rssEntries.id))
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(
        and(
          isNotNull(processedContents.analysis),
          isNotNull(sources.userId)
        )
      )
      .all();

    console.log(`[REGENERATE] 发现 ${processedEntries.length} 条已处理的内容`);

    let generated = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of processedEntries) {
      const { entry, source, analysis } = item;

      if (!source.userId) {
        skipped++;
        console.log(`[SKIP] 条目 ${entry.id} 没有关联用户`);
        continue;
      }

      try {
        console.log(`[PROCESS] 正在为条目 ${entry.id} 生成 Markdown...`);

        // 解析已有的 LLM 分析结果
        const topics = analysis.topics ? JSON.parse(analysis.topics) : [];
        const keywords = analysis.keywords ? analysis.keywords.split(',').filter(Boolean) : [];
        const images = analysis.images ? JSON.parse(analysis.images) : [];

        // 构建符合 ProcessingResult 接口的对象
        const analysisResult: any = {
          id: entry.id.toString(),
          sourceId: entry.sourceId.toString(),
          userId: source.userId.toString(),
          originalUrl: entry.link || '',
          title: entry.title,
          content: entry.content,
          summary: analysis.markdownContent?.substring(0, 500) || '无摘要',
          keywords: keywords,
          categories: topics, // topics 映射到 categories
          sentiment: analysis.sentiment || 'neutral',
          importance: 5,
          readability: 5,
          markdownContent: analysis.markdownContent || '',
          processingTime: analysis.processingTime || 0,
          aiTokensUsed: 0,
          aiProvider: analysis.modelUsed || 'unknown',
          aiModel: analysis.modelUsed || 'unknown',
          status: 'completed' as const,
          createdAt: new Date(entry.createdAt),
          completedAt: analysis.updatedAt ? new Date(analysis.updatedAt) : new Date()
        };

        // 调用自动存储服务生成 Markdown
        const result = await storageService.processAndStoreMarkdown({
          userId: source.userId,
          sourceId: entry.sourceId,
          entryId: entry.id,
          analysisResult: analysisResult,
          originalContent: entry.content,
          metadata: {
            userId: source.userId,
            sourceId: entry.sourceId,
            entryId: entry.id,
            title: entry.title,
            sourceName: source.name,
            processedAt: new Date()
          }
        });

        if (result.success) {
          generated++;
          console.log(`[SUCCESS] ✅ 条目 ${entry.id}: ${result.filePath}`);
        } else {
          failed++;
          console.log(`[FAILED] ❌ 条目 ${entry.id}: ${result.error}`);
        }

        // 每处理 5 条暂停一下，避免过载
        if ((generated + failed) % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        failed++;
        console.error(`[ERROR] 条目 ${entry.id} 生成失败:`, error);
      }
    }

    return c.json({
      success: true,
      total: processedEntries.length,
      generated,
      failed,
      skipped,
      message: `成功生成 ${generated} 个 Markdown 文件，失败 ${failed} 个，跳过 ${skipped} 个`
    });

  } catch (error) {
    console.error('[REGENERATE] 批量生成失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '批量生成失败'
    }, 500);
  }
});

/**
 * POST /api/v1/admin/regenerate-markdown/single/:entryId
 * 重新生成单个条目的 Markdown 文件
 */
regenerateRoutes.post('/regenerate-markdown/single/:entryId', async (c) => {
  try {
    const entryId = parseInt(c.req.param('entryId'));
    const db = drizzle(c.env.DB);
    const storageService = new AutoMarkdownStorageService(c.env);

    // 查询条目信息
    const result = await db
      .select({
        entry: rssEntries,
        source: sources,
        analysis: processedContents
      })
      .from(rssEntries)
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .leftJoin(processedContents, eq(processedContents.entryId, rssEntries.id))
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!result) {
      return c.json({ success: false, error: '条目不存在' }, 404);
    }

    const { entry, source, analysis } = result;

    if (!analysis || !analysis.analysis) {
      return c.json({ success: false, error: '该条目尚未进行 LLM 分析' }, 400);
    }

    if (!source.userId) {
      return c.json({ success: false, error: '该条目没有关联用户' }, 400);
    }

    // 解析已有的 LLM 分析结果
    const topics = analysis.topics ? JSON.parse(analysis.topics) : [];
    const keywords = analysis.keywords ? analysis.keywords.split(',').filter(Boolean) : [];
    const images = analysis.images ? JSON.parse(analysis.images) : [];

    // 构建符合 ProcessingResult 接口的对象
    const analysisResult: any = {
      id: entry.id.toString(),
      sourceId: entry.sourceId.toString(),
      userId: source.userId.toString(),
      originalUrl: entry.link || '',
      title: entry.title,
      content: entry.content,
      summary: analysis.markdownContent?.substring(0, 500) || '无摘要',
      keywords: keywords,
      categories: topics, // topics 映射到 categories
      sentiment: analysis.sentiment || 'neutral',
      importance: 5,
      readability: 5,
      markdownContent: analysis.markdownContent || '',
      processingTime: analysis.processingTime || 0,
      aiTokensUsed: 0,
      aiProvider: analysis.modelUsed || 'unknown',
      aiModel: analysis.modelUsed || 'unknown',
      status: 'completed' as const,
      createdAt: new Date(entry.createdAt),
      completedAt: analysis.updatedAt ? new Date(analysis.updatedAt) : new Date()
    };

    // 生成 Markdown
    const storageResult = await storageService.processAndStoreMarkdown({
      userId: source.userId,
      sourceId: entry.sourceId,
      entryId: entry.id,
      analysisResult: analysisResult,
      originalContent: entry.content,
      metadata: {
        userId: source.userId,
        sourceId: entry.sourceId,
        entryId: entry.id,
        title: entry.title,
        sourceName: source.name,
        processedAt: new Date()
      }
    });

    if (storageResult.success) {
      return c.json({
        success: true,
        filePath: storageResult.filePath,
        fileSize: storageResult.fileSize,
        message: 'Markdown 文件生成成功'
      });
    } else {
      return c.json({
        success: false,
        error: storageResult.error
      }, 500);
    }

  } catch (error) {
    console.error('[REGENERATE_SINGLE] 生成失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '生成失败'
    }, 500);
  }
});

export default regenerateRoutes;
