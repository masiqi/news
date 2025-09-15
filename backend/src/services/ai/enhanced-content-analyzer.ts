// 增强内容分析服务
// 提供深度内容理解、主题提取、情感分析等AI功能

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  enhancedContentAnalysis, 
  topics, 
  keywords, 
  contentTopics, 
  contentKeywords,
  processedContent 
} from '../db/schema';
import { getObsidianConfigFromEnv, type ObsidianConfig } from '../config/obsidian.config';

// 分析结果接口
export interface EnhancedAnalysisResult {
  id: string;
  userId: number;
  contentId: number;
  sourceId: string;
  title: string;
  content: string;
  summary: string;
  
  // 主题和标签
  topics: Topic[];
  keywords: Keyword[];
  categories: Category[];
  tags: string[];
  
  // 情感和重要性
  sentiment: SentimentAnalysis;
  importance: number;
  readability: number;
  
  // 内容向量
  contentVector: number[];
  embeddingModel: string;
  
  // 时间上下文
  temporalContext: TemporalContext;
  timelinePosition: string;
  
  // 处理信息
  aiModel: string;
  processingTime: number;
  processedAt: Date;
}

// 主题信息
export interface Topic {
  name: string;
  displayName: string;
  confidence: number;
  category: string;
  relatedTopics: string[];
  isTrending: boolean;
}

// 关键词信息
export interface Keyword {
  text: string;
  weight: number;
  context: string;
  isEntity: boolean;
  entityType?: string;
  position: number;
}

// 分类信息
export interface Category {
  name: string;
  confidence: number;
  description?: string;
}

// 情感分析
export interface SentimentAnalysis {
  score: number; // -1到1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

// 时间上下文
export interface TemporalContext {
  timelinePosition: 'breaking' | 'developing' | 'established';
  timeWindow: {
    start: Date;
    end: Date;
  };
  relatedEvents: string[];
}

// 分析配置
export interface AnalysisConfig {
  includeSentiment: boolean;
  includeImportance: boolean;
  includeReadability: boolean;
  includeEmbeddings: boolean;
  maxTopics: number;
  maxKeywords: number;
  minKeywordWeight: number;
}

export class EnhancedContentAnalyzer {
  private config: ObsidianConfig;
  
  constructor() {
    this.config = getObsidianConfigFromEnv();
  }
  
