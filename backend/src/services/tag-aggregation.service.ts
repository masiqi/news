import {
  userTopics,
  userKeywords,
  topicEntryRelations,
  keywordEntryRelations,
  processedContents,
  rssEntries,
  sources,
} from '../db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

export interface TagAggregationService {
  processContentTags(processedContentId: number, db: any): Promise<void>;
  getUserTopics(userId: number, limit?: number, offset?: number, db?: any): Promise<any[]>;
  getUserKeywords(userId: number, limit?: number, offset?: number, db?: any): Promise<any[]>;
  getEntriesByTopic(userId: number, topicName: string, limit?: number, offset?: number, db?: any): Promise<any[]>;
  getEntriesByKeyword(userId: number, keywordName: string, limit?: number, offset?: number, db?: any): Promise<any[]>;
  searchTags(userId: number, query: string, type: 'topics' | 'keywords' | 'all', db?: any): Promise<any[]>;
}

export class TagAggregationServiceImpl implements TagAggregationService {
  /**
   * 处理单个内容的标签聚合
   */
  async processContentTags(processedContentId: number, db: any): Promise<void> {
    console.log(`🏷️ 开始处理内容标签聚合，processedContentId: ${processedContentId}`);

    try {
      // 获取处理后的内容和关联信息
      const [processedContent] = await db
        .select({
          id: processedContents.id,
          entryId: processedContents.entryId,
          topics: processedContents.topics,
          keywords: processedContents.keywords,
          markdownContent: processedContents.markdownContent,
        })
        .from(processedContents)
        .where(eq(processedContents.id, processedContentId))
        .limit(1);

      if (!processedContent) {
        console.warn(`⚠️ 未找到处理后的内容，ID: ${processedContentId}`);
        return;
      }

      // 获取用户信息
      const [entryInfo] = await db
        .select({
          userId: sources.userId,
          title: rssEntries.title,
          link: rssEntries.link,
          publishedAt: rssEntries.publishedAt,
        })
        .from(rssEntries)
        .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
        .where(eq(rssEntries.id, processedContent.entryId))
        .limit(1);

      if (!entryInfo) {
        console.warn(`⚠️ 未找到条目信息，entryId: ${processedContent.entryId}`);
        return;
      }

      const userId = entryInfo.userId;

      // 解析主题和关键词
      const topics = this.parseTopics(processedContent.topics);
      const keywords = this.parseKeywords(processedContent.keywords);

      console.log(`📝 解析标签 - 主题: ${topics.length}, 关键词: ${keywords.length}`);

      // 处理主题聚合
      for (const topicName of topics) {
        await this.processTopic(userId, topicName, processedContent.entryId, processedContent.id, db);
      }

      // 处理关键词聚合
      for (const keywordName of keywords) {
        await this.processKeyword(userId, keywordName, processedContent.entryId, processedContent.id, db);
      }

      console.log(`✅ 内容标签聚合处理完成，ID: ${processedContentId}`);
    } catch (error) {
      console.error('❌ 处理内容标签聚合失败:', error);
      throw error;
    }
  }

