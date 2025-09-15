-- 多用户R2访问控制数据库迁移
-- 为Story 2.5添加访问控制相关表和字段

-- 1. 扩展现有的sync_credentials表，添加访问控制字段
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS path_prefix TEXT NOT NULL DEFAULT '';
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS permissions_json TEXT; -- JSON格式存储详细权限
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS max_storage_bytes INTEGER DEFAULT 104857600; -- 100MB
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS current_storage_bytes INTEGER DEFAULT 0;
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS max_file_count INTEGER DEFAULT 1000;
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS current_file_count INTEGER DEFAULT 0;
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS is_readonly INTEGER DEFAULT 1; -- 1为只读，0为读写
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS token_hash TEXT; -- 用于访问控制的Token哈希
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP;
ALTER TABLE sync_credentials ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- 2. 创建用户R2访问配置表（更详细的访问控制）
CREATE TABLE IF NOT EXISTS user_r2_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_key_id TEXT NOT NULL UNIQUE,
  secret_access_key_hash TEXT NOT NULL, -- 加密存储
  path_prefix TEXT NOT NULL CHECK (path_prefix LIKE 'user-%/'), -- 用户专属路径前缀
  bucket_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'auto',
  endpoint TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '{"read": true, "write": false, "delete": false, "list": true}',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  max_storage_bytes INTEGER NOT NULL DEFAULT 104857600, -- 100MB
  current_storage_bytes INTEGER NOT NULL DEFAULT 0,
  max_file_count INTEGER NOT NULL DEFAULT 1000,
  current_file_count INTEGER NOT NULL DEFAULT 0,
  is_readonly INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 约束和索引
  CONSTRAINT unique_user_access UNIQUE (user_id),
  CONSTRAINT valid_path_prefix CHECK (path_prefix != '' AND path_prefix LIKE '%/')
);

-- 3. 创建访问权限表（细粒度权限控制）
CREATE TABLE IF NOT EXISTS r2_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_id INTEGER NOT NULL REFERENCES user_r2_access(id) ON DELETE CASCADE,
  resource_pattern TEXT NOT NULL, -- 资源路径模式，如 'user-123/news/*'
  actions TEXT NOT NULL, -- JSON数组，如 '["read", "write"]'
  conditions TEXT, -- JSON格式的条件
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_r2_permissions_access_id (access_id),
  INDEX idx_r2_permissions_resource (resource_pattern)
);

-- 4. 创建访问控制日志表
CREATE TABLE IF NOT EXISTS r2_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_id INTEGER NOT NULL REFERENCES user_r2_access(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('read', 'write', 'delete', 'list', 'head')),
  resource_path TEXT NOT NULL,
  resource_size INTEGER,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- 毫秒
  bytes_transferred INTEGER DEFAULT 0,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  request_headers TEXT, -- JSON格式
  response_headers TEXT, -- JSON格式
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_r2_access_logs_user_id (user_id),
  INDEX idx_r2_access_logs_access_id (access_id),
  INDEX idx_r2_access_logs_operation (operation),
  INDEX idx_r2_access_logs_timestamp (timestamp),
  INDEX idx_r2_access_logs_status_code (status_code)
);

-- 5. 创建用户目录配额表
CREATE TABLE IF NOT EXISTS user_directory_quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  max_storage_bytes INTEGER NOT NULL DEFAULT 104857600, -- 100MB
  max_file_count INTEGER NOT NULL DEFAULT 1000,
  current_storage_bytes INTEGER NOT NULL DEFAULT 0,
  current_file_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_user_directory_quotas_storage (current_storage_bytes),
  INDEX idx_user_directory_quotas_files (current_file_count)
);

