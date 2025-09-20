// src/services/shared-content-pool.service.ts
// 共享内容池服务 - 实现写时复制(Copy-on-Write)的分层存储

import { drizzle } from 'drizzle-orm/d1';
import { 
  contentLibrary, 
  userStorageRefs, 
  storageStats,
  rssEntries 
} from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { R2Service } from './r2.service';

interface SharedContent {
  contentHash: string;
  originalPath: string;
  metadata: {
    title: string;
    source: string;
    publishedAt: Date;
    processingTime: number;
    modelUsed: string;
    wordCount: number;
    entryId: number;
  };
  referenceCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
  fileSize: number;
}

interface UserStorageRef {
  id: string;
  userId: string;
  entryId: number;
  contentHash: string;
  userPath: string;
  isModified: boolean;
  currentHash?: string;
  modifiedAt?: Date;
  fileSize: number;
  createdAt: Date;
}

interface StorageStats {
  totalSharedFiles: number;
  totalUserFiles: number;
  totalStorageUsed: number;
  sharedContentSavings: number; // 节省的存储空间
  compressionRatio: number;
  lastCleanupAt: Date;
}

export class SharedContentPoolService {
  private readonly SHARED_CONTENT_PREFIX = 'shared-content/';
  private readonly USER_STORAGE_PREFIX = 'users/';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(
    private db: any,
    private r2Service: R2Service
  ) {
    this.db = drizzle(db);
  }

