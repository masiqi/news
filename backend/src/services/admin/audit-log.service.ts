// src/services/admin/audit-log.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { 
  userOperationLogs,
  users,
  userSessions
} from '../../db/schema';
import { eq, and, or, ilike, desc, asc, count, gte, lte } from 'drizzle-orm';
import type { 
  UserOperationLog,
  UserSession 
} from '../../db/types';

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  userId?: number;
  adminId?: number;
  operation?: string;
  result?: 'success' | 'failure';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SessionQueryParams {
  page?: number;
  limit?: number;
  userId?: number;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogResult {
  logs: UserOperationLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SessionResult {
  sessions: UserSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditStatistics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  operationTypeDistribution: Record<string, number>;
  dailyOperationTrend: Array<{ date: string; count: number }>;
  topAdmins: Array<{ adminId: number; operationCount: number }>;
  riskEvents: number;
}

export class AuditLogService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 获取用户操作日志
   */
  async getAuditLogs(params: AuditLogQueryParams): Promise<AuditLogResult> {
    const {
      page = 1,
      limit = 20,
      userId,
      adminId,
      operation,
      result,
      dateFrom,
      dateTo,
      search,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions: any[] = [];
    
    if (userId) {
      whereConditions.push(eq(userOperationLogs.userId, userId));
    }
    
    if (adminId) {
      whereConditions.push(eq(userOperationLogs.adminId, adminId));
    }
    
    if (operation) {
      whereConditions.push(eq(userOperationLogs.operation, operation as any));
    }
    
    if (result) {
      whereConditions.push(eq(userOperationLogs.result, result));
    }
    
    if (dateFrom) {
      whereConditions.push(gte(userOperationLogs.timestamp, new Date(dateFrom)));
    }
    
    if (dateTo) {
      whereConditions.push(lte(userOperationLogs.timestamp, new Date(dateTo)));
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(userOperationLogs.details, `%${search}%`),
          ilike(userOperationLogs.errorMessage, `%${search}%`),
          ilike(userOperationLogs.ipAddress, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序
    const orderBy = [];
    const sortColumn = userOperationLogs[sortBy as keyof typeof userOperationLogs] || userOperationLogs.timestamp;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderBy.push(orderDirection(sortColumn));

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取日志数据
    const logs = await this.db
      .select({
        id: userOperationLogs.id,
        userId: userOperationLogs.userId,
        adminId: userOperationLogs.adminId,
        operation: userOperationLogs.operation,
        details: userOperationLogs.details,
        ipAddress: userOperationLogs.ipAddress,
        userAgent: userOperationLogs.userAgent,
        result: userOperationLogs.result,
        errorMessage: userOperationLogs.errorMessage,
        timestamp: userOperationLogs.timestamp
      })
      .from(userOperationLogs)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取用户会话
   */
  async getUserSessions(params: SessionQueryParams): Promise<SessionResult> {
    const {
      page = 1,
      limit = 20,
      userId,
      isActive,
      sortBy = 'lastActivityAt',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions: any[] = [];
    
    if (userId) {
      whereConditions.push(eq(userSessions.userId, userId));
    }
    
    if (isActive !== undefined) {
      whereConditions.push(eq(userSessions.isActive, isActive));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序
    const orderBy = [];
    const sortColumn = userSessions[sortBy as keyof typeof userSessions] || userSessions.lastActivityAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderBy.push(orderDirection(sortColumn));

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(userSessions)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取会话数据
    const sessions = await this.db
      .select()
      .from(userSessions)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 记录用户操作
   */
  async logOperation(
    userId: number,
    adminId: number,
    operation: 'create' | 'update' | 'delete' | 'status_change' | 'role_change' | 'login' | 'logout',
    details: any,
    ipAddress: string,
    userAgent: string = '',
    result: 'success' | 'failure' = 'success',
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .insert(userOperationLogs)
      .values({
        userId,
        adminId,
        operation,
        details: JSON.stringify(details),
        ipAddress,
        userAgent,
        result,
        errorMessage,
        timestamp: new Date()
      });
  }

  /**
   * 获取审计统计信息
   */
  async getAuditStatistics(days: number = 30): Promise<AuditStatistics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 总操作数
    const totalOperations = await this.db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(gte(userOperationLogs.timestamp, startDate));

    // 成功和失败的操作数
    const resultDistribution = await this.db
      .select({ result: userOperationLogs.result, count: count() })
      .from(userOperationLogs)
      .where(gte(userOperationLogs.timestamp, startDate))
      .groupBy(userOperationLogs.result);

    // 操作类型分布
    const operationDistribution = await this.db
      .select({ operation: userOperationLogs.operation, count: count() })
      .from(userOperationLogs)
      .where(gte(userOperationLogs.timestamp, startDate))
      .groupBy(userOperationLogs.operation);

    // 每日操作趋势
    const dailyTrend = await this.db
      .select({
        date: userOperationLogs.timestamp,
        count: count()
      })
      .from(userOperationLogs)
      .where(gte(userOperationLogs.timestamp, startDate))
      .groupBy(userOperationLogs.timestamp);

    // 最活跃的管理员
    const topAdmins = await this.db
      .select({
        adminId: userOperationLogs.adminId,
        operationCount: count()
      })
      .from(userOperationLogs)
      .where(gte(userOperationLogs.timestamp, startDate))
      .groupBy(userOperationLogs.adminId)
      .orderBy(desc(count()))
      .limit(10);

    // 风险事件（失败的操作）
    const riskEvents = await this.db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(and(
        gte(userOperationLogs.timestamp, startDate),
        eq(userOperationLogs.result, 'failure')
      ));

    const successCount = resultDistribution.find(r => r.result === 'success')?.count || 0;
    const failureCount = resultDistribution.find(r => r.result === 'failure')?.count || 0;

    const operationCounts = operationDistribution.reduce((acc, item) => {
      acc[item.operation] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // 格式化每日趋势数据
    const dailyTrendFormatted = dailyTrend.map(item => ({
      date: item.date.toISOString().split('T')[0],
      count: item.count
    }));

    return {
      totalOperations: totalOperations[0].count,
      successfulOperations: successCount,
      failedOperations: failureCount,
      operationTypeDistribution: operationCounts,
      dailyOperationTrend: dailyTrendFormatted,
      topAdmins: topAdmins.map(item => ({ 
        adminId: item.adminId, 
        operationCount: item.operationCount 
      })),
      riskEvents: riskEvents[0].count
    };
  }

  /**
   * 获取用户操作历史
   */
  async getUserOperationHistory(userId: number, limit: number = 50): Promise<UserOperationLog[]> {
    return await this.db
      .select()
      .from(userOperationLogs)
      .where(eq(userOperationLogs.userId, userId))
      .orderBy(desc(userOperationLogs.timestamp))
      .limit(limit);
  }

  /**
   * 获取管理员操作历史
   */
  async getAdminOperationHistory(adminId: number, limit: number = 50): Promise<UserOperationLog[]> {
    return await this.db
      .select()
      .from(userOperationLogs)
      .where(eq(userOperationLogs.adminId, adminId))
      .orderBy(desc(userOperationLogs.timestamp))
      .limit(limit);
  }

  /**
   * 检查异常活动
   */
  async detectSuspiciousActivity(userId: number): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    timestamp: Date;
    details: any;
  }>> {
    const suspiciousActivities: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      timestamp: Date;
      details: any;
    }> = [];

    // 检查最近的失败登录尝试
    const recentFailedLogins = await this.db
      .select()
      .from(userOperationLogs)
      .where(and(
        eq(userOperationLogs.userId, userId),
        eq(userOperationLogs.operation, 'login'),
        eq(userOperationLogs.result, 'failure'),
        gte(userOperationLogs.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24小时内
      ))
      .orderBy(desc(userOperationLogs.timestamp));

    if (recentFailedLogins.length > 5) {
      suspiciousActivities.push({
        type: 'multiple_failed_logins',
        severity: 'high',
        description: '24小时内多次登录失败',
        timestamp: new Date(),
        details: { failedAttempts: recentFailedLogins.length }
      });
    }

    // 检查异常IP地址
    const recentOperations = await this.db
      .select({
        ipAddress: userOperationLogs.ipAddress,
        count: count()
      })
      .from(userOperationLogs)
      .where(and(
        eq(userOperationLogs.userId, userId),
        gte(userOperationLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7天内
      ))
      .groupBy(userOperationLogs.ipAddress)
      .having(count() > 10);

    if (recentOperations.length > 3) {
      suspiciousActivities.push({
        type: 'multiple_ip_addresses',
        severity: 'medium',
        description: '7天内从多个IP地址进行操作',
        timestamp: new Date(),
        details: { ipAddresses: recentOperations.map(op => op.ipAddress) }
      });
    }

    // 检查异常时间操作
    const nightTimeOperations = await this.db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(and(
        eq(userOperationLogs.userId, userId),
        gte(userOperationLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ));

    // 这里可以添加更多异常检测逻辑

    return suspiciousActivities;
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(userOperationLogs)
      .where(lte(userOperationLogs.timestamp, cutoffDate))
      .returning({ deletedId: userOperationLogs.id });

    return result.length;
  }

  /**
   * 导出审计日志
   */
  async exportAuditLogs(params: AuditLogQueryParams): Promise<string> {
    const logs = await this.getAuditLogs({ ...params, limit: 10000 });
    
    const csvData = [
      ['时间', '用户ID', '管理员ID', '操作类型', 'IP地址', '用户代理', '结果', '错误信息', '详情'],
      ...logs.logs.map(log => [
        log.timestamp.toISOString(),
        log.userId.toString(),
        log.adminId.toString(),
        log.operation,
        log.ipAddress,
        log.userAgent || '',
        log.result,
        log.errorMessage || '',
        log.details || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csvData;
  }
}