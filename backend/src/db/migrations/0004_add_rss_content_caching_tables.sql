-- Migration: Add RSS content caching and sharing optimization tables
-- 创建日期: 2025-09-03

-- 添加索引（表已在初始迁移中创建）
CREATE INDEX IF NOT EXISTS idx_rss_entries_source_id ON rss_entries(source_id);
CREATE INDEX IF NOT EXISTS idx_rss_entries_guid ON rss_entries(guid);
CREATE INDEX IF NOT EXISTS idx_rss_entries_processed ON rss_entries(processed);
CREATE INDEX IF NOT EXISTS idx_processed_contents_entry_id ON processed_contents(entry_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_entry_id ON user_notes(entry_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_processed_content_id ON user_notes(processed_content_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_favorite ON user_notes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_notes_read_status ON user_notes(read_status);