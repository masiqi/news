// 测试用数据库连接
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// 创建测试数据库连接
const sqlite = new Database(':memory:');
export const db = drizzle(sqlite, { schema });

// 导出数据库实例
export { sqlite };

// 导出schema
export * from './schema';