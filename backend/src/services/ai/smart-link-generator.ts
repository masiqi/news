// 智能链接生成服务
// 基于标签、主题、相似度等自动生成Obsidian风格的链接

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  enhancedContentAnalysis, 
  contentRelations, 
  topics, 
  keywords, 
  contentTopics, 
  contentKeywords,
  smartLinkGenerationLogs 
} from '../db/schema';
import { getObsidianConfigFromEnv, defaultLinkStrategies } from '../config/obsidian.config';
import { type EnhancedAnalysisResult } from './ai/enhanced-content-analyzer';

// 链接生成配置
export interface LinkGenerationConfig {
  strategies: LinkStrategy[];
  maxLinks: number;
  similarityThreshold: number;
  timeWindowDays: number;
  enableTagLinks: boolean;
  enableTopicLinks: boolean;
  enableSimilarityLinks: boolean;
  enableTemporalLinks: boolean;
}

// 链接策略
export interface LinkStrategy {
  type: 'tag' | 'topic' | 'keyword' | 'similarity' | 'temporal';
  enabled: boolean;
  threshold: number;
  template: string;
  maxLinks: number;
  weight: number;
}

// 生成的链接
export interface GeneratedLink {
  type: 'tag' | 'topic' | 'keyword' | 'similarity' | 'temporal';
  text: string;
  target: string;
  confidence: number;
  metadata?: Record<string, any>;
}

// 链接生成结果
export interface LinkGenerationResult {
  contentId: string;
  userId: number;
  totalLinks: number;
  links: GeneratedLink[];
  
  // 分类统计
  tagLinks: GeneratedLink[];
  topicLinks: GeneratedLink[];
  keywordLinks: GeneratedLink[];
  similarityLinks: GeneratedLink[];
  temporalLinks: GeneratedLink[];
  
  // 性能指标
  generationTime: number;
  averageConfidence: number;
  
  // 配置信息
  config: LinkGenerationConfig;
}

// 内容关联候选
export interface ContentCandidate {
  id: string;
  title: string;
  similarity: number;
  relationType: 'semantic' | 'temporal' | 'topical' | 'source';
  publishedAt: Date;
  sharedTopics: string[];
  sharedKeywords: string[];
  timeDiff?: number; // 时间差异（分钟）
}

export class SmartLinkGenerator {
  private config = getObsidianConfigFromEnv();
  
