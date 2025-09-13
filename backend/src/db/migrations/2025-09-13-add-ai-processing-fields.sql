-- Migration: Add AI processing fields to processed_contents table
-- 创建日期: 2025-09-13
-- 描述: 为AI处理内容表添加分析、教育价值、作者、来源等字段

-- 为 processed_contents 表添加新字段
ALTER TABLE processed_contents ADD COLUMN topics TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN images TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN links TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN author TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN source TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN publish_time TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN analysis TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN educational_value TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN processing_time INTEGER DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN model_used TEXT DEFAULT NULL;
ALTER TABLE processed_contents ADD COLUMN word_count INTEGER DEFAULT NULL;

-- 添加新索引
CREATE INDEX IF NOT EXISTS idx_processed_contents_topics ON processed_contents(topics);
CREATE INDEX IF NOT EXISTS idx_processed_contents_source ON processed_contents(source);
CREATE INDEX IF NOT EXISTS idx_processed_contents_author ON processed_contents(author);
CREATE INDEX IF NOT EXISTS idx_processed_contents_model_used ON processed_contents(model_used);