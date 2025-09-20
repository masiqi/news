// 用户编辑隔离服务
// 管理用户编辑隔离，确保用户编辑不影响其他用户

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { userStorageRefs, contentLibrary, processedContents, rssEntries } from '../db/schema';
import { R2Service } from './r2.service';
import { WebDAVService } from './webdav.service';
import type { WebDAVAuthUser } from '../middleware/webdav-auth.middleware';
import { createHash } from 'crypto';

// 编辑操作类型
export type EditOperation = 'create' | 'update' | 'delete' | 'move' | 'copy';

// 编辑隔离事件接口
export interface EditIsolationEvent {
  id: string;
  userId: string;
  operation: EditOperation;
  originalPath: string;
  targetPath?: string;
  originalHash?: string;
  newHash?: string;
  fileSize?: number;
  timestamp: Date;
  source: 'webdav' | 'api' | 'system';
  metadata?: Record<string, any>;
}

// 用户编辑副本接口
export interface UserEditCopy {
  id: string;
  userId: string;
  originalContentHash: string;
  copyContentHash: string;
  originalPath: string;
  copyPath: string;
  entryId?: number;
  fileSize: number;
  createdAt: Date;
  lastModifiedAt: Date;
  isDirty: boolean;
  parentCopyId?: string; // 支持副本链
}

// 编辑隔离统计接口
export interface EditIsolationStats {
  totalEdits: number;
  activeCopies: number;
  totalStorageUsed: number;
  editsByOperation: Record<EditOperation, number>;
  recentEdits: EditIsolationEvent[];
  dirtyCopies: number;
}

export class UserEditIsolationService {
  private db: any;
  private r2Service: R2Service;
  private webdavService: WebDAVService;

  constructor(db: any, env: any) {
    this.db = drizzle(db);
    this.r2Service = new R2Service(env);
    this.webdavService = new WebDAVService(env);
  }

