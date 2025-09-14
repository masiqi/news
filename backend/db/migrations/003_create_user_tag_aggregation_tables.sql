-- 迁移: 创建用户标签聚合表
-- 用于存储用户RSS源内容的主题和关键词聚合，支持快速查询

-- 用户主题聚合表
CREATE TABLE user_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户关键词聚合表
CREATE TABLE user_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  keyword_name TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 主题与内容条目关联表
CREATE TABLE topic_entry_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  processed_content_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES user_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES rss_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_content_id) REFERENCES processed_contents(id) ON DELETE CASCADE
);

-- 关键词与内容条目关联表
CREATE TABLE keyword_entry_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  keyword_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  processed_content_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (keyword_id) REFERENCES user_keywords(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES rss_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_content_id) REFERENCES processed_contents(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_user_topics_user_id ON user_topics(user_id);
CREATE INDEX idx_user_topics_topic_name ON user_topics(topic_name);
CREATE INDEX idx_user_topics_entry_count ON user_topics(entry_count);
CREATE INDEX idx_user_topics_last_used_at ON user_topics(last_used_at);
CREATE INDEX idx_user_topics_created_at ON user_topics(created_at);

CREATE INDEX idx_user_keywords_user_id ON user_keywords(user_id);
CREATE INDEX idx_user_keywords_keyword_name ON user_keywords(keyword_name);
CREATE INDEX idx_user_keywords_entry_count ON user_keywords(entry_count);
CREATE INDEX idx_user_keywords_last_used_at ON user_keywords(last_used_at);
CREATE INDEX idx_user_keywords_created_at ON user_keywords(created_at);

CREATE INDEX idx_topic_entry_relations_user_id ON topic_entry_relations(user_id);
CREATE INDEX idx_topic_entry_relations_topic_id ON topic_entry_relations(topic_id);
CREATE INDEX idx_topic_entry_relations_entry_id ON topic_entry_relations(entry_id);
CREATE INDEX idx_topic_entry_relations_processed_content_id ON topic_entry_relations(processed_content_id);
CREATE INDEX idx_topic_entry_relations_created_at ON topic_entry_relations(created_at);

CREATE INDEX idx_keyword_entry_relations_user_id ON keyword_entry_relations(user_id);
CREATE INDEX idx_keyword_entry_relations_keyword_id ON keyword_entry_relations(keyword_id);
CREATE INDEX idx_keyword_entry_relations_entry_id ON keyword_entry_relations(entry_id);
CREATE INDEX idx_keyword_entry_relations_processed_content_id ON keyword_entry_relations(processed_content_id);
CREATE INDEX idx_keyword_entry_relations_created_at ON keyword_entry_relations(created_at);

-- 创建唯一约束
CREATE UNIQUE INDEX unq_user_topics_user_topic ON user_topics(user_id, topic_name);
CREATE UNIQUE INDEX unq_user_keywords_user_keyword ON user_keywords(user_id, keyword_name);
CREATE UNIQUE INDEX unq_topic_entry_relations_topic_entry ON topic_entry_relations(topic_id, entry_id);
CREATE UNIQUE INDEX unq_keyword_entry_relations_keyword_entry ON keyword_entry_relations(keyword_id, entry_id);