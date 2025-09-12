// src/services/admin/user-management.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { 
  users, 
  userRoles, 
  userPermissions, 
  userRoleRelations, 
  userOperationLogs,
  userSessions,
  userSettings 
} from '../../db/schema';
import { eq, and, or, ilike, desc, asc, count, gte, lte } from 'drizzle-orm';
import type { 
  User, 
  UserRole, 
  UserPermission, 
  UserOperationLog,
  UserSession,
  UserSetting 
} from '../../db/types';

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export interface UserManagementResult {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserDetailResult {
  user: User;
  roles: UserRole[];
  permissions: UserPermission[];
  recentLogs: UserOperationLog[];
  activeSessions: UserSession[];
  settings: UserSetting;
}

export class UserManagementService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 获取用户列表，支持分页、搜索和筛选
   */
  async getUsers(params: UserQueryParams): Promise<UserManagementResult> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = params;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions: any[] = [];
    
    if (search) {
      whereConditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.notes, `%${search}%`)
        )
      );
    }
    
    if (status) {
      whereConditions.push(eq(users.status, status as any));
    }
    
    if (role) {
      whereConditions.push(eq(users.role, role as any));
    }
    
    if (dateFrom) {
      whereConditions.push(gte(users.createdAt, new Date(dateFrom)));
    }
    
    if (dateTo) {
      whereConditions.push(lte(users.createdAt, new Date(dateTo)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序
    const orderBy = [];
    const sortColumn = users[sortBy as keyof typeof users] || users.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderBy.push(orderDirection(sortColumn));

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取用户数据
    const userList = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      users: userList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取用户详细信息
   */
  async getUserDetail(userId: number): Promise<UserDetailResult | null> {
    // 获取用户基本信息
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return null;
    }

    // 获取用户角色
    const roles = await this.db
      .select({
        id: userRoles.id,
        name: userRoles.name,
        description: userRoles.description,
        permissions: userRoles.permissions,
        isSystemRole: userRoles.isSystemRole,
        isActive: userRoles.isActive,
        sortOrder: userRoles.sortOrder,
        createdAt: userRoles.createdAt,
        updatedAt: userRoles.updatedAt
      })
      .from(userRoleRelations)
      .innerJoin(userRoles, eq(userRoleRelations.roleId, userRoles.id))
      .where(and(
        eq(userRoleRelations.userId, userId),
        eq(userRoleRelations.isActive, true)
      ));

    // 获取用户权限
    const permissions = await this.db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.isActive, true));

    // 获取最近操作日志
    const recentLogs = await this.db
      .select()
      .from(userOperationLogs)
      .where(eq(userOperationLogs.userId, userId))
      .orderBy(desc(userOperationLogs.timestamp))
      .limit(10);

    // 获取活跃会话
    const activeSessions = await this.db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isActive, true),
        gte(userSessions.expiresAt, new Date())
      ))
      .orderBy(desc(userSessions.lastActivityAt));

    // 获取用户设置
    const settings = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return {
      user: user[0],
      roles,
      permissions,
      recentLogs,
      activeSessions,
      settings: settings[0] || {
        userId,
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        theme: 'light',
        notificationsEnabled: true,
        emailNotifications: true,
        dailyDigest: false,
        settings: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as UserSetting
    };
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(userId: number, status: string, reason?: string, adminId?: number): Promise<User | null> {
    const result = await this.db
      .update(users)
      .set({ 
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (result.length > 0 && adminId) {
      // 记录操作日志
      await this.logUserOperation(userId, adminId, 'status_change', {
        oldStatus: result[0].status,
        newStatus: status,
        reason
      });
    }

    return result.length > 0 ? result[0] : null;
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(userId: number, roleId: number, adminId?: number): Promise<boolean> {
    // 先移除现有角色关联
    await this.db
      .update(userRoleRelations)
      .set({ isActive: false })
      .where(eq(userRoleRelations.userId, userId));

    // 添加新的角色关联
    await this.db
      .insert(userRoleRelations)
      .values({
        userId,
        roleId,
        assignedBy: adminId,
        assignedAt: new Date(),
        isActive: true
      });

    if (adminId) {
      // 记录操作日志
      await this.logUserOperation(userId, adminId, 'role_change', {
        newRoleId: roleId
      });
    }

    return true;
  }

  /**
   * 记录用户操作日志
   */
  async logUserOperation(
    userId: number, 
    adminId: number, 
    operation: 'create' | 'update' | 'delete' | 'status_change' | 'role_change' | 'login' | 'logout',
    details: any,
    ipAddress: string = '',
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
   * 获取用户操作日志
   */
  async getUserOperationLogs(userId: number, page: number = 1, limit: number = 20, operation?: string) {
    const offset = (page - 1) * limit;
    
    let whereConditions = [eq(userOperationLogs.userId, userId)];
    if (operation) {
      whereConditions.push(eq(userOperationLogs.operation, operation as any));
    }

    const whereClause = and(...whereConditions);

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(userOperationLogs)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取日志数据
    const logs = await this.db
      .select()
      .from(userOperationLogs)
      .where(whereClause)
      .orderBy(desc(userOperationLogs.timestamp))
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
   * 批量更新用户状态
   */
  async batchUpdateUserStatus(userIds: number[], status: string, adminId?: number): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        const result = await this.updateUserStatus(userId, status, undefined, adminId);
        if (result) {
          success++;
        } else {
          failed++;
          errors.push(`用户 ${userId} 不存在`);
        }
      } catch (error) {
        failed++;
        errors.push(`更新用户 ${userId} 失败: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * 获取用户统计信息
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    pendingUsers: number;
    roleDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
    recentRegistrations: number;
  }> {
    const totalUsers = await this.db
      .select({ count: count() })
      .from(users);

    const statusDistribution = await this.db
      .select({ status: users.status, count: count() })
      .from(users)
      .groupBy(users.status);

    const roleDistribution = await this.db
      .select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role);

    const riskDistribution = await this.db
      .select({ riskLevel: users.riskLevel, count: count() })
      .from(users)
      .groupBy(users.riskLevel);

    const recentRegistrations = await this.db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // 最近7天

    const statusCounts = statusDistribution.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const roleCounts = roleDistribution.reduce((acc, item) => {
      acc[item.role] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const riskCounts = riskDistribution.reduce((acc, item) => {
      acc[item.riskLevel] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers: totalUsers[0].count,
      activeUsers: statusCounts.active || 0,
      inactiveUsers: statusCounts.inactive || 0,
      suspendedUsers: statusCounts.suspended || 0,
      pendingUsers: statusCounts.pending || 0,
      roleDistribution: roleCounts,
      riskDistribution: riskCounts,
      recentRegistrations: recentRegistrations[0].count
    };
  }
}