-- 6. 创建访问令牌表（用于Worker代理）
CREATE TABLE IF NOT EXISTS access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_id INTEGER NOT NULL REFERENCES user_r2_access(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL DEFAULT 'bearer' CHECK (token_type IN ('bearer', 'api_key')),
  scope TEXT NOT NULL DEFAULT 'r2:read', -- 令牌作用域
  expires_at TIMESTAMP,
  is_revoked INTEGER NOT NULL DEFAULT 0 CHECK (is_revoked IN (0, 1)),
  last_used_at TIMESTAMP,
  usage_count INTEGER NOT NULL DEFAULT 0,
  ip_whitelist TEXT, -- JSON格式的IP白名单
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_access_tokens_user_id (user_id),
  INDEX idx_access_tokens_access_id (access_id),
  INDEX idx_access_tokens_token_hash (token_hash),
  INDEX idx_access_tokens_expires_at (expires_at),
  INDEX idx_access_tokens_is_revoked (is_revoked)
);

-- 7. 创建R2操作审计表
CREATE TABLE IF NOT EXISTS r2_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_id INTEGER NOT NULL REFERENCES user_r2_access(id) ON DELETE CASCADE,
  session_id TEXT, -- 会话标识
  operation TEXT NOT NULL,
  details TEXT, -- JSON格式的详细信息
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  is_suspicious INTEGER NOT NULL DEFAULT 0 CHECK (is_suspicious IN (0, 1)),
  flagged_for_review INTEGER NOT NULL DEFAULT 0 CHECK (flagged_for_review IN (0, 1)),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_r2_audit_logs_user_id (user_id),
  INDEX idx_r2_audit_logs_operation (operation),
  INDEX idx_r2_audit_logs_risk_level (risk_level),
  INDEX idx_r2_audit_logs_timestamp (timestamp),
  INDEX idx_r2_audit_logs_suspicious (is_suspicious)
);

-- 8. 创建触发器以自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_user_r2_access_updated_at 
    AFTER UPDATE ON user_r2_access
    FOR EACH ROW
BEGIN
    UPDATE user_r2_access SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_r2_permissions_updated_at 
    AFTER UPDATE ON r2_permissions
    FOR EACH ROW
BEGIN
    UPDATE r2_permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_access_tokens_updated_at 
    AFTER UPDATE ON access_tokens
    FOR EACH ROW
BEGIN
    UPDATE access_tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_directory_quotas_updated_at 
    AFTER UPDATE ON user_directory_quotas
    FOR EACH ROW
BEGIN
    UPDATE user_directory_quotas SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 9. 创建视图用于查询用户访问统计
CREATE VIEW IF NOT EXISTS user_access_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(ura.current_storage_bytes, 0) as storage_used,
    COALESCE(ura.max_storage_bytes, 0) as storage_limit,
    COALESCE(ura.current_file_count, 0) as files_used,
    COALESCE(ura.max_file_count, 0) as files_limit,
    COALESCE(COUNT(DISTINCT ral.id), 0) as total_accesses,
    COALESCE(MAX(ral.timestamp), CURRENT_TIMESTAMP) as last_access,
    COALESCE(COUNT(DISTINCT ral.session_id), 0) as active_sessions,
    CASE 
        WHEN ura.is_active = 1 AND (ura.expires_at IS NULL OR ura.expires_at > CURRENT_TIMESTAMP) THEN 'active'
        WHEN ura.expires_at IS NOT NULL AND ura.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'inactive'
    END as status
FROM users u
LEFT JOIN user_r2_access ura ON u.id = ura.user_id
LEFT JOIN r2_access_logs ral ON ura.id = ral.access_id
GROUP BY u.id, u.email, ura.current_storage_bytes, ura.max_storage_bytes, 
         ura.current_file_count, ura.max_file_count, ura.is_active, ura.expires_at;

-- 10. 插入默认配置数据
INSERT OR IGNORE INTO user_directory_quotas (user_id, max_storage_bytes, max_file_count) 
SELECT id, 104857600, 1000 FROM users WHERE id NOT IN (SELECT user_id FROM user_directory_quotas);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_sync_credentials_path_prefix ON sync_credentials(path_prefix);
CREATE INDEX IF NOT EXISTS idx_sync_credentials_permissions ON sync_credentials(permissions_json);
CREATE INDEX IF NOT EXISTS idx_sync_credentials_token_hash ON sync_credentials(token_hash);

-- 完成迁移标记
UPDATE drizzle_migrations SET name = '2025-09-14-add-multiuser-r2-access' WHERE name = 'pending';