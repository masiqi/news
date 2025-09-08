// 2024-01-01-add-topics-column.ts
import { sql } from 'drizzle-orm/sql-core';

export default {
  up: sql`
    ALTER TABLE processed_contents 
    ADD COLUMN topics TEXT DEFAULT ('[]');
  `,
  down: sql`
    ALTER TABLE processed_contents 
    DROP COLUMN topics;
  `
};