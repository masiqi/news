// worker-configuration.d.ts
export interface CloudflareBindings {
  // 数据库
  DB: D1Database;
  
  // R2存储
  R2_BUCKET: R2Bucket;
  
  // 队列
  RSS_FETCHER_QUEUE: Queue<any>;
  AI_PROCESSOR_QUEUE: Queue<any>;
  
  // Workers AI
  AI: Ai;
}

// D1数据库接口
export interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<D1Result[]>;
  exec: (query: string) => Promise<D1Result>;
  dump: () => Promise<ArrayBuffer>;
}

export interface D1PreparedStatement {
  bind: (values: any[]) => D1PreparedStatement;
  first: () => Promise<any>;
  all: () => Promise<any[]>;
  run: () => Promise<D1Result>;
}

export interface D1Result {
  results: any[];
  success: boolean;
  meta: any;
  duration: number;
  lastRowId: number;
  changes: number;
  served_by: string;
}

// R2存储桶接口
export interface R2Bucket {
  head: (key: string) => Promise<R2Object>;
  get: (key: string) => Promise<R2Object>;
  put: (key: string, value: any, options?: R2PutOptions) => Promise<R2PutResult>;
  delete: (key: string) => Promise<void>;
  list: (options?: R2ListOptions) => Promise<R2ListResult>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpEtag: string;
  version: string;
}

export interface R2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
  md5?: string;
}

export interface R2PutResult {
  key: string;
  uploaded: Date;
  etag: string;
  version: string;
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
}

export interface R2ListResult {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes?: string[];
}

// 队列接口
export interface Queue<T> {
  send: (message: T, options?: QueueSendOptions) => Promise<void>;
  sendBatch: (messages: T[], options?: QueueSendBatchOptions) => Promise<void>;
}

export interface QueueSendOptions {
  delaySeconds?: number;
}

export interface QueueSendBatchOptions {
  delaySeconds?: number;
}

// Workers AI接口
export interface Ai {
  // Workers AI binding supports: ai.run(model, { input or messages ... })
  run: (model: string, options: any) => Promise<any>;
}

// Keep legacy types for reference in case of future use
export interface AiRunOptions {
  model: string;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  input?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AiResponse {
  response?: string;
}
