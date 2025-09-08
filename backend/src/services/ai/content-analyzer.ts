// src/services/ai/content-analyzer.ts
import { AIProcessingConfig, ProcessingResult } from './types';
import { ModelConfigService } from '../model-config.service';
import { ZhipuAIService } from './zhipu-ai.service';

/**
 * 内容分析器服务
 * 提供多种AI分析功能和算法优化
 */
export class ContentAnalyzerService {
  private zhipuAIService: ZhipuAIService;
  private modelConfigService: ModelConfigService;

  constructor(apiKey?: string) {
    this.zhipuAIService = new ZhipuAIService(apiKey);
    this.modelConfigService = new ModelConfigService();
  }

  /**
   * 综合内容分析（使用智谱AI）
   */
  async analyzeContent(params: {
    content: string;
    title: string;
    config: AIProcessingConfig;
  }): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { content, title, config } = params;

    try {
      console.log(`开始综合内容分析: ${title}, 配置: ${config.language}-${config.style}`);

      // 使用智谱AI进行分析
      const result = await this.zhipuAIService.analyzeContent({
        content,
        title,
        config
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`综合内容分析完成，总耗时: ${processingTime}ms`);
      
      return {
        ...result,
        sourceId: '',
        userId: config.userId,
        originalUrl: '',
        aiProvider: 'zhipu',
        aiModel: 'glm-4.5-flash'
      };
      
    } catch (error) {
      console.error('综合内容分析失败:', error);
      
      return {
        id: this.generateId(),
        sourceId: '',
        userId: config.userId,
        originalUrl: '',
        title,
        content,
        summary: '分析失败',
        keywords: [],
        categories: [],
        markdownContent: '',
        processingTime: Date.now() - startTime,
        aiTokensUsed: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        createdAt: new Date(),
        aiProvider: 'zhipu',
        aiModel: 'glm-4.5-flash'
      };
    }
  }