  /**
   * 分析内容并生成增强分析结果
   */
  async analyzeContent(
    userId: number,
    contentId: number,
    title: string,
    content: string,
    sourceId: string,
    publishedAt?: Date,
    config?: Partial<AnalysisConfig>
  ): Promise<EnhancedAnalysisResult> {
    const startTime = Date.now();
    
    // 合并配置
    const analysisConfig = this.getAnalysisConfig(config);
    
    try {
      // 并行执行不同的分析任务
      const [
        summary,
        extractedTopics,
        extractedKeywords,
        sentiment,
        importance,
        readability,
        contentVector,
        temporalContext
      ] = await Promise.all([
        this.generateSummary(content),
        this.extractTopics(content, analysisConfig),
        this.extractKeywords(content, analysisConfig),
        analysisConfig.includeSentiment ? this.analyzeSentiment(content) : null,
        analysisConfig.includeImportance ? this.calculateImportance(content) : null,
        analysisConfig.includeReadability ? this.calculateReadability(content) : null,
        analysisConfig.includeEmbeddings ? this.generateEmbeddings(content) : [],
        this.analyzeTemporalContext(publishedAt || new Date())
      ]);
      
      // 提取分类和标签
      const categories = this.extractCategories(extractedTopics);
      const tags = this.generateTags(extractedTopics, extractedKeywords);
      
      // 创建增强分析记录
      const analysisRecord = await this.createAnalysisRecord({
        userId,
        contentId,
        sourceId,
        title,
        content,
        summary,
        topics: extractedTopics,
        keywords: extractedKeywords,
        categories,
        tags,
        sentiment: sentiment || { score: 0, label: 'neutral', confidence: 0 },
        importance: importance || 0,
        readability: readability || 0,
        contentVector,
        temporalContext,
        timelinePosition: temporalContext.timelinePosition,
        aiModel: this.config.ai.model,
        processingTime: Date.now() - startTime,
      });
      
      return analysisRecord;
      
    } catch (error) {
      console.error('Enhanced content analysis failed:', error);
      throw new Error(`Content analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 获取用户内容的分析结果
   */
  async getUserAnalysis(userId: number, contentId: number): Promise<EnhancedAnalysisResult | null> {
    const result = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          eq(enhancedContentAnalysis.contentId, contentId)
        )
      )
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    return this.transformDbRecordToResult(result[0]);
  }
  
  /**
   * 获取用户的相似内容
   */
  async getSimilarContent(
    userId: number, 
    contentId: number, 
    limit: number = 5,
    threshold: number = 0.3
  ): Promise<Array<{ content: EnhancedAnalysisResult; similarity: number }>> {
    // 获取目标内容的信息
    const targetContent = await this.getUserAnalysis(userId, contentId);
    if (!targetContent || !targetContent.contentVector.length) {
      return [];
    }
    
    // 获取用户的所有内容
    const userContents = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId));
    
    // 计算相似度并排序
    const similarities = await Promise.all(
      userContents
        .filter(content => content.id !== contentId)
        .map(async (record) => {
          const result = this.transformDbRecordToResult(record);
          const similarity = this.calculateCosineSimilarity(
            targetContent.contentVector,
            result.contentVector
          );
          return { content: result, similarity };
        })
    );
    
    // 过滤和排序
    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * 获取热门主题
   */
  async getTrendingTopics(userId: number, limit: number = 10): Promise<Topic[]> {
    // 获取用户最近的内容分析
    const recentAnalyses = await db
      .select({
        topics: enhancedContentAnalysis.topics,
        processedAt: enhancedContentAnalysis.processedAt,
      })
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId))
      .orderBy(desc(enhancedContentAnalysis.processedAt))
      .limit(100);
    
    // 统计主题频率
    const topicFrequency = new Map<string, { count: number; totalConfidence: number }>();
    
    recentAnalyses.forEach(analysis => {
      const analysisTopics = JSON.parse(analysis.topics || '[]') as Topic[];
      analysisTopics.forEach(topic => {
        const current = topicFrequency.get(topic.name) || { count: 0, totalConfidence: 0 };
        topicFrequency.set(topic.name, {
          count: current.count + 1,
          totalConfidence: current.totalConfidence + topic.confidence,
        });
      });
    });
    
    // 计算热门主题并排序
    const trendingTopics = Array.from(topicFrequency.entries())
      .map(([name, stats]) => ({
        name,
        displayName: name,
        confidence: stats.totalConfidence / stats.count,
        category: 'general',
        relatedTopics: [],
        isTrending: stats.count > 3, // 如果在3个以上的内容中出现，认为是热门
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
    
    return trendingTopics;
  }
  
  /**
   * 生成内容摘要
   */
  private async generateSummary(content: string): Promise<string> {
    try {
      // 使用Cloudflare Workers AI生成摘要
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${this.config.ai.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: '你是一个专业的新闻摘要助手。请为以下新闻内容生成一个简洁、准确的摘要，保持客观和中立的语调，重点突出核心信息。',
              },
              {
                role: 'user',
                content: `请为以下新闻内容生成摘要（控制在200字以内）：\n\n${content}`,
              },
            ],
            max_tokens: 300,
            temperature: 0.5,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.response || this.generateFallbackSummary(content);
      
    } catch (error) {
      console.warn('AI summary generation failed, using fallback:', error);
      return this.generateFallbackSummary(content);
    }
  }
  
  /**
   * 提取主题
   */
  private async extractTopics(content: string, config: AnalysisConfig): Promise<Topic[]> {
    try {
      // 使用AI提取主题
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${this.config.ai.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `你是一个主题识别专家。请从以下内容中提取最多${config.maxTopics}个主要主题，并为每个主题分配置信度（0-1）。以JSON格式返回结果。`,
              },
              {
                role: 'user',
                content: `请从以下内容中提取主题：\n\n${content}`,
              },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Topic extraction failed: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.result?.response;
      
      // 尝试解析JSON响应
      try {
        const parsedTopics = JSON.parse(aiResponse);
        return parsedTopics.map((topic: any) => ({
          name: topic.name || topic.topic,
          displayName: topic.displayName || topic.name || topic.topic,
          confidence: Math.min(1, Math.max(0, topic.confidence || topic.score || 0.5)),
          category: topic.category || 'general',
          relatedTopics: topic.relatedTopics || [],
          isTrending: false,
        }));
      } catch {
        // 如果JSON解析失败，使用简单提取
        return this.extractTopicsFallback(content, config);
      }
      
    } catch (error) {
      console.warn('AI topic extraction failed, using fallback:', error);
      return this.extractTopicsFallback(content, config);
    }
  }
  
  /**
   * 提取关键词
   */
  private async extractKeywords(content: string, config: AnalysisConfig): Promise<Keyword[]> {
    // 简单的关键词提取算法
    const words = content.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // 计算词频
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // 过滤和排序
    const stopwords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '现在']);
    
    const keywords = Array.from(wordFreq.entries())
      .filter(([word, freq]) => !stopwords.has(word) && freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.maxKeywords)
      .map(([text, freq], index) => ({
        text,
        weight: Math.min(1, freq / Math.max(1, words.length * 0.01)),
        context: '',
        isEntity: this.isEntity(text),
        entityType: this.getEntityType(text),
        position: index,
      }))
      .filter(keyword => keyword.weight >= config.minKeywordWeight);
    
    return keywords;
  }
  
  /**
   * 分析情感
   */
  private async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${this.config.ai.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: '你是一个情感分析专家。请分析以下内容的情感倾向，返回JSON格式的结果，包含score（-1到1）、label（positive/negative/neutral）和confidence（0-1）。',
              },
              {
                role: 'user',
                content: `请分析以下内容的情感：\n\n${content}`,
              },
            ],
            max_tokens: 100,
            temperature: 0.1,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Sentiment analysis failed: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.result?.response;
      
      try {
        const parsed = JSON.parse(aiResponse);
        return {
          score: Math.max(-1, Math.min(1, parsed.score || 0)),
          label: ['positive', 'negative', 'neutral'].includes(parsed.label) ? parsed.label : 'neutral',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        };
      } catch {
        return { score: 0, label: 'neutral', confidence: 0.5 };
      }
      
    } catch (error) {
      console.warn('Sentiment analysis failed:', error);
      return { score: 0, label: 'neutral', confidence: 0.5 };
    }
  }
  
  /**
   * 计算重要性
   */
  private async calculateImportance(content: string): Promise<number> {
    // 基于多个因素计算重要性分数
    const factors = {
      length: Math.min(1, content.length / 5000), // 内容长度
      urgency: this.calculateUrgencyScore(content), // 紧急性
      entities: this.countEntities(content), // 实体数量
      keywords: this.countImportantKeywords(content), // 重要关键词数量
    };
    
    const score = (
      factors.length * 0.2 +
      factors.urgency * 0.3 +
      Math.min(1, factors.entities / 10) * 0.25 +
      Math.min(1, factors.keywords / 5) * 0.25
    );
    
    return Math.min(1, Math.max(0, score));
  }
  
  /**
   * 计算可读性
   */
  private async calculateReadability(content: string): Promise<number> {
    // 简单的可读性计算
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return 0.5;
    }
    
    const avgWordsPerSentence = words.length / sentences.length;
    const avgCharsPerWord = content.length / words.length;
    
    // 简单的可读性分数（越高越易读）
    const readability = Math.max(0, Math.min(1, 1 - (avgWordsPerSentence / 30 + avgCharsPerWord / 10) / 2));
    
    return readability;
  }
  
  /**
   * 生成内容向量
   */
  private async generateEmbeddings(content: string): Promise<number[]> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${this.config.ai.embeddingModel}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: content.slice(0, 8000), // 限制文本长度
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Embedding generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data?.[0] || [];
      
    } catch (error) {
      console.warn('Embedding generation failed:', error);
      return [];
    }
  }
  
  /**
   * 分析时间上下文
   */
  private async analyzeTemporalContext(publishedAt: Date): Promise<TemporalContext> {
    const now = new Date();
    const hoursDiff = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
    
    let timelinePosition: 'breaking' | 'developing' | 'established';
    if (hoursDiff <= 6) {
      timelinePosition = 'breaking';
    } else if (hoursDiff <= 48) {
      timelinePosition = 'developing';
    } else {
      timelinePosition = 'established';
    }
    
    return {
      timelinePosition,
      timeWindow: {
        start: publishedAt,
        end: now,
      },
      relatedEvents: [],
    };
  }
  
  /**
   * 创建分析记录
   */
  private async createAnalysisRecord(data: {
    userId: number;
    contentId: number;
    sourceId: string;
    title: string;
    content: string;
    summary: string;
    topics: Topic[];
    keywords: Keyword[];
    categories: Category[];
    tags: string[];
    sentiment: SentimentAnalysis;
    importance: number;
    readability: number;
    contentVector: number[];
    temporalContext: TemporalContext;
    timelinePosition: string;
    aiModel: string;
    processingTime: number;
  }): Promise<EnhancedAnalysisResult> {
    
    const [record] = await db
      .insert(enhancedContentAnalysis)
      .values({
        userId: data.userId,
        contentId: data.contentId,
        sourceId: data.sourceId,
        title: data.title,
        content: data.content,
        summary: data.summary,
        topics: JSON.stringify(data.topics),
        keywords: JSON.stringify(data.keywords),
        categories: JSON.stringify(data.categories),
        tags: JSON.stringify(data.tags),
        sentimentScore: data.sentiment.score,
        sentimentLabel: data.sentiment.label,
        importanceScore: data.importance,
        readabilityScore: data.readability,
        contentVector: JSON.stringify(data.contentVector),
        embeddingModel: this.config.ai.embeddingModel,
        temporalContext: JSON.stringify(data.temporalContext),
        timelinePosition: data.timelinePosition,
        aiModel: data.aiModel,
        processingTime: data.processingTime,
        processedAt: new Date(),
      })
      .returning();
    
    return this.transformDbRecordToResult(record);
  }
  
  /**
   * 转换数据库记录为结果对象
   */
  private transformDbRecordToResult(record: any): EnhancedAnalysisResult {
    return {
      id: record.id.toString(),
      userId: record.userId,
      contentId: record.contentId,
      sourceId: record.sourceId,
      title: record.title,
      content: record.content,
      summary: record.summary,
      topics: JSON.parse(record.topics || '[]'),
      keywords: JSON.parse(record.keywords || '[]'),
      categories: JSON.parse(record.categories || '[]'),
      tags: JSON.parse(record.tags || '[]'),
      sentiment: {
        score: record.sentimentScore,
        label: record.sentimentLabel,
        confidence: 0.8, // 默认置信度
      },
      importance: record.importanceScore,
      readability: record.readabilityScore,
      contentVector: JSON.parse(record.contentVector || '[]'),
      embeddingModel: record.embeddingModel,
      temporalContext: JSON.parse(record.temporalContext || '{}'),
      timelinePosition: record.timelinePosition,
      aiModel: record.aiModel,
      processingTime: record.processingTime,
      processedAt: new Date(record.processedAt),
    };
  }
  
  /**
   * 获取分析配置
   */
  private getAnalysisConfig(config?: Partial<AnalysisConfig>): AnalysisConfig {
    return {
      includeSentiment: config?.includeSentiment ?? this.config.analysis.sentimentAnalysis,
      includeImportance: config?.includeImportance ?? this.config.analysis.importanceScoring,
      includeReadability: config?.includeReadability ?? this.config.analysis.readabilityScoring,
      includeEmbeddings: config?.includeEmbeddings ?? true,
      maxTopics: config?.maxTopics ?? this.config.analysis.maxTopics,
      maxKeywords: config?.maxKeywords ?? this.config.analysis.maxKeywords,
      minKeywordWeight: config?.minKeywordWeight ?? this.config.analysis.minKeywordWeight,
    };
  }
  
  /**
   * 计算余弦相似度
   */
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length === 0 || vector2.length === 0 || vector1.length !== vector2.length) {
      return 0;
    }
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
  }
  
  /**
   * 生成备用摘要
   */
  private generateFallbackSummary(content: string): string {
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return '';
    
    // 取前两句作为摘要
    return sentences.slice(0, 2).join('. ') + '.';
  }
  
  /**
   * 备用主题提取
   */
  private extractTopicsFallback(content: string, config: AnalysisConfig): Topic[] {
    // 简单的基于关键词的主题提取
    const topicKeywords = {
      '技术': ['ai', '人工智能', '机器学习', '技术', '科技', '软件', '算法', '数据'],
      '商业': ['公司', '企业', '市场', '经济', '金融', '投资', '商业', '收入'],
      '政治': ['政府', '政策', '法律', '选举', '国家', '国际', '外交', '政治'],
      '健康': ['医疗', '健康', '疾病', '治疗', '药物', '疫苗', '医院', '医生'],
      '教育': ['学校', '教育', '学生', '老师', '大学', '学习', '课程', '考试'],
    };
    
    const contentLower = content.toLowerCase();
    const foundTopics: Topic[] = [];
    
    Object.entries(topicKeywords).forEach(([topicName, keywords]) => {
      const matches = keywords.filter(keyword => contentLower.includes(keyword)).length;
      if (matches > 0) {
        foundTopics.push({
          name: topicName,
          displayName: topicName,
          confidence: Math.min(1, matches / keywords.length),
          category: 'general',
          relatedTopics: [],
          isTrending: false,
        });
      }
    });
    
    return foundTopics.slice(0, config.maxTopics);
  }
  
  /**
   * 提取分类
   */
  private extractCategories(topics: Topic[]): Category[] {
    return topics.map(topic => ({
      name: topic.category,
      confidence: topic.confidence,
      description: `Based on topic: ${topic.name}`,
    }));
  }
  
  /**
   * 生成标签
   */
  private generateTags(topics: Topic[], keywords: Keyword[]): string[] {
    const tags = new Set<string>();
    
    // 添加主题作为标签
    topics.forEach(topic => {
      tags.add(topic.name);
      topic.relatedTopics.forEach(related => tags.add(related));
    });
    
    // 添加重要的关键词作为标签
    keywords
      .filter(kw => kw.weight > 0.5 && kw.isEntity)
      .forEach(kw => tags.add(kw.text));
    
    return Array.from(tags).slice(0, 20);
  }
  
  /**
   * 计算紧急性分数
   */
  private calculateUrgencyScore(content: string): number {
    const urgentWords = ['紧急', '立即', '马上', 'breaking', 'urgent', 'immediately', '突发', '重要'];
    const contentLower = content.toLowerCase();
    
    const matches = urgentWords.filter(word => contentLower.includes(word)).length;
    return Math.min(1, matches / urgentWords.length);
  }
  
  /**
   * 计算实体数量
   */
  private countEntities(content: string): number {
    // 简单的实体检测（数字、大写字母组合等）
    const entityPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // 人名、公司名
      /\b\d{4}\b/g, // 年份
      /\b\d+\%\b/g, // 百分比
      /\$\d+(?:,\d{3})*(?:\.\d{2})?\b/g, // 金额
    ];
    
    return entityPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }
  
  /**
   * 计算重要关键词数量
   */
  private countImportantKeywords(content: string): number {
    const importantWords = ['新', '重大', '突破', '发现', '宣布', '发布', 'new', 'major', 'breakthrough', 'discovery', 'announced', 'released'];
    const contentLower = content.toLowerCase();
    
    return importantWords.filter(word => contentLower.includes(word)).length;
  }
  
  /**
   * 判断是否为实体
   */
  private isEntity(word: string): boolean {
    // 简单的实体检测逻辑
    return (
      /^[A-Z][a-z]+$/.test(word) || // 英文人名
      /^\d+$/.test(word) || // 数字
      /^\d+\%$/.test(word) || // 百分比
      /^[\u4e00-\u9fff]{2,4}$/.test(word) // 中文人名
    );
  }
  
  /**
   * 获取实体类型
   */
  private getEntityType(word: string): string {
    if (/^\d+$/.test(word)) return 'NUMBER';
    if (/^\d+\%$/.test(word)) return 'PERCENTAGE';
    if (/^[A-Z][a-z]+$/.test(word)) return 'PERSON';
    if (/^[\u4e00-\u9fff]{2,4}$/.test(word)) return 'PERSON';
    return 'UNKNOWN';
  }
}