import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from './env';
import authRoutes from "./routes/auth";
import sourceRoutes from "./routes/sources";
import userRoutes from "./routes/users";
import systemRoutes from "./routes/system";
import topicsRoutes from "./routes/topics";
import webContentRoutes from "./routes/web-content";
import adminRoutes from "./routes/admin";
import onboardingRoutes from "./routes/onboarding";
// 移除测试路由导入
import llmExtractorRoutes from "./services/llm-extractor";
import llmContentExtractorRoutes from "./services/llm-content-extractor";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, sources, processedContents } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ContentCacheService } from './services/content-cache.service';
import Parser from 'rss-parser';