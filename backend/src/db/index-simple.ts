// 简化版数据库入口文件
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema-simple';

// 初始化Drizzle ORM
export const initDB = (d1: any) => {
  return drizzle(d1, { schema });
};

export * from './schema-simple';