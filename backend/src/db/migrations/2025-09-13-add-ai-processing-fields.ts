// 2025-09-13-add-ai-processing-fields.ts
import { sql } from 'drizzle-orm/sql-core';

export default {
  up: sql`
    ALTER TABLE processed_contents 
    ADD COLUMN topics TEXT DEFAULT NULL,
    ADD COLUMN images TEXT DEFAULT NULL,
    ADD COLUMN links TEXT DEFAULT NULL,
    ADD COLUMN author TEXT DEFAULT NULL,
    ADD COLUMN source TEXT DEFAULT NULL,
    ADD COLUMN publish_time TEXT DEFAULT NULL,
    ADD COLUMN analysis TEXT DEFAULT NULL,
    ADD COLUMN educational_value TEXT DEFAULT NULL,
    ADD COLUMN processing_time INTEGER DEFAULT NULL,
    ADD COLUMN model_used TEXT DEFAULT NULL;
    
    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_processed_contents_topics ON processed_contents(topics);
    CREATE INDEX IF NOT EXISTS idx_processed_contents_source ON processed_contents(source);
    CREATE INDEX IF NOT EXISTS idx_processed_contents_author ON processed_contents(author);
    CREATE INDEX IF NOT EXISTS idx_processed_contents_model_used ON processed_contents(model_used);
  `,
  down: sql`
    -- 删除索引
    DROP INDEX IF EXISTS idx_processed_contents_topics;
    DROP INDEX IF EXISTS idx_processed_contents_source;
    DROP INDEX IF EXISTS idx_processed_contents_author;
    DROP INDEX IF EXISTS idx_processed_contents_model_used;
    
    -- 删除字段
    ALTER TABLE processed_contents 
    DROP COLUMN topics,
    DROP COLUMN images,
    DROP COLUMN links,
    DROP COLUMN author,
    DROP COLUMN source,
    DROP COLUMN publish_time,
    DROP COLUMN analysis,
    DROP COLUMN educational_value,
    DROP COLUMN processing_time,
    DROP COLUMN model_used;
  `
};