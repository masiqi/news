import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from './env';
import authRoutes from "./routes/auth";
import sourceRoutes from "./routes/sources";
import userRoutes from "./routes/users";
import systemRoutes from "./routes/system";
import topicsRoutes from "./routes/topics";
import webContentRoutes from "./routes/web-content";
import adminRoutes from "./routes/admin";
// 移除测试路由导入
import llmExtractorRoutes from "./services/llm-extractor";
import llmContentExtractorRoutes from "./services/llm-content-extractor";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, sources, processedContents } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ContentCacheService } from './services/content-cache.service';
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

// 注册认证路由
app.route("/auth", authRoutes);

// 注册RSS源路由
app.route("/sources", sourceRoutes);

// 注册用户路由
app.route("/users", userRoutes);

// 注册系统路由
app.route("/system", systemRoutes);

// 注册主题提取路由
app.route("/topics", topicsRoutes);

// 注册网页内容路由
app.route("/web-content", webContentRoutes);

// 注册管理员API路由
app.route("/admin", adminRoutes);

// 移除测试路由注册

// 注册LLM智能内容提取路由
app.route("/llm-extractor", llmExtractorRoutes);
app.route("/llm-content-extractor", llmContentExtractorRoutes);

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

        // 触发网页内容抓取和主题提取
        if (env.AI) {
          try {
            console.log(`开始为条目 ${rssEntry.id} 抓取网页内容`);
            
            // 如果有链接，先抓取网页内容
            if (entry.link) {
              try {
                // 动态导入WebContentService以避免循环依赖
                const { WebContentService } = require('../services/web-content.service');
                const webContentService = new WebContentService(db);
                
                const parsedContent = await webContentService.fetchAndParseWebContent(rssEntry.id, entry.link);
                console.log(`网页内容抓取完成，标题: ${parsedContent.title}，字数: ${parsedContent.wordCount}`);
              } catch (webError) {
                console.error(`网页内容抓取失败，继续使用RSS原始内容:`, webError);
              }
            }
            
            // 现在进行主题提取
            console.log(`开始为条目 ${rssEntry.id} 提取主题`);
            const { run } = env.AI;
            const startTime = Date.now();
            
            // 构建主题提取提示
            const prompt = `你是一个专业的新闻主题分析专家。你的任务是从中文新闻内容中提取关键主题和关键词。要求：1. 提取3-5个最主要的主题；2. 每个主题应该简洁明了（2-6个字）；3. 提取5-10个关键词；4. 输出必须是JSON格式；5. 主题要覆盖新闻的核心内容。

新闻标题：${entry.title}
新闻内容：
${entry.content.substring(0, 2000)}

请从上述新闻内容中提取主题和关键词，并以JSON格式返回，结构如下：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"]
}

要求：
1. 主题应该简洁、准确，覆盖新闻的核心内容
2. 关键词应该是文章中的重要名词、术语或概念
3. 只返回JSON，不要包含其他解释`;

            const response = await run({
              model: "@cf/meta/llama-3.1-8b-instruct-fast",
              messages: [
                {
                  role: "system",
                  content: "你是一个专业的新闻主题分析专家。你的任务是从中文新闻内容中提取关键主题和关键词。"
                },
                {
                  role: "user", 
                  content: prompt
                }
              ],
              temperature: 0.3,
              max_tokens: 500
            });

            const endTime = Date.now();
            console.log(`条目 ${rssEntry.id} 主题提取完成，耗时: ${endTime - startTime}ms`);

            // 解析并保存主题结果
            const resultText = response.response;
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              
              if (Array.isArray(parsed.topics) && Array.isArray(parsed.keywords)) {
                const db = drizzle(env.DB);
                
                // 序列化主题为JSON字符串
                const topicsJson = JSON.stringify(parsed.topics.slice(0, 5));
                const keywordsString = parsed.keywords.slice(0, 10).join(',');
                
                // 更新processed_contents表
                await db.update(processedContents)
                  .set({
                    topics: topicsJson,
                    keywords: keywordsString
                  })
                  .where(eq(processedContents.entryId, rssEntry.id));
                
                console.log(`条目 ${rssEntry.id} 主题已保存: ${parsed.topics.join(', ')}`);
              }
            }
          } catch (topicError) {
            console.error(`条目 ${rssEntry.id} 主题提取失败:`, topicError);
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
