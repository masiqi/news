-- Migration: Add fetch tracking fields to sources table
-- 创建日期: 2025-09-05

-- 为sources表添加获取状态跟踪字段
ALTER TABLE sources ADD COLUMN last_fetched_at INTEGER;
ALTER TABLE sources ADD COLUMN fetch_failure_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sources ADD COLUMN fetch_error_message TEXT;