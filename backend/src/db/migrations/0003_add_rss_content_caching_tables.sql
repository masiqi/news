-- Migration: Add RSS content caching and sharing optimization tables
-- 创建日期: 2025-09-03

-- 创建RSS条目表
CREATE TABLE rss_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  content TEXT,
  published_at INTEGER NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 创建处理后的内容表
CREATE TABLE processed_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES rss_entries(id),
  summary TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  keywords TEXT,
  sentiment TEXT,
  processing_time INTEGER,
  model_used TEXT,
  created_at INTEGER NOT NULL
);

-- 创建用户笔记表
CREATE TABLE user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  entry_id INTEGER NOT NULL REFERENCES rss_entries(id),
  processed_content_id INTEGER NOT NULL REFERENCES processed_contents(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  personal_tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 添加索引
CREATE INDEX idx_rss_entries_source_id ON rss_entries(source_id);
CREATE INDEX idx_rss_entries_guid ON rss_entries(guid);
CREATE INDEX idx_rss_entries_processed ON rss_entries(processed);
CREATE INDEX idx_processed_contents_entry_id ON processed_contents(entry_id);
CREATE INDEX idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_user_notes_entry_id ON user_notes(entry_id);
CREATE INDEX idx_user_notes_processed_content_id ON user_notes(processed_content_id);
CREATE INDEX idx_user_notes_favorite ON user_notes(is_favorite);
CREATE INDEX idx_user_notes_read_status ON user_notes(read_status);