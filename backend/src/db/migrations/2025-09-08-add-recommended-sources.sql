-- 推荐源功能数据库迁移
-- 扩展现有sources表，添加推荐相关字段
-- 创建推荐源分类和标签系统表

-- 1. 扩展sources表，添加推荐相关字段
ALTER TABLE sources ADD COLUMN is_recommended INTEGER DEFAULT 0 NOT NULL CHECK (is_recommended IN (0, 1));
ALTER TABLE sources ADD COLUMN recommendation_level TEXT DEFAULT 'basic' NOT NULL CHECK (recommendation_level IN ('basic', 'premium', 'featured'));
ALTER TABLE sources ADD COLUMN quality_availability INTEGER DEFAULT 0 NOT NULL CHECK (quality_availability >= 0 AND quality_availability <= 100);
ALTER TABLE sources ADD COLUMN quality_content_quality INTEGER DEFAULT 0 NOT NULL CHECK (quality_content_quality >= 0 AND quality_content_quality <= 100);
ALTER TABLE sources ADD COLUMN quality_update_frequency INTEGER DEFAULT 0 NOT NULL CHECK (quality_update_frequency >= 0 AND quality_update_frequency <= 100);
ALTER TABLE sources ADD COLUMN quality_last_validated_at INTEGER;
ALTER TABLE sources ADD COLUMN quality_validation_status TEXT DEFAULT 'pending' NOT NULL CHECK (quality_validation_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE sources ADD COLUMN quality_validation_notes TEXT;
ALTER TABLE sources ADD COLUMN statistics_total_subscribers INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sources ADD COLUMN statistics_active_subscribers INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sources ADD COLUMN statistics_average_usage REAL DEFAULT 0.0 NOT NULL;
ALTER TABLE sources ADD COLUMN statistics_satisfaction REAL DEFAULT 0.0 NOT NULL CHECK (statistics_satisfaction >= 0 AND statistics_satisfaction <= 5);
ALTER TABLE sources ADD COLUMN recommended_by INTEGER REFERENCES users(id);
ALTER TABLE sources ADD COLUMN recommended_at INTEGER;

-- 2. 创建推荐源分类表
CREATE TABLE source_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL CHECK (is_active IN (0, 1)),
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 3. 创建推荐源标签表
CREATE TABLE source_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL CHECK (is_active IN (0, 1)),
    usage_count INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 4. 创建推荐源与分类的关联表
CREATE TABLE source_category_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES source_categories(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(source_id, category_id)
);

-- 5. 创建推荐源与标签的关联表
CREATE TABLE source_tag_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES source_tags(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(source_id, tag_id)
);

-- 6. 创建推荐源验证历史表
CREATE TABLE source_validation_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    validation_type TEXT NOT NULL CHECK (validation_type IN ('automatic', 'manual')),
    availability_score INTEGER CHECK (availability_score >= 0 AND availability_score <= 100),
    content_quality_score INTEGER CHECK (content_quality_score >= 0 AND content_quality_score <= 100),
    update_frequency_score INTEGER CHECK (update_frequency_score >= 0 AND update_frequency_score <= 100),
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning')),
    error_message TEXT,
    validation_details TEXT, -- JSON格式存储详细验证信息
    validated_by INTEGER REFERENCES users(id),
    validated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- 7. 创建索引以提高查询性能
CREATE INDEX idx_sources_is_recommended ON sources(is_recommended);
CREATE INDEX idx_sources_recommendation_level ON sources(recommendation_level);
CREATE INDEX idx_sources_quality_validation_status ON sources(quality_validation_status);
CREATE INDEX idx_source_categories_is_active ON source_categories(is_active);
CREATE INDEX idx_source_tags_is_active ON source_tags(is_active);
CREATE INDEX idx_source_category_relations_source_id ON source_category_relations(source_id);
CREATE INDEX idx_source_category_relations_category_id ON source_category_relations(category_id);
CREATE INDEX idx_source_tag_relations_source_id ON source_tag_relations(source_id);
CREATE INDEX idx_source_tag_relations_tag_id ON source_tag_relations(tag_id);
CREATE INDEX idx_source_validation_histories_source_id ON source_validation_histories(source_id);
CREATE INDEX idx_source_validation_histories_status ON source_validation_histories(status);
CREATE INDEX idx_source_validation_histories_validated_at ON source_validation_histories(validated_at);

-- 8. 插入默认分类数据
INSERT INTO source_categories (name, description, icon, color, is_active, sort_order, created_at, updated_at) VALUES
('科技新闻', '最新的科技行业新闻和资讯', '📱', '#3B82F6', 1, 1, strftime('%s', 'now'), strftime('%s', 'now')),
('财经资讯', '金融市场和投资相关信息', '💰', '#10B981', 1, 2, strftime('%s', 'now'), strftime('%s', 'now')),
('政治时政', '国内外政治新闻和分析', '🏛️', '#EF4444', 1, 3, strftime('%s', 'now'), strftime('%s', 'now')),
('文化艺术', '文化、艺术和娱乐新闻', '🎨', '#8B5CF6', 1, 4, strftime('%s', 'now'), strftime('%s', 'now')),
('体育健身', '体育赛事和健身资讯', '⚽', '#F59E0B', 1, 5, strftime('%s', 'now'), strftime('%s', 'now')),
('生活健康', '健康生活方式和医疗资讯', '🌱', '#059669', 1, 6, strftime('%s', 'now'), strftime('%s', 'now')),
('教育学术', '教育资源和学术研究', '📚', '#6366F1', 1, 7, strftime('%s', 'now'), strftime('%s', 'now')),
('旅游探索', '旅游攻略和探索资讯', '✈️', '#0EA5E9', 1, 8, strftime('%s', 'now'), strftime('%s', 'now'));

-- 9. 插入默认标签数据
INSERT INTO source_tags (name, description, color, is_active, usage_count, created_at, updated_at) VALUES
('官方发布', '来自官方媒体的新闻源', '#1F2937', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('专业深度', '提供深度分析的专业媒体', '#7C3AED', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('实时更新', '更新频率高的新闻源', '#DC2626', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('内容优质', '内容质量高、可读性强', '#059669', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('多媒体丰富', '包含图片、视频等多媒体内容', '#0891B2', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('独立媒体', '独立新闻机构的报道', '#EA580C', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('数据驱动', '基于数据分析和统计的报道', '#BE185D', 1, 0, strftime('%s', 'now'), strftime('%s', 'now')),
('国际视野', '具有国际视野的新闻源', '#1E40AF', 1, 0, strftime('%s', 'now'), strftime('%s', 'now'));