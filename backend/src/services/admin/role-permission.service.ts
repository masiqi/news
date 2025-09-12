// src/services/admin/role-permission.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { 
  userRoles, 
  userPermissions, 
  userRoleRelations,
  users 
} from '../../db/schema';
import { eq, and, or, ilike, desc, asc, count } from 'drizzle-orm';
import type { 
  UserRole, 
  UserPermission, 
  UserRoleRelation 
} from '../../db/types';

export interface RoleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  isSystemRole?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PermissionQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  resource?: string;
  action?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RoleManagementResult {
  roles: UserRole[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PermissionManagementResult {
  permissions: UserPermission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class RolePermissionService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 获取角色列表
   */
  async getRoles(params: RoleQueryParams): Promise<RoleManagementResult> {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      isSystemRole,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = params;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions: any[] = [];
    
    if (search) {
      whereConditions.push(
        or(
          ilike(userRoles.name, `%${search}%`),
          ilike(userRoles.description, `%${search}%`)
        )
      );
    }
    
    if (isActive !== undefined) {
      whereConditions.push(eq(userRoles.isActive, isActive));
    }
    
    if (isSystemRole !== undefined) {
      whereConditions.push(eq(userRoles.isSystemRole, isSystemRole));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序
    const orderBy = [];
    const sortColumn = userRoles[sortBy as keyof typeof userRoles] || userRoles.sortOrder;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderBy.push(orderDirection(sortColumn));

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(userRoles)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取角色数据
    const roles = await this.db
      .select()
      .from(userRoles)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 创建新角色
   */
  async createRole(roleData: {
    name: string;
    description?: string;
    permissions: string[];
    isSystemRole?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<UserRole> {
    const result = await this.db
      .insert(userRoles)
      .values({
        name: roleData.name,
        description: roleData.description,
        permissions: JSON.stringify(roleData.permissions),
        isSystemRole: roleData.isSystemRole || false,
        isActive: roleData.isActive !== undefined ? roleData.isActive : true,
        sortOrder: roleData.sortOrder || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return result[0];
  }

  /**
   * 更新角色
   */
  async updateRole(roleId: number, roleData: {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<UserRole | null> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (roleData.name !== undefined) updateData.name = roleData.name;
    if (roleData.description !== undefined) updateData.description = roleData.description;
    if (roleData.permissions !== undefined) updateData.permissions = JSON.stringify(roleData.permissions);
    if (roleData.isActive !== undefined) updateData.isActive = roleData.isActive;
    if (roleData.sortOrder !== undefined) updateData.sortOrder = roleData.sortOrder;

    const result = await this.db
      .update(userRoles)
      .set(updateData)
      .where(eq(userRoles.id, roleId))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId: number): Promise<boolean> {
    // 检查是否为系统角色
    const role = await this.db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, roleId))
      .limit(1);

    if (role.length === 0) {
      return false;
    }

    if (role[0].isSystemRole) {
      throw new Error('不能删除系统角色');
    }

    // 检查是否有用户使用此角色
    const userCount = await this.db
      .select({ count: count() })
      .from(userRoleRelations)
      .where(and(
        eq(userRoleRelations.roleId, roleId),
        eq(userRoleRelations.isActive, true)
      ));

    if (userCount[0].count > 0) {
      throw new Error('该角色下还有用户，无法删除');
    }

    await this.db
      .delete(userRoles)
      .where(eq(userRoles.id, roleId));

    return true;
  }

  /**
   * 获取权限列表
   */
  async getPermissions(params: PermissionQueryParams): Promise<PermissionManagementResult> {
    const {
      page = 1,
      limit = 20,
      search,
      resource,
      action,
      isActive,
      sortBy = 'resource',
      sortOrder = 'asc'
    } = params;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions: any[] = [];
    
    if (search) {
      whereConditions.push(
        or(
          ilike(userPermissions.name, `%${search}%`),
          ilike(userPermissions.description, `%${search}%`)
        )
      );
    }
    
    if (resource) {
      whereConditions.push(eq(userPermissions.resource, resource));
    }
    
    if (action) {
      whereConditions.push(eq(userPermissions.action, action));
    }
    
    if (isActive !== undefined) {
      whereConditions.push(eq(userPermissions.isActive, isActive));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序
    const orderBy = [];
    const sortColumn = userPermissions[sortBy as keyof typeof userPermissions] || userPermissions.resource;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderBy.push(orderDirection(sortColumn));

    // 获取总数
    const countResult = await this.db
      .select({ count: count() })
      .from(userPermissions)
      .where(whereClause);
    
    const total = countResult[0].count;

    // 获取权限数据
    const permissions = await this.db
      .select()
      .from(userPermissions)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      permissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 创建新权限
   */
  async createPermission(permissionData: {
    name: string;
    description?: string;
    resource: string;
    action: string;
    conditions?: Record<string, any>;
    isSystemPermission?: boolean;
    isActive?: boolean;
  }): Promise<UserPermission> {
    const result = await this.db
      .insert(userPermissions)
      .values({
        name: permissionData.name,
        description: permissionData.description,
        resource: permissionData.resource,
        action: permissionData.action,
        conditions: permissionData.conditions ? JSON.stringify(permissionData.conditions) : null,
        isSystemPermission: permissionData.isSystemPermission || false,
        isActive: permissionData.isActive !== undefined ? permissionData.isActive : true,
        createdAt: new Date()
      })
      .returning();

    return result[0];
  }

  /**
   * 更新权限
   */
  async updatePermission(permissionId: number, permissionData: {
    name?: string;
    description?: string;
    resource?: string;
    action?: string;
    conditions?: Record<string, any>;
    isActive?: boolean;
  }): Promise<UserPermission | null> {
    const updateData: any = {};

    if (permissionData.name !== undefined) updateData.name = permissionData.name;
    if (permissionData.description !== undefined) updateData.description = permissionData.description;
    if (permissionData.resource !== undefined) updateData.resource = permissionData.resource;
    if (permissionData.action !== undefined) updateData.action = permissionData.action;
    if (permissionData.conditions !== undefined) updateData.conditions = permissionData.conditions ? JSON.stringify(permissionData.conditions) : null;
    if (permissionData.isActive !== undefined) updateData.isActive = permissionData.isActive;

    const result = await this.db
      .update(userPermissions)
      .set(updateData)
      .where(eq(userPermissions.id, permissionId))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * 删除权限
   */
  async deletePermission(permissionId: number): Promise<boolean> {
    // 检查是否为系统权限
    const permission = await this.db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.id, permissionId))
      .limit(1);

    if (permission.length === 0) {
      return false;
    }

    if (permission[0].isSystemPermission) {
      throw new Error('不能删除系统权限');
    }

    await this.db
      .delete(userPermissions)
      .where(eq(userPermissions.id, permissionId));

    return true;
  }

  /**
   * 为用户分配角色
   */
  async assignRoleToUser(userId: number, roleId: number, assignedBy: number, expiresAt?: Date): Promise<UserRoleRelation> {
    // 先停用该用户的现有角色关联
    await this.db
      .update(userRoleRelations)
      .set({ isActive: false })
      .where(eq(userRoleRelations.userId, userId));

    // 创建新的角色关联
    const result = await this.db
      .insert(userRoleRelations)
      .values({
        userId,
        roleId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        isActive: true,
        createdAt: new Date()
      })
      .returning();

    return result[0];
  }

  /**
   * 移除用户的角色
   */
  async removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    const result = await this.db
      .update(userRoleRelations)
      .set({ isActive: false })
      .where(and(
        eq(userRoleRelations.userId, userId),
        eq(userRoleRelations.roleId, roleId)
      ));

    return true;
  }

  /**
   * 获取用户的角色
   */
  async getUserRoles(userId: number): Promise<UserRole[]> {
    const result = await this.db
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
        eq(userRoleRelations.isActive, true),
        eq(userRoles.isActive, true)
      ));

    return result;
  }

  /**
   * 获取拥有特定角色的用户
   */
  async getUsersByRole(roleId: number): Promise<number[]> {
    const result = await this.db
      .select({ userId: userRoleRelations.userId })
      .from(userRoleRelations)
      .where(and(
        eq(userRoleRelations.roleId, roleId),
        eq(userRoleRelations.isActive, true)
      ));

    return result.map(item => item.userId);
  }

  /**
   * 获取所有权限资源类型
   */
  async getPermissionResources(): Promise<string[]> {
    const result = await this.db
      .select({ resource: userPermissions.resource })
      .from(userPermissions)
      .where(eq(userPermissions.isActive, true))
      .groupBy(userPermissions.resource);

    return result.map(item => item.resource);
  }

  /**
   * 获取特定资源的所有操作类型
   */
  async getPermissionActions(resource: string): Promise<string[]> {
    const result = await this.db
      .select({ action: userPermissions.action })
      .from(userPermissions)
      .where(and(
        eq(userPermissions.resource, resource),
        eq(userPermissions.isActive, true)
      ))
      .groupBy(userPermissions.action);

    return result.map(item => item.action);
  }

  /**
   * 检查用户是否有特定权限
   */
  async hasPermission(userId: number, resource: string, action: string): Promise<boolean> {
    // 获取用户角色
    const userRoles = await this.getUserRoles(userId);
    
    // 检查每个角色的权限
    for (const role of userRoles) {
      const permissions = JSON.parse(role.permissions || '[]');
      
      // 检查是否有通配符权限
      if (permissions.includes('*')) {
        return true;
      }
      
      // 检查是否有资源级权限
      if (permissions.includes(`${resource}:*`) || permissions.includes(`${resource}:${action}`)) {
        return true;
      }
    }

    return false;
  }
}