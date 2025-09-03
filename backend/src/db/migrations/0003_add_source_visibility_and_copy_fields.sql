-- Migration: Add source visibility and copy fields
-- 创建日期: 2025-09-03

-- 添加索引（列已在初始迁移中创建）
CREATE INDEX IF NOT EXISTS idx_sources_is_public ON sources(is_public);
CREATE INDEX IF NOT EXISTS idx_sources_original_source_id ON sources(original_source_id);