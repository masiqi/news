// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// RSS源表
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  name: text('name').notNull(),
  description: text('description'), // RSS源描述
  isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(), // 是否为公共源
  originalSourceId: integer('original_source_id'), // 复制自哪个源（自引用）
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }), // 上次获取时间
  fetchFailureCount: integer('fetch_failure_count').default(0).notNull(), // 连续失败次数
  fetchErrorMessage: text('fetch_error_message'), // 最近的错误信息
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// RSS条目表 - 存储原始RSS条目信息
export const rssEntries = sqliteTable('rss_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  guid: text('guid').notNull(), // RSS条目唯一标识
  title: text('title').notNull(),
  link: text('link').notNull(),
  content: text('content'), // 原始内容
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(), // 发布时间
  processed: integer('processed', { mode: 'boolean' }).default(false).notNull(), // 是否已处理
  processedAt: integer('processed_at', { mode: 'timestamp' }), // 处理时间
  failureCount: integer('failure_count').default(0).notNull(), // 处理失败次数
  errorMessage: text('error_message'), // 错误信息
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 处理后的内容表 - 存储已处理的内容
export const processedContents = sqliteTable('processed_contents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').notNull().references(() => rssEntries.id),
  summary: text('summary').notNull(), // AI生成的摘要
  markdownContent: text('markdown_content').notNull(), // AI处理后的Markdown内容
  keywords: text('keywords'), // 关键词
  sentiment: text('sentiment'), // 情感分析结果
  processingTime: integer('processing_time'), // 处理耗时（毫秒）
  modelUsed: text('model_used'), // 使用的AI模型
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 用户笔记表 - 存储用户个性化内容
export const userNotes = sqliteTable('user_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  entryId: integer('entry_id').notNull().references(() => rssEntries.id),
  processedContentId: integer('processed_content_id').notNull().references(() => processedContents.id),
  title: text('title').notNull(), // 个性化标题
  content: text('content').notNull(), // 个性化内容
  personalTags: text('personal_tags'), // 用户个性化标签
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false).notNull(), // 是否收藏
  readStatus: integer('read_status').default(0).notNull(), // 阅读状态（0未读，1已读）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 同步凭证表
export const syncCredentials = sqliteTable('sync_credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  accessKey: text('access_key').notNull(),
  secretKey: text('secret_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});