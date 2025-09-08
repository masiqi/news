import { db } from '../index';
import { 
  interestCategories, 
  userInterests, 
  interestSourceMappings, 
  onboardingStatuses,
  sources 
} from '../../db/schema';
import { eq, and, or, isNull, inArray, desc, sql } from 'drizzle-orm';

export interface InterestCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: number;
  sortOrder: number;
  isActive: boolean;
  relatedTags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInterest {
  id: number;
  userId: number;
  categoryId: number;
  level: 'low' | 'medium' | 'high';
  priority: number;
  selectedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterestSourceMapping {
  id: number;
  categoryId: number;
  sourceId: number;
  relevanceScore: number;
  matchScore: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingStatus {
  id: number;
  userId: number;
  step: 'welcome' | 'interests' | 'recommendations' | 'confirmation' | 'completed' | 'skipped';
  currentStep: number;
  totalSteps: number;
  startedAt: Date;
  completedAt?: Date;
  selectedInterests?: string[];
  recommendedSources?: string[];
  confirmedSources?: string[];
  createdAt: Date;
  updatedAt: Date;
}

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
  matchScore: number;
  relevanceScore: number;
  createdAt: Date;
}

export interface InterestInput {
  categoryId: string;
  level: 'low' | 'medium' | 'high';
}

export interface OnboardingStep {
  step: string;
  data?: any;
}

export class OnboardingService {
  /**
   * 获取所有兴趣分类
   */
  async getInterestCategories(): Promise<InterestCategory[]> {
    try {
      const categories = await db
        .select()
        .from(interestCategories)
        .where(eq(interestCategories.isActive, true))
        .orderBy(asc(interestCategories.sortOrder), asc(interestCategories.name));

      return categories.map(category => ({
        ...category,
        relatedTags: category.relatedTags ? JSON.parse(category.relatedTags) : [],
      }));
    } catch (error) {
      console.error('获取兴趣分类失败:', error);
      throw new Error('获取兴趣分类失败');
    }
  }

  /**
   * 获取用户兴趣
   */
  async getUserInterests(userId: number): Promise<UserInterest[]> {
    try {
      const interests = await db
        .select()
        .from(userInterests)
        .where(and(eq(userInterests.userId, userId), eq(userInterests.isActive, true)))
        .orderBy(desc(userInterests.selectedAt));

      return interests;
    } catch (error) {
      console.error('获取用户兴趣失败:', error);
      throw new Error('获取用户兴趣失败');
    }
  }

  /**
   * 保存用户兴趣
   */
  async saveUserInterests(userId: number, interests: InterestInput[]): Promise<void> {
    try {
      // 开始事务
      await db.transaction(async (tx) => {
        // 先停用用户现有的兴趣
        await tx
          .update(userInterests)
          .set({ 
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(userInterests.userId, userId));

        // 插入新的兴趣
        for (const interest of interests) {
          await tx
            .insert(userInterests)
            .values({
              userId,
              categoryId: parseInt(interest.categoryId),
              level: interest.level,
              priority: interest.level === 'high' ? 8 : interest.level === 'medium' ? 5 : 3,
              selectedAt: new Date(),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
        }

        // 更新引导状态
        await this.updateOnboardingStatus(userId, {
          step: 'interests',
          selectedInterests: interests.map(i => i.categoryId),
        });
      });

      console.log(`用户 ${userId} 的兴趣保存成功`);
    } catch (error) {
      console.error('保存用户兴趣失败:', error);
      throw new Error('保存用户兴趣失败');
    }
  }

  /**
   * 基于用户兴趣推荐RSS源
   */
  async recommendSources(userId: number, interests: InterestInput[]): Promise<RecommendedSource[]> {
    try {
      // 1. 获取兴趣分类的映射关系
      const categoryIds = interests.map(i => parseInt(i.categoryId));
      const mappings = await db
        .select({
          id: interestSourceMappings.id,
          categoryId: interestSourceMappings.categoryId,
          sourceId: interestSourceMappings.sourceId,
          relevanceScore: interestSourceMappings.relevanceScore,
          matchScore: interestSourceMappings.matchScore,
        })
        .from(interestSourceMappings)
        .where(
          and(
            inArray(interestSourceMappings.categoryId, categoryIds),
            eq(interestSourceMappings.isActive, true)
          )
        );

      // 2. 获取推荐的源详情
      const sourceIds = mappings.map(m => m.sourceId);
      const recommendedSources = await db
        .select()
        .from(sources)
        .where(
          and(
            inArray(sources.id, sourceIds),
            eq(sources.isRecommended, true),
            eq(sources.qualityValidationStatus, 'approved')
          )
        );

      // 3. 计算匹配分数
      const results: RecommendedSource[] = [];
      const interestWeights = interests.reduce((acc, interest) => {
        acc[interest.categoryId] = {
          high: 1.0,
          medium: 0.7,
          low: 0.4
        }[interest.level];
        return acc;
      }, {} as Record<string, number>);

      for (const source of recommendedSources) {
        const sourceMappings = mappings.filter(m => m.sourceId === source.id);
        const maxMatchScore = Math.max(...sourceMappings.map(m => m.matchScore));
        const maxRelevanceScore = Math.max(...sourceMappings.map(m => m.relevanceScore));
        
        // 计算加权匹配分数
        let weightedScore = 0;
        let totalWeight = 0;
        
        for (const mapping of sourceMappings) {
          const weight = interestWeights[mapping.categoryId] || 0.5;
          weightedScore += (mapping.matchScore * mapping.relevanceScore / 10000) * weight;
          totalWeight += weight;
        }
        
        const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        
        results.push({
          ...source,
          matchScore: Math.round(finalScore * 100),
          relevanceScore: Math.round((maxMatchScore + maxRelevanceScore) / 2),
        });
      }

      // 4. 按匹配分数排序
      results.sort((a, b) => {
        const scoreA = (a.matchScore + a.relevanceScore) / 2;
        const scoreB = (b.matchScore + b.relevanceScore) / 2;
        return scoreB - scoreA;
      });

      // 5. 更新引导状态
      await this.updateOnboardingStatus(userId, {
        step: 'recommendations',
        recommendedSources: results.map(s => s.id.toString()),
      });

      return results;
    } catch (error) {
      console.error('推荐RSS源失败:', error);
      throw new Error('推荐RSS源失败');
    }
  }

  /**
   * 确认用户选择的RSS源
   */
  async confirmSources(userId: number, sourceIds: string[]): Promise<{ success: boolean; importedCount: number }> {
    try {
      // 1. 将选中的源添加到用户的RSS源列表
      const numericSourceIds = sourceIds.map(id => parseInt(id));
      
      // 获取推荐的源详情
      const recommendedSources = await db
        .select()
        .from(sources)
        .where(inArray(sources.id, numericSourceIds));

      // 2. 为用户创建RSS源订阅
      let importedCount = 0;
      for (const source of recommendedSources) {
        try {
          // 检查用户是否已经订阅了这个源
          const existingSubscription = await db
            .select()
            .from(sources)
            .where(
              and(
                eq(sources.userId, userId),
                or(
                  eq(sources.originalSourceId, source.id),
                  eq(sources.url, source.url)
                )
              )
            )
            .limit(1);

          if (existingSubscription.length === 0) {
            await db.insert(sources).values({
              userId,
              url: source.url,
              name: source.name,
              description: source.description,
              isPublic: false,
              originalSourceId: source.id,
              isRecommended: false, // 用户订阅的源不标记为推荐源
              createdAt: new Date(),
            });
            importedCount++;
          }
        } catch (error) {
          console.error(`订阅源 ${source.id} 失败:`, error);
          // 继续处理其他源
        }
      }

      // 3. 更新引导状态
      await this.updateOnboardingStatus(userId, {
        step: 'confirmation',
        confirmedSources: sourceIds,
      });

      console.log(`用户 ${userId} 确认了 ${importedCount} 个RSS源`);
      
      return { 
        success: true, 
        importedCount 
      };
    } catch (error) {
      console.error('确认RSS源失败:', error);
      throw new Error('确认RSS源失败');
    }
  }

  /**
   * 更新引导状态
   */
  async updateOnboardingStatus(userId: number, update: OnboardingStep): Promise<OnboardingStatus> {
    try {
      const now = new Date();
      
      // 检查是否已有引导状态记录
      let [status] = await db
        .select()
        .from(onboardingStatuses)
        .where(eq(onboardingStatuses.userId, userId))
        .limit(1);

      if (!status) {
        // 创建新的引导状态
        [status] = await db
          .insert(onboardingStatuses)
          .values({
            userId,
            step: update.step,
            currentStep: 1,
            totalSteps: 4,
            startedAt: now,
            selectedInterests: update.selectedInterests ? JSON.stringify(update.selectedInterests) : undefined,
            recommendedSources: update.recommendedSources ? JSON.stringify(update.recommendedSources) : undefined,
            confirmedSources: update.confirmedSources ? JSON.stringify(update.confirmedSources) : undefined,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      } else {
        // 更新现有状态
        [status] = await db
          .update(onboardingStatuses)
          .set({
            step: update.step,
            currentStep: this.getStepNumber(update.step),
            completedAt: update.step === 'completed' || update.step === 'skipped' ? now : undefined,
            selectedInterests: update.selectedInterests ? JSON.stringify(update.selectedInterests) : status.selectedInterests,
            recommendedSources: update.recommendedSources ? JSON.stringify(update.recommendedSources) : status.recommendedSources,
            confirmedSources: update.confirmedSources ? JSON.stringify(update.confirmedSources) : status.confirmedSources,
            updatedAt: now,
          })
          .where(eq(onboardingStatuses.id, status.id))
          .returning();
      }

      // 解析JSON字段
      const result: OnboardingStatus = {
        ...status,
        selectedInterests: status.selectedInterests ? JSON.parse(status.selectedInterests) : undefined,
        recommendedSources: status.recommendedSources ? JSON.parse(status.recommendedSources) : undefined,
        confirmedSources: status.confirmedSources ? JSON.parse(status.confirmedSources) : undefined,
      };

      return result;
    } catch (error) {
      console.error('更新引导状态失败:', error);
      throw new Error('更新引导状态失败');
    }
  }

  /**
   * 跳过引导流程
   */
  async skipOnboarding(userId: number): Promise<{ success: boolean }> {
    try {
      const now = new Date();
      
      await this.updateOnboardingStatus(userId, {
        step: 'skipped',
      });

      console.log(`用户 ${userId} 跳过了引导流程`);
      return { success: true };
    } catch (error) {
      console.error('跳过引导流程失败:', error);
      throw new Error('跳过引导流程失败');
    }
  }

  /**
   * 完成引导流程
   */
  async completeOnboarding(userId: number): Promise<{ success: boolean }> {
    try {
      const now = new Date();
      
      await this.updateOnboardingStatus(userId, {
        step: 'completed',
      });

      console.log(`用户 ${userId} 完成了引导流程`);
      return { success: true };
    } catch (error) {
      console.error('完成引导流程失败:', error);
      throw new Error('完成引导流程失败');
    }
  }

  /**
   * 获取用户引导状态
   */
  async getOnboardingStatus(userId: number): Promise<OnboardingStatus | null> {
    try {
      const [status] = await db
        .select()
        .from(onboardingStatuses)
        .where(eq(onboardingStatuses.userId, userId))
        .limit(1);

      if (!status) {
        return null;
      }

      return {
        ...status,
        selectedInterests: status.selectedInterests ? JSON.parse(status.selectedInterests) : undefined,
        recommendedSources: status.recommendedSources ? JSON.parse(status.recommendedSources) : undefined,
        confirmedSources: status.confirmedSources ? JSON.parse(status.confirmedSources) : undefined,
      };
    } catch (error) {
      console.error('获取引导状态失败:', error);
      throw new Error('获取引导状态失败');
    }
  }

  /**
   * 检查用户是否需要引导
   */
  async needsOnboarding(userId: number): Promise<boolean> {
    try {
      const [status] = await db
        .select()
        .from(onboardingStatuses)
        .where(eq(onboardingStatuses.userId, userId))
        .limit(1);

      // 如果没有状态记录或者状态不是completed/skipped，则需要引导
      return !status || !['completed', 'skipped'].includes(status.step);
    } catch (error) {
      console.error('检查引导需求失败:', error);
      return false;
    }
  }

  /**
   * 获取引导进度
   */
  async getOnboardingProgress(userId: number): Promise<{
    currentStep: number;
    totalSteps: number;
    stepName: string;
    progress: number;
  }> {
    try {
      const status = await this.getOnboardingStatus(userId);
      
      if (!status) {
        return {
          currentStep: 0,
          totalSteps: 4,
          stepName: 'not_started',
          progress: 0,
        };
      }

      const stepNames = {
        'welcome': '欢迎',
        'interests': '兴趣选择',
        'recommendations': '推荐源',
        'confirmation': '确认选择',
        'completed': '已完成',
        'skipped': '已跳过',
      };

      const progress = ['completed', 'skipped'].includes(status.step) ? 100 : 
                         Math.round((status.currentStep - 1) / (status.totalSteps - 1) * 100);

      return {
        currentStep: status.currentStep,
        totalSteps: status.totalSteps,
        stepName: stepNames[status.step] || status.step,
        progress,
      };
    } catch (error) {
      console.error('获取引导进度失败:', error);
      throw new Error('获取引导进度失败');
    }
  }

  /**
   * 将步骤名转换为步骤号
   */
  private getStepNumber(step: string): number {
    const stepNumbers = {
      'welcome': 1,
      'interests': 2,
      'recommendations': 3,
      'confirmation': 4,
      'completed': 4,
      'skipped': 4,
    };
    return stepNumbers[step as keyof typeof stepNumbers] || 1;
  }

  /**
   * 初始化引导流程
   */
  async initializeOnboarding(userId: number): Promise<OnboardingStatus> {
    try {
      const now = new Date();
      
      const [status] = await db
        .insert(onboardingStatuses)
        .values({
          userId,
          step: 'welcome',
          currentStep: 1,
          totalSteps: 4,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      console.log(`用户 ${userId} 开始引导流程`);
      return status;
    } catch (error) {
      console.error('初始化引导流程失败:', error);
      throw new Error('初始化引导流程失败');
    }
  }

  /**
   * 获取热门兴趣分类
   */
  async getPopularCategories(limit: number = 10): Promise<InterestCategory[]> {
    try {
      // 获取有最多用户选择的分类
      const popularCategories = await db
        .select({
          id: interestCategories.id,
          name: interestCategories.name,
          description: interestCategories.description,
          icon: interestCategories.icon,
          color: interestCategories.color,
          parent_id: interestCategories.parentId,
          sort_order: interestCategories.sortOrder,
        })
        .from(interestCategories)
        .leftJoin(userInterests, eq(userInterests.categoryId, interestCategories.id))
        .where(eq(interestCategories.isActive, true))
        .groupBy(
          interestCategories.id,
          interestCategories.name,
          interestCategories.description,
          interestCategories.icon,
          interestCategories.color,
          interestCategories.parentId,
          interestCategories.sortOrder
        )
        .orderBy(desc(sql`count(${userInterests.id})`))
        .limit(limit);

      return popularCategories;
    } catch (error) {
      console.error('获取热门分类失败:', error);
      throw new Error('获取热门分类失败');
    }
  }
}