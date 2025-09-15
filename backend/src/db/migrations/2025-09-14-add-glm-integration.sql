-- GLM API集成和并发控制
-- 创建GLM相关表结构，支持API调用管理、并发控制和成本统计

-- GLM配置表
CREATE TABLE IF NOT EXISTS glm_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT DEFAULT 'https://open.bigmodel.cn/api/paas/v4',
  model TEXT NOT NULL DEFAULT 'glm-4',
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  temperature REAL NOT NULL DEFAULT 0.7,
  timeout INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  max_concurrency INTEGER NOT NULL DEFAULT 1,
  daily_limit INTEGER DEFAULT 100,
  monthly_limit INTEGER DEFAULT 3000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- GLM API调用统计表
CREATE TABLE IF NOT EXISTS glm_usage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD格式
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  average_response_time REAL NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES glm_configs(id) ON DELETE CASCADE,
  UNIQUE(user_id, config_id, date)
);

-- GLM请求队列表
CREATE TABLE IF NOT EXISTS glm_request_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_id INTEGER NOT NULL,
  content_id TEXT,
  request_id TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at DATETIME,
  error_message TEXT,
  result_data TEXT, -- JSON格式存储GLM响应
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  cost REAL,
  response_time INTEGER, -- 毫秒
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES glm_configs(id) ON DELETE CASCADE
);

-- GLM API调用日志表
CREATE TABLE IF NOT EXISTS glm_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  request_prompt TEXT NOT NULL,
  request_parameters TEXT, -- JSON格式
  response_success BOOLEAN NOT NULL,
  response_data TEXT, -- JSON格式
  response_error TEXT,
  status_code INTEGER,
  response_time INTEGER NOT NULL, -- 毫秒
  tokens_used INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_type TEXT,
  error_details TEXT, -- JSON格式
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES glm_configs(id) ON DELETE CASCADE
);

-- GLM实时监控表
CREATE TABLE IF NOT EXISTS glm_monitoring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL, -- 'concurrency', 'queue_length', 'error_rate', 'response_time'
  metric_value REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  additional_data TEXT, -- JSON格式存储额外信息
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES glm_configs(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_glm_configs_user_id ON glm_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_glm_configs_active ON glm_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_glm_usage_stats_user_date ON glm_usage_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_glm_usage_stats_config_date ON glm_usage_stats(config_id, date);
CREATE INDEX IF NOT EXISTS idx_glm_request_queue_user_id ON glm_request_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_glm_request_queue_status ON glm_request_queue(status);
CREATE INDEX IF NOT EXISTS idx_glm_request_queue_priority ON glm_request_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_glm_request_queue_request_id ON glm_request_queue(request_id);
CREATE INDEX IF NOT EXISTS idx_glm_request_queue_next_retry ON glm_request_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_glm_call_logs_user_id ON glm_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_glm_call_logs_timestamp ON glm_call_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_glm_call_logs_request_id ON glm_call_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_glm_monitoring_user_metric ON glm_monitoring(user_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_glm_monitoring_timestamp ON glm_monitoring(timestamp);

-- 创建触发器自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_glm_configs_updated_at 
    AFTER UPDATE ON glm_configs
    FOR EACH ROW
BEGIN
        UPDATE glm_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_glm_usage_stats_updated_at 
    AFTER UPDATE ON glm_usage_stats
    FOR EACH ROW
BEGIN
        UPDATE glm_usage_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;