// src/db/index.ts
import { drizzle } from 'drizzle-orm/d1';
import { type D1Database } from '@cloudflare/workers-types';

// 初始化Drizzle ORM
export const initDB = (d1: D1Database) => {
  return drizzle(d1);
};

export * from './schema';