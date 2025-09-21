import { drizzle } from 'drizzle-orm/d1';
import { 
  processedContents, 
  rssEntries, 
  sources, 
  userTopics, 
  userKeywords, 
  topicEntryRelations, 
  keywordEntryRelations 
} from './src/db/schema.js';
import { eq, and, or, isNotNull, sql } from 'drizzle-orm';

// 模拟D1数据库实例
class MockD1 {
  constructor(data) {
    this.data = data;
  }

  async select(fields) {
    return this;
  }

  async from(table) {
    return this;
  }

  async where(condition) {
    return this;
  }

  async innerJoin(table, condition) {
    return this;
  }

  async limit(limit) {
    return this;
  }

  async offset(offset) {
    return this;
  }

  async orderBy(...conditions) {
    return this;
  }

  async all() {
    // 这里应该返回实际的数据
    return { results: [] };
  }

  async get() {
    return { results: [] };
  }

  async insert(table) {
    return this;
  }

  async values(data) {
    return this;
  }

  async returning() {
    return { results: [{}] };
  }

  async update(table) {
    return this;
  }

  async set(data) {
    return this;
  }

  async delete() {
    return this;
  }
}

// 标签聚合服务
class TagAggregationService {
  parseTopics(topicsJson) {
    if (!topicsJson) return [];
    
    try {
      const topics = JSON.parse(topicsJson);
      return Array.isArray(topics) ? topics.map(t => String(t).trim()).filter(Boolean) : [];
    } catch (error) {
      console.warn('[WARN] 解析主题JSON失败:', error);
      return [];
    }
  }

  parseKeywords(keywordsString) {
    if (!keywordsString) return [];
    
    try {
      return keywordsString
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
    } catch (error) {
      console.warn('[WARN] 解析关键词字符串失败:', error);
      return [];
    }
  }

  async processContentTags(processedContentId, db) {
    console.log(`[TAG] 开始处理内容标签聚合，processedContentId: ${processedContentId}`);

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
        console.warn(`[WARN] 未找到处理后的内容，ID: ${processedContentId}`);
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
        console.warn(`[WARN] 未找到条目信息，entryId: ${processedContent.entryId}`);
        return;
      }

      const userId = entryInfo.userId;

      // 解析主题和关键词
      const topics = this.parseTopics(processedContent.topics);
      const keywords = this.parseKeywords(processedContent.keywords);

      console.log(`[PROMPT] 解析标签 - 主题: ${topics.length}, 关键词: ${keywords.length}`);

      // 处理主题聚合
      for (const topicName of topics) {
        await this.processTopic(userId, topicName, processedContent.entryId, processedContent.id, db);
      }

      // 处理关键词聚合
      for (const keywordName of keywords) {
        await this.processKeyword(userId, keywordName, processedContent.entryId, processedContent.id, db);
      }

      console.log(`[SUCCESS] 内容标签聚合处理完成，ID: ${processedContentId}`);
    } catch (error) {
      console.error('[ERROR] 处理内容标签聚合失败:', error);
      throw error;
    }
  }

  async processTopic(userId, topicName, entryId, processedContentId, db) {
    try {
      // 检查主题是否已存在
      const [existingTopic] = await db
        .select()
        .from(userTopics)
        .where(and(eq(userTopics.userId, userId), eq(userTopics.topicName, topicName)))
        .limit(1);

      let topicId;
      
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
        
        console.log(`[UPDATE] 更新主题: ${topicName}, 计数: ${existingTopic.entryCount + 1}`);
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
        console.log(`[CREATE] 创建新主题: ${topicName}`);
      }

      // 创建主题与条目的关联
      await this.createTopicRelation(userId, topicId, entryId, processedContentId, db);
    } catch (error) {
      console.error(`[ERROR] 处理主题聚合失败: ${topicName}`, error);
      throw error;
    }
  }

  async processKeyword(userId, keywordName, entryId, processedContentId, db) {
    try {
      // 检查关键词是否已存在
      const [existingKeyword] = await db
        .select()
        .from(userKeywords)
        .where(and(eq(userKeywords.userId, userId), eq(userKeywords.keywordName, keywordName)))
        .limit(1);

      let keywordId;
      
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
        
        console.log(`[UPDATE] 更新关键词: ${keywordName}, 计数: ${existingKeyword.entryCount + 1}`);
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
        console.log(`[CREATE] 创建新关键词: ${keywordName}`);
      }

      // 创建关键词与条目的关联
      await this.createKeywordRelation(userId, keywordId, entryId, processedContentId, db);
    } catch (error) {
      console.error(`[ERROR] 处理关键词聚合失败: ${keywordName}`, error);
      throw error;
    }
  }

  async createTopicRelation(userId, topicId, entryId, processedContentId, db) {
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
      console.error(`[ERROR] 创建主题关联失败: topicId=${topicId}, entryId=${entryId}`, error);
      throw error;
    }
  }

  async createKeywordRelation(userId, keywordId, entryId, processedContentId, db) {
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
      console.error(`[ERROR] 创建关键词关联失败: keywordId=${keywordId}, entryId=${entryId}`, error);
      throw error;
    }
  }
}

// 这个脚本需要在实际的Worker环境中运行，或者使用 wrangler d1 execute
console.log('标签聚合脚本已准备就绪');
console.log('请在Worker环境中运行，或使用 wrangler d1 execute 执行具体的数据库操作');