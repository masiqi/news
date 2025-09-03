-- Migration: Add failure tracking fields to rss_entries table
-- 创建日期: 2025-09-03

-- 为RSS条目表添加处理失败跟踪字段
ALTER TABLE rss_entries ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rss_entries ADD COLUMN error_message TEXT;