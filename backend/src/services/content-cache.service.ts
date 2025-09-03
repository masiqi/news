// src/services/content-cache.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents, userNotes } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { RssEntry, NewRssEntry, ProcessedContent, NewProcessedContent, UserNote, NewUserNote } from '../db/types';

export class ContentCacheService {
  constructor(private db: any) {}

  /**
   * 检查RSS条目是否已存在
   * @param sourceId RSS源ID
   * @param guid 条目唯一标识
   * @returns 已存在的条目或null
   */
  async getEntryByGuid(sourceId: number, guid: string): Promise<RssEntry | null> {
    const result = await this.db.select().from(rssEntries)
      .where(and(eq(rssEntries.sourceId, sourceId), eq(rssEntries.guid, guid)))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 创建新的RSS条目
   * @param entry RSS条目数据
   * @returns 创建的条目
   */
  async createEntry(entry: NewRssEntry): Promise<RssEntry> {
    const result = await this.db.insert(rssEntries).values(entry).returning();
    return result[0];
  }

  /**
   * 标记条目为已处理
   * @param entryId 条目ID
   * @returns 更新后的条目
   */
  async markEntryAsProcessed(entryId: number): Promise<RssEntry | null> {
    const result = await this.db.update(rssEntries)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(rssEntries.id, entryId))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 标记条目处理失败
   * @param entryId 条目ID
   * @param errorMessage 错误信息
   * @returns 更新后的条目
   */
  async markEntryAsFailed(entryId: number, errorMessage: string): Promise<RssEntry | null> {
    const result = await this.db.update(rssEntries)
      .set({ 
        processed: false, 
        processedAt: new Date(),
        // 注意：我们需要在schema中添加错误信息字段
      })
      .where(eq(rssEntries.id, entryId))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 增加条目处理失败次数
   * @param entryId 条目ID
   * @returns 更新后的条目
   */
  async incrementFailureCount(entryId: number): Promise<RssEntry | null> {
    const entry = await this.db.select().from(rssEntries).where(eq(rssEntries.id, entryId)).limit(1);
    if (entry.length === 0) return null;
    
    const failureCount = (entry[0].failureCount || 0) + 1;
    
    const result = await this.db.update(rssEntries)
      .set({ failureCount })
      .where(eq(rssEntries.id, entryId))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 获取已处理的内容
   * @param entryId 条目ID
   * @returns 已处理的内容或null
   */
  async getProcessedContentByEntryId(entryId: number): Promise<ProcessedContent | null> {
    const result = await this.db.select().from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 创建已处理的内容
   * @param content 已处理的内容数据
   * @returns 创建的内容
   */
  async createProcessedContent(content: NewProcessedContent): Promise<ProcessedContent> {
    const result = await this.db.insert(processedContents).values(content).returning();
    return result[0];
  }

  /**
   * 为用户创建个性化笔记
   * @param note 用户笔记数据
   * @returns 创建的笔记
   */
  async createUserNote(note: NewUserNote): Promise<UserNote> {
    const result = await this.db.insert(userNotes).values(note).returning();
    return result[0];
  }

  /**
   * 获取用户的笔记
   * @param userId 用户ID
   * @param entryId 条目ID
   * @returns 用户笔记或null
   */
  async getUserNote(userId: number, entryId: number): Promise<UserNote | null> {
    const result = await this.db.select().from(userNotes)
      .where(and(eq(userNotes.userId, userId), eq(userNotes.entryId, entryId)))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 获取用户的所有笔记
   * @param userId 用户ID
   * @param limit 限制数量
   * @returns 用户笔记列表
   */
  async getUserNotes(userId: number, limit: number = 50): Promise<UserNote[]> {
    return await this.db.select().from(userNotes)
      .where(eq(userNotes.userId, userId))
      .orderBy(desc(userNotes.createdAt))
      .limit(limit);
  }

  /**
   * 更新用户笔记的阅读状态
   * @param userId 用户ID
   * @param entryId 条目ID
   * @param readStatus 阅读状态
   * @returns 更新后的笔记
   */
  async updateUserNoteReadStatus(userId: number, entryId: number, readStatus: number): Promise<UserNote | null> {
    const result = await this.db.update(userNotes)
      .set({ readStatus, updatedAt: new Date() })
      .where(and(eq(userNotes.userId, userId), eq(userNotes.entryId, entryId)))
      .returning();
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 处理RSS条目（检查缓存，如未处理则创建新条目）
   * @param sourceId RSS源ID
   * @param guid 条目唯一标识
   * @param entryData 条目数据
   * @returns 处理后的条目
   */
  async processRssEntry(sourceId: number, guid: string, entryData: Omit<NewRssEntry, 'sourceId' | 'guid'>): Promise<{
    entry: RssEntry;
    wasAlreadyProcessed: boolean;
  }> {
    // 检查条目是否已存在
    let entry = await this.getEntryByGuid(sourceId, guid);
    
    if (entry) {
      // 条目已存在，返回现有条目
      return {
        entry,
        wasAlreadyProcessed: entry.processed
      };
    } else {
      // 条目不存在，创建新条目
      const newEntry: NewRssEntry = {
        sourceId,
        guid,
        ...entryData
      };
      
      entry = await this.createEntry(newEntry);
      return {
        entry,
        wasAlreadyProcessed: false
      };
    }
  }

  /**
   * 缓存处理后的内容
   * @param entryId 条目ID
   * @param contentData 处理后的内容数据
   * @returns 处理后的内容
   */
  async cacheProcessedContent(entryId: number, contentData: Omit<NewProcessedContent, 'entryId'>): Promise<ProcessedContent> {
    const newContent: NewProcessedContent = {
      entryId,
      ...contentData
    };
    
    return await this.createProcessedContent(newContent);
  }

  /**
   * 为用户生成个性化内容（基于共享的处理结果）
   * @param userId 用户ID
   * @param entryId 条目ID
   * @param processedContentId 处理后的内容ID
   * @param personalizationData 个性化数据
   * @returns 用户笔记
   */
  async generatePersonalizedContent(
    userId: number, 
    entryId: number, 
    processedContentId: number,
    personalizationData: Omit<NewUserNote, 'userId' | 'entryId' | 'processedContentId'>
  ): Promise<UserNote> {
    // 检查用户是否已有该条目的笔记
    let userNote = await this.getUserNote(userId, entryId);
    
    if (userNote) {
      // 用户已有笔记，返回现有笔记
      return userNote;
    } else {
      // 用户没有笔记，创建新笔记
      const newUserNote: NewUserNote = {
        userId,
        entryId,
        processedContentId,
        ...personalizationData
      };
      
      return await this.createUserNote(newUserNote);
    }
  }
}