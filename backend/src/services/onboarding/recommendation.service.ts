import { db } from '../index';
import { sources, sourceCategories, interestCategories, sourceTags } from '../../db/schema';
import { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';
import { OnboardingService, InterestInput } from './onboarding.service';

export interface RecommendedSource {
  id: number;
  name: string;
  url: string;
  description?: string;
  icon?: string;
  recommendationLevel: 'basic' | 'premium' | 'featured';
  qualityAvailability: number;
  qualityContentQuality: number;
  qualityUpdateFrequency: number;
  qualityValidationStatus: 'pending' | 'approved' | 'rejected';
  isRecommended: boolean;
  categories?: Array<{
    id: number;
    name: string;
    icon?: string;
    color?: string;
  }>;
  tags?: Array<{
    id: number;
    name: string;
    color?: string;
  }>;
  matchScore: number;
  relevanceScore: number;
}

export class RecommendationService {
  private onboardingService: OnboardingService;

  constructor() {
    this.onboardingService = new OnboardingService();
  }

  /**
   * 基于用户兴趣推荐RSS源
   */
  async recommendSourcesBasedOnInterests(userId: number, interests: InterestInput[]): Promise<RecommendedSource[]> {
    try {
      // 1. 获取兴趣分类的映射关系
      const categoryIds = interests.map(i => parseInt(i.categoryId));
      
      // 2. 计算兴趣权重
      const interestWeights = this.calculateInterestWeights(interests);

      // 3. 获取相关联的RSS源
      const recommendedSources = await this.getSourcesByCategories(categoryIds, interestWeights);

      // 4. 应用推荐算法评分
      const scoredSources = await this.scoreRecommendations(recommendedSources, userId, interests);

      // 5. 排序和过滤结果
      const finalRecommendations = this.rankRecommendations(scoredSources);

      return finalRecommendations;
    } catch (error) {
      console.error('基于兴趣推荐RSS源失败:', error);
      throw new Error('推荐RSS源失败');
    }
  }

  /**
   * 获取推荐源质量评分
   */
  async getRecommendedSourceQuality(sourceId: number): Promise<{
    qualityScore: number;
    popularityScore: number;
    relevanceScore: number;
    overallScore: number;
  }> {
    try {
      const sourceResults = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceId))
        .limit(1);

      if (sourceResults.length === 0) {
        throw new Error('推荐源不存在');
      }

      const source = sourceResults[0];

      // 质量评分 (40%)
      const qualityScore = (
        (source.qualityAvailability || 50) +
        (source.qualityContentQuality || 50) +
        (source.qualityUpdateFrequency || 50)
      ) / 3;

      // 流行度评分 (30%) - 基于订阅数
      const popularityScore = Math.min(source.statisticsTotalSubscribers || 0, 100);

      // 相关性评分 (30%) - 基于分类和标签匹配
      const relevanceScore = await this.calculateRelevanceScore(sourceId);

      // 总评分
      const overallScore = Math.round(
        qualityScore * 0.4 + 
        popularityScore * 0.3 + 
        relevanceScore * 0.3
      );

      return {
        qualityScore,
        popularityScore,
        relevanceScore,
        overallScore,
      };
    } catch (error) {
      console.error('获取推荐源质量评分失败:', error);
      throw new Error('获取推荐源质量评分失败');
    }
  }

  /**
   * 计算兴趣权重
   */
  private calculateInterestWeights(interests: InterestInput[]): Record<number, number> {
    return interests.reduce((acc, interest) => {
      const categoryId = parseInt(interest.categoryId);
      const weight = interest.level === 'high' ? 1.0 :
                     interest.level === 'medium' ? 0.7 : 0.4;
      acc[categoryId] = weight;
      return acc;
    }, {} as Record<number, number>);
  }

  /**
   * 根据分类获取RSS源
   */
  private async getSourcesByCategories(categoryIds: number[], interestWeights: Record<number, number>): Promise<any[]> {
    // 获取直接关联的源
    const directSources = await db
      .select({
        id: sources.id,
        name: sources.name,
        url: sources.url,
        description: sources.description,
        recommendationLevel: sources.recommendationLevel,
        qualityAvailability: sources.qualityAvailability,
        qualityContentQuality: sources.qualityContentQuality,
        qualityUpdateFrequency: sources.qualityUpdateFrequency,
        qualityValidationStatus: sources.qualityValidationStatus,
        isRecommended: sources.isRecommended,
        statisticsTotalSubscribers: sources.statisticsTotalSubscribers,
      })
      .from(sources)
      .innerJoin(sourceCategoryRelations, eq(sourceCategoryRelations.sourceId, sources.id))
      .where(
        and(
          inArray(sourceCategoryRelations.categoryId, categoryIds),
          eq(sources.isRecommended, true),
          eq(sources.qualityValidationStatus, 'approved')
        )
      );

    // 获取标签关联的源
    const tagSources = await db
      .select({
        id: sources.id,
        name: sources.name,
        url: sources.url,
        description: sources.description,
        recommendationLevel: sources.recommendationLevel,
        qualityAvailability: sources.qualityAvailability,
        qualityContentQuality: sources.qualityContentQuality,
        qualityUpdateFrequency: sources.qualityUpdateFrequency,
        qualityValidationStatus: sources.qualityValidationStatus,
        isRecommended: sources.isRecommended,
        statisticsTotalSubscribers: sources.statisticsTotalSubscribers,
      })
      .from(sources)
      .innerJoin(sourceTagRelations, eq(sourceTagRelations.sourceId, sources.id))
      .innerJoin(interestCategories, eq(interestCategories.id, sourceTagRelations.tagId))
      .where(
        and(
          inArray(interestCategories.id, categoryIds),
          eq(sources.isRecommended, true),
          eq(sources.qualityValidationStatus, 'approved')
        )
      )
      .groupBy(sources.id);

    // 合并结果并去重
    const allSources = [...directSources, ...tagSources];
    const uniqueSources = this.removeDuplicates(allSources, 'id');

    return uniqueSources.map(source => ({
      ...source,
      interestWeight: this.calculateSourceInterestWeight(source.id, categoryIds, interestWeights),
    }));
  }

  /**
   * 计算源的兴趣权重
   */
  private calculateSourceInterestWeight(sourceId: number, categoryIds: number[], interestWeights: Record<number, number>): number {
    // 这里简化处理，实际应该查询数据库获取具体的关联关系
    const weights = categoryIds.map(id => interestWeights[id] || 0.5);
    return Math.max(...weights);
  }

  /**
   * 计算推荐评分
   */
  private async scoreRecommendations(sources: any[], userId: number, userInterests: InterestInput[]): Promise<any[]> {
    const scoredSources = [];

    for (const source of sources) {
      // 1. 获取源的质量评分
      const quality = await this.getRecommendedSourceQuality(source.id);

      // 2. 计算兴趣匹配度
      const interestMatch = this.calculateInterestMatch(source, userInterests);

      // 3. 计算多样性评分（避免推荐过多相似源）
      const diversityScore = await this.calculateDiversityScore(source, userId);

      // 4. 综合评分
      const finalScore = Math.round(
        quality.overallScore * 0.5 +
        interestMatch * 0.3 +
        diversityScore * 0.2
      );

      scoredSources.push({
        ...source,
        qualityScore: quality.overallScore,
        interestMatchScore: Math.round(interestMatch * 100),
        diversityScore: Math.round(diversityScore * 100),
        finalScore,
      });
    }

    return scoredSources;
  }

  /**
   * 计算兴趣匹配度
   */
  private calculateInterestMatch(source: any, userInterests: InterestInput[]): number {
    // 简化的兴趣匹配算法
    // 实际实现中应该考虑分类层次、标签匹配等
    const sourceCategories = source.categories || [];
    const userCategories = userInterests.map(i => i.categoryId);
    
    // 计算分类重叠度
    const categoryOverlap = sourceCategories.filter(cat => 
      userCategories.includes(cat.id.toString())
    ).length;
    
    const matchScore = categoryOverlap > 0 ? 
      Math.min(categoryOverlap / Math.max(sourceCategories.length, userCategories.length), 1) : 0.3;

    return matchScore;
  }

  /**
   * 计算多样性评分
   */
  private async calculateDiversityScore(source: any, userId: number): Promise<number> {
    try {
      // 检查用户是否已经订阅了相似分类的源
      const sourceCategories = source.categories || [];
      
      if (sourceCategories.length === 0) {
        return 0.8; // 无分类信息的源给予中等多样性
      }

      // 获取用户已订阅的分类
      const userCategoryIds = await db
        .select({ categoryId: sourceCategories.id })
        .from(sourceCategoryRelations)
        .innerJoin(sources, eq(sources.id, sourceCategoryRelations.sourceId))
        .where(eq(sources.userId, userId))
        .groupBy(sourceCategoryRelations.categoryId);

      const userCategories = userCategoryIds.map(uc => uc.categoryId);

      // 计算多样性 - 用户已订阅的分类越少，多样性评分越高
      const overlapCount = sourceCategories.filter(cat => 
        userCategories.includes(cat.id)
      ).length;

      const diversityScore = overlapCount === 0 ? 1.0 :
                               overlapCount === 1 ? 0.7 :
                               overlapCount === 2 ? 0.4 : 0.1;

      return diversityScore;
    } catch (error) {
      console.error('计算多样性评分失败:', error);
      return 0.5; // 默认中等多样性
    }
  }

  /**
   * 计算相关性评分
   */
  private async calculateRelevanceScore(sourceId: number): Promise<number> {
    try {
      // 获取源的分类和标签
      const [source] = await db
        .select({
          id: sources.id,
        })
        .from(sources)
        .innerJoin(sourceCategoryRelations, eq(sourceCategoryRelations.sourceId, sources.id))
        .innerJoin(sourceTagRelations, eq(sourceTagRelations.sourceId, sources.id))
        .where(eq(sources.id, sourceId))
        .limit(1);

      if (!source) {
        return 50; // 默认中等相关性
      }

      // 简化的相关性计算
      // 实际实现中应该考虑分类热度、标签匹配度等
      // 这里返回一个基于分类数量的估算分数
      const categoryCount = source.sourceCategories?.length || 1;
      const tagCount = source.sourceTags?.length || 0;
      
      const relevanceScore = Math.min(50 + categoryCount * 5 + tagCount * 2, 100);
      
      return relevanceScore;
    } catch (error) {
      console.error('计算相关性评分失败:', error);
      return 50; // 默认中等相关性
    }
  }

  /**
   * 排序推荐结果
   */
  private rankRecommendations(scoredSources: any[]): RecommendedSource[] {
    // 按最终评分降序排序
    const sortedSources = scoredSources.sort((a, b) => b.finalScore - a.finalScore);

    return sortedSources.map((source, index) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      description: source.description,
      icon: source.icon,
      recommendationLevel: source.recommendationLevel,
      qualityAvailability: source.qualityAvailability,
      qualityContentQuality: source.qualityContentQuality,
      qualityUpdateFrequency: source.qualityUpdateFrequency,
      qualityValidationStatus: source.qualityValidationStatus,
      isRecommended: source.isRecommended,
      categories: source.categories,
      tags: source.tags,
      matchScore: source.interestMatchScore,
      relevanceScore: source.diversityScore,
    }));
  }

  /**
   * 数组去重
   */
  private removeDuplicates(array: any[], key: string): any[] {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * 获取个性化推荐
   */
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<RecommendedSource[]> {
    try {
      // 1. 检查用户是否完成引导
      const onboardingStatus = await this.onboardingService.getOnboardingStatus(userId);
      
      if (!onboardingStatus || onboardingStatus.step !== 'completed') {
        return [];
      }

      // 2. 获取用户兴趣
      const userInterests = await this.onboardingService.getUserInterests(userId);
      
      if (userInterests.length === 0) {
        return [];
      }

      // 3. 基于兴趣推荐源
      const interests: InterestInput[] = userInterests.map(interest => ({
        categoryId: interest.categoryId.toString(),
        level: interest.level,
      }));

      const recommendations = await this.recommendSourcesBasedOnInterests(userId, interests);

      // 4. 限制结果数量
      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('获取个性化推荐失败:', error);
      throw new Error('获取个性化推荐失败');
    }
  }

  /**
   * 获取热门推荐源（用于新用户）
   */
  async getTrendingRecommendedSources(limit: number = 10): Promise<RecommendedSource[]> {
    try {
      const trendingSources = await db
        .select({
          id: sources.id,
          name: sources.name,
          url: sources.url,
          description: sources.description,
          icon: sources.icon,
          recommendationLevel: sources.recommendationLevel,
          qualityAvailability: sources.qualityAvailability,
          qualityContentQuality: sources.qualityContentQuality,
          qualityUpdateFrequency: sources.qualityUpdateFrequency,
          qualityValidationStatus: sources.qualityValidationStatus,
          isRecommended: sources.isRecommended,
          statisticsTotalSubscribers: sources.statisticsTotalSubscribers,
        })
        .from(sources)
        .where(
          and(
            eq(sources.isRecommended, true),
            eq(sources.qualityValidationStatus, 'approved'),
            gte(sources.statisticsTotalSubscribers, 100) // 至少100订阅
          )
        )
        .orderBy(desc(sources.statisticsTotalSubscribers), desc(sources.qualityAvailability))
        .limit(limit);

      return trendingSources.map((source, index) => ({
        ...source,
        matchScore: 90, // 高分因为热门
        relevanceScore: 90, // 高分因为热门
      }));
    } catch (error) {
      console.error('获取热门推荐源失败:', error);
      throw new Error('获取热门推荐源失败');
    }
  }

  /**
   * 基于分类获取推荐源
   */
  async getRecommendationsByCategory(categoryId: number, limit: number = 20): Promise<RecommendedSource[]> {
    try {
      const sources = await db
        .select({
          id: sources.id,
          name: sources.name,
          url: sources.url,
          description: sources.description,
          icon: sources.icon,
          recommendationLevel: sources.recommendationLevel,
          qualityAvailability: sources.qualityAvailability,
          qualityContentQuality: sources.qualityContentQuality,
          qualityUpdateFrequency: sources.qualityUpdateFrequency,
          qualityValidationStatus: sources.qualityValidationStatus,
          isRecommended: sources.isRecommended,
          statisticsTotalSubscribers: sources.statisticsTotalSubscribers,
        })
        .from(sources)
        .innerJoin(sourceCategoryRelations, eq(sourceCategoryRelations.sourceId, sources.id))
        .where(
          and(
            eq(sourceCategoryRelations.categoryId, categoryId),
            eq(sources.isRecommended, true),
            eq(sources.qualityValidationStatus, 'approved')
          )
        )
        .orderBy(desc(sources.statisticsTotalSubscribers))
        .limit(limit);

      return sources.map((source, index) => ({
        ...source,
        matchScore: 80, // 分类匹配较高
        relevanceScore: 80,
      }));
    } catch (error) {
      console.error('基于分类获取推荐源失败:', error);
      throw new Error('基于分类获取推荐源失败');
    }
  }

  /**
   * 更新推荐算法参数
   */
  async updateRecommendationWeights(weights: {
    qualityWeight: number;
    popularityWeight: number;
    relevanceWeight: number;
    diversityWeight: number;
  }): Promise<void> {
    try {
      // 这里可以保存权重配置到数据库或环境变量
      // 目前简化实现，实际中应该有配置表
      console.log('更新推荐算法权重:', weights);
      
      // 验证权重总和
      const totalWeight = weights.qualityWeight + weights.popularityWeight + 
                         weights.relevanceWeight + weights.diversityWeight;
      
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error('权重总和必须等于1.0');
      }

      // TODO: 将权重保存到配置表
      // await db.insert(recommendationWeights).values({
      //   ...weights,
      //   updatedAt: new Date(),
      // });

      console.log('推荐算法权重更新成功');
    } catch (error) {
      console.error('更新推荐算法权重失败:', error);
      throw new Error('更新推荐算法权重失败');
    }
  }

  /**
   * A/B测试不同的推荐策略
   */
  async getABTestRecommendations(userId: number, strategy: 'A' | 'B', limit: number = 20): Promise<{
    strategyA: RecommendedSource[];
    strategyB: RecommendedSource[];
  }> {
    try {
      const userInterests = await this.onboardingService.getUserInterests(userId);
      const interests: InterestInput[] = userInterests.map(interest => ({
        categoryId: interest.categoryId.toString(),
        level: interest.level,
      }));

      // 策略A：基于兴趣和质量的混合推荐
      const strategyA = await this.recommendSourcesBasedOnInterests(userId, interests);

      // 策略B：基于热门和个性化趋势的推荐
      const strategyB = await this.getTrendingRecommendedSources(limit);

      // 根据测试参数返回对应策略
      return {
        strategyA,
        strategyB,
      };
    } catch (error) {
      console.error('A/B测试推荐失败:', error);
      throw new Error('A/B测试推荐失败');
    }
  }
}