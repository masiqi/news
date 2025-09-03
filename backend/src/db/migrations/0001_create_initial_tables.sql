-- Migration: Create initial tables
-- 创建日期: 2025-09-03

-- 创建用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 创建RSS源表
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0, -- 是否为公共源
  original_source_id INTEGER, -- 复制自哪个源（自引用）
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建RSS条目表
CREATE TABLE rss_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  content TEXT,
  published_at INTEGER NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- 创建处理后的内容表
CREATE TABLE processed_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  summary TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  keywords TEXT,
  sentiment TEXT,
  processing_time INTEGER,
  model_used TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES rss_entries(id)
);

-- 创建用户笔记表
CREATE TABLE user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  processed_content_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  personal_tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES rss_entries(id),
  FOREIGN KEY (processed_content_id) REFERENCES processed_contents(id)
);

-- 创建同步凭证表
CREATE TABLE sync_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  access_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 添加索引
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_is_public ON sources(is_public);
CREATE INDEX idx_sources_original_source_id ON sources(original_source_id);
CREATE INDEX idx_rss_entries_source_id ON rss_entries(source_id);
CREATE INDEX idx_rss_entries_guid ON rss_entries(guid);
CREATE INDEX idx_rss_entries_processed ON rss_entries(processed);
CREATE INDEX idx_processed_contents_entry_id ON processed_contents(entry_id);
CREATE INDEX idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_user_notes_entry_id ON user_notes(entry_id);
CREATE INDEX idx_user_notes_processed_content_id ON user_notes(processed_content_id);
CREATE INDEX idx_user_notes_favorite ON user_notes(is_favorite);
CREATE INDEX idx_user_notes_read_status ON user_notes(read_status);
CREATE INDEX idx_sync_credentials_user_id ON sync_credentials(user_id);