  /**
   * 处理单个主题的聚合
   */
  private async processTopic(userId: number, topicName: string, entryId: number, processedContentId: number, db: any): Promise<void> {
    try {
      // 检查主题是否已存在
      const [existingTopic] = await db
        .select()
        .from(userTopics)
        .where(and(eq(userTopics.userId, userId), eq(userTopics.topicName, topicName)))
        .limit(1);

      let topicId: number;
      
      if (existingTopic) {
        // 更新现有主题
        topicId = existingTopic.id;
        await db
          .update(userTopics)
          .set({
            entryCount: sql`${userTopics.entryCount} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userTopics.id, topicId));
        
        console.log(`🔄 更新主题: ${topicName}, 计数: ${existingTopic.entryCount + 1}`);
      } else {
        // 创建新主题
        const [newTopic] = await db
          .insert(userTopics)
          .values({
            userId,
            topicName,
            entryCount: 1,
            lastUsedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        topicId = newTopic.id;
        console.log(`🆕 创建新主题: ${topicName}`);
      }

      // 创建主题与条目的关联
      await this.createTopicRelation(userId, topicId, entryId, processedContentId, db);
    } catch (error) {
      console.error(`❌ 处理主题聚合失败: ${topicName}`, error);
      throw error;
    }
  }

  /**
   * 处理单个关键词的聚合
   */
  private async processKeyword(userId: number, keywordName: string, entryId: number, processedContentId: number, db: any): Promise<void> {
    try {
      // 检查关键词是否已存在
      const [existingKeyword] = await db
        .select()
        .from(userKeywords)
        .where(and(eq(userKeywords.userId, userId), eq(userKeywords.keywordName, keywordName)))
        .limit(1);

      let keywordId: number;
      
      if (existingKeyword) {
        // 更新现有关键词
        keywordId = existingKeyword.id;
        await db
          .update(userKeywords)
          .set({
            entryCount: sql`${userKeywords.entryCount} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userKeywords.id, keywordId));
        
        console.log(`🔄 更新关键词: ${keywordName}, 计数: ${existingKeyword.entryCount + 1}`);
      } else {
        // 创建新关键词
        const [newKeyword] = await db
          .insert(userKeywords)
          .values({
            userId,
            keywordName,
            entryCount: 1,
            lastUsedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        keywordId = newKeyword.id;
        console.log(`🆕 创建新关键词: ${keywordName}`);
      }

      // 创建关键词与条目的关联
      await this.createKeywordRelation(userId, keywordId, entryId, processedContentId, db);
    } catch (error) {
      console.error(`❌ 处理关键词聚合失败: ${keywordName}`, error);
      throw error;
    }
  }

  /**
   * 创建主题与条目的关联
   */
  private async createTopicRelation(userId: number, topicId: number, entryId: number, processedContentId: number, db: any): Promise<void> {
    try {
      // 检查关联是否已存在
      const [existingRelation] = await db
        .select()
        .from(topicEntryRelations)
        .where(and(
          eq(topicEntryRelations.topicId, topicId),
          eq(topicEntryRelations.entryId, entryId)
        ))
        .limit(1);

      if (!existingRelation) {
        await db.insert(topicEntryRelations).values({
          userId,
          topicId,
          entryId,
          processedContentId,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`❌ 创建主题关联失败: topicId=${topicId}, entryId=${entryId}`, error);
      throw error;
    }
  }

  /**
   * 创建关键词与条目的关联
   */
  private async createKeywordRelation(userId: number, keywordId: number, entryId: number, processedContentId: number, db: any): Promise<void> {
    try {
      // 检查关联是否已存在
      const [existingRelation] = await db
        .select()
        .from(keywordEntryRelations)
        .where(and(
          eq(keywordEntryRelations.keywordId, keywordId),
          eq(keywordEntryRelations.entryId, entryId)
        ))
        .limit(1);

      if (!existingRelation) {
        await db.insert(keywordEntryRelations).values({
          userId,
          keywordId,
          entryId,
          processedContentId,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`❌ 创建关键词关联失败: keywordId=${keywordId}, entryId=${entryId}`, error);
      throw error;
    }
  }

  /**
   * 获取用户的主题列表
   */
  async getUserTopics(userId: number, limit = 50, offset = 0, db?: any): Promise<any[]> {
    try {
      if (!db) {
        throw new Error('数据库连接未提供');
      }
      
      const topics = await db
        .select({
          id: userTopics.id,
          topicName: userTopics.topicName,
          entryCount: userTopics.entryCount,
          lastUsedAt: userTopics.lastUsedAt,
          createdAt: userTopics.createdAt,
        })
        .from(userTopics)
        .where(eq(userTopics.userId, userId))
        .orderBy(desc(userTopics.entryCount), desc(userTopics.lastUsedAt))
        .limit(limit)
        .offset(offset);

      return topics;
    } catch (error) {
      console.error('❌ 获取用户主题失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的关键词列表
   */
  async getUserKeywords(userId: number, limit = 50, offset = 0, db?: any): Promise<any[]> {
    try {
      if (!db) {
        throw new Error('数据库连接未提供');
      }
      
      const keywords = await db
        .select({
          id: userKeywords.id,
          keywordName: userKeywords.keywordName,
          entryCount: userKeywords.entryCount,
          lastUsedAt: userKeywords.lastUsedAt,
          createdAt: userKeywords.createdAt,
        })
        .from(userKeywords)
        .where(eq(userKeywords.userId, userId))
        .orderBy(desc(userKeywords.entryCount), desc(userKeywords.lastUsedAt))
        .limit(limit)
        .offset(offset);

      return keywords;
    } catch (error) {
      console.error('❌ 获取用户关键词失败:', error);
      throw error;
    }
  }

  /**
   * 根据主题获取相关内容
   */
  async getEntriesByTopic(userId: number, topicName: string, limit = 20, offset = 0, db?: any): Promise<any[]> {
    try {
      if (!db) {
        throw new Error('数据库连接未提供');
      }
      
      const entries = await db
        .select({
          id: rssEntries.id,
          title: rssEntries.title,
          content: rssEntries.content,
          link: rssEntries.link,
          sourceId: rssEntries.sourceId,
          sourceName: sources.name,
          publishedAt: rssEntries.publishedAt,
          processedAt: rssEntries.processedAt,
          webContent: processedContents.markdownContent,
          topics: processedContents.topics,
          keywords: processedContents.keywords,
          sentiment: processedContents.sentiment,
          analysis: processedContents.analysis,
          educationalValue: processedContents.educationalValue,
          wordCount: processedContents.wordCount,
        })
        .from(topicEntryRelations)
        .innerJoin(userTopics, eq(topicEntryRelations.topicId, userTopics.id))
        .innerJoin(rssEntries, eq(topicEntryRelations.entryId, rssEntries.id))
        .innerJoin(processedContents, eq(topicEntryRelations.processedContentId, processedContents.id))
        .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
        .where(and(
          eq(userTopics.userId, userId),
          eq(userTopics.topicName, topicName),
          eq(sources.userId, userId)
        ))
        .orderBy(desc(rssEntries.publishedAt))
        .limit(limit)
        .offset(offset);

      // 更新主题的最后使用时间
      await db
        .update(userTopics)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(userTopics.userId, userId), eq(userTopics.topicName, topicName)));

      // 格式化返回数据
      return entries.map(entry => ({
        ...entry,
        topics: entry.topics ? JSON.parse(entry.topics) : [],
        keywords: entry.keywords ? entry.keywords.split(',').filter(k => k.trim()) : [],
        webContent: entry.webContent || null
      }));
    } catch (error) {
      console.error(`❌ 根据主题获取内容失败: ${topicName}`, error);
      throw error;
    }
  }

  /**
   * 根据关键词获取相关内容
   */
  async getEntriesByKeyword(userId: number, keywordName: string, limit = 20, offset = 0, db?: any): Promise<any[]> {
    try {
      if (!db) {
        throw new Error('数据库连接未提供');
      }
      
      const entries = await db
        .select({
          id: rssEntries.id,
          title: rssEntries.title,
          content: rssEntries.content,
          link: rssEntries.link,
          sourceId: rssEntries.sourceId,
          sourceName: sources.name,
          publishedAt: rssEntries.publishedAt,
          processedAt: rssEntries.processedAt,
          webContent: processedContents.markdownContent,
          topics: processedContents.topics,
          keywords: processedContents.keywords,
          sentiment: processedContents.sentiment,
          analysis: processedContents.analysis,
          educationalValue: processedContents.educationalValue,
          wordCount: processedContents.wordCount,
        })
        .from(keywordEntryRelations)
        .innerJoin(userKeywords, eq(keywordEntryRelations.keywordId, userKeywords.id))
        .innerJoin(rssEntries, eq(keywordEntryRelations.entryId, rssEntries.id))
        .innerJoin(processedContents, eq(keywordEntryRelations.processedContentId, processedContents.id))
        .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
        .where(and(
          eq(userKeywords.userId, userId),
          eq(userKeywords.keywordName, keywordName),
          eq(sources.userId, userId)
        ))
        .orderBy(desc(rssEntries.publishedAt))
        .limit(limit)
        .offset(offset);

      // 更新关键词的最后使用时间
      await db
        .update(userKeywords)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(userKeywords.userId, userId), eq(userKeywords.keywordName, keywordName)));

      // 格式化返回数据
      return entries.map(entry => ({
        ...entry,
        topics: entry.topics ? JSON.parse(entry.topics) : [],
        keywords: entry.keywords ? entry.keywords.split(',').filter(k => k.trim()) : [],
        webContent: entry.webContent || null
      }));
    } catch (error) {
      console.error(`❌ 根据关键词获取内容失败: ${keywordName}`, error);
      throw error;
    }
  }

  /**
   * 搜索标签
   */
  async searchTags(userId: number, query: string, type: 'topics' | 'keywords' | 'all', db?: any): Promise<any[]> {
    try {
      if (!db) {
        throw new Error('数据库连接未提供');
      }
      
      const searchPattern = `%${query}%`;
      let results: any[] = [];

      if (type === 'topics' || type === 'all') {
        const topics = await db
          .select({
            id: userTopics.id,
            name: userTopics.topicName,
            entryCount: userTopics.entryCount,
            type: sql<'topic'>`'topic'`,
          })
          .from(userTopics)
          .where(and(
            eq(userTopics.userId, userId),
            sql`LOWER(${userTopics.topicName}) LIKE LOWER(${searchPattern})`
          ))
          .orderBy(desc(userTopics.entryCount))
          .limit(10);

        results.push(...topics);
      }

      if (type === 'keywords' || type === 'all') {
        const keywords = await db
          .select({
            id: userKeywords.id,
            name: userKeywords.keywordName,
            entryCount: userKeywords.entryCount,
            type: sql<'keyword'>`'keyword'`,
          })
          .from(userKeywords)
          .where(and(
            eq(userKeywords.userId, userId),
            sql`LOWER(${userKeywords.keywordName}) LIKE LOWER(${searchPattern})`
          ))
          .orderBy(desc(userKeywords.entryCount))
          .limit(10);

        results.push(...keywords);
      }

      return results;
    } catch (error) {
      console.error(`❌ 搜索标签失败: ${query}`, error);
      throw error;
    }
  }

  /**
   * 解析主题JSON
   */
  private parseTopics(topicsJson: string | null): string[] {
    if (!topicsJson) return [];
    
    try {
      const topics = JSON.parse(topicsJson);
      return Array.isArray(topics) ? topics.map(t => String(t).trim()).filter(Boolean) : [];
    } catch (error) {
      console.warn('⚠️ 解析主题JSON失败:', error);
      return [];
    }
  }

  /**
   * 解析关键词字符串
   */
  private parseKeywords(keywordsString: string | null): string[] {
    if (!keywordsString) return [];
    
    try {
      return keywordsString
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
    } catch (error) {
      console.warn('⚠️ 解析关键词字符串失败:', error);
      return [];
    }
  }
}

// 导出服务实例
export const tagAggregationService = new TagAggregationServiceImpl();