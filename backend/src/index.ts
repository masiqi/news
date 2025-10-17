import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from './env';

// 开发环境加载.env文件
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
import authRoutes from "./routes/auth";
import sourceRoutes from "./routes/sources";
import userRoutes from "./routes/users";
import systemRoutes from "./routes/system";
import topicsRoutes from "./routes/topics";
import webContentRoutes from "./routes/web-content";
import contentRoutes from "./routes/content";
import adminRoutes from "./routes/admin";
import adminMarkdownRoutes from "./routes/admin-markdown-simple";
import reprocessRoutes from "./routes/reprocess";
import tagsRoutes from "./routes/tags";
import userAccessRoutes from "./routes/user-access";
import adminAccessRoutes from "./routes/admin-access";
import autoStorageRoutes from "./routes/auto-storage";
import credentialRoutes from "./routes/credentials";
import webdavRoutes from "./routes/webdav";
import distributionRoutes from "./routes/distribution";
import editIsolationRoutes from "./routes/edit-isolation";
import optimizationRoutes from "./routes/storage-optimization";
import rssRoutes from "./routes/rss";
import statusRoutes from "./routes/api-status";
import monitoringRoutes from "./routes/monitoring";
import aiRoutes from "./routes/ai";
import systemMonitorRoutes from "./routes/system-monitor";
import topicsManagementRoutes from "./routes/topics-management";
import keywordsManagementRoutes from "./routes/keywords-management";
import contentTagsRoutes from "./routes/content-tags";
// 暂时注释掉GLM路由，因为有导入错误
// import glmRoutes from "./routes/glm";
// 移除测试路由导入
import llmExtractorRoutes from "./services/llm-extractor";
import llmContentExtractorRoutes from "./services/llm-content-extractor";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, sources, processedContents } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ContentCacheService } from './services/content-cache.service';
import { UnifiedLLMService } from './services/unified-llm.service';
import Parser from 'rss-parser';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 添加CORS中间件
app.use(
  cors({
    origin: (origin) => origin,
    allowMethods: ['POST', 'PUT', 'DELETE', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Access-Control-Request-Headers', 'Access-Control-Request-Method', 'Cache-Control', 'Connection', 'Origin', 'Pragma', 'Referer', 'Sec-Fetch-Mode', 'User-Agent'],
    maxAge: 600,
    credentials: true,
  })
);

// ==================== API v1 路由 (用户API) ====================
// 认证相关
app.route("/api/v1/auth", authRoutes);

// 内容相关
app.route("/api/v1/content", contentRoutes);
app.route("/api/v1/content", reprocessRoutes);
app.route("/api/v1/sources", sourceRoutes);
app.route("/api/v1/rss", rssRoutes);

// 标签和主题
app.route("/api/v1/tags", tagsRoutes);
app.route("/api/v1/topics", topicsRoutes);
app.route("/api/v1/content-tags", contentTagsRoutes);

// 用户功能
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/user", userAccessRoutes);
app.route("/api/v1/auto-storage", autoStorageRoutes);
app.route("/api/v1/credentials", credentialRoutes);

// 系统功能
app.route("/api/v1/system", systemRoutes);
app.route("/api/v1/monitoring", monitoringRoutes);
app.route("/api/v1", statusRoutes);

// 其他功能
app.route("/api/v1/web-content", webContentRoutes);
app.route("/api/v1/ai", aiRoutes);
app.route("/api/v1/edit-isolation", editIsolationRoutes);
app.route("/api/v1/storage-optimization", optimizationRoutes);
app.route("/api/v1/content-distribution", distributionRoutes);

// LLM提取器
app.route("/api/v1/llm-extractor", llmExtractorRoutes);
app.route("/api/v1/llm-content-extractor", llmContentExtractorRoutes);

// ==================== 管理员 API 路由 ====================
app.route("/api/admin", adminRoutes);
app.route("/api/admin", adminAccessRoutes);
app.route("/api/admin", systemMonitorRoutes);
app.route("/api/admin/markdown", adminMarkdownRoutes);
app.route("/api/admin/topics", topicsManagementRoutes);
app.route("/api/admin/keywords", keywordsManagementRoutes);

// ==================== 特殊路由 ====================
// WebDAV (保持独立路径)
app.route("/webdav", webdavRoutes);

// ==================== 向后兼容的旧路由 (逐步废弃) ====================
// 认证路由 - 兼容旧客户端
app.route("/auth", authRoutes);
app.route("/api/auth", authRoutes);

// 管理员路由 - 兼容旧客户端
app.route("/admin", adminRoutes);

// 测试端点
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

// 队列处理函数
async function queue(batch: MessageBatch<any>, env: CloudflareBindings): Promise<void> {
  console.log(`处理队列消息批次，包含 ${batch.messages.length} 条消息`);
  
  for (const message of batch.messages) {
    try {
      const { sourceId, rssUrl, manualTrigger } = message.body;
      console.log(`处理RSS源 ${sourceId} 的队列消息，URL: ${rssUrl}，手动触发: ${manualTrigger || false}`);
      
      // 处理RSS获取任务
      await processRssFetch(sourceId, rssUrl, env);
      
      console.log(`RSS源 ${sourceId} 处理完成`);
    } catch (error) {
      console.error('处理队列消息时出错:', error);
      throw error; // 让Cloudflare Workers处理重试逻辑
    }
  }
}

// RSS获取处理函数
async function processRssFetch(sourceId: number, rssUrl: string, env: CloudflareBindings): Promise<void> {
  const db = drizzle(env.DB);
  const contentCacheService = new ContentCacheService(env.DB);
  
  try {
    // 获取RSS源信息
    const source = await db.select().from(sources).where(eq(sources.id, sourceId)).get();
    if (!source) {
      console.error(`RSS源 ${sourceId} 不存在`);
      return;
    }

    console.log(`开始获取RSS源 ${sourceId} 的内容，URL: ${rssUrl}`);

    // 抓取RSS内容
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const rssContent = await response.text();
    console.log(`成功获取RSS内容，长度: ${rssContent.length}`);

    // 重置源的失败状态
    await db.update(sources)
      .set({
        fetchFailureCount: 0,
        fetchErrorMessage: null,
        lastFetchedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    // 解析RSS内容
    const entries = await parseRssContent(rssContent);
    console.log(`解析出 ${entries.length} 条RSS条目`);

    // 处理每个条目
    let newEntryCount = 0;
    for (const entry of entries) {
      try {
        // 检查条目是否已存在并处理
        const { entry: rssEntry, wasAlreadyProcessed } = await contentCacheService.processRssEntry(
          sourceId,
          entry.guid,
          {
            title: entry.title,
            link: entry.link,
            content: entry.content,
            publishedAt: new Date(entry.publishedAt),
            createdAt: new Date(),
          }
        );

        if (!wasAlreadyProcessed) {
          newEntryCount++;
          console.log(`新条目已保存: ${entry.title}`);
        }

        // 使用统一LLM服务进行完整的内容分析
        if (env.ZHIPUAI_API_KEY) {
          try {
            console.log(`开始为条目 ${rssEntry.id} 进行统一LLM分析`);
            
            // 准备分析内容
            let contentForAnalysis = entry.content;
            let webContentFetched = false;
            
            // 如果有链接，先尝试抓取完整的网页内容
            if (entry.link) {
              try {
                console.log(`[WEB] 尝试抓取完整网页内容: ${entry.link}`);
                
                const response = await fetch(entry.link, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                  }
                });

                if (response.ok) {
                  const html = await response.text();
                  contentForAnalysis = html;
                  webContentFetched = true;
                  console.log(`[SUCCESS] 网页抓取成功，使用HTML内容进行分析，长度: ${html.length} 字符`);
                }
              } catch (webError) {
                console.error(`[ERROR] 网页内容抓取失败，将使用RSS原始内容:`, webError);
              }
            }
            
            // 使用统一LLM服务进行分析
            await UnifiedLLMService.analyzeAndSave({
              entryId: rssEntry.id,
              title: entry.title,
              content: contentForAnalysis,
              link: entry.link,
              isHtml: webContentFetched,
              apiKey: env.ZHIPUAI_API_KEY,
              db: db,
              env
            });
            
            console.log(`[SUCCESS] 条目 ${rssEntry.id} 统一LLM分析完成`);
            
          } catch (analysisError) {
            console.error(`条目 ${rssEntry.id} LLM分析失败:`, analysisError);
            // 继续处理其他条目，不因为单个条目失败而中断整个流程
          }
        }
      } catch (entryError) {
        console.error(`处理RSS条目失败:`, entryError);
      }
    }
    
    console.log(`RSS源 ${sourceId} 处理完成，新增 ${newEntryCount} 条目，共处理 ${entries.length} 条目`);
  } catch (error) {
    console.error(`获取RSS源 ${sourceId} 内容失败:`, error);
    
    // 更新源的获取状态
    const currentSource = await db.select().from(sources).where(eq(sources.id, sourceId)).get();
    await db.update(sources)
      .set({
        fetchFailureCount: (currentSource?.fetchFailureCount || 0) + 1,
        fetchErrorMessage: error instanceof Error ? error.message : '未知错误',
        lastFetchedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));
  }
}

// RSS解析函数
async function parseRssContent(rssContent: string): Promise<any[]> {
  try {
    const parser = new Parser();
    const feed = await parser.parseString(rssContent);
    
    return feed.items.map(item => ({
      guid: item.guid || item.id || item.link || `${item.title}-${item.pubDate}`,
      title: item.title || '',
      link: item.link || '',
      content: item['content:encoded'] || item.content || item.summary || '',
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('解析RSS内容失败:', error);
    throw new Error(`RSS解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export default {
  fetch: app.fetch.bind(app),
  queue: queue
};
