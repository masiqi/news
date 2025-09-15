-- 添加用户自动存储配置相关表
-- 用于管理用户的markdown自动存储偏好设置和统计信息

-- 用户自动存储配置表
CREATE TABLE IF NOT EXISTS user_auto_storage_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    storage_path TEXT NOT NULL DEFAULT 'notes',
    filename_pattern TEXT NOT NULL DEFAULT '{title}_{id}_{date}',
    max_file_size INTEGER NOT NULL DEFAULT 1048576, -- 1MB
    max_files_per_day INTEGER NOT NULL DEFAULT 100,
    include_metadata INTEGER NOT NULL DEFAULT 1 CHECK (include_metadata IN (0, 1)),
    file_format TEXT NOT NULL DEFAULT 'standard' CHECK (file_format IN ('standard', 'academic', 'concise')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户存储日志表
CREATE TABLE IF NOT EXISTS user_storage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    entry_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    processing_time INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES rss_entries(id) ON DELETE CASCADE
);

-- 用户存储统计表
CREATE TABLE IF NOT EXISTS user_storage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_size INTEGER NOT NULL DEFAULT 0,
    today_files INTEGER NOT NULL DEFAULT 0,
    today_size INTEGER NOT NULL DEFAULT 0,
    last_storage_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_auto_storage_configs_user_id ON user_auto_storage_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auto_storage_configs_enabled ON user_auto_storage_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_user_auto_storage_configs_file_format ON user_auto_storage_configs(file_format);
CREATE INDEX IF NOT EXISTS idx_user_auto_storage_configs_created_at ON user_auto_storage_configs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_storage_logs_user_id ON user_storage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_logs_source_id ON user_storage_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_logs_entry_id ON user_storage_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_logs_status ON user_storage_logs(status);
CREATE INDEX IF NOT EXISTS idx_user_storage_logs_created_at ON user_storage_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_storage_stats_user_id ON user_storage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_stats_created_at ON user_storage_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_user_storage_stats_updated_at ON user_storage_stats(updated_at);

-- 为现有用户创建默认自动存储配置
INSERT OR IGNORE INTO user_auto_storage_configs (user_id, enabled, storage_path, filename_pattern, max_file_size, max_files_per_day, include_metadata, file_format, created_at, updated_at)
SELECT 
    id as user_id,
    1 as enabled,
    'notes' as storage_path,
    '{title}_{id}_{date}' as filename_pattern,
    1048576 as max_file_size,
    100 as max_files_per_day,
    1 as include_metadata,
    'standard' as file_format,
    strftime('%s', 'now') as created_at,
    strftime('%s', 'now') as updated_at
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_auto_storage_configs);

-- 为现有用户创建存储统计记录
INSERT OR IGNORE INTO user_storage_stats (user_id, total_files, total_size, today_files, today_size, created_at, updated_at)
SELECT 
    id as user_id,
    0 as total_files,
    0 as total_size,
    0 as today_files,
    0 as today_size,
    strftime('%s', 'now') as created_at,
    strftime('%s', 'now') as updated_at
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_storage_stats);