-- 用户管理系统数据库迁移
-- 创建基本表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    role TEXT NOT NULL DEFAULT 'user',
    is_verified INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0,
    last_login_at INTEGER,
    last_login_ip TEXT,
    registered_ip TEXT,
    risk_level TEXT NOT NULL DEFAULT 'low',
    risk_score INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL,
    is_system_role INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 用户权限表
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    conditions TEXT,
    is_system_permission INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 用户角色关系表
CREATE TABLE IF NOT EXISTS user_role_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_by INTEGER,
    assigned_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES user_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 用户操作日志表
CREATE TABLE IF NOT EXISTS user_operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    admin_id INTEGER,
    operation TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_user_roles_name ON user_roles(name);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);

CREATE INDEX IF NOT EXISTS idx_user_permissions_resource_action ON user_permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_permissions_is_system_permission ON user_permissions(is_system_permission);

CREATE INDEX IF NOT EXISTS idx_user_role_relations_user_id ON user_role_relations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_relations_role_id ON user_role_relations(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_relations_is_active ON user_role_relations(is_active);
CREATE INDEX IF NOT EXISTS idx_user_role_relations_user_id_role_id ON user_role_relations(user_id, role_id);

CREATE INDEX IF NOT EXISTS idx_user_operation_logs_user_id ON user_operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_operation_logs_admin_id ON user_operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_user_operation_logs_operation ON user_operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_user_operation_logs_timestamp ON user_operation_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id_key ON user_settings(user_id, key);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 插入默认角色
INSERT OR IGNORE INTO user_roles (name, description, permissions, is_system_role, is_active, created_at, updated_at) VALUES 
('admin', '系统管理员', '["*"]', 1, 1, strftime('%s', 'now'), strftime('%s', 'now')),
('user', '普通用户', '["read", "write"]', 1, 1, strftime('%s', 'now'), strftime('%s', 'now')),
('super_admin', '超级管理员', '["*"]', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'));

-- 插入默认权限
INSERT OR IGNORE INTO user_permissions (name, description, resource, action, is_system_permission, created_at) VALUES 
('用户管理', '管理用户账户', 'users', '*', 1, strftime('%s', 'now')),
('角色管理', '管理角色和权限', 'roles', '*', 1, strftime('%s', 'now')),
('系统管理', '系统配置管理', 'system', '*', 1, strftime('%s', 'now')),
('内容管理', '管理内容', 'content', '*', 1, strftime('%s', 'now')),
('查看用户', '查看用户信息', 'users', 'read', 1, strftime('%s', 'now')),
('创建用户', '创建新用户', 'users', 'create', 1, strftime('%s', 'now')),
('更新用户', '更新用户信息', 'users', 'update', 1, strftime('%s', 'now')),
('删除用户', '删除用户', 'users', 'delete', 1, strftime('%s', 'now'));

-- 插入测试用户
INSERT OR IGNORE INTO users (email, password_hash, status, role, is_verified, login_count, risk_level, risk_score, created_at, updated_at) VALUES 
('admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6', 'active', 'admin', 1, 0, 'low', 0, strftime('%s', 'now'), strftime('%s', 'now')),
('user@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6', 'active', 'user', 1, 0, 'low', 0, strftime('%s', 'now'), strftime('%s', 'now')),
('test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6', 'inactive', 'user', 0, 0, 'medium', 30, strftime('%s', 'now'), strftime('%s', 'now'));