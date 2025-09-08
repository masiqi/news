// 2024-01-02-add-web-content-columns.ts
import { sql } from 'drizzle-orm/sql-core';

export default {
  up: sql`
    ALTER TABLE processed_contents 
    ADD COLUMN markdown_content TEXT DEFAULT (''),
    ADD COLUMN word_count INTEGER DEFAULT (0);
  `,
  down: sql`
    ALTER TABLE processed_contents 
    DROP COLUMN markdown_content,
    DROP COLUMN word_count;
  `
};