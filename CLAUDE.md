# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI news platform service built on a serverless architecture using Cloudflare technologies. The platform allows users to register, configure personalized RSS feeds, and receive AI-processed content as Markdown notes delivered to secure personal cloud storage (Cloudflare R2). Users can sync these notes to tools like Obsidian using generated read-only credentials.

## Architecture Summary

- **Platform**: Cloudflare ecosystem (Pages, Workers, D1, R2, Queues, Workers AI)
- **Architecture Pattern**: Serverless, Monorepo managed by Turborepo
- **Frontend**: Next.js with TypeScript
- **Backend**: Hono.js API service with TypeScript
- **Database**: Cloudflare D1 with Drizzle ORM
- **File Storage**: Cloudflare R2 for Markdown files
- **Authentication**: JWT-based
- **Asynchronous Processing**: Cloudflare Queues with producer-consumer pattern
- **AI Processing**: Cloudflare Workers AI

## Repository Structure

Based on the architecture document, the expected structure is:
```
apps/
  web/          # Next.js frontend
  api/          # Hono.js backend API
packages/
  shared/       # Shared code between apps
  db/           # Database layer with Drizzle ORM
```

## Key Technical Requirements

1. **Security**: Strict multi-tenant data isolation using scoped credentials
2. **Reliability**: Async processing with retry logic and dead-letter queues
3. **Scalability**: Serverless architecture for automatic scaling
4. **Cost Control**: Usage limits (100 articles per user per day in MVP)

## Core Components

1. **User Management**: Registration, authentication, and session management
2. **RSS Source Management**: CRUD operations for user RSS feeds
3. **Content Processing Pipeline**: 
   - RSS fetching worker (producer)
   - Queue-based processing (Cloudflare Queues)
   - AI analysis worker (consumer)
   - Markdown generation and R2 storage
4. **Sync Credentials**: Read-only credential generation for R2 access
5. **Admin System**: Backend management interface (post-MVP)

## Development Environment

- **Monorepo Tool**: Turborepo
- **Package Manager**: Not specified (npm/yarn/pnpm all possible)
- **Local Development**: Cloudflare Wrangler CLI for local development and deployment
- **Testing**: 
  - Unit/Integration: Vitest
  - End-to-End: Playwright
- **Database Migrations**: Drizzle ORM for schema management and migrations

## Development Guidelines

- Follow the existing TypeScript patterns in both frontend and backend
- Maintain clear separation between frontend (Next.js) and backend (Hono.js) concerns
- Implement proper error handling and retry logic for async operations
- Ensure all database interactions go through the Drizzle ORM layer
- Follow security best practices for multi-tenant isolation
- Write tests using Vitest for unit/integration and Playwright for E2E

## Important Design Principles

1. **Security First**: All data must be strictly isolated between users
2. **Reliability**: Async processes must handle failures gracefully with retries
3. **User Experience**: "One-time minimal configuration" approach
4. **Testability**: All features must be testable, including async processes and LLM interactions