-- Migration: Add description field to sources table
-- 创建日期: 2025-09-04

-- 为sources表添加description字段
ALTER TABLE sources ADD COLUMN description TEXT;