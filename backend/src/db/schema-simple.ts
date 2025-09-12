// 简化版数据库schema - 仅包含用户管理相关表
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: text('status').notNull().default('active'),
  role: text('role').notNull().default('user'),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  loginCount: integer('login_count').default(0).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  lastLoginIp: text('last_login_ip'),
  registeredIp: text('registered_ip'),
  riskLevel: text('risk_level').notNull().default('low'),
  riskScore: integer('risk_score').default(0).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  statusIdx: index('idx_users_status').on(table.status),
  roleIdx: index('idx_users_role').on(table.role),
  createdAtIdx: index('idx_users_created_at').on(table.createdAt),
}));

// 用户角色表
export const userRoles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  permissions: text('permissions').notNull(), // JSON字符串
  isSystemRole: integer('is_system_role', { mode: 'boolean' }).default(false).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  nameIdx: index('idx_user_roles_name').on(table.name),
  isActiveIdx: index('idx_user_roles_is_active').on(table.isActive),
}));

// 用户权限表
export const userPermissions = sqliteTable('user_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  conditions: text('conditions'), // JSON字符串
  isSystemPermission: integer('is_system_permission', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  resourceActionIdx: index('idx_user_permissions_resource_action').on(table.resource, table.action),
  isSystemPermissionIdx: index('idx_user_permissions_is_system_permission').on(table.isSystemPermission),
}));

// 用户角色关系表
export const userRoleRelations = sqliteTable('user_role_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => userRoles.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
}, (table) => ({
  userIdIdx: index('idx_user_role_relations_user_id').on(table.userId),
  roleIdIdx: index('idx_user_role_relations_role_id').on(table.roleId),
  isActiveIdx: index('idx_user_role_relations_is_active').on(table.isActive),
  userIdRoleIdIdx: index('idx_user_role_relations_user_id_role_id').on(table.userId, table.roleId),
}));

// 用户操作日志表
export const userOperationLogs = sqliteTable('user_operation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id').references(() => users.id, { onDelete: 'set null' }),
  operation: text('operation').notNull(),
  details: text('details').notNull(), // JSON字符串
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_operation_logs_user_id').on(table.userId),
  adminIdIdx: index('idx_user_operation_logs_admin_id').on(table.adminId),
  operationIdx: index('idx_user_operation_logs_operation').on(table.operation),
  timestampIdx: index('idx_user_operation_logs_timestamp').on(table.timestamp),
}));

// 用户会话表
export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_sessions_user_id').on(table.userId),
  sessionIdIdx: index('idx_user_sessions_session_id').on(table.sessionId),
  isActiveIdx: index('idx_user_sessions_is_active').on(table.isActive),
  expiresAtIdx: index('idx_user_sessions_expires_at').on(table.expiresAt),
}));

// 用户设置表
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdKeyIdx: index('idx_user_settings_user_id_key').on(table.userId, table.key),
  userIdIdx: index('idx_user_settings_user_id').on(table.userId),
}));

export * from './schema';