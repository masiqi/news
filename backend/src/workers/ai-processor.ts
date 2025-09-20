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
import { SharedContentPoolService } from '../services/shared-content-pool.service';
import { ContentDistributionService } from '../services/content-distribution.service';
import { R2Service } from '../services/r2.service';
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
    
    // 初始化共享内容池服务
    const r2Service = new R2Service(env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    
    // 初始化内容分发服务
    const contentDistributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
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
        
        // 自动存储Markdown到共享内容池和用户空间
        if (entryId) {
          let contentHash: string | null = null;
          let processedContentId: number | null = null;
          
          try {
            console.log(`开始自动存储Markdown到共享内容池和用户${userId}的空间...`);
            
            // 计算内容哈希
            contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(markdownContent))
              .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
            
            console.log(`内容哈希计算完成: ${contentHash}`);
            
            // 1. 存储到共享内容池
            const sharedContentMetadata = {
              title: metadata?.title || analysisResult.title,
              source: metadata?.sourceName || '未知来源',
              publishedAt: metadata?.publishedAt ? new Date(metadata.publishedAt) : new Date(),
              processingTime: analysisResult.processingTime,
              modelUsed: analysisResult.modelUsed || 'glm-4.5-flash',
              wordCount: analysisResult.wordCount || 0,
              entryId: parseInt(entryId)
            };
            
            const sharedContent = await sharedContentPool.storeToSharedPool(
              contentHash,
              markdownContent,
              sharedContentMetadata
            );
            
            console.log(`[SUCCESS] 共享内容存储成功: ${sharedContent.contentHash} (${sharedContent.fileSize}字节)`);
            
            // 2. 为用户创建副本
            const userCopy = await sharedContentPool.createUserCopy(
              userId,
              parseInt(entryId),
              contentHash
            );
            
            console.log(`[SUCCESS] 用户副本创建成功: ${userId} - ${entryId} (${userCopy.fileSize}字节)`);
            
            // 3. 同时调用原有的自动存储服务以保持兼容性（未来可移除）
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
                processedAt: new Date(),
                contentHash: contentHash,
                storagePath: userCopy.userPath
              }
            });
            
            if (autoStorageResult.success) {
              console.log(`[SUCCESS] 兼容性存储成功: ${autoStorageResult.filePath} (${autoStorageResult.fileSize}字节)`);
            } else {
              console.warn(`[WARN] 兼容性存储失败: ${autoStorageResult.error}`);
            }
            
          } catch (storageError) {
            console.error('分层存储过程中出错:', storageError);
            // 分层存储失败不影响主要处理流程
          }
          
          // 4. 智能内容分发 - 将内容分发给相关用户
          if (contentHash) {
            try {
              console.log(`[DISTRIBUTION] 开始智能内容分发: 内容哈希 ${contentHash}`);
              
              // 获取或创建processedContentId（如果需要）
              // 这里简化处理，实际应该从数据库获取
              processedContentId = parseInt(entryId); // 临时使用entryId作为processedContentId
              
              // 构建内容特征
              const contentFeatures = {
                topics: analysisResult.categories || [],
                keywords: analysisResult.keywords || [],
                importanceScore: analysisResult.importance || 0.7,
                source: metadata?.sourceName || '未知来源',
                contentType: 'news' as const
              };
              
              // 执行智能内容分发
              const distributionResults = await contentDistributionService.distributeContent(
                contentHash,
                processedContentId,
                parseInt(entryId),
                contentFeatures
              );
              
              const successCount = distributionResults.filter(r => r.success).length;
              const totalCount = distributionResults.length;
              
              console.log(`[DISTRIBUTION] 智能内容分发完成: 成功 ${successCount}/${totalCount} 用户`);
              
              if (totalCount > 0) {
                console.log(`[DISTRIBUTION] 分发统计:`);
                console.log(`[DISTRIBUTION]   - 成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
                console.log(`[DISTRIBUTION]   - 平均处理时间: ${(distributionResults.reduce((sum, r) => sum + r.processingTime, 0) / totalCount).toFixed(0)}ms`);
                
                // 记录分发失败的详情
                const failedDistributions = distributionResults.filter(r => !r.success);
                if (failedDistributions.length > 0) {
                  console.warn(`[DISTRIBUTION] 分发失败详情:`);
                  failedDistributions.forEach(fd => {
                    console.warn(`[DISTRIBUTION]   - 用户 ${fd.target.userId}: ${fd.error}`);
                  });
                }
              }
              
            } catch (distributionError) {
              console.error('智能内容分发失败:', distributionError);
              // 分发失败不影响主要处理流程
            }
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