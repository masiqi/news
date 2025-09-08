-- 处理任务状态表
CREATE TABLE processing_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK(task_type IN ('rss_fetch', 'ai_process', 'content_storage', 'error_retry')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  title TEXT NOT NULL,
  description TEXT,
  error_message TEXT,
  result_data TEXT, -- JSON存储
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  estimated_duration INTEGER, -- 秒
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 状态历史记录表
CREATE TABLE status_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES processing_tasks(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
  message TEXT,
  metadata TEXT, -- JSON存储
  timestamp INTEGER NOT NULL
);

-- 用户统计摘要表
CREATE TABLE user_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  processing_tasks INTEGER NOT NULL DEFAULT 0,
  average_processing_time INTEGER DEFAULT 0, -- 秒
  tasks_today INTEGER NOT NULL DEFAULT 0,
  tasks_this_week INTEGER NOT NULL DEFAULT 0,
  tasks_this_month INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id)
);

-- 通知设置表
CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enable_realtime_notifications INTEGER NOT NULL DEFAULT 1,
  enable_email_notifications INTEGER NOT NULL DEFAULT 0,
  notify_on_completed INTEGER NOT NULL DEFAULT 1,
  notify_on_failed INTEGER NOT NULL DEFAULT 1,
  notify_on_error INTEGER NOT NULL DEFAULT 1,
  email_frequency TEXT NOT NULL DEFAULT 'immediate' CHECK(email_frequency IN ('immediate', 'daily', 'weekly')),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
  quiet_hours_start TEXT, -- HH:mm
  quiet_hours_end TEXT, -- HH:mm
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id)
);

-- 通知记录表
CREATE TABLE notification_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('task_completed', 'task_failed', 'task_progress', 'error', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT, -- JSON存储
  is_read INTEGER NOT NULL DEFAULT 0,
  sent_via TEXT NOT NULL DEFAULT 'realtime' CHECK(sent_via IN ('realtime', 'email')),
  scheduled_for INTEGER,
  sent_at INTEGER,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX idx_processing_tasks_user_id ON processing_tasks(user_id);
CREATE INDEX idx_processing_tasks_source_id ON processing_tasks(source_id);
CREATE INDEX idx_processing_tasks_status ON processing_tasks(status);
CREATE INDEX idx_processing_tasks_created_at ON processing_tasks(created_at);
CREATE INDEX idx_processing_tasks_started_at ON processing_tasks(started_at);

CREATE INDEX idx_status_histories_task_id ON status_histories(task_id);
CREATE INDEX idx_status_histories_timestamp ON status_histories(timestamp);

CREATE INDEX idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX idx_user_statistics_last_updated ON user_statistics(last_updated);

CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);

CREATE INDEX idx_notification_records_user_id ON notification_records(user_id);
CREATE INDEX idx_notification_records_is_read ON notification_records(is_read);
CREATE INDEX idx_notification_records_created_at ON notification_records(created_at);
CREATE INDEX idx_notification_records_scheduled_for ON notification_records(scheduled_for);