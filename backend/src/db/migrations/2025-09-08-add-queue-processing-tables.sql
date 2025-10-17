-- 队列处理跟踪表迁移
-- 添加异步处理管道所需的表

-- 队列处理状态跟踪表
CREATE TABLE processing_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 队列消息历史记录表
CREATE TABLE message_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retried', 'dead_letter')),
  timestamp TIMESTAMP NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  processing_time INTEGER,
  created_at TIMESTAMP NOT NULL
);

-- 队列统计信息表
CREATE TABLE queue_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_name TEXT NOT NULL,
  pending_messages INTEGER DEFAULT 0 NOT NULL,
  processing_messages INTEGER DEFAULT 0 NOT NULL,
  failed_messages INTEGER DEFAULT 0 NOT NULL,
  dead_letter_messages INTEGER DEFAULT 0 NOT NULL,
  average_processing_time INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX idx_processing_statuses_message_id ON processing_statuses(message_id);
CREATE INDEX idx_processing_statuses_user_id ON processing_statuses(user_id);
CREATE INDEX idx_processing_statuses_source_id ON processing_statuses(source_id);
CREATE INDEX idx_processing_statuses_status ON processing_statuses(status);
CREATE INDEX idx_processing_statuses_created_at ON processing_statuses(created_at);

CREATE INDEX idx_message_histories_message_id ON message_histories(message_id);
CREATE INDEX idx_message_histories_status ON message_histories(status);
CREATE INDEX idx_message_histories_timestamp ON message_histories(timestamp);
CREATE INDEX idx_message_histories_created_at ON message_histories(created_at);

CREATE INDEX idx_queue_stats_queue_name ON queue_stats(queue_name);
CREATE INDEX idx_queue_stats_last_updated ON queue_stats(last_updated);
CREATE INDEX idx_queue_stats_created_at ON queue_stats(created_at);