  /**
   * 智能文本摘要（多级别摘要）
   */
  async generateSmartSummary(params: {
    content: string;
    config: AIProcessingConfig;
    levels?: 'brief' | 'normal' | 'detailed';
  }): Promise<{
    brief: string;
    normal: string;
    detailed: string;
    keywords: string[];
    processingTime: number;
  }> {
    const { content, config, levels = { brief: true, normal: true, detailed: true } } = params;
    const startTime = Date.now();

    try {
      console.log(`开始智能文本摘要，配置: ${config.language}-${config.style}`);

      // 根据配置选择模型
      const modelConfig = ModelConfigService.getRecommendedModelConfig('summarization');
      
      // 构建多级摘要提示
      const summaryPrompt = `
请为以下文章内容生成多级别的摘要：

文章标题：${config.style === 'academic' ? '学术论文' : config.style === 'detailed' ? '深度报道' : '新闻文章'}

文章内容：
${content}

要求：
${this.getLanguageInstruction(config.language)}

请以JSON格式返回多级摘要：
{
  "brief": "简短摘要（1句话，20-30字）",
  "normal": "标准摘要（2-3句话，50-80字）",
  "detailed": "详细摘要（4-6句话，100-150字）",
  "keywords": ["5-8个核心关键词"]
}

注意：
1. 各级摘要要有层次感，简短摘要是核心，详细摘要是完整版
2. 关键词要涵盖文章的核心概念和术语
3. ${this.getStyleInstruction(config.style)}
4. 只返回JSON格式，不要包含其他解释`;

      // 调用AI生成多级摘要
      const response = await this.callAI(summaryPrompt, modelConfig);
      
      // 解析响应
      const summaryResult = this.parseSummaryResponse(response);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`智能文本摘要完成，耗时: ${processingTime}ms`);
      
      return {
        ...summaryResult,
        processingTime
      };
      
    } catch (error) {
      console.error('智能文本摘要失败:', error);
      
      return {
        brief: '摘要生成失败',
        normal: '摘要生成失败',
        detailed: '摘要生成失败',
        keywords: ['关键词提取失败'],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 高级关键词提取（包含权重和分类）
   */
  async extractAdvancedKeywords(params: {
    content: string;
    config: AIProcessingConfig;
    maxKeywords?: number;
  }): Promise<{
    keywords: Array<{
      keyword: string;
      weight: number;
      category: string;
    }>;
    processingTime: number;
  }> {
    const { content, config, maxKeywords = 10 } = params;
    const startTime = Date.now();

    try {
      console.log(`开始高级关键词提取，最大数量: ${maxKeywords}`);

      const modelConfig = ModelConfigService.getRecommendedModelConfig('classification');
      
      const keywordPrompt = `
请从以下文章内容中提取高级关键词信息：

文章内容：
${content}

要求：
${this.getLanguageInstruction(config.language)}

请以JSON格式返回关键词分析结果：
{
  "keywords": [
    {
      "keyword": "关键词1",
      "weight": 0.9,
      "category": "主题领域"
    },
    {
      "keyword": "关键词2", 
      "weight": 0.7,
      "category": "技术术语"
    }
  ]
}

分析要求：
1. 提取最重要的${maxKeywords}个关键词
2. 为每个关键词分配权重（0.1-1.0，1.0为最重要）
3. 将关键词分类到合适的类别（如：政治、经济、科技、文化、体育、环境、教育等）
4. 权重应该反映关键词在文章中的重要性和出现频率
5. ${this.getStyleInstruction(config.style)}
6. 只返回JSON格式，不要包含其他解释`;

      const response = await this.callAI(keywordPrompt, modelConfig);
      
      // 解析响应
      const keywordResult = this.parseKeywordResponse(response, maxKeywords);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`高级关键词提取完成，耗时: ${processingTime}ms`);
      
      return {
        keywords: keywordResult,
        processingTime
      };
      
    } catch (error) {
      console.error('高级关键词提取失败:', error);
      
      return {
        keywords: [{
          keyword: '关键词提取失败',
          weight: 0,
          category: '错误'
        }],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 深度内容分类（多维度标签）
   */
  async classifyContent(params: {
    content: string;
    title: string;
    config: AIProcessingConfig;
  }): Promise<{
    primaryCategory: string;
    subCategories: string[];
    topics: string[];
    sentiment: string;
    confidence: number;
    processingTime: number;
  }> {
    const { content, title, config } = params;
    const startTime = Date.now();

    try {
      console.log(`开始深度内容分类: ${title}`);

      const modelConfig = ModelConfigService.getRecommendedModelConfig('classification');
      
      const classificationPrompt = `
请对以下文章进行深度分类分析：

文章标题：${title}

文章内容：
${content}

要求：
${this.getLanguageInstruction(config.language)}

请以JSON格式返回分类结果：
{
  "primaryCategory": "主要分类（如：政治、经济、科技、文化、体育等）",
  "subCategories": ["子分类1", "子分类2"],
  "topics": ["具体主题1", "具体主题2", "具体主题3"],
  "sentiment": "情感倾向（正面、负面、中性）",
  "confidence": 0.95
}

分类要求：
1. 主要分类应该准确反映文章的核心领域
2. 子分类应该更具体，2-4个相关子领域
3. 主题应该是文章讨论的具体问题或事件
4. 情感分析要客观准确
5. 置信度反映分类的准确性（0.0-1.0）
6. ${this.getStyleInstruction(config.style)}
7. 只返回JSON格式，不要包含其他解释`;

      const response = await this.callAI(classificationPrompt, modelConfig);
      
      // 解析响应
      const classificationResult = this.parseClassificationResponse(response);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`深度内容分类完成，耗时: ${processingTime}ms`);
      
      return {
        ...classificationResult,
        processingTime
      };
      
    } catch (error) {
      console.error('深度内容分类失败:', error);
      
      return {
        primaryCategory: '分类失败',
        subCategories: ['子分类失败'],
        topics: ['主题分析失败'],
        sentiment: '中性',
        confidence: 0.5,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 内容质量评估
   */
  async assessContentQuality(params: {
    content: string;
    title: string;
  }): Promise<{
    readability: number; // 1-10分
    coherence: number; // 1-10分
    completeness: number; // 1-10分
    originality: number; // 1-10分
    overallScore: number; // 1-10分
    suggestions: string[];
    processingTime: number;
  }> {
    const { content, title } = params;
    const startTime = Date.now();

    try {
      console.log(`开始内容质量评估: ${title}`);

      const modelConfig = this.modelConfigService.getRecommendedModelConfig('summarization');
      
      const qualityPrompt = `
请对以下文章内容进行质量评估：

文章标题：${title}

文章内容：
${content}

请以JSON格式返回质量评估结果：
{
  "readability": 8,
  "coherence": 7,
  "completeness": 9,
  "originality": 6,
  "overallScore": 7.5,
  "suggestions": [
    "建议1",
    "建议2",
    "建议3"
  ]
}

评估标准：
1. 可读性（readability）: 文章的易读程度，考虑语言表达、句式结构等（1-10分）
2. 连贯性（coherence）: 文章逻辑结构的连贯性，段落之间的衔接（1-10分）
3. 完整性（completeness）: 内容的完整程度，信息是否充分（1-10分）
4. 原创性（originality）: 内容的新颖程度和独特性（1-10分）
5. 总体评分（overallScore）: 综合以上四项的平均分

改进建议：
1. 提供3-5条具体的改进建议
2. 建议应该具有针对性和可操作性
3. 聚焦于提升文章质量的实用建议

注意：
1. 评分要客观准确，基于内容质量而非个人偏好
2. 建议要建设性和具体化
3. 只返回JSON格式，不要包含其他解释`;

      const response = await this.callAI(qualityPrompt, modelConfig);
      
      // 解析响应
      const qualityResult = this.parseQualityResponse(response);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`内容质量评估完成，耗时: ${processingTime}ms`);
      
      return {
        ...qualityResult,
        processingTime
      };
      
    } catch (error) {
      console.error('内容质量评估失败:', error);
      
      return {
        readability: 5,
        coherence: 5,
        completeness: 5,
        originality: 5,
        overallScore: 5,
        suggestions: ['质量评估失败'],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 批量内容分析
   */
  async analyzeBatch(params: {
    items: Array<{
      content: string;
      title: string;
      config: AIProcessingConfig;
    }>;
  }): Promise<{
    results: ProcessingResult[];
    totalProcessingTime: number;
    averageProcessingTime: number;
    successCount: number;
    failureCount: number;
  }> {
    const startTime = Date.now();
    const { items } = params;

    console.log(`开始批量内容分析，数量: ${items.length}`);

    const results: ProcessingResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // 并行处理以提高性能
    const promises = items.map(async (item) => {
      try {
        const result = await this.analyzeContent(item);
        results.push(result);
        successCount++;
        return result;
      } catch (error) {
        console.error(`批量分析项目失败: ${item.title}`, error);
        results.push({
          id: this.generateId(),
          sourceId: '',
          userId: item.config.userId,
          originalUrl: '',
          title: item.title,
          content: item.content,
          summary: '批量分析失败',
          keywords: [],
          categories: [],
          markdownContent: '',
          processingTime: 0,
          aiTokensUsed: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误',
          createdAt: new Date(),
          aiProvider: 'zhipu',
          aiModel: 'glm-4.5-flash'
        });
        failureCount++;
        return null;
      }
    });

    await Promise.allSettled(promises);

    const totalProcessingTime = Date.now() - startTime;
    const averageProcessingTime = successCount > 0 ? totalProcessingTime / successCount : 0;

    console.log(`批量内容分析完成，成功: ${successCount}, 失败: ${failureCount}, 总耗时: ${totalProcessingTime}ms`);

    return {
      results,
      totalProcessingTime,
      averageProcessingTime,
      successCount,
      failureCount
    };
  }

  /**
   * 调用AI模型
   */
  private async callAI(prompt: string, modelConfig: any): Promise<any> {
    try {
      // 使用智谱AI服务
      return await this.zhipuAIService.callZhipuAI(prompt, modelConfig);
    } catch (error) {
      console.error('AI调用失败:', error);
      throw error;
    }
  }

  /**
   * 解析摘要响应
   */
  private parseSummaryResponse(response: any): { brief: string; normal: string; detailed: string; keywords: string[] } {
    try {
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const content = response.choices[0].message.content;
        
        // 尝试解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            brief: parsed.brief || '简短摘要',
            normal: parsed.normal || '标准摘要',
            detailed: parsed.detailed || '详细摘要',
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
          };
        }
      }
      
      // JSON解析失败，返回默认值
      return {
        brief: '简短摘要生成失败',
        normal: '标准摘要生成失败',
        detailed: '详细摘要生成失败',
        keywords: ['关键词提取失败']
      };
      
    } catch (error) {
      console.error('解析摘要响应失败:', error);
      return {
        brief: '简短摘要解析失败',
        normal: '标准摘要解析失败',
        detailed: '详细摘要解析失败',
        keywords: ['关键词解析失败']
      };
    }
  }

  /**
   * 解析关键词响应
   */
  private parseKeywordResponse(response: any, maxKeywords: number): Array<{ keyword: string; weight: number; category: string }> {
    try {
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const content = response.choices[0].message.content;
        
        // 尝试解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
          
          // 验证和清理数据
          return keywords
            .slice(0, maxKeywords)
            .map((kw: any) => ({
              keyword: typeof kw.keyword === 'string' ? kw.keyword : '未知关键词',
              weight: typeof kw.weight === 'number' ? Math.max(0, Math.min(1, kw.weight)) : 0.5,
              category: typeof kw.category === 'string' ? kw.category : '未分类'
            }));
        }
      }
      
      // JSON解析失败，返回默认值
      return [{
        keyword: '关键词提取失败',
        weight: 0,
        category: '错误'
      }];
      
    } catch (error) {
      console.error('解析关键词响应失败:', error);
      return [{
        keyword: '关键词解析失败',
        weight: 0,
        category: '错误'
      }];
    }
  }

  /**
   * 解析分类响应
   */
  private parseClassificationResponse(response: any): { primaryCategory: string; subCategories: string[]; topics: string[]; sentiment: string; confidence: number } {
    try {
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const content = response.choices[0].message.content;
        
        // 尝试解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            primaryCategory: typeof parsed.primaryCategory === 'string' ? parsed.primaryCategory : '未分类',
            subCategories: Array.isArray(parsed.subCategories) ? parsed.subCategories : [],
            topics: Array.isArray(parsed.topics) ? parsed.topics : [],
            sentiment: typeof parsed.sentiment === 'string' ? parsed.sentiment : '中性',
            confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5
          };
        }
      }
      
      // JSON解析失败，返回默认值
      return {
        primaryCategory: '分类失败',
        subCategories: [],
        topics: [],
        sentiment: '中性',
        confidence: 0.5
      };
      
    } catch (error) {
      console.error('解析分类响应失败:', error);
      return {
        primaryCategory: '分类解析失败',
        subCategories: [],
        topics: [],
        sentiment: '中性',
        confidence: 0.5
      };
    }
  }

