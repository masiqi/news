// 访问控制服务
// 多用户R2访问控制的核心服务

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, isNull, gt, lt } from 'drizzle-orm';
import { 
  userR2Access, 
  r2Permissions, 
  r2AccessLogs, 
  userDirectoryQuotas,
  accessTokens,
  r2AuditLogs,
  users 
} from '../db/schema';
import { CryptoService } from '../services/crypto.service';

// 类型定义
export interface R2Permission {
  resource: string; // 资源路径模式，如 "user-123/*"
  actions: ('read' | 'write' | 'delete' | 'list')[];
  conditions?: Record<string, any>;
}

export interface UserR2AccessConfig {
  id: string;
  userId: string;
  accessKeyId: string;
  pathPrefix: string; // 用户专属路径，如 "user-123/"
  bucketName: string;
  region: string;
  endpoint: string;
  permissions: R2Permission[];
  isActive: boolean;
  maxStorageBytes: number;
  currentStorageBytes: number;
  maxFileCount: number;
  currentFileCount: number;
  isReadonly: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessTokenConfig {
  id: string;
  userId: string;
  accessId: string;
  token: string;
  tokenType: 'bearer' | 'api_key';
  scope: string;
  expiresAt?: Date;
  isRevoked: boolean;
  usageCount: number;
  ipWhitelist?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessLogEntry {
  id: string;
  userId: string;
  accessId: string;
  operation: 'read' | 'write' | 'delete' | 'list' | 'head';
  resourcePath: string;
  resourceSize?: number;
  statusCode: number;
  responseTime: number;
  bytesTransferred: number;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  errorMessage?: string;
}

export interface AccessValidationResult {
  isValid: boolean;
  userId?: string;
  accessConfig?: UserR2AccessConfig;
  error?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 访问控制服务
 * 提供多用户R2访问控制和路径隔离功能
 */
export class AccessControlService {
  private db: ReturnType<typeof drizzle>;
  private cryptoService: CryptoService;

  constructor(db: D1Database) {
    this.db = drizzle(db);
    this.cryptoService = new CryptoService();
  }

  /**
   * 创建用户R2访问配置
   */
  async createUserAccess(
    userId: number,
    config: {
      bucketName: string;
      region: string;
      endpoint: string;
      permissions?: R2Permission[];
      maxStorageBytes?: number;
      maxFileCount?: number;
      isReadonly?: boolean;
      expiresInSeconds?: number;
    }
  ): Promise<UserR2AccessConfig> {
    try {
      console.log(`为用户 ${userId} 创建R2访问配置`);

      // 生成用户专属路径前缀
      const pathPrefix = `user-${userId}/`;

      // 生成访问密钥
      const credentials = this.generateCredentials(userId);

      // 计算过期时间
      const expiresAt = config.expiresInSeconds 
        ? new Date(Date.now() + config.expiresInSeconds * 1000)
        : undefined;

      // 创建用户R2访问记录
      const [accessRecord] = await this.db.insert(userR2Access).values({
        userId,
        accessKeyId: credentials.accessKeyId,
        secretAccessKeyHash: await this.cryptoService.hashData(credentials.secretAccessKey),
        pathPrefix,
        bucketName: config.bucketName,
        region: config.region || 'auto',
        endpoint: config.endpoint,
        permissionsJson: JSON.stringify(config.permissions || [{
          resource: `${pathPrefix}*`,
          actions: config.isReadonly !== false ? ['read', 'list'] : ['read', 'write', 'list']
        }]),
        isActive: true,
        maxStorageBytes: config.maxStorageBytes || 104857600, // 100MB
        currentStorageBytes: 0,
        maxFileCount: config.maxFileCount || 1000,
        currentFileCount: 0,
        isReadonly: config.isReadonly !== false,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // 创建配额记录
      await this.db.insert(userDirectoryQuotas).values({
        userId,
        maxStorageBytes: config.maxStorageBytes || 104857600,
        maxFileCount: config.maxFileCount || 1000,
        currentStorageBytes: 0,
        currentFileCount: 0,
        lastUpdated: new Date()
      }).onConflictDoUpdate({
        target: userDirectoryQuotas.userId,
        set: {
          maxStorageBytes: config.maxStorageBytes || 104857600,
          maxFileCount: config.maxFileCount || 1000,
          lastUpdated: new Date()
        }
      });

      // 创建权限记录
      if (config.permissions) {
        for (const permission of config.permissions) {
          await this.db.insert(r2Permissions).values({
            accessId: accessRecord.id,
            resourcePattern: permission.resource,
            actions: JSON.stringify(permission.actions),
            conditions: permission.conditions ? JSON.stringify(permission.conditions) : null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // 记录审计日志
      await this.logAuditEvent(userId, accessRecord.id, 'access_created', {
        pathPrefix,
        bucketName: config.bucketName,
        permissions: config.permissions
      });

      console.log(`用户R2访问配置创建成功: ${accessRecord.id} for user ${userId}`);

      return this.mapAccessRecordToConfig(accessRecord);

    } catch (error) {
      console.error('创建用户R2访问配置失败:', error);
      throw new Error(`创建用户R2访问配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证访问权限
   */
  async validateAccess(
    accessKeyId: string,
    secretAccessKey: string,
    resourcePath: string,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head'
  ): Promise<AccessValidationResult> {
    try {
      // 查找访问配置
      const accessRecord = await this.db.select()
        .from(userR2Access)
        .where(eq(userR2Access.accessKeyId, accessKeyId))
        .get();

      if (!accessRecord) {
        return {
          isValid: false,
          error: '访问密钥不存在',
          riskLevel: 'high'
        };
      }

      // 验证密钥
      const isKeyValid = await this.cryptoService.verify(
        secretAccessKey,
        accessRecord.secretAccessKeyHash
      );

      if (!isKeyValid) {
        await this.logAuditEvent(accessRecord.userId, accessRecord.id, 'invalid_key', {
          accessKeyId,
          resourcePath,
          operation
        });

        return {
          isValid: false,
          error: '访问密钥无效',
          riskLevel: 'high'
        };
      }

      // 检查访问配置状态
      if (!accessRecord.isActive) {
        return {
          isValid: false,
          error: '访问配置已禁用',
          riskLevel: 'medium'
        };
      }

      // 检查过期时间
      if (accessRecord.expiresAt && new Date() > accessRecord.expiresAt) {
        return {
          isValid: false,
          error: '访问配置已过期',
          riskLevel: 'medium'
        };
      }

      // 验证路径权限
      const hasPathPermission = await this.validatePathPermission(
        accessRecord.id,
        resourcePath,
        operation
      );

      if (!hasPathPermission) {
        await this.logAuditEvent(accessRecord.userId, accessRecord.id, 'access_denied', {
          accessKeyId,
          resourcePath,
          operation,
          reason: 'insufficient_permissions'
        });

        return {
          isValid: false,
          error: '路径访问权限不足',
          riskLevel: 'medium'
        };
      }

      // 更新最后使用时间
      await this.db.update(userR2Access)
        .set({ 
          lastUsedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userR2Access.id, accessRecord.id));

      return {
        isValid: true,
        userId: accessRecord.userId.toString(),
        accessConfig: this.mapAccessRecordToConfig(accessRecord),
        riskLevel: 'low'
      };

    } catch (error) {
      console.error('验证访问权限失败:', error);
      return {
        isValid: false,
        error: '访问验证失败',
        riskLevel: 'high'
      };
    }
  }

  /**
   * 验证路径权限
   */
  private async validatePathPermission(
    accessId: number,
    resourcePath: string,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head'
  ): Promise<boolean> {
    try {
      // 获取访问配置的权限
      const permissions = await this.db.select()
        .from(r2Permissions)
        .where(eq(r2Permissions.accessId, accessId))
        .all();

      // 获取用户路径前缀
      const accessConfig = await this.db.select()
        .from(userR2Access)
        .where(eq(userR2Access.id, accessId))
        .get();

      if (!accessConfig) {
        return false;
      }

      // 检查路径是否在用户专属目录内
      if (!resourcePath.startsWith(accessConfig.pathPrefix)) {
        return false;
      }

      // 检查只读权限
      if (accessConfig.isReadonly && ['write', 'delete'].includes(operation)) {
        return false;
      }

      // 检查细粒度权限
      for (const permission of permissions) {
        const actions = JSON.parse(permission.actions) as string[];
        const resourcePattern = permission.resourcePattern;

        // 检查操作权限
        if (!actions.includes(operation)) {
          continue;
        }

        // 检查资源路径匹配
        if (this.isPathMatch(resourcePath, resourcePattern)) {
          // 检查额外条件
          if (permission.conditions) {
            const conditions = JSON.parse(permission.conditions);
            if (this.checkConditions(resourcePath, conditions)) {
              return true;
            }
          } else {
            return true;
          }
        }
      }

      return false;

    } catch (error) {
      console.error('验证路径权限失败:', error);
      return false;
    }
  }

  /**
   * 路径匹配检查
   */
  private isPathMatch(resourcePath: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resourcePath);
  }

  /**
   * 检查访问条件
   */
  private checkConditions(resourcePath: string, conditions: Record<string, any>): boolean {
    // 简单的条件检查，可以根据需要扩展
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'maxSize':
          // 这里需要获取文件大小，暂时返回true
          break;
        case 'fileType':
          // 检查文件类型
          const ext = resourcePath.split('.').pop()?.toLowerCase();
          if (Array.isArray(value) && !value.includes(ext)) {
            return false;
          }
          break;
        case 'pathDepth':
          const depth = resourcePath.split('/').length - 1;
          if (typeof value === 'number' && depth !== value) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * 记录访问日志
   */
  async logAccess(
    userId: number,
    accessId: number,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head',
    resourcePath: string,
    details: {
      statusCode: number;
      responseTime: number;
      bytesTransferred?: number;
      resourceSize?: number;
      ipAddress: string;
      userAgent?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      await this.db.insert(r2AccessLogs).values({
        userId,
        accessId,
        operation,
        resourcePath,
        resourceSize: details.fileSize || 0,
        statusCode: details.statusCode,
        responseTime: details.responseTime,
        bytesTransferred: details.bytesTransferred || 0,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        errorMessage: details.errorMessage,
        timestamp: new Date()
      });

      // 更新使用统计
      await this.updateUsageStats(accessId, details.bytesTransferred || 0);

    } catch (error) {
      console.error('记录访问日志失败:', error);
    }
  }

  /**
   * 更新使用统计
   */
  private async updateUsageStats(accessId: number, bytesTransferred: number): Promise<void> {
    try {
      // 获取访问配置
      const accessConfig = await this.db.select()
        .from(userR2Access)
        .where(eq(userR2Access.id, accessId))
        .get();

      if (!accessConfig) {
        return;
      }

      // 更新存储使用量
      await this.db.update(userR2Access)
        .set({ 
          currentStorageBytes: accessConfig.currentStorageBytes + bytesTransferred,
          updatedAt: new Date()
        })
        .where(eq(userR2Access.id, accessId));

      // 更新配额统计
      await this.db.update(userDirectoryQuotas)
        .set({ 
          currentStorageBytes: accessConfig.currentStorageBytes + bytesTransferred,
          lastUpdated: new Date()
        })
        .where(eq(userDirectoryQuotas.userId, accessConfig.userId));

    } catch (error) {
      console.error('更新使用统计失败:', error);
    }
  }

  /**
   * 创建访问令牌
   */
  async createAccessToken(
    userId: number,
    accessId: number,
    config: {
      scope?: string;
      expiresInSeconds?: number;
      ipWhitelist?: string[];
    }
  ): Promise<AccessTokenConfig> {
    try {
      // 生成随机令牌
      const token = this.generateSecureToken();

      // 计算过期时间
      const expiresAt = config.expiresInSeconds 
        ? new Date(Date.now() + config.expiresInSeconds * 1000)
        : undefined;

      // 计算令牌哈希
      const tokenHash = await this.cryptoService.hash(token);

      // 创建令牌记录
      const [tokenRecord] = await this.db.insert(accessTokens).values({
        userId,
        accessId,
        tokenHash,
        tokenType: 'bearer',
        scope: config.scope || 'r2:read',
        expiresAt,
        isRevoked: false,
        usageCount: 0,
        ipWhitelist: config.ipWhitelist ? JSON.stringify(config.ipWhitelist) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // 记录审计日志
      await this.logAuditEvent(userId, accessId, 'token_created', {
        scope: config.scope,
        expiresAt
      });

      return {
        id: tokenRecord.id.toString(),
        userId: tokenRecord.userId.toString(),
        accessId: tokenRecord.accessId.toString(),
        token,
        tokenType: tokenRecord.tokenType,
        scope: tokenRecord.scope,
        expiresAt: tokenRecord.expiresAt,
        isRevoked: tokenRecord.isRevoked,
        usageCount: tokenRecord.usageCount,
        ipWhitelist: config.ipWhitelist,
        createdAt: tokenRecord.createdAt,
        updatedAt: tokenRecord.updatedAt
      };

    } catch (error) {
      console.error('创建访问令牌失败:', error);
      throw new Error(`创建访问令牌失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证访问令牌
   */
  async validateAccessToken(
    token: string,
    ipAddress?: string
  ): Promise<{
    isValid: boolean;
    userId?: string;
    accessConfig?: UserR2AccessConfig;
    error?: string;
  }> {
    try {
      // 计算令牌哈希
      const tokenHash = await this.cryptoService.hash(token);

      // 查找令牌记录
      const tokenRecord = await this.db.select()
        .from(accessTokens)
        .where(eq(accessTokens.tokenHash, tokenHash))
        .get();

      if (!tokenRecord) {
        return {
          isValid: false,
          error: '令牌不存在'
        };
      }

      // 检查令牌状态
      if (tokenRecord.isRevoked) {
        return {
          isValid: false,
          error: '令牌已撤销'
        };
      }

      // 检查过期时间
      if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
        return {
          isValid: false,
          error: '令牌已过期'
        };
      }

      // 检查IP白名单
      if (tokenRecord.ipWhitelist && ipAddress) {
        const whitelist = JSON.parse(tokenRecord.ipWhitelist) as string[];
        if (!whitelist.includes(ipAddress)) {
          return {
            isValid: false,
            error: 'IP地址不在白名单中'
          };
        }
      }

      // 获取访问配置
      const accessRecord = await this.db.select()
        .from(userR2Access)
        .where(eq(userR2Access.id, tokenRecord.accessId))
        .get();

      if (!accessRecord) {
        return {
          isValid: false,
          error: '访问配置不存在'
        };
      }

      // 更新令牌使用统计
      await this.db.update(accessTokens)
        .set({ 
          usageCount: tokenRecord.usageCount + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(accessTokens.id, tokenRecord.id));

      return {
        isValid: true,
        userId: tokenRecord.userId.toString(),
        accessConfig: this.mapAccessRecordToConfig(accessRecord)
      };

    } catch (error) {
      console.error('验证访问令牌失败:', error);
      return {
        isValid: false,
        error: '令牌验证失败'
      };
    }
  }

  /**
   * 获取用户访问配置
   */
  async getUserAccess(userId: number): Promise<UserR2AccessConfig | null> {
    try {
      const accessRecord = await this.db.select()
        .from(userR2Access)
        .where(eq(userR2Access.userId, userId))
        .get();

      if (!accessRecord) {
        return null;
      }

      return this.mapAccessRecordToConfig(accessRecord);

    } catch (error) {
      console.error('获取用户访问配置失败:', error);
      throw new Error(`获取用户访问配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取访问统计
   */
  async getAccessStatistics(userId: number): Promise<{
    totalAccesses: number;
    totalBytesTransferred: number;
    averageResponseTime: number;
    recentAccesses: AccessLogEntry[];
  }> {
    try {
      // 获取用户的访问配置
      const accessConfig = await this.getUserAccess(userId);
      if (!accessConfig) {
        return {
          totalAccesses: 0,
          totalBytesTransferred: 0,
          averageResponseTime: 0,
          recentAccesses: []
        };
      }

      // 获取访问日志
      const logs = await this.db.select()
        .from(r2AccessLogs)
        .where(eq(r2AccessLogs.userId, userId))
        .orderBy(desc(r2AccessLogs.timestamp))
        .limit(50)
        .all();

      // 计算统计信息
      const totalAccesses = logs.length;
      const totalBytesTransferred = logs.reduce((sum, log) => sum + log.bytesTransferred, 0);
      const averageResponseTime = logs.length > 0 
        ? logs.reduce((sum, log) => sum + log.responseTime, 0) / logs.length 
        : 0;

      const recentAccesses = logs.map(log => ({
        id: log.id.toString(),
        userId: log.userId.toString(),
        accessId: log.accessId.toString(),
        operation: log.operation,
        resourcePath: log.resourcePath,
        resourceSize: log.resourceSize,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        bytesTransferred: log.bytesTransferred,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
        errorMessage: log.errorMessage
      }));

      return {
        totalAccesses,
        totalBytesTransferred,
        averageResponseTime,
        recentAccesses
      };

    } catch (error) {
      console.error('获取访问统计失败:', error);
      throw new Error(`获取访问统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 记录审计事件
   */
  private async logAuditEvent(
    userId: number,
    accessId: number,
    operation: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.db.insert(r2AuditLogs).values({
        userId,
        accessId,
        operation,
        details: JSON.stringify(details),
        riskLevel: this.assessRiskLevel(operation, details),
        isSuspicious: false,
        flaggedForReview: false,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('记录审计事件失败:', error);
    }
  }

  /**
   * 评估风险等级
   */
  private assessRiskLevel(operation: string, details: Record<string, any>): 'low' | 'medium' | 'high' {
    switch (operation) {
      case 'access_created':
      case 'token_created':
        return 'low';
      case 'invalid_key':
      case 'access_denied':
        return 'medium';
      case 'suspicious_activity':
        return 'high';
      default:
        return 'low';
    }
  }

  /**
   * 生成凭证密钥
   */
  private generateCredentials(userId: number): {
    accessKeyId: string;
    secretAccessKey: string;
  } {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    
    return {
      accessKeyId: `AKIA${timestamp}${random}`,
      secretAccessKey: `${random}${timestamp}${Math.random().toString(36).substring(2, 15)}`
    };
  }

  /**
   * 生成安全令牌
   */
  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 映射访问记录到配置对象
   */
  private mapAccessRecordToConfig(record: any): UserR2AccessConfig {
    const permissions = record.permissionsJson 
      ? JSON.parse(record.permissionsJson) as R2Permission[]
      : [];

    return {
      id: record.id.toString(),
      userId: record.userId.toString(),
      accessKeyId: record.accessKeyId,
      pathPrefix: record.pathPrefix,
      bucketName: record.bucketName,
      region: record.region,
      endpoint: record.endpoint,
      permissions,
      isActive: record.isActive,
      maxStorageBytes: record.maxStorageBytes,
      currentStorageBytes: record.currentStorageBytes,
      maxFileCount: record.maxFileCount,
      currentFileCount: record.currentFileCount,
      isReadonly: record.isReadonly,
      expiresAt: record.expiresAt,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}