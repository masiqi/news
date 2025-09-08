// src/services/credential.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { syncCredentials, credentialLogs } from '../db/schema';
import { SyncCredential, CredentialLog } from '../types/credential.types';

/**
 * 凭证管理服务
 * 负责R2访问凭证的创建、管理、撤销和审计
 */
export class CredentialService {
  private db: ReturnType<typeof drizzle>;

  constructor(db: D1Database) {
    this.db = drizzle(db);
  }

  /**
   * 创建新的同步凭证
   */
  async createCredential(
    userId: number,
    name: string,
    cloudflareConfig: {
      bucket: string;
      region: string;
      endpoint?: string;
    }
  ): Promise<SyncCredential> {
    try {
      console.log(`为用户 ${userId} 创建同步凭证: ${name}`);

      // 生成R2凭证参数
      const credential = this.generateR2Credentials(userId, cloudflareConfig);
      
      // 保存凭证到数据库
      const [savedCredential] = await this.db.insert(syncCredentials).values({
        userId,
        name,
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
        region: credential.region,
        endpoint: credential.endpoint || `https://s3.${credential.region}.amazonaws.com/${cloudflareConfig.bucket}`,
        bucket: cloudflareConfig.bucket,
        prefix: `user-${userId}/`, // 用户专属前缀，确保数据隔离
        permissions: 'readonly',
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // 记录创建操作到审计日志
      await this.logCredentialOperation(savedCredential.id, userId, 'created');

      console.log(`同步凭证创建成功: ${savedCredential.id} for user ${userId}`);
      
      return {
        id: savedCredential.id.toString(),
        userId: userId.toString(),
        name: savedCredential.name,
        accessKeyId: savedCredential.accessKeyId,
        secretAccessKey: savedCredential.secretAccessKey,
        region: savedCredential.region,
        endpoint: savedCredential.endpoint,
        bucket: savedCredential.bucket,
        prefix: savedCredential.prefix,
        permissions: savedCredential.permissions as 'readonly',
        expiresAt: savedCredential.expiresAt,
        isActive: savedCredential.isActive,
        createdAt: savedCredential.createdAt,
        updatedAt: savedCredential.updatedAt
      };

    } catch (error) {
      console.error('创建同步凭证失败:', error);
      throw new Error(`创建同步凭证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取用户的所有同步凭证
   */
  async getUserCredentials(userId: number): Promise<SyncCredential[]> {
    try {
      console.log(`获取用户 ${userId} 的同步凭证列表`);

      const credentials = await this.db.select()
        .from(syncCredentials)
        .where(eq(syncCredentials.userId, userId))
        .orderBy(desc(syncCredentials.createdAt))
        .all();

      console.log(`找到 ${credentials.length} 个凭证 for user ${userId}`);
      
      return credentials.map(cred => ({
        id: cred.id.toString(),
        userId: cred.userId.toString(),
        name: cred.name,
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
        region: cred.region,
        endpoint: cred.endpoint,
        bucket: cred.bucket,
        prefix: cred.prefix,
        permissions: cred.permissions as 'readonly',
        expiresAt: cred.expiresAt,
        isActive: cred.isActive,
        lastUsedAt: cred.lastUsedAt,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt
      }));

    } catch (error) {
      console.error('获取用户同步凭证失败:', error);
      throw new Error(`获取用户同步凭证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 根据ID获取凭证详情
   */
  async getCredential(credentialId: number): Promise<SyncCredential | null> {
    try {
      console.log(`获取凭证详情: ${credentialId}`);

      const credential = await this.db.select()
        .from(syncCredentials)
        .where(eq(syncCredentials.id, credentialId))
        .get();

      if (!credential) {
        console.log(`凭证不存在: ${credentialId}`);
        return null;
      }

      console.log(`找到凭证: ${credentialId} - ${credential.name}`);
      
      return {
        id: credential.id.toString(),
        userId: credential.userId.toString(),
        name: credential.name,
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
        region: credential.region,
        endpoint: credential.endpoint,
        bucket: credential.bucket,
        prefix: credential.prefix,
        permissions: credential.permissions as 'readonly',
        expiresAt: credential.expiresAt,
        isActive: credential.isActive,
        lastUsedAt: credential.lastUsedAt,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt
      };

    } catch (error) {
      console.error('获取凭证详情失败:', error);
      throw new Error(`获取凭证详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 撤销同步凭证
   */
  async revokeCredential(credentialId: number, userId: number): Promise<boolean> {
    try {
      console.log(`撤销凭证: ${credentialId} for user ${userId}`);

      // 检查凭证是否存在且属于该用户
      const credential = await this.db.select()
        .from(syncCredentials)
        .where(and(
          eq(syncCredentials.id, credentialId),
          eq(syncCredentials.userId, userId)
        ))
        .get();

      if (!credential) {
        console.log(`凭证不存在或不属于用户: ${credentialId}`);
        return false;
      }

      // 标记凭证为非激活状态
      await this.db.update(syncCredentials)
        .set({ 
          isActive: false,
          updatedAt: new Date() 
        })
        .where(eq(syncCredentials.id, credentialId));

      // 记录撤销操作到审计日志
      await this.logCredentialOperation(credentialId, userId, 'revoked');

      console.log(`凭证撤销成功: ${credentialId}`);
      return true;

    } catch (error) {
      console.error('撤销同步凭证失败:', error);
      throw new Error(`撤销同步凭证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 重新生成凭证
   */
  async regenerateCredential(
    credentialId: number, 
    userId: number
  ): Promise<SyncCredential> {
    try {
      console.log(`重新生成凭证: ${credentialId} for user ${userId}`);

      // 获取原凭证信息
      const oldCredential = await this.db.select()
        .from(syncCredentials)
        .where(and(
          eq(syncCredentials.id, credentialId),
          eq(syncCredentials.userId, userId)
        ))
        .get();

      if (!oldCredential) {
        throw new Error(`凭证不存在或不属于用户: ${credentialId}`);
      }

      // 生成新的凭证密钥对
      const newCredentialData = this.generateR2Credentials(userId, {
        bucket: oldCredential.bucket,
        region: oldCredential.region
      });

      // 更新凭证信息
      const [updatedCredential] = await this.db.update(syncCredentials)
        .set({
          accessKeyId: newCredentialData.accessKeyId,
          secretAccessKey: newCredentialData.secretAccessKey,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(syncCredentials.id, credentialId))
        .returning();

      // 记录重新生成操作到审计日志
      await this.logCredentialOperation(credentialId, userId, 'regenerated');

      console.log(`凭证重新生成成功: ${credentialId} for user ${userId}`);

      return {
        id: updatedCredential.id.toString(),
        userId: updatedCredential.userId.toString(),
        name: updatedCredential.name,
        accessKeyId: updatedCredential.accessKeyId,
        secretAccessKey: updatedCredential.secretAccessKey,
        region: updatedCredential.region,
        endpoint: updatedCredential.endpoint,
        bucket: updatedCredential.bucket,
        prefix: updatedCredential.prefix,
        permissions: updatedCredential.permissions as 'readonly',
        expiresAt: updatedCredential.expiresAt,
        isActive: updatedCredential.isActive,
        lastUsedAt: updatedCredential.lastUsedAt,
        createdAt: updatedCredential.createdAt,
        updatedAt: updatedCredential.updatedAt
      };

    } catch (error) {
      console.error('重新生成同步凭证失败:', error);
      throw new Error(`重新生成同步凭证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 记录凭证使用情况
   */
  async recordCredentialUsage(
    credentialId: number,
    userId: number,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      // 更新最后使用时间
      await this.db.update(syncCredentials)
        .set({ 
          lastUsedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(syncCredentials.id, credentialId));

      // 记录访问操作到审计日志
      await this.logCredentialOperation(credentialId, userId, 'accessed', details);

      console.log(`记录凭证使用: ${credentialId} for user ${userId}`);

    } catch (error) {
      console.error('记录凭证使用失败:', error);
      // 不抛出错误，避免影响主要流程
    }
  }

  /**
   * 清理过期的凭证
   */
  async cleanupExpiredCredentials(): Promise<void> {
    try {
      console.log('开始清理过期的同步凭证');

      const expiredTime = new Date();
      
      const result = await this.db.update(syncCredentials)
        .set({ 
          isActive: false,
          updatedAt: new Date() 
        })
        .where(eq(syncCredentials.isActive, true))
        .execute();

      console.log(`清理了 ${result.changes} 个过期的凭证`);

    } catch (error) {
      console.error('清理过期凭证失败:', error);
    }
  }

  /**
   * 获取凭证审计日志
   */
  async getCredentialLogs(
    userId: number,
    limit: number = 50
  ): Promise<CredentialLog[]> {
    try {
      console.log(`获取用户 ${userId} 的凭证审计日志，限制: ${limit}`);

      const logs = await this.db.select()
        .from(credentialLogs)
        .where(eq(credentialLogs.userId, userId))
        .orderBy(desc(credentialLogs.timestamp))
        .limit(limit)
        .all();

      console.log(`找到 ${logs.length} 条审计日志 for user ${userId}`);

      return logs.map(log => ({
        id: log.id.toString(),
        credentialId: log.credentialId.toString(),
        userId: log.userId.toString(),
        action: log.action as 'created' | 'accessed' | 'revoked' | 'regenerated',
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
        details: log.details ? JSON.parse(log.details) : undefined
      }));

    } catch (error) {
      console.error('获取凭证审计日志失败:', error);
      throw new Error(`获取凭证审计日志失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证凭证有效性
   */
  async validateCredential(credentialId: number, userId: number): Promise<{
    isValid: boolean;
    credential: SyncCredential | null;
    error?: string;
  }> {
    try {
      const credential = await this.getCredential(credentialId);
      
      if (!credential) {
        return {
          isValid: false,
          credential: null,
          error: '凭证不存在'
        };
      }

      if (credential.userId !== userId.toString()) {
        return {
          isValid: false,
          credential: null,
          error: '无权访问此凭证'
        };
      }

      if (!credential.isActive) {
        return {
          isValid: false,
          credential,
          error: '凭证已撤销'
        };
      }

      // 检查是否过期
      if (credential.expiresAt && new Date() > credential.expiresAt) {
        return {
          isValid: false,
          credential,
          error: '凭证已过期'
        };
      }

      return {
        isValid: true,
        credential,
        error: undefined
      };

    } catch (error) {
      console.error('验证凭证失败:', error);
      return {
        isValid: false,
        credential: null,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取凭证统计信息
   */
  async getCredentialStats(userId: number): Promise<{
    totalCredentials: number;
    activeCredentials: number;
    expiredCredentials: number;
    mostRecentlyUsed: SyncCredential | null;
  }> {
    try {
      // 获取所有凭证
      const allCredentials = await this.db.select()
        .from(syncCredentials)
        .where(eq(syncCredentials.userId, userId))
        .all();

      const now = new Date();
      const activeCredentials = allCredentials.filter(c => c.isActive && (!c.expiresAt || c.expiresAt > now));
      const expiredCredentials = allCredentials.filter(c => !c.isActive || (c.expiresAt && c.expiresAt <= now));

      // 找到最近使用的凭证
      const mostRecentlyUsed = allCredentials
        .filter(c => c.lastUsedAt)
        .sort((a, b) => b.lastUsedAt!.getTime() - a.lastUsedAt!.getTime())[0];

      return {
        totalCredentials: allCredentials.length,
        activeCredentials: activeCredentials.length,
        expiredCredentials: expiredCredentials.length,
        mostRecentlyUsed: mostRecentlyUsed || null
      };

    } catch (error) {
      console.error('获取凭证统计失败:', error);
      throw new Error(`获取凭证统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成R2凭证（模拟实现，实际使用Cloudflare R2 API）
   */
  private generateR2Credentials(
    userId: number, 
    config: { bucket: string; region: string; endpoint?: string; }
  ): {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } {
    // 注意：这是模拟实现
    // 实际应用中应该调用Cloudflare R2 API或AWS S3 API来生成凭证
    // 这里我们生成模拟的凭证密钥对
    
    const timestamp = Date.now().toString();
    const userIdStr = userId.toString();
    
    // 生成accessKeyId和secretAccessKey（模拟）
    const accessKeyId = `AKIAIOSFODNN7EXAMPLE-${timestamp}`;
    const secretAccessKey = `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY-${timestamp}`;
    
    console.log(`为用户 ${userIdStr} 生成R2凭证: ${accessKeyId.substring(0, 20)}...`);
    
    return {
      accessKeyId,
      secretAccessKey,
      region: config.region || 'auto'
    };
  }

  /**
   * 记录凭证操作到审计日志
   */
  private async logCredentialOperation(
    credentialId: number,
    userId: number,
    action: 'created' | 'accessed' | 'revoked' | 'regenerated',
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.db.insert(credentialLogs).values({
        credentialId,
        userId,
        action,
        ipAddress: '127.0.0.1', // 实际应用中应该获取真实IP
        userAgent: 'News-Sync-Client/1.0', // 实际应用中应该获取真实User-Agent
        timestamp: new Date(),
        details: JSON.stringify(details),
        createdAt: new Date()
      });

      console.log(`记录凭证操作: ${action} for credential ${credentialId} by user ${userId}`);

    } catch (error) {
      console.error('记录凭证操作日志失败:', error);
      // 不抛出错误，避免影响主要流程
    }
  }
}

// 类型定义（如果还没有单独的类型文件）
export interface CloudflareR2Config {
  bucket: string;
  region: string;
  endpoint?: string;
}