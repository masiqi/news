-- 用户管理功能数据库迁移
-- 创建用户角色和权限管理相关表

-- 1. 扩展用户表，添加管理相关字段
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));
ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN last_login_ip TEXT;
ALTER TABLE users ADD COLUMN registered_ip TEXT;
ALTER TABLE users ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high'));
ALTER TABLE users ADD COLUMN risk_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN notes TEXT;
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. 创建用户角色表
CREATE TABLE user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT NOT NULL, -- JSON格式存储权限列表
  is_system_role INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建用户权限表
CREATE TABLE user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL, -- 资源类型，如 'users', 'sources', 'admin'
  action TEXT NOT NULL, -- 操作类型，如 'read', 'write', 'delete', 'admin'
  conditions TEXT, -- JSON格式存储条件
  is_system_permission INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建用户角色关联表
CREATE TABLE user_role_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. 创建用户操作日志表
CREATE TABLE user_operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'status_change', 'role_change', 'login', 'logout')),
  details TEXT, -- JSON格式存储操作详情
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure')),
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. 创建用户会话表
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. 创建用户设置表
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  theme TEXT NOT NULL DEFAULT 'light',
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  email_notifications INTEGER NOT NULL DEFAULT 1,
  daily_digest INTEGER NOT NULL DEFAULT 0,
  settings TEXT, -- JSON格式存储其他设置
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_verified ON users(is_verified);
CREATE INDEX idx_users_risk_level ON users(risk_level);
CREATE INDEX idx_users_updated_at ON users(updated_at);

CREATE INDEX idx_user_roles_name ON user_roles(name);
CREATE INDEX idx_user_roles_is_active ON user_roles(is_active);

CREATE INDEX idx_user_permissions_resource_action ON user_permissions(resource, action);
CREATE INDEX idx_user_permissions_is_active ON user_permissions(is_active);

CREATE INDEX idx_user_role_relations_user_id ON user_role_relations(user_id);
CREATE INDEX idx_user_role_relations_role_id ON user_role_relations(role_id);
CREATE INDEX idx_user_role_relations_is_active ON user_role_relations(is_active);

CREATE INDEX idx_user_operation_logs_user_id ON user_operation_logs(user_id);
CREATE INDEX idx_user_operation_logs_admin_id ON user_operation_logs(admin_id);
CREATE INDEX idx_user_operation_logs_operation ON user_operation_logs(operation);
CREATE INDEX idx_user_operation_logs_timestamp ON user_operation_logs(timestamp);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- 插入默认的系统角色
INSERT INTO user_roles (name, description, permissions, is_system_role, sort_order) VALUES 
('普通用户', '拥有基本的用户功能权限', '["read_profile", "update_profile", "manage_sources", "read_content"]', 1, 1),
('管理员', '拥有管理权限，可以管理用户和内容', '["read_profile", "update_profile", "manage_sources", "read_content", "manage_users", "manage_admin", "system_config"]', 1, 2),
('超级管理员', '拥有所有权限，包括系统配置', '["*"]', 1, 3);

-- 插入默认的系统权限
INSERT INTO user_permissions (name, description, resource, action, is_system_permission) VALUES 
('读取用户资料', '允许用户查看自己的资料', 'users', 'read', 1),
('更新用户资料', '允许用户更新自己的资料', 'users', 'update', 1),
('管理用户', '允许管理员管理用户账户', 'users', 'admin', 1),
('读取内容', '允许用户读取内容', 'content', 'read', 1),
('管理RSS源', '允许用户管理自己的RSS源', 'sources', 'manage', 1),
('管理推荐源', '允许管理员管理推荐源', 'sources', 'admin', 1),
('系统配置', '允许超级管理员进行系统配置', 'system', 'config', 1),
('查看统计', '允许管理员查看系统统计', 'statistics', 'read', 1),
('管理角色权限', '允许超级管理员管理角色和权限', 'roles', 'admin', 1),
('查看操作日志', '允许管理员查看用户操作日志', 'logs', 'read', 1);

-- 创建触发器，自动更新 updated_at 字段
CREATE TRIGGER update_users_updated_at 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_roles_updated_at 
AFTER UPDATE ON user_roles
FOR EACH ROW
BEGIN
  UPDATE user_roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_settings_updated_at 
AFTER UPDATE ON user_settings
FOR EACH ROW
BEGIN
  UPDATE user_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;