  /**
   * 解析质量评估响应
   */
  private parseQualityResponse(response: any): { readability: number; coherence: number; completeness: number; originality: number; overallScore: number; suggestions: string[] } {
    try {
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const content = response.choices[0].message.content;
        
        // 尝试解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            readability: typeof parsed.readability === 'number' ? Math.max(1, Math.min(10, parsed.readability)) : 5,
            coherence: typeof parsed.coherence === 'number' ? Math.max(1, Math.min(10, parsed.coherence)) : 5,
            completeness: typeof parsed.completeness === 'number' ? Math.max(1, Math.min(10, parsed.completeness)) : 5,
            originality: typeof parsed.originality === 'number' ? Math.max(1, Math.min(10, parsed.originality)) : 5,
            overallScore: typeof parsed.overallScore === 'number' ? Math.max(1, Math.min(10, parsed.overallScore)) : 5,
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ['质量评估解析失败']
          };
        }
      }
      
      // JSON解析失败，返回默认值
      return {
        readability: 5,
        coherence: 5,
        completeness: 5,
        originality: 5,
        overallScore: 5,
        suggestions: ['质量评估失败']
      };
      
    } catch (error) {
      console.error('解析质量评估响应失败:', error);
      return {
        readability: 5,
        coherence: 5,
        completeness: 5,
        originality: 5,
        overallScore: 5,
        suggestions: ['质量评估解析失败']
      };
    }
  }

  /**
   * 获取语言指令
   */
  private getLanguageInstruction(language: string): string {
    switch (language) {
      case 'zh-CN':
        return '使用中文进行分析和输出结果';
      case 'en-US':
        return 'Use English for analysis and output';
      case 'auto':
      default:
        return '自动检测语言并使用相应语言进行分析';
    }
  }

  /**
   * 获取风格指令
   */
  private getStyleInstruction(style: string): string {
    switch (style) {
      case 'concise':
        return '分析风格要简洁明了，突出重点信息';
      case 'detailed':
        return '分析风格要详细深入，涵盖文章的各个方面';
      case 'academic':
        return '分析风格要学术严谨，使用专业术语和客观分析';
      default:
        return '分析风格要平衡简洁与详细程度';
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `analyzer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查服务可用性
   */
  async checkAvailability(): Promise<{ available: boolean; message: string }> {
    return await this.zhipuAIService.checkAvailability();
  }
}