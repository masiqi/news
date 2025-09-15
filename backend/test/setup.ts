// 测试设置文件
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema';

// 全局测试数据库
let testDb: Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

// 全局设置
beforeAll(async () => {
  // 创建测试数据库
  testDb = new Database(':memory:');
  db = drizzle(testDb, { schema });

  // 运行数据库初始化
  const { initTestDatabase } = await import('./init-test-db');
  initTestDatabase();
});

// 每个测试前的清理（仅清理必要的表）
beforeEach(async () => {
  try {
    const tables = ['users', 'enhanced_content_analysis', 'obsidian_templates'];
    
    for (const table of tables) {
      try {
        testDb.exec(`DELETE FROM ${table}`);
      } catch (error) {
        // 表可能不存在，忽略错误
      }
    }
  } catch (error) {
    // 忽略清理错误
  }
});

// 全局清理
afterAll(async () => {
  if (testDb) {
    testDb.close();
  }
});

// 导出数据库连接供测试使用
export { db };