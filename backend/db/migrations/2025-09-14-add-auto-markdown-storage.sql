-- 用户自动存储设置表
-- 管理用户的markdown自动存储偏好设置

CREATE TABLE IF NOT EXISTS user_auto_storage_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    storage_path TEXT DEFAULT 'notes' NOT NULL,
    filename_pattern TEXT DEFAULT '{title}_{id}_{date}' NOT NULL,
    max_file_size INTEGER DEFAULT 1048576 NOT NULL, -- 1MB
    max_files_per_day INTEGER DEFAULT 100 NOT NULL,
    include_metadata BOOLEAN DEFAULT TRUE NOT NULL,
    file_format TEXT DEFAULT 'standard' NOT NULL CHECK(file_format IN ('standard', 'academic', 'concise')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- 确保每个用户只有一条设置记录
    UNIQUE(user_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_auto_storage_settings_user_id 
    ON user_auto_storage_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_user_auto_storage_settings_enabled 
    ON user_auto_storage_settings(enabled);

CREATE INDEX IF NOT EXISTS idx_user_auto_storage_settings_created_at 
    ON user_auto_storage_settings(created_at);

-- Markdown存储日志表
-- 记录自动存储操作的详细日志

CREATE TABLE IF NOT EXISTS markdown_storage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    entry_id INTEGER REFERENCES rss_entries(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_status TEXT DEFAULT 'success' NOT NULL CHECK(storage_status IN ('success', 'failed', 'skipped')),
    error_message TEXT,
    processing_time INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_markdown_storage_logs_user_id 
    ON markdown_storage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_markdown_storage_logs_source_id 
    ON markdown_storage_logs(source_id);

CREATE INDEX IF NOT EXISTS idx_markdown_storage_logs_entry_id 
    ON markdown_storage_logs(entry_id);

CREATE INDEX IF NOT EXISTS idx_markdown_storage_logs_status 
    ON markdown_storage_logs(storage_status);

CREATE INDEX IF NOT EXISTS idx_markdown_storage_logs_created_at 
    ON markdown_storage_logs(created_at);

-- 用户存储统计表
-- 维护用户存储使用的统计信息

CREATE TABLE IF NOT EXISTS user_storage_statistics (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_files INTEGER DEFAULT 0 NOT NULL,
    total_size INTEGER DEFAULT 0 NOT NULL,
    today_files INTEGER DEFAULT 0 NOT NULL,
    today_size INTEGER DEFAULT 0 NOT NULL,
    last_storage_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_storage_statistics_today_files 
    ON user_storage_statistics(today_files);

CREATE INDEX IF NOT EXISTS idx_user_storage_statistics_last_storage_at 
    ON user_storage_statistics(last_storage_at);

-- 插入触发器：自动创建用户默认设置
CREATE TRIGGER IF NOT EXISTS create_default_auto_storage_settings
    AFTER INSERT ON users
    FOR EACH ROW
BEGIN
        INSERT INTO user_auto_storage_settings (
            user_id, enabled, storage_path, filename_pattern, 
            max_file_size, max_files_per_day, include_metadata, file_format
        ) VALUES (
            NEW.id, TRUE, 'notes', '{title}_{id}_{date}', 
            1048576, 100, TRUE, 'standard'
        );
    END;

-- 更新触发器：自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_auto_storage_settings_timestamp
    AFTER UPDATE ON user_auto_storage_settings
    FOR EACH ROW
    BEGIN
        UPDATE user_auto_storage_settings 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- 更新触发器：自动更新统计时间戳
CREATE TRIGGER IF NOT EXISTS update_storage_statistics_timestamp
    AFTER UPDATE ON user_storage_statistics
    FOR EACH ROW
    BEGIN
        UPDATE user_storage_statistics 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = NEW.user_id;
    END;

-- 创建视图：用户存储概览
CREATE VIEW IF NOT EXISTS user_storage_overview AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(ass.enabled, TRUE) as auto_storage_enabled,
    COALESCE(ass.storage_path, 'notes') as storage_path,
    COALESCE(ass.file_format, 'standard') as file_format,
    COALESCE(uss.total_files, 0) as total_files,
    COALESCE(uss.total_size, 0) as total_size,
    COALESCE(uss.today_files, 0) as today_files,
    COALESCE(uss.today_size, 0) as today_size,
    uss.last_storage_at,
    ass.created_at as settings_created_at,
    ass.updated_at as settings_updated_at
FROM users u
LEFT JOIN user_auto_storage_settings ass ON u.id = ass.user_id
LEFT JOIN user_storage_statistics uss ON u.id = uss.user_id;

-- 创建视图：存储日志统计
CREATE VIEW IF NOT EXISTS storage_log_statistics AS
SELECT 
    DATE(created_at) as date,
    storage_status,
    COUNT(*) as count,
    SUM(file_size) as total_size,
    AVG(processing_time) as avg_processing_time
FROM markdown_storage_logs 
GROUP BY DATE(created_at), storage_status
ORDER BY date DESC, storage_status;

