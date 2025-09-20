// AI处理API路由 - 提供简化的AI处理功能
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents, sources } from '../db/schema';
import { eq, and, isNull, sql, gt } from 'drizzle-orm';
import { UnifiedLLMService } from '../services/unified-llm.service';

const aiRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 简化的AI处理接口
aiRoutes.post('/process', async (c) => {
  try {
    const body = await c.req.json();
    const { content, sourceId, entryId } = body;

    if (!content) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    console.log(`[AI] 开始处理内容，长度: ${content.length} 字符`);

    // 初始化数据库
    const db = drizzle(c.env.DB);

    // 如果有entryId，先验证条目是否存在
    let rssEntry = null;
    if (entryId) {
      [rssEntry] = await db
        .select()
        .from(rssEntries)
        .where(eq(rssEntries.id, parseInt(entryId)))
        .limit(1);
    }

    // 如果没有entryId但有sourceId，找一个待处理的条目
    if (!rssEntry && sourceId) {
      [rssEntry] = await db
        .select()
        .from(rssEntries)
        .where(and(
          eq(rssEntries.sourceId, parseInt(sourceId)),
          eq(rssEntries.processed, false)
        ))
        .limit(1);
    }

    // 如果还没有entryId，找任何待处理的条目
    if (!rssEntry) {
      [rssEntry] = await db
        .select()
        .from(rssEntries)
        .where(eq(rssEntries.processed, false))
        .limit(1);
    }

    // 使用统一LLM服务进行处理
    if (rssEntry && c.env.ZHIPUAI_API_KEY) {
      try {
        console.log(`[AI] 为条目 ${rssEntry.id} 进行LLM分析`);
        
        const result = await UnifiedLLMService.analyzeAndSave({
          entryId: rssEntry.id,
          title: rssEntry.title,
          content: content,
          link: rssEntry.link,
          isHtml: false,
          apiKey: c.env.ZHIPUAI_API_KEY,
          db: db,
          env: c.env
        });

        // 更新条目状态为已处理
        await db
          .update(rssEntries)
          .set({
            processed: true,
            processedAt: new Date()
          })
          .where(eq(rssEntries.id, rssEntry.id));

        console.log(`[AI] 条目 ${rssEntry.id} 处理完成`);

        return c.json({
          success: true,
          data: {
            entryId: rssEntry.id,
            title: rssEntry.title,
            processedAt: new Date().toISOString(),
            result: result
          },
          message: 'AI处理完成'
        });

      } catch (analysisError) {
        console.error(`[AI] 条目 ${rssEntry.id} 处理失败:`, analysisError);
        
        // 更新失败状态
        await db
          .update(rssEntries)
          .set({
            processed: false,
            failureCount: (rssEntry.failureCount || 0) + 1,
            errorMessage: analysisError instanceof Error ? analysisError.message : '未知错误'
          })
          .where(eq(rssEntries.id, rssEntry.id));

        return c.json({
          success: false,
          error: 'AI处理失败',
          details: analysisError instanceof Error ? analysisError.message : '未知错误'
        }, 500);
      }
    } else {
      // 如果没有找到条目或没有API密钥，返回模拟结果
      return c.json({
        success: true,
        data: {
          processed: true,
          contentLength: content.length,
          simulated: true,
          message: 'AI处理模拟完成（需要配置ZHIPUAI_API_KEY）'
        },
        message: 'AI处理完成'
      });
    }

  } catch (error) {
    console.error('AI处理失败:', error);
    return c.json({
      success: false,
      error: 'AI处理失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取AI处理状态
aiRoutes.get('/status', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    
    // 获取待处理的条目数 (processed = false)
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rssEntries)
      .where(eq(rssEntries.processed, false));

    // 获取已处理的条目数 (processed = true)
    const [processedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rssEntries)
      .where(eq(rssEntries.processed, true));

    // 获取处理失败的条目数 (failureCount > 0)
    const [failedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rssEntries)
      .where(gt(rssEntries.failureCount, 0));

    return c.json({
      success: true,
      data: {
        pending: pendingResult.count || 0,
        processed: processedResult.count || 0,
        failed: failedResult.count || 0,
        total: (pendingResult.count || 0) + (processedResult.count || 0) + (failedResult.count || 0)
      },
      message: 'AI处理状态获取成功'
    });

  } catch (error) {
    console.error('获取AI处理状态失败:', error);
    return c.json({
      success: false,
      error: '获取AI处理状态失败'
    }, 500);
  }
});

export default aiRoutes;