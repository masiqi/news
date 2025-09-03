-- Migration: Add source visibility and copy fields
-- 创建日期: 2025-09-03

-- 为RSS源表添加公开/私有标识和原始源引用字段
ALTER TABLE sources ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN original_source_id INTEGER;

-- 添加索引
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_is_public ON sources(is_public);
CREATE INDEX idx_sources_original_source_id ON sources(original_source_id);