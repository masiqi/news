// src/services/topic-extraction.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ModelConfigService, TopicExtractionModelConfig } from './model-config.service';

export interface TopicExtractionResult {
  topics: string[];
  keywords: string[];
  sentiment?: string;
  modelUsed: string;
  processingTime: number;
  modelConfig?: string; // 模型配置ID
}

export class TopicExtractionService {
  private aiBindings: any; // Cloudflare AI bindings

  constructor(aiBindings: any) {
    this.aiBindings = aiBindings;
  }

  /**
   * 从新闻内容中提取主题（支持可配置模型）
   * @param content 新闻内容
   * @param title 新闻标题（可选，提供更好上下文）
   * @param modelConfig 可选的模型配置
   * @returns 提取结果
   */
  async extractTopics(content: string, title?: string, modelConfig?: TopicExtractionModelConfig): Promise<TopicExtractionResult> {
    const startTime = Date.now();

    try {
      // 使用提供的模型配置或自动选择最佳模型
      const config = modelConfig || ModelConfigService.autoSelectModel('topic-extraction');
      const aiBinding = this.aiBindings[config.model];
      
      if (!aiBinding) {
        throw new Error(`AI绑定 ${config.bindingName} 不存在`);
      }
      
      // 构建AI提示
      const prompt = this.buildTopicExtractionPrompt(content, title);
      
      // 使用配置的Cloudflare AI进行主题提取
      const response = await aiBinding.run({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的新闻主题分析专家。你的任务是从中文新闻内容中提取关键主题和关键词。要求：1. 提取3-5个最主要的主题；2. 每个主题应该简洁明了（2-6个字）；3. 提取5-10个关键词；4. 输出必须是JSON格式；5. 主题要覆盖新闻的核心内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 解析AI响应
      const result = this.parseAIResponse(response.response);
      
      return {
        ...result,
        modelUsed: config.model,
        processingTime,
        modelConfig: modelConfig?.model || 'auto'
      };
    } catch (error) {
      console.error('主题提取失败:', error);
      
      // 返回错误结果，使用默认模型
      const defaultConfig = ModelConfigService.autoSelectModel('topic-extraction');
      
      return {
        topics: [],
        keywords: [],
        modelUsed: defaultConfig.model,
        processingTime: Date.now() - startTime,
        modelConfig: 'error'
      };
    }
  }

  /**
   * 构建主题提取的提示词
   */
  private buildTopicExtractionPrompt(content: string, title?: string): string {
    const titlePart = title ? `标题：${title}\n` : '';
    
    return `${titlePart}新闻内容：
${content.substring(0, 2000)} // 限制内容长度以避免token超限

请从上述新闻内容中提取主题和关键词，并以JSON格式返回，结构如下：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"]
}

要求：
1. 主题应该简洁、准确，覆盖新闻的核心内容
2. 关键词应该是文章中的重要名词、术语或概念
3. 只返回JSON，不要包含其他解释
4. 如果内容不足，请返回空的数组和关键词列表`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): Omit<TopicExtractionResult, 'modelUsed' | 'processingTime'> {
    try {
      // 尝试解析JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // 验证数据结构
        if (Array.isArray(parsed.topics) && Array.isArray(parsed.keywords)) {
          return {
            topics: parsed.topics.slice(0, 5), // 最多5个主题
            keywords: parsed.keywords.slice(0, 10) // 最多10个关键词
          };
        }
      }
      
      // 如果JSON解析失败，尝试简单文本解析
      return this.parseSimpleResponse(response);
    } catch (error) {
      console.error('解析AI响应失败:', error);
      return {
        topics: [],
        keywords: []
      };
    }
  }

  /**
   * 简单文本解析（备用方案）
   */
  private parseSimpleResponse(response: string): Omit<TopicExtractionResult, 'modelUsed' | 'processingTime'> {
    const topics: string[] = [];
    const keywords: string[] = [];
    
    // 使用正则表达式提取可能的主题和关键词
    const lines = response.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过空行和JSON标记
      if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('}') || trimmed.startsWith('"')) {
        continue;
      }
      
      // 简单的启发式规则
      if (trimmed.includes('主题') || trimmed.includes('话题')) {
        const topicMatch = trimmed.match(/[:：]\s*([^,，\n]+)/);
        if (topicMatch) {
          topicMatch[1].split(/[,，]/).forEach((topic: string) => {
            const cleanTopic = topic.trim().replace(/[""]/g, '');
            if (cleanTopic && cleanTopic.length >= 2 && cleanTopic.length <= 10) {
              topics.push(cleanTopic);
            }
          });
        }
      }
      
      if (trimmed.includes('关键词') || trimmed.includes('关键字')) {
        const keywordMatch = trimmed.match(/[:：]\s*([^,，\n]+)/);
        if (keywordMatch) {
          keywordMatch[1].split(/[,，]/).forEach((keyword: string) => {
            const cleanKeyword = keyword.trim().replace(/[""]/g, '');
            if (cleanKeyword && cleanKeyword.length >= 2) {
              keywords.push(cleanKeyword);
            }
          });
        }
      }
    }
    
    return {
      topics: topics.slice(0, 5),
      keywords: keywords.slice(0, 10)
    };
  }

  /**
   * 保存主题提取结果到数据库
   */
  async saveTopics(entryId: number, result: TopicExtractionResult): Promise<void> {
    const db = drizzle(process.env.DB);
    
    try {
      // 序列化主题为JSON字符串
      const topicsJson = JSON.stringify(result.topics);
      const keywordsString = result.keywords.join(',');
      
      // 更新processed_contents表
      await db.update(processedContents)
        .set({
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: result.sentiment
        })
        .where(eq(processedContents.entryId, entryId));
      
      console.log(`主题提取结果已保存，条目ID: ${entryId}，主题: ${result.topics.join(', ')}`);
    } catch (error) {
      console.error('保存主题提取结果失败:', error);
      throw error;
    }
  }

  /**
   * 批量处理多个条目的主题提取
   */
  async processBatchTopics(entries: Array<{ id: number; content: string; title?: string }>): Promise<void> {
    console.log(`开始批量主题提取，共${entries.length}条`);
    
    for (const entry of entries) {
      try {
        const result = await this.extractTopics(entry.content, entry.title);
        await this.saveTopics(entry.id, result);
        
        // 添加小延迟以避免AI API频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`处理条目 ${entry.id} 主题提取失败:`, error);
      }
    }
    
    console.log('批量主题提取完成');
  }
}