  /**
   * 为内容生成智能链接
   */
  async generateSmartLinks(
    userId: number,
    analysis: EnhancedAnalysisResult,
    customConfig?: Partial<LinkGenerationConfig>
  ): Promise<LinkGenerationResult> {
    const startTime = Date.now();
    
    // 合并配置
    const config = this.mergeLinkConfig(customConfig);
    
    try {
      // 并行执行不同类型的链接生成
      const [
        tagLinks,
        topicLinks,
        keywordLinks,
        similarityLinks,
        temporalLinks
      ] = await Promise.all([
        config.enableTagLinks ? this.generateTagLinks(analysis, config) : [],
        config.enableTopicLinks ? this.generateTopicLinks(analysis, config) : [],
        this.generateKeywordLinks(analysis, config),
        config.enableSimilarityLinks ? this.generateSimilarityLinks(userId, analysis, config) : [],
        config.enableTemporalLinks ? this.generateTemporalLinks(userId, analysis, config) : []
      ]);
      
      // 合并所有链接
      const allLinks = [
        ...tagLinks,
        ...topicLinks,
        ...keywordLinks,
        ...similarityLinks,
        ...temporalLinks
      ];
      
      // 按置信度和权重排序并限制数量
      const sortedLinks = allLinks
        .sort((a, b) => {
          const scoreA = a.confidence * this.getStrategyWeight(config.strategies, a.type);
          const scoreB = b.confidence * this.getStrategyWeight(config.strategies, b.type);
          return scoreB - scoreA;
        })
        .slice(0, config.maxLinks);
      
      const generationTime = Date.now() - startTime;
      const averageConfidence = sortedLinks.length > 0 
        ? sortedLinks.reduce((sum, link) => sum + link.confidence, 0) / sortedLinks.length 
        : 0;
      
      // 记录生成日志
      await this.logGeneration(userId, parseInt(analysis.contentId), {
        totalLinks: sortedLinks.length,
        tagLinks: tagLinks.length,
        topicLinks: topicLinks.length,
        keywordLinks: keywordLinks.length,
        similarityLinks: similarityLinks.length,
        temporalLinks: temporalLinks.length,
        generationTime,
        averageLinkQuality: averageConfidence,
        config,
      });
      
      const result: LinkGenerationResult = {
        contentId: analysis.contentId,
        userId,
        totalLinks: sortedLinks.length,
        links: sortedLinks,
        tagLinks,
        topicLinks,
        keywordLinks,
        similarityLinks,
        temporalLinks,
        generationTime,
        averageConfidence,
        config,
      };
      
      // 存储内容关联
      await this.storeContentRelations(userId, parseInt(analysis.contentId), similarityLinks, temporalLinks);
      
      return result;
      
    } catch (error) {
      console.error('Smart link generation failed:', error);
      throw new Error(`Link generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 获取用户的相关内容候选
   */
  async getRelatedContentCandidates(
    userId: number,
    analysis: EnhancedAnalysisResult,
    limit: number = 20,
    threshold: number = 0.3
  ): Promise<ContentCandidate[]> {
    // 获取用户的所有内容分析
    const userContents = await db
      .select({
        id: enhancedContentAnalysis.id,
        title: enhancedContentAnalysis.title,
        content: enhancedContentAnalysis.content,
        topics: enhancedContentAnalysis.topics,
        keywords: enhancedContentAnalysis.keywords,
        processedAt: enhancedContentAnalysis.processedAt,
        contentVector: enhancedContentAnalysis.contentVector,
      })
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          sql`${enhancedContentAnalysis.id} != ${parseInt(analysis.contentId)}`
        )
      )
      .orderBy(desc(enhancedContentAnalysis.processedAt))
      .limit(limit);
    
    const candidates: ContentCandidate[] = [];
    
    for (const content of userContents) {
      // 计算语义相似度
      const semanticSimilarity = this.calculateSemanticSimilarity(analysis, content);
      
      if (semanticSimilarity >= threshold) {
        const analysisTopics = analysis.topics.map(t => t.name);
        const analysisKeywords = analysis.keywords.slice(0, 10).map(k => k.text);
        
        const contentTopics = JSON.parse(content.topics || '[]').map((t: any) => t.name);
        const contentKeywords = JSON.parse(content.keywords || '[]').slice(0, 10).map((k: any) => k.text);
        
        const sharedTopics = analysisTopics.filter(topic => contentTopics.includes(topic));
        const sharedKeywords = analysisKeywords.filter(keyword => contentKeywords.includes(keyword));
        
        candidates.push({
          id: content.id.toString(),
          title: content.title,
          similarity: semanticSimilarity,
          relationType: 'semantic',
          publishedAt: new Date(content.processedAt),
          sharedTopics,
          sharedKeywords,
        });
      }
    }
    
    return candidates.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * 生成标签链接
   */
  private async generateTagLinks(
    analysis: EnhancedAnalysisResult,
    config: LinkGenerationConfig
  ): Promise<GeneratedLink[]> {
    const tagStrategy = config.strategies.find(s => s.type === 'tag');
    if (!tagStrategy || !tagStrategy.enabled) return [];
    
    const links: GeneratedLink[] = [];
    
    // 为每个标签生成链接
    for (const tag of analysis.tags.slice(0, tagStrategy.maxLinks)) {
      const confidence = this.calculateTagConfidence(tag, analysis);
      
      if (confidence >= tagStrategy.threshold) {
        links.push({
          type: 'tag',
          text: tag,
          target: tag,
          confidence,
          metadata: {
            tagType: 'content',
            frequency: analysis.tags.filter(t => t === tag).length,
          },
        });
      }
    }
    
    return links;
  }
  
  /**
   * 生成主题链接
   */
  private async generateTopicLinks(
    analysis: EnhancedAnalysisResult,
    config: LinkGenerationConfig
  ): Promise<GeneratedLink[]> {
    const topicStrategy = config.strategies.find(s => s.type === 'topic');
    if (!topicStrategy || !topicStrategy.enabled) return [];
    
    const links: GeneratedLink[] = [];
    
    // 为每个主题生成链接
    for (const topic of analysis.topics.slice(0, topicStrategy.maxLinks)) {
      const confidence = topic.confidence;
      
      if (confidence >= topicStrategy.threshold) {
        links.push({
          type: 'topic',
          text: topic.name,
          target: topic.name,
          confidence,
          metadata: {
            category: topic.category,
            isTrending: topic.isTrending,
            relatedTopics: topic.relatedTopics,
          },
        });
      }
    }
    
    return links;
  }
  
  /**
   * 生成关键词链接
   */
  private async generateKeywordLinks(
    analysis: EnhancedAnalysisResult,
    config: LinkGenerationConfig
  ): Promise<GeneratedLink[]> {
    const keywordStrategy = config.strategies.find(s => s.type === 'keyword');
    if (!keywordStrategy || !keywordStrategy.enabled) return [];
    
    const links: GeneratedLink[] = [];
    
    // 为重要的关键词生成链接
    const importantKeywords = analysis.keywords
      .filter(kw => kw.isEntity && kw.weight > 0.5)
      .slice(0, keywordStrategy.maxLinks);
    
    for (const keyword of importantKeywords) {
      const confidence = keyword.weight;
      
      if (confidence >= keywordStrategy.threshold) {
        links.push({
          type: 'keyword',
          text: keyword.text,
          target: keyword.text,
          confidence,
          metadata: {
            entityType: keyword.entityType,
            context: keyword.context,
            position: keyword.position,
          },
        });
      }
    }
    
    return links;
  }
  
  /**
   * 生成相似度链接
   */
  private async generateSimilarityLinks(
    userId: number,
    analysis: EnhancedAnalysisResult,
    config: LinkGenerationConfig
  ): Promise<GeneratedLink[]> {
    const similarityStrategy = config.strategies.find(s => s.type === 'similarity');
    if (!similarityStrategy || !similarityStrategy.enabled) return [];
    
    // 获取相似内容
    const candidates = await this.getRelatedContentCandidates(
      userId,
      analysis,
      similarityStrategy.maxLinks,
      similarityStrategy.threshold
    );
    
    return candidates.map(candidate => ({
      type: 'similarity' as const,
      text: candidate.title,
      target: candidate.title,
      confidence: candidate.similarity,
      metadata: {
        sharedTopics: candidate.sharedTopics,
        sharedKeywords: candidate.sharedKeywords,
        relationReason: this.generateRelationReason(candidate),
      },
    }));
  }
  
  /**
   * 生成时间序列链接
   */
  private async generateTemporalLinks(
    userId: number,
    analysis: EnhancedAnalysisResult,
    config: LinkGenerationConfig
  ): Promise<GeneratedLink[]> {
    const temporalStrategy = config.strategies.find(s => s.type === 'temporal');
    if (!temporalStrategy || !temporalStrategy.enabled) return [];
    
    // 获取时间窗口内的内容
    const timeWindow = new Date();
    timeWindow.setDate(timeWindow.getDate() - config.timeWindowDays);
    
    const temporalContents = await db
      .select({
        id: enhancedContentAnalysis.id,
        title: enhancedContentAnalysis.title,
        processedAt: enhancedContentAnalysis.processedAt,
        topics: enhancedContentAnalysis.topics,
      })
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          sql`${enhancedContentAnalysis.id} != ${parseInt(analysis.contentId)}`,
          sql`${enhancedContentAnalysis.processedAt} >= ${timeWindow.getTime()}`
        )
      )
      .orderBy(desc(enhancedContentAnalysis.processedAt))
      .limit(temporalStrategy.maxLinks);
    
    const links: GeneratedLink[] = [];
    const currentTopics = analysis.topics.map(t => t.name);
    
    for (const content of temporalContents) {
      const contentTopics = JSON.parse(content.topics || '[]').map((t: any) => t.name);
      const sharedTopics = currentTopics.filter(topic => contentTopics.includes(topic));
      
      if (sharedTopics.length > 0) {
        const timeDiff = Math.abs(
          new Date(content.processedAt).getTime() - new Date().getTime()
        ) / (1000 * 60); // 分钟
        
        const confidence = Math.max(0.3, 1 - (timeDiff / (config.timeWindowDays * 24 * 60)));
        
        if (confidence >= temporalStrategy.threshold) {
          links.push({
            type: 'temporal',
            text: content.title,
            target: content.title,
            confidence,
            metadata: {
              timeRelation: this.getTimeRelation(new Date(content.processedAt), new Date()),
              timeInterval: this.formatTimeInterval(timeDiff),
              sharedTopics,
            },
          });
        }
      }
    }
    
    return links;
  }
  
  /**
   * 计算语义相似度
   */
  private calculateSemanticSimilarity(
    analysis1: EnhancedAnalysisResult,
    analysis2: any
  ): number {
    const vector1 = analysis1.contentVector;
    const vector2 = JSON.parse(analysis2.contentVector || '[]');
    
    if (vector1.length === 0 || vector2.length === 0 || vector1.length !== vector2.length) {
      return 0;
    }
    
    // 计算余弦相似度
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    return magnitude1 && magnitude2 ? Math.max(0, dotProduct / (magnitude1 * magnitude2)) : 0;
  }
  
  /**
   * 计算标签置信度
   */
  private calculateTagConfidence(tag: string, analysis: EnhancedAnalysisResult): number {
    // 基于标签在内容中的出现频率和重要性
    const tagInTopics = analysis.topics.some(topic => 
      topic.name.toLowerCase().includes(tag.toLowerCase()) ||
      tag.toLowerCase().includes(topic.name.toLowerCase())
    );
    
    const tagInKeywords = analysis.keywords.some(keyword =>
      keyword.text.toLowerCase().includes(tag.toLowerCase()) ||
      tag.toLowerCase().includes(keyword.text.toLowerCase())
    );
    
    let confidence = 0.5; // 基础置信度
    
    if (tagInTopics) confidence += 0.3;
    if (tagInKeywords) confidence += 0.2;
    
    return Math.min(1, confidence);
  }
  
  /**
   * 生成关联原因
   */
  private generateRelationReason(candidate: ContentCandidate): string {
    const reasons: string[] = [];
    
    if (candidate.sharedTopics.length > 0) {
      reasons.push(`共享主题: ${candidate.sharedTopics.slice(0, 2).join(', ')}`);
    }
    
    if (candidate.sharedKeywords.length > 0) {
      reasons.push(`共享关键词: ${candidate.sharedKeywords.slice(0, 2).join(', ')}`);
    }
    
    if (candidate.similarity > 0.8) {
      reasons.push('高度相似内容');
    }
    
    return reasons.join('; ') || '语义相关';
  }
  
  /**
   * 获取时间关系
   */
  private getTimeRelation(date1: Date, date2: Date): 'before' | 'after' | 'contemporary' {
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours <= 24) {
      return 'contemporary';
    }
    
    return date1 < date2 ? 'before' : 'after';
  }
  
  /**
   * 格式化时间间隔
   */
  private formatTimeInterval(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}分钟前`;
    } else if (minutes < 24 * 60) {
      return `${Math.round(minutes / 60)}小时前`;
    } else {
      return `${Math.round(minutes / (24 * 60))}天前`;
    }
  }
  
  /**
   * 获取策略权重
   */
  private getStrategyWeight(strategies: LinkStrategy[], type: string): number {
    const strategy = strategies.find(s => s.type === type);
    return strategy?.weight || 1;
  }
  
  /**
   * 合并链接配置
   */
  private mergeLinkConfig(customConfig?: Partial<LinkGenerationConfig>): LinkGenerationConfig {
    const baseConfig = {
      strategies: defaultLinkStrategies,
      maxLinks: this.config.links.maxLinks,
      similarityThreshold: this.config.links.similarityThreshold,
      timeWindowDays: this.config.links.timeWindowDays,
      enableTagLinks: this.config.links.enableTagLinks,
      enableTopicLinks: this.config.links.enableTopicLinks,
      enableSimilarityLinks: this.config.links.enableSimilarityLinks,
      enableTemporalLinks: this.config.links.enableTemporalLinks,
    };
    
    return { ...baseConfig, ...customConfig };
  }
  
  /**
   * 存储内容关联
   */
  private async storeContentRelations(
    userId: number,
    contentId: number,
    similarityLinks: GeneratedLink[],
    temporalLinks: GeneratedLink[]
  ): Promise<void> {
    const relations = [];
    
    // 处理相似度关联
    for (const link of similarityLinks) {
      // 这里需要解析target来获取实际的内容ID
      // 简化处理，实际应该根据标题查询对应的内容ID
      relations.push({
        sourceContentId: contentId,
        targetContentId: parseInt(link.target) || 0, // 需要实际查询
        relationType: 'semantic',
        similarityScore: link.confidence,
        relationStrength: link.confidence,
        relationReason: link.metadata?.relationReason || '语义相似',
      });
    }
    
    // 处理时间关联
    for (const link of temporalLinks) {
      relations.push({
        sourceContentId: contentId,
        targetContentId: parseInt(link.target) || 0, // 需要实际查询
        relationType: 'temporal',
        similarityScore: link.confidence,
        relationStrength: link.confidence * 0.8,
        relationReason: link.metadata?.timeRelation || '时间相关',
        timeRelation: link.metadata?.timeRelation,
        timeInterval: link.metadata?.timeInterval,
      });
    }
    
    // 批量插入关联（简化处理）
    if (relations.length > 0) {
      await db.insert(contentRelations).values(relations);
    }
  }
  
  /**
   * 记录生成日志
   */
  private async logGeneration(
    userId: number,
    contentAnalysisId: number,
    data: {
      totalLinks: number;
      tagLinks: number;
      topicLinks: number;
      keywordLinks: number;
      similarityLinks: number;
      temporalLinks: number;
      generationTime: number;
      averageLinkQuality: number;
      config: LinkGenerationConfig;
    }
  ): Promise<void> {
    await db.insert(smartLinkGenerationLogs).values({
      userId,
      contentAnalysisId,
      totalLinksGenerated: data.totalLinks,
      tagLinksCount: data.tagLinks,
      topicLinksCount: data.topicLinks,
      similarityLinksCount: data.similarityLinks,
      temporalLinksCount: data.temporalLinks,
      generationConfig: JSON.stringify(data.config),
      generationTime: data.generationTime,
      averageLinkQuality: data.averageLinkQuality,
      createdAt: new Date(),
    });
  }
  
  /**
   * 渲染链接到Markdown
   */
  renderLinksToMarkdown(links: GeneratedLink[]): string {
    if (links.length === 0) return '';
    
    const markdownLines: string[] = [];
    
    // 按类型分组
    const linksByType = links.reduce((acc, link) => {
      if (!acc[link.type]) acc[link.type] = [];
      acc[link.type].push(link);
      return acc;
    }, {} as Record<string, GeneratedLink[]>);
    
    // 为每种类型生成标题和链接
    Object.entries(linksByType).forEach(([type, typeLinks]) => {
      const typeTitle = this.getTypeTitle(type);
      markdownLines.push(`### ${typeTitle}`);
      markdownLines.push('');
      
      typeLinks.forEach(link => {
        const markdownLink = this.generateMarkdownLink(link);
        markdownLines.push(`- ${markdownLink}`);
      });
      
      markdownLines.push('');
    });
    
    return markdownLines.join('\n');
  }
  
  /**
   * 生成单个Markdown链接
   */
  private generateMarkdownLink(link: GeneratedLink): string {
    switch (link.type) {
      case 'tag':
        return `#${link.target}`;
      case 'topic':
      case 'similarity':
      case 'temporal':
        return `[[${link.target}]]`;
      case 'keyword':
        return link.target;
      default:
        return link.text;
    }
  }
  
  /**
   * 获取类型标题
   */
  private getTypeTitle(type: string): string {
    const titles: Record<string, string> = {
      tag: '标签',
      topic: '主题',
      keyword: '关键词',
      similarity: '相关内容',
      temporal: '时间相关',
    };
    return titles[type] || type;
  }
}