// src/workers/ai-processor.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { ContentCacheService } from '../services/content-cache.service';

interface Env {
  DB: D1Database;
  AI: any; // Cloudflare AI bindings
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('AI Processor Worker');
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const contentCacheService = new ContentCacheService(db);

    for (const message of batch.messages) {
      try {
        const { entryId, sourceId, content } = message.body;
        
        // 使用Cloudflare Workers AI处理内容
        const startTime = Date.now();
        
        // 生成摘要
        const summaryResponse = await env.AI.run(
          '@cf/meta/llama-2-7b-chat-fp16',
          {
            prompt: `请为以下内容生成一个简短的摘要:\n\n${content}\n\n摘要:`
          }
        );
        const summary = summaryResponse.response;
        
        // 生成Markdown内容
        const markdownResponse = await env.AI.run(
          '@cf/meta/llama-2-7b-chat-fp16',
          {
            prompt: `请将以下内容转换为结构化的Markdown格式:\n\n${content}\n\nMarkdown:`
          }
        );
        const markdownContent = markdownResponse.response;
        
        // 关键词提取
        const keywordsResponse = await env.AI.run(
          '@cf/meta/llama-2-7b-chat-fp16',
          {
            prompt: `请从以下内容中提取5个最重要的关键词，用逗号分隔:\n\n${content}\n\n关键词:`
          }
        );
        const keywords = keywordsResponse.response;
        
        // 情感分析
        const sentimentResponse = await env.AI.run(
          '@cf/meta/llama-2-7b-chat-fp16',
          {
            prompt: `请分析以下内容的情感倾向，回答"正面"、"负面"或"中性":\n\n${content}\n\n情感:`
          }
        );
        const sentiment = sentimentResponse.response;
        
        const processingTime = Date.now() - startTime;
        
        // 缓存处理后的内容
        const processedContent = await contentCacheService.cacheProcessedContent(
          entryId,
          {
            summary,
            markdownContent,
            keywords,
            sentiment,
            processingTime,
            modelUsed: '@cf/meta/llama-2-7b-chat-fp16',
            createdAt: new Date(),
          }
        );
        
        // 标记条目为已处理
        await contentCacheService.markEntryAsProcessed(entryId);
        
        console.log(`内容处理完成，条目ID: ${entryId}, 处理时间: ${processingTime}ms`);
      } catch (error) {
        console.error('AI处理内容时出错:', error);
        // 可以选择重新排队失败的消息
      }
    }
  },
};