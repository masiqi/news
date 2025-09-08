-- 兴趣分类表
CREATE TABLE interest_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  parent_id INTEGER REFERENCES interest_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  related_tags TEXT, -- JSON数组
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 用户兴趣偏好表
CREATE TABLE user_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES interest_categories(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK(level IN ('low', 'medium', 'high')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
  selected_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 兴趣与RSS源的映射表
CREATE TABLE interest_source_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES interest_categories(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL DEFAULT 50 CHECK(relevance_score BETWEEN 0 AND 100),
  match_score INTEGER NOT NULL DEFAULT 50 CHECK(match_score BETWEEN 0 AND 100),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 用户引导状态表
CREATE TABLE onboarding_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK(step IN ('welcome', 'interests', 'recommendations', 'confirmation', 'completed', 'skipped')),
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 4,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  selected_interests TEXT, -- JSON数组
  recommended_sources TEXT, -- JSON数组
  confirmed_sources TEXT, -- JSON数组
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX idx_user_interests_category_id ON user_interests(category_id);
CREATE INDEX idx_interest_source_mappings_category_id ON interest_source_mappings(category_id);
CREATE INDEX idx_interest_source_mappings_source_id ON interest_source_mappings(source_id);
CREATE INDEX idx_onboarding_statuses_user_id ON onboarding_statuses(user_id);
CREATE INDEX idx_onboarding_statuses_step ON onboarding_statuses(step);
CREATE INDEX idx_interest_categories_parent_id ON interest_categories(parent_id);
CREATE INDEX idx_interest_categories_active ON interest_categories(is_active);