  /**
   * 检测用户编辑操作并创建隔离副本
   */
  async detectAndCreateEditCopy(
    authUser: WebDAVAuthUser,
    path: string,
    operation: EditOperation,
    content?: ArrayBuffer,
    targetPath?: string
  ): Promise<{ success: boolean; copyPath?: string; error?: string }> {
    console.log(`[EDIT_ISOLATION] 检测编辑操作: 用户${authUser.id}, 路径: ${path}, 操作: ${operation}`);

    try {
      // 检查是否为已分发的内容文件
      const storageRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, authUser.id),
            eq(sql`LOWER(${userStorageRefs.userPath})`, path.toLowerCase())
          )
        )
        .limit(1)
        .get();

      if (!storageRef) {
        console.log(`[EDIT_ISOLATION] 非分发内容文件，跳过隔离处理: ${path}`);
        return { success: true };
      }

      // 检查是否已存在编辑副本
      const existingCopy = await this.getUserEditCopy(authUser.id, path);
      if (existingCopy) {
        console.log(`[EDIT_ISOLATION] 已存在编辑副本，更新副本: ${existingCopy.copyPath}`);
        return await this.updateExistingCopy(authUser, existingCopy, operation, content, targetPath);
      }

      // 创建新的编辑副本
      return await this.createNewEditCopy(authUser, storageRef, operation, content, targetPath);

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 检测编辑操作失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户的编辑副本
   */
  private async getUserEditCopy(userId: string, originalPath: string): Promise<UserEditCopy | null> {
    try {
      // 这里假设有一个user_edit_copies表，如果没有则需要创建
      // 由于我们还没有这个表，暂时使用userStorageRefs来检查
      const modifiedRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.userPath, originalPath),
            eq(userStorageRefs.isModified, true)
          )
        )
        .limit(1)
        .get();

      if (modifiedRef) {
        return {
          id: `copy-${modifiedRef.id}`,
          userId: userId,
          originalContentHash: modifiedRef.contentHash,
          copyContentHash: modifiedRef.contentHash, // 实际应该有新的哈希
          originalPath: modifiedRef.userPath,
          copyPath: modifiedRef.userPath, // 实际应该有副本路径
          entryId: modifiedRef.entryId,
          fileSize: modifiedRef.fileSize || 0,
          createdAt: modifiedRef.createdAt,
          lastModifiedAt: modifiedRef.modifiedAt || modifiedRef.createdAt,
          isDirty: true
        };
      }

      return null;
    } catch (error) {
      console.error(`[EDIT_ISOLATION] 获取用户编辑副本失败:`, error);
      return null;
    }
  }

  /**
   * 更新现有编辑副本
   */
  private async updateExistingCopy(
    authUser: WebDAVAuthUser,
    existingCopy: UserEditCopy,
    operation: EditOperation,
    content?: ArrayBuffer,
    targetPath?: string
  ): Promise<{ success: boolean; copyPath?: string; error?: string }> {
    try {
      const newHash = content ? this.generateContentHash(content) : existingCopy.copyContentHash;
      const fileSize = content?.byteLength || existingCopy.fileSize;

      // 更新编辑记录
      await this.logEditEvent({
        id: this.generateEventId(),
        userId: authUser.id,
        operation,
        originalPath: existingCopy.originalPath,
        targetPath: targetPath || existingCopy.copyPath,
        originalHash: existingCopy.originalContentHash,
        newHash: newHash,
        fileSize: fileSize,
        timestamp: new Date(),
        source: 'webdav',
        metadata: {
          copyId: existingCopy.id,
          isUpdate: true
        }
      });

      // 更新存储引用
      await this.db
        .update(userStorageRefs)
        .set({
          isModified: true,
          modifiedAt: new Date(),
          fileSize: fileSize,
          accessCount: sql`${userStorageRefs.accessCount} + 1`,
          lastAccessedAt: new Date()
        })
        .where(
          and(
            eq(userStorageRefs.userId, authUser.id),
            eq(userStorageRefs.userPath, existingCopy.originalPath)
          )
        );

      console.log(`[EDIT_ISOLATION] 编辑副本更新成功: ${existingCopy.copyPath}`);
      return { success: true, copyPath: existingCopy.copyPath };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 更新编辑副本失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建新的编辑副本
   */
  private async createNewEditCopy(
    authUser: WebDAVAuthUser,
    storageRef: any,
    operation: EditOperation,
    content?: ArrayBuffer,
    targetPath?: string
  ): Promise<{ success: boolean; copyPath?: string; error?: string }> {
    try {
      // 生成副本路径
      const copyPath = this.generateCopyPath(authUser, storageRef.userPath, operation);
      
      // 如果是删除操作，不需要创建副本文件
      if (operation === 'delete') {
        await this.handleDeleteOperation(authUser, storageRef, copyPath);
        return { success: true, copyPath };
      }

      // 获取原始内容或使用提供的内容
      let fileContent: ArrayBuffer;
      if (content) {
        fileContent = content;
      } else {
        // 从共享内容池获取原始内容
        const originalContent = await this.r2Service.getObject(storageRef.contentHash);
        if (!originalContent) {
          throw new Error('原始内容不存在');
        }
        fileContent = originalContent.arrayBuffer();
      }

      // 创建副本文件
      const copyContentHash = this.generateContentHash(fileContent);
      await this.r2Service.putObject(copyContentHash, fileContent);

      // 更新用户存储引用，标记为已修改
      await this.db
        .update(userStorageRefs)
        .set({
          isModified: true,
          modifiedAt: new Date(),
          fileSize: fileContent.byteLength,
          userPath: copyPath, // 更新路径
          accessCount: sql`${userStorageRefs.accessCount} + 1`,
          lastAccessedAt: new Date()
        })
        .where(eq(userStorageRefs.id, storageRef.id));

      // 记录编辑事件
      await this.logEditEvent({
        id: this.generateEventId(),
        userId: authUser.id,
        operation,
        originalPath: storageRef.userPath,
        targetPath: copyPath,
        originalHash: storageRef.contentHash,
        newHash: copyContentHash,
        fileSize: fileContent.byteLength,
        timestamp: new Date(),
        source: 'webdav',
        metadata: {
          copyPath: copyPath,
          storageRefId: storageRef.id
        }
      });

      console.log(`[EDIT_ISOLATION] 创建编辑副本成功: ${copyPath}`);
      return { success: true, copyPath };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 创建编辑副本失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理删除操作
   */
  private async handleDeleteOperation(
    authUser: WebDAVAuthUser,
    storageRef: any,
    copyPath: string
  ): Promise<void> {
    // 标记为已删除但不实际删除，保持隔离
    await this.db
      .update(userStorageRefs)
      .set({
        isModified: true,
        modifiedAt: new Date(),
        userPath: `${copyPath}.deleted`, // 标记为删除
        accessCount: sql`${userStorageRefs.accessCount} + 1`,
        lastAccessedAt: new Date()
      })
      .where(eq(userStorageRefs.id, storageRef.id));

    console.log(`[EDIT_ISOLATION] 标记文件为已删除: ${storageRef.userPath} -> ${copyPath}.deleted`);
  }

  /**
   * 生成副本路径
   */
  private generateCopyPath(
    authUser: WebDAVAuthUser,
    originalPath: string,
    operation: EditOperation
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = originalPath.includes('.') ? originalPath.split('.').pop() : 'md';
    
    const basePath = originalPath.replace(/\.[^/.]+$/, ''); // 移除扩展名
    return `${basePath}.edit-${timestamp}-${randomId}.${extension}`;
  }

  /**
   * 生成内容哈希
   */
  private generateContentHash(content: ArrayBuffer): string {
    return createHash('sha256').update(Buffer.from(content)).digest('hex');
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 记录编辑事件
   */
  private async logEditEvent(event: EditIsolationEvent): Promise<void> {
    try {
      // 这里假设有一个edit_isolation_events表
      // 由于还没有这个表，暂时记录到控制台
      console.log(`[EDIT_ISOLATION_EVENT] ${event.operation} by user ${event.userId}: ${event.originalPath} -> ${event.targetPath || 'N/A'}`);
    } catch (error) {
      console.error(`[EDIT_ISOLATION] 记录编辑事件失败:`, error);
    }
  }

  /**
   * 获取用户编辑统计信息
   */
  async getUserEditStats(userId: string): Promise<EditIsolationStats> {
    try {
      // 获取用户的编辑记录
      const modifiedRefs = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.isModified, true)
          )
        )
        .orderBy(desc(userStorageRefs.modifiedAt))
        .limit(50);

      const totalEdits = modifiedRefs.length;
      const totalStorageUsed = modifiedRefs.reduce((sum, ref) => sum + (ref.fileSize || 0), 0);
      const dirtyCopies = modifiedRefs.filter(ref => ref.isModified).length;

      // 统计操作类型（基于路径模式）
      const editsByOperation: Record<EditOperation, number> = {
        create: 0,
        update: 0,
        delete: 0,
        move: 0,
        copy: 0
      };

      modifiedRefs.forEach(ref => {
        if (ref.userPath.includes('.edit-')) {
          editsByOperation.update++;
        } else if (ref.userPath.includes('.deleted')) {
          editsByOperation.delete++;
        } else {
          editsByOperation.create++;
        }
      });

      const recentEdits: EditIsolationEvent[] = modifiedRefs.slice(0, 10).map(ref => ({
        id: `event-${ref.id}`,
        userId: userId,
        operation: this.inferOperationFromPath(ref.userPath),
        originalPath: ref.userPath,
        timestamp: ref.modifiedAt || ref.createdAt,
        source: 'webdav' as const,
        fileSize: ref.fileSize || 0
      }));

      return {
        totalEdits,
        activeCopies: totalEdits,
        totalStorageUsed,
        editsByOperation,
        recentEdits,
        dirtyCopies
      };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 获取用户编辑统计失败:`, error);
      return {
        totalEdits: 0,
        activeCopies: 0,
        totalStorageUsed: 0,
        editsByOperation: { create: 0, update: 0, delete: 0, move: 0, copy: 0 },
        recentEdits: [],
        dirtyCopies: 0
      };
    }
  }

  /**
   * 根据路径推断操作类型
   */
  private inferOperationFromPath(path: string): EditOperation {
    if (path.includes('.edit-')) {
      return 'update';
    } else if (path.includes('.deleted')) {
      return 'delete';
    } else if (path.includes('.move-')) {
      return 'move';
    } else if (path.includes('.copy-')) {
      return 'copy';
    } else {
      return 'create';
    }
  }

  /**
   * 清理过期的编辑副本
   */
  async cleanupExpiredCopies(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<{ cleaned: number; errors: string[] }> {
    console.log(`[EDIT_ISOLATION] 开始清理过期编辑副本，最大年龄: ${maxAge}ms`);

    try {
      const cutoffDate = new Date(Date.now() - maxAge);
      const errors: string[] = [];
      let cleaned = 0;

      // 查找过期的修改记录
      const expiredRefs = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.isModified, true),
            sql`${userStorageRefs.modifiedAt} < ${cutoffDate.getTime()}`
          )
        );

      for (const ref of expiredRefs) {
        try {
          // 检查是否有其他用户引用相同的内容
          const otherRefs = await this.db
            .select()
            .from(userStorageRefs)
            .where(
              and(
                eq(userStorageRefs.contentHash, ref.contentHash),
                eq(userStorageRefs.isModified, false)
              )
            )
            .limit(1);

          if (otherRefs.length === 0) {
            // 没有其他用户引用，安全删除
            await this.db
              .delete(userStorageRefs)
              .where(eq(userStorageRefs.id, ref.id));
            cleaned++;
          } else {
            // 有其他用户引用，重置为未修改状态
            await this.db
              .update(userStorageRefs)
              .set({
                isModified: false,
                modifiedAt: null,
                userPath: ref.userPath.replace(/\.edit-.*?\./, '.') // 恢复原始路径
              })
              .where(eq(userStorageRefs.id, ref.id));
            cleaned++;
          }

        } catch (error) {
          console.error(`[EDIT_ISOLATION] 清理编辑副本失败:`, error);
          errors.push(`清理引用 ${ref.id} 失败: ${error.message}`);
        }
      }

      console.log(`[EDIT_ISOLATION] 清理完成，处理了 ${cleaned} 个记录`);
      return { cleaned, errors };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 清理过期编辑副本失败:`, error);
      return { cleaned: 0, errors: [error.message] };
    }
  }

  /**
   * 检查用户是否有权限编辑特定内容
   */
  async canEditContent(userId: string, contentHash: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      // 检查用户是否有该内容的存储引用
      const userRef = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.contentHash, contentHash)
          )
        )
        .limit(1)
        .get();

      if (!userRef) {
        return { canEdit: false, reason: '用户没有该内容的访问权限' };
      }

      // 检查内容是否被锁定
      // 这里可以添加更多的业务逻辑检查

      return { canEdit: true };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 检查编辑权限失败:`, error);
      return { canEdit: false, reason: '权限检查失败' };
    }
  }

  /**
   * 获取用户的编辑历史
   */
  async getUserEditHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ events: EditIsolationEvent[]; total: number }> {
    try {
      const modifiedRefs = await this.db
        .select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.isModified, true)
          )
        )
        .orderBy(desc(userStorageRefs.modifiedAt))
        .limit(limit)
        .offset(offset);

      const total = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, userId),
            eq(userStorageRefs.isModified, true)
          )
        )
        .get();

      const events: EditIsolationEvent[] = modifiedRefs.map(ref => ({
        id: `event-${ref.id}`,
        userId: userId,
        operation: this.inferOperationFromPath(ref.userPath),
        originalPath: ref.userPath,
        timestamp: ref.modifiedAt || ref.createdAt,
        source: 'webdav' as const,
        fileSize: ref.fileSize || 0,
        metadata: {
          storageRefId: ref.id,
          entryId: ref.entryId
        }
      }));

      return { events, total: total?.count || 0 };

    } catch (error) {
      console.error(`[EDIT_ISOLATION] 获取用户编辑历史失败:`, error);
      return { events: [], total: 0 };
    }
  }
}