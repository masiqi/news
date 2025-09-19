// src/workers/ai-processor.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ContentCacheService } from '../services/content-cache.service';
import { QueueConsumerService } from '../services/queue/consumer';
import { QueueMonitorService } from '../services/queue/monitor';
import { ZhipuAIService } from '../services/ai/zhipu-ai.service';
import { AIConfigService } from '../services/config/ai-config.service';
import { ContentAnalyzerService } from '../services/ai/content-analyzer';
import { MarkdownGenerator } from '../services/ai/markdown-generator';
import { AutoMarkdownStorageService } from '../services/auto-markdown-storage.service';
import { QueueMessage, ProcessingResult } from '../services/queue/types';

// 最大失败重试次数
const MAX_FAILURE_RETRIES = 3;

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
    const queueMonitor = new QueueMonitorService(env.AI_PROCESSOR_QUEUE);
    
    // 初始化AI服务
    const aiService = new ZhipuAIService();
    const configService = new AIConfigService(db);
    const contentAnalyzer = new ContentAnalyzerService();
    const markdownGenerator = new MarkdownGenerator();
    const autoStorageService = new AutoMarkdownStorageService(env);
    
    const consumer = new QueueConsumerService(env.AI_PROCESSOR_QUEUE);
    
    await consumer.process(async (message: QueueMessage) => {
      const startTime = Date.now();
      
      try {
        const { sourceId, userId, content, metadata } = message.payload;
        const entryId = metadata?.entryId;
        
        // 如果提供了entryId，检查条目状态
        if (entryId) {
          const entry = await db.select().from(rssEntries).where(eq(rssEntries.id, entryId)).get();
          if (!entry) {
            console.error(`条目 ${entryId} 不存在`);
            return;
          }
          
          if (entry.failureCount >= MAX_FAILURE_RETRIES) {
            console.error(`条目 ${entryId} 失败次数超过最大重试次数，跳过处理`);
            return;
          }
        }
        
        console.log(`开始LLM内容分析: 消息ID ${message.id}, 条目ID: ${entryId || 'N/A'}`);
        
        // 获取或创建用户AI配置
        let aiConfig: AIProcessingConfig;
        try {
          aiConfig = await configService.getUserConfig(userId);
          console.log(`获取到用户AI配置: ${aiConfig.language}-${aiConfig.style}`);
        } catch (configError) {
          console.warn('获取用户AI配置失败，使用默认配置:', configError);
          aiConfig = await configService.createDefaultConfig(userId);
        }
        
        // 验证配置有效性
        const isValidConfig = await configService.validateConfig(aiConfig);
        if (!isValidConfig) {
          throw new Error('用户AI配置无效');
        }
        
        // 检查智谱AI服务可用性
        const availability = await aiService.checkAvailability();
        if (!availability.available) {
          console.warn(`智谱AI服务不可用: ${availability.message}，将使用Cloudflare AI作为降级`);
          
          // 降级到Cloudflare AI
          await this.processWithCloudflareAI(content, entryId, db, contentCacheService, queueMonitor);
          return;
        }
        
        console.log('智谱AI服务可用，开始增强内容分析...');
        
        // 使用内容分析器进行深度分析
        const analysisResult = await contentAnalyzer.analyzeContent({
          content,
          title: metadata?.title || '未知标题',
          config: aiConfig
        });
        
        console.log(`内容分析完成，耗时: ${analysisResult.processingTime}ms`);
        console.log(`分析结果 - 摘要: ${analysisResult.summary.substring(0, 100)}...`);
        console.log(`分析结果 - 关键词: ${analysisResult.keywords.join(', ')}`);
        console.log(`分析结果 - 分类: ${analysisResult.categories.join(', ')}`);
        console.log(`分析结果 - AI使用量: ${analysisResult.aiTokensUsed} tokens`);
        
        // 生成结构化Markdown文档
        console.log('开始生成Markdown文档...');
        
        let markdownContent: string;
        try {
          markdownContent = await markdownGenerator.generateDocument({
            result: analysisResult,
            config: aiConfig,
            templateId: aiConfig.templateId
          });
          
          console.log(`Markdown文档生成完成，长度: ${markdownContent.length} 字符`);
          
        } catch (markdownError) {
          console.warn('Markdown文档生成失败，使用简化版本:', markdownError);
          
          // 降级到简化Markdown
          markdownContent = markdownGenerator.generateSimpleMarkdown(analysisResult);
        }
        
        // 更新分析结果
        analysisResult.markdownContent = markdownContent;
        analysisResult.status = 'completed';
        
        // 更新配置使用统计
        try {
          await configService.recordConfigChange(userId, aiConfig, analysisResult);
        } catch (recordError) {
          console.warn('记录配置变更失败:', recordError);
        }
        
        const totalProcessingTime = Date.now() - startTime;
        console.log(`完整LLM处理流程完成，总耗时: ${totalProcessingTime}ms`);
        
        // 自动存储Markdown到用户R2空间
        if (entryId) {
          try {
            console.log(`开始自动存储Markdown到用户${userId}的R2空间...`);
            
            const autoStorageResult = await autoStorageService.processAndStoreMarkdown({
              userId,
              sourceId,
              entryId,
              analysisResult,
              originalContent: content,
              metadata: {
                userId,
                sourceId,
                entryId,
                title: metadata?.title || analysisResult.title,
                sourceName: metadata?.sourceName,
                processedAt: new Date()
              }
            });
            
            if (autoStorageResult.success) {
              console.log(`[SUCCESS] 自动存储成功: ${autoStorageResult.filePath} (${autoStorageResult.fileSize}字节)`);
            } else {
              console.warn(`[WARN] 自动存储失败: ${autoStorageResult.error}`);
            }
            
          } catch (storageError) {
            console.error('自动存储过程中出错:', storageError);
            // 自动存储失败不影响主要处理流程
          }
        }
        
        // 如果提供了entryId，缓存完整处理结果
        if (entryId) {
          const processedContent = await contentCacheService.cacheProcessedContent(
            entryId,
            {
              summary: analysisResult.summary,
              markdownContent: analysisResult.markdownContent,
              keywords: analysisResult.keywords.join(','),
              sentiment: analysisResult.sentiment,
              processingTime: analysisResult.processingTime,
              modelUsed: 'glm-4.5-flash',
              aiTokensUsed: analysisResult.aiTokensUsed,
              categories: analysisResult.categories,
              importance: analysisResult.importance,
              readability: analysisResult.readability,
              createdAt: new Date(),
            }
          );
          
          // 标记条目为已处理
          await contentCacheService.markEntryAsProcessed(entryId);
          
          console.log(`完整LLM处理完成，条目ID: ${entryId} 已标记为处理完成`);
        }
        
        // 记录队列统计信息
        try {
          await queueMonitor.checkQueueHealth('AI_PROCESSOR_QUEUE');
        } catch (monitorError) {
          console.warn('记录队列统计信息失败:', monitorError);
        }
        
      } catch (error) {
        console.error('LLM内容处理时出错:', error);
        
        // 如果提供了entryId，增加失败次数
        if (message.payload.metadata?.entryId) {
          try {
            await contentCacheService.incrementFailureCount(message.payload.metadata.entryId);
            console.log(`条目 ${message.payload.metadata.entryId} 失败次数已增加`);
          } catch (incrementError) {
            console.error('增加失败次数时出错:', incrementError);
          }
        }
        
        // 重新抛出错误，让队列自动重试
        throw new Error(`LLM内容处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });
  }

  /**
   * 使用Cloudflare AI进行降级处理
   */
  private async processWithCloudflareAI(
    content: string, 
    entryId: string | undefined, 
    db: any, 
    contentCacheService: ContentCacheService, 
    queueMonitor: QueueMonitorService
  ): Promise<void> {
    console.log('降级到Cloudflare AI处理...');
    
    const aiStartTime = Date.now();
    
    // 并行执行AI处理任务以提高性能
    const [summaryResponse, markdownResponse, keywordsResponse, sentimentResponse] = await Promise.allSettled([
      env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
        prompt: `请为以下内容生成一个简短的摘要:\n\n${content}\n\n摘要:`
      }),
      env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
        prompt: `请将以下内容转换为结构化的Markdown格式:\n\n${content}\n\nMarkdown:`
      }),
      env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
        prompt: `请从以下内容中提取5个最重要的关键词，用逗号分隔:\n\n${content}\n\n关键词:`
      }),
      env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
        prompt: `请分析以下内容的情感倾向，回答"正面"、"负面"或"中性":\n\n${content}\n\n情感:`
      })
    ]);
    
    // 处理结果
    const summary = summaryResponse.status === 'fulfilled' ? summaryResponse.value.response : '摘要生成失败';
    const markdownContent = markdownResponse.status === 'fulfilled' ? markdownResponse.value.response : 'Markdown生成失败';
    const keywords = keywordsResponse.status === 'fulfilled' ? keywordsResponse.value.response : '关键词提取失败';
    const sentiment = sentimentResponse.status === 'fulfilled' ? sentimentResponse.value.response : '中性';
    
    // 记录任何AI处理失败
    if (summaryResponse.status === 'rejected') {
      console.error('摘要生成失败:', summaryResponse.reason);
    }
    if (markdownResponse.status === 'rejected') {
      console.error('Markdown生成失败:', markdownResponse.reason);
    }
    if (keywordsResponse.status === 'rejected') {
      console.error('关键词提取失败:', keywordsResponse.reason);
    }
    if (sentimentResponse.status === 'rejected') {
      console.error('情感分析失败:', sentimentResponse.reason);
    }
    
    const aiProcessingTime = Date.now() - aiStartTime;
    
    // 如果提供了entryId，缓存处理后的内容
    if (entryId) {
      const processedContent = await contentCacheService.cacheProcessedContent(
        entryId,
        {
          summary,
          markdownContent,
          keywords,
          sentiment,
          processingTime: aiProcessingTime,
          modelUsed: '@cf/meta/llama-2-7b-chat-fp16',
          createdAt: new Date(),
        }
      );
      
      // 标记条目为已处理
      await contentCacheService.markEntryAsProcessed(entryId);
      
      console.log(`Cloudflare AI降级处理完成，条目ID: ${entryId}, AI处理时间: ${aiProcessingTime}ms`);
    }
  },
};