  /**
   * 存储内容到共享池
   */
  async storeToSharedPool(
    contentHash: string,
    markdownContent: string,
    metadata: SharedContent['metadata']
  ): Promise<SharedContent> {
    try {
      console.log(`存储内容到共享池: ${contentHash}`);

      // 检查是否已存在
      const existing = await this.db
        .select()
        .from(contentLibrary)
        .where(eq(contentLibrary.contentHash, contentHash))
        .limit(1)
        .get();

      if (existing) {
        console.log(`内容已存在于共享池: ${contentHash}`);
        return {
          contentHash: existing.contentHash,
          originalPath: existing.storagePath,
          metadata: JSON.parse(existing.metadata),
          referenceCount: existing.referenceCount,
          createdAt: existing.createdAt,
          lastAccessedAt: existing.lastAccessedAt,
          fileSize: existing.fileSize
        };
      }

      // 存储文件到R2
      const storagePath = `${this.SHARED_CONTENT_PREFIX}${contentHash}/original.md`;
      const metadataPath = `${this.SHARED_CONTENT_PREFIX}${contentHash}/metadata.json`;
      
      const contentBuffer = new TextEncoder().encode(markdownContent);
      const metadataBuffer = new TextEncoder().encode(JSON.stringify(metadata, null, 2));

      await this.r2Service.uploadFile(storagePath, contentBuffer, 'text/markdown');
      await this.r2Service.uploadFile(metadataPath, metadataBuffer, 'application/json');

      // 创建数据库记录
      const newRecord = await this.db
        .insert(contentLibrary)
        .values({
          contentHash: contentHash,
          storagePath: storagePath,
          metadata: JSON.stringify(metadata),
          referenceCount: 0, // 初始为0，等用户引用时增加
          fileSize: contentBuffer.length,
          createdAt: new Date(),
          lastAccessedAt: new Date()
        })
        .returning()
        .get();

      console.log(`内容存储成功: ${contentHash}, 路径: ${storagePath}`);

      return {
        contentHash: newRecord.contentHash,
        originalPath: newRecord.storagePath,
        metadata,
        referenceCount: 0,
        createdAt: newRecord.createdAt,
        lastAccessedAt: newRecord.lastAccessedAt,
        fileSize: newRecord.fileSize
      };

    } catch (error) {
      console.error('存储到共享池失败:', error);
      throw new Error(`共享池存储失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 为用户创建内容副本（初始状态）
   */
  async createUserCopy(
    userId: string,
    entryId: number,
    contentHash: string
  ): Promise<UserStorageRef> {
    try {
      console.log(`为用户 ${userId} 创建内容副本: ${contentHash}`);

      // 检查是否已存在副本
      const existingRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.entryId, entryId)
          )
        )
        .limit(1)
        .get();

      if (existingRef) {
        console.log(`用户副本已存在: ${userId} - ${entryId}`);
        return {
          id: existingRef.id,
          userId: existingRef.userId,
          entryId: existingRef.entryId,
          contentHash: existingRef.contentHash,
          userPath: existingRef.userPath,
          isModified: existingRef.isModified,
          currentHash: existingRef.currentHash,
          modifiedAt: existingRef.modifiedAt,
          fileSize: existingRef.fileSize,
          createdAt: existingRef.createdAt
        };
      }

      // 获取共享内容信息
      const sharedContent = await this.db
        .select()
        .from(contentLibrary)
        .where(eq(contentLibrary.contentHash, contentHash))
        .limit(1)
        .get();

      if (!sharedContent) {
        throw new Error(`共享内容不存在: ${contentHash}`);
      }

      // 创建用户存储路径
      const userPath = `${this.USER_STORAGE_PREFIX}${userId}/notes/${entryId}.md`;
      
      // 从共享内容复制到用户空间
      const sharedContentBuffer = await this.r2Service.downloadFile(sharedContent.storagePath);
      await this.r2Service.uploadFile(userPath, sharedContentBuffer, 'text/markdown');

      // 创建用户存储引用记录
      const userRef = await this.db
        .insert(userStorageRefs)
        .values({
          userId: userId,
          entryId: entryId,
          contentHash: contentHash,
          userPath: userPath,
          isModified: false,
          currentHash: contentHash,
          fileSize: sharedContentBuffer.length,
          createdAt: new Date()
        })
        .returning()
        .get();

      // 更新共享内容的引用计数
      await this.db
        .update(contentLibrary)
        .set({ 
          referenceCount: sql`${contentLibrary.referenceCount} + 1`,
          lastAccessedAt: new Date()
        })
        .where(eq(contentLibrary.contentHash, contentHash));

      console.log(`用户副本创建成功: ${userId} - ${entryId}`);

      return {
        id: userRef.id,
        userId: userRef.userId,
        entryId: userRef.entryId,
        contentHash: userRef.contentHash,
        userPath: userRef.userPath,
        isModified: userRef.isModified,
        currentHash: userRef.currentHash,
        modifiedAt: userRef.modifiedAt,
        fileSize: userRef.fileSize,
        createdAt: userRef.createdAt
      };

    } catch (error) {
      console.error(`创建用户副本失败: ${userId} - ${entryId}`, error);
      throw new Error(`用户副本创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理用户内容更新（写时复制逻辑）
   */
  async handleUserContentUpdate(
    userId: string,
    entryId: number,
    newContent: string
  ): Promise<{ isNewCopy: boolean; path: string }> {
    try {
      console.log(`处理用户内容更新: ${userId} - ${entryId}`);

      // 计算新内容的哈希
      const newHash = await this.computeContentHash(newContent);

      // 获取当前用户引用
      const userRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.entryId, entryId)
          )
        )
        .limit(1)
        .get();

      if (!userRef) {
        throw new Error(`用户存储引用不存在: ${userId} - ${entryId}`);
      }

      // 检查内容是否真的发生了变化
      if (userRef.currentHash === newHash) {
        console.log(`内容未发生变化: ${userId} - ${entryId}`);
        return { isNewCopy: false, path: userRef.userPath };
      }

      // 如果之前是共享状态，现在需要创建独立副本
      if (!userRef.isModified) {
        console.log(`创建用户独立副本: ${userId} - ${entryId}`);
        
        // 标记为已修改
        await this.db
          .update(userStorageRefs)
          .set({
            isModified: true,
            currentHash: newHash,
            modifiedAt: new Date()
          })
          .where(eq(userStorageRefs.id, userRef.id));

        // 减少共享内容的引用计数
        await this.db
          .update(contentLibrary)
          .set({ 
            referenceCount: sql`${contentLibrary.referenceCount} - 1`
          })
          .where(eq(contentLibrary.contentHash, userRef.contentHash));
      }

      // 保存新内容到用户空间
      const contentBuffer = new TextEncoder().encode(newContent);
      await this.r2Service.uploadFile(userRef.userPath, contentBuffer, 'text/markdown');

      // 更新用户引用记录
      await this.db
        .update(userStorageRefs)
        .set({
          currentHash: newHash,
          fileSize: contentBuffer.length,
          modifiedAt: new Date()
        })
        .where(eq(userStorageRefs.id, userRef.id));

      console.log(`用户内容更新成功: ${userId} - ${entryId}, 新大小: ${contentBuffer.length} 字节`);

      return { isNewCopy: !userRef.isModified, path: userRef.userPath };

    } catch (error) {
      console.error(`处理用户内容更新失败: ${userId} - ${entryId}`, error);
      throw new Error(`内容更新处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取用户内容
   */
  async getUserContent(userId: string, entryId: number): Promise<{ content: string; path: string; isModified: boolean }> {
    try {
      const userRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.entryId, entryId)
          )
        )
        .limit(1)
        .get();

      if (!userRef) {
        throw new Error(`用户存储引用不存在: ${userId} - ${entryId}`);
      }

      const contentBuffer = await this.r2Service.downloadFile(userRef.userPath);
      const content = new TextDecoder().decode(contentBuffer);

      return {
        content,
        path: userRef.userPath,
        isModified: userRef.isModified
      };

    } catch (error) {
      console.error(`获取用户内容失败: ${userId} - ${entryId}`, error);
      throw new Error(`获取用户内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 清理孤立的共享内容
   */
  async cleanupOrphanedContent(): Promise<{ removed: number; spaceFreed: number }> {
    try {
      console.log('开始清理孤立共享内容');

      // 查找引用计数为0的共享内容
      const orphanedContent = await this.db
        .select()
        .from(contentLibrary)
        .where(eq(contentLibrary.referenceCount, 0))
        .all();

      let removed = 0;
      let spaceFreed = 0;

      for (const content of orphanedContent) {
        try {
          // 删除R2中的文件
          await this.r2Service.deleteFile(content.storagePath);
          
          // 删除元数据文件
          const metadataPath = content.storagePath.replace('/original.md', '/metadata.json');
          await this.r2Service.deleteFile(metadataPath);

          // 删除数据库记录
          await this.db
            .delete(contentLibrary)
            .where(eq(contentLibrary.contentHash, content.contentHash));

          removed++;
          spaceFreed += content.fileSize;

          console.log(`清理孤立内容: ${content.contentHash}, 释放空间: ${content.fileSize} 字节`);

        } catch (cleanupError) {
          console.error(`清理内容失败: ${content.contentHash}`, cleanupError);
        }
      }

      console.log(`清理完成，移除 ${removed} 个孤立内容，释放 ${spaceFreed} 字节`);

      return { removed, spaceFreed };

    } catch (error) {
      console.error('清理孤立内容失败:', error);
      return { removed: 0, spaceFreed: 0 };
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // 统计共享内容
      const sharedStats = await this.db
        .select({
          totalFiles: sql<number>`count(*)`,
          totalSize: sql<number>`sum(fileSize)`,
          totalReferences: sql<number>`sum(referenceCount)`
        })
        .from(contentLibrary)
        .get();

      // 统计用户存储
      const userStats = await this.db
        .select({
          totalFiles: sql<number>`count(*)`,
          totalSize: sql<number>`sum(fileSize)`,
          modifiedFiles: sql<number>`sum(CASE WHEN isModified = 1 THEN 1 ELSE 0 END)`
        })
        .from(userStorageRefs)
        .get();

      const totalSharedFiles = sharedStats?.totalFiles || 0;
      const totalUserFiles = userStats?.totalFiles || 0;
      const sharedStorageSize = sharedStats?.totalSize || 0;
      const userStorageSize = userStats?.totalSize || 0;

      // 计算节省的空间（如果没有共享，每个用户都需要独立存储）
      const potentialTotalSize = totalUserFiles * sharedStorageSize;
      const actualTotalSize = sharedStorageSize + userStorageSize;
      const savings = Math.max(0, potentialTotalSize - actualTotalSize);

      return {
        totalSharedFiles,
        totalUserFiles,
        totalStorageUsed: actualTotalSize,
        sharedContentSavings: savings,
        compressionRatio: totalUserFiles > 0 ? savings / potentialTotalSize : 0,
        lastCleanupAt: new Date()
      };

    } catch (error) {
      console.error('获取存储统计失败:', error);
      return {
        totalSharedFiles: 0,
        totalUserFiles: 0,
        totalStorageUsed: 0,
        sharedContentSavings: 0,
        compressionRatio: 0,
        lastCleanupAt: new Date()
      };
    }
  }

  /**
   * 计算内容哈希
   */
  private async computeContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}