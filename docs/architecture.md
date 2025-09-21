# **墨香蒸馏 全栈架构文档**





## **1. 引言 (Introduction)**



本文档概述了"墨香蒸馏"的完整全栈架构。它将作为AI开发智能体和人类开发者的核心技术指南。本文档基于产品需求文档（PRD v3.0）。



### **启动模板与后端框架 (Starter Template & Backend Framework)**



- **提议**: 采用一个基于**Turborepo**的Monorepo启动模板。仓库中将包含两个主要应用：一个用**Next.js**构建的前端应用，和一个用**Hono.js**构建的、专门负责API的后端服务。
- **理由**: 职责清晰，能充分发挥Next.js在前端和Hono.js在边缘API性能上的优势。



### **变更日志 (Change Log)**



| 日期       | 版本 | 描述             | 作者                |
| ---------- | ---- | ---------------- | ------------------- |
| 2025-09-02 | 1.0  | 初始架构草稿创建 | Winston (architect) |

导出到 Google 表格



## **2. 高层架构 (High Level Architecture)**





### **2.1 技术摘要 (Technical Summary)**



本平台将采用一个基于Cloudflare生态系统的、完全无服务器的全栈架构。前端使用Next.js，后端API服务使用Hono.js，通过Turborepo管理的Monorepo进行组织。系统将采用基于Cloudflare Queues的可靠异步处理模型处理LLM任务，并通过动态生成的范围限定凭证确保严格的安全隔离。



### **2.2 平台与基础设施 (Platform and Infrastructure)**



- **平台**: **Cloudflare** (Pages, Workers, D1, R2, Queues) - **付费版本**。
- **AI服务**: **GLM API** (智谱AI大语言模型服务)。
- **部署网络**: Cloudflare 全球边缘网络。
- **关键特性**: 
  - 付费版Cloudflare Workers：默认30秒CPU时间（可配置最长5分钟）、100个Worker实例、250个Cron触发器
  - Cloudflare Queues：可靠的异步消息队列
  - GLM API：高质量AI内容处理，支持多种模型选择
  - Cron触发器最长支持15分钟CPU时间，完全满足LLM调用需求



### **2.3 代码仓库结构 (Repository Structure)**



- **结构**: **Monorepo**。
- **管理工具**: **Turborepo**。
- **包组织**: `frontend` (Next.js), `admin` (Amis), `backend` (Hono.js), `packages/shared`, `packages/db` (Drizzle ORM)。



### **2.4 高层架构图 (High Level Architecture Diagram)**



代码段

```
graph TD
    subgraph 用户端 (Client)
        A[用户浏览器]
        J[管理员浏览器]
    end

    subgraph Cloudflare 边缘网络
        B[Cloudflare Pages: Next.js 前端]
        K[Cloudflare Pages: Amis 管理后台]
        C[Cloudflare Worker: Hono.js API]
        D[Cloudflare Queues: 任务队列]
        E[Cloudflare Worker: 消费者]
        G[Cloudflare D1: 数据库]
        H[Cloudflare R2: Markdown文件存储]
    end
    
    subgraph AI服务
        F[GLM API: 大语言模型]
    end
    
    subgraph 第三方同步工具
        I[Obsidian 同步插件]
    end

    A -- HTTPS --> B
    J -- HTTPS --> K
    B -- API请求 --> C
    K -- 管理API请求 --> C
    C -- 读写用户信息/配置 --> G
    C -- 生成/重置凭证 --> H
    C -- 推送任务 --> D

    D -- 触发 --> E
    E -- HTTP调用 --> F
    E -- 获取文章内容 --> C
    E -- 读写任务状态 --> G
    F -- AI分析结果 --> E
    E -- 写入Markdown文件 --> H

    I -- 使用专用凭证同步 --> H
    
    subgraph 并发控制
        P[并发控制器\n最大并发:1]
        Q[重试机制\n指数退避]
        R[请求队列\n优先级管理]
    end
    
    E --> P
    P --> Q
    Q --> R
    R --> F
```



### **2.5 架构模式 (Architectural Patterns)**



- **无服务器架构 (Serverless Architecture)**
- **Monorepo**
- **前后端分离 (Decoupled Frontend/Backend)**
- **基于队列的异步处理 (Queue-Based Asynchronous Processing)**
- **仓库模式 (Repository Pattern)** (通过Drizzle ORM)



## **3. 技术栈 (Tech Stack)**



| 类别               | 技术               | 版本  | 用途                | 理由                                |
| ------------------ | ------------------ | ----- | ------------------- | ----------------------------------- |
| **前端语言**       | TypeScript         | ~5.5  | 主要开发语言        | 提供端到端的类型安全。              |
| **前端框架**       | Next.js            | ~15.0 | 构建用户界面        | 业界领先的React框架。               |
| **管理后台前端框架** | Amis               | -     | 构建管理后台界面    | 高效的低代码前端框架。              |
| **UI组件库**       | **待定 (TBD)**     | -     | 构建UI组件          | 交由UX/设计师决定。                 |
| **CSS框架**        | Tailwind CSS       | ~4.0  | UI样式              | 现代化的、功能优先的CSS框架。       |
| **前端状态管理**   | Zustand            | ~4.5  | 客户端状态管理      | 轻量、简单。                        |
| **后端语言**       | TypeScript         | ~5.5  | 主要开发语言        | 与前端统一。                        |
| **后端框架**       | Hono.js            | ~4.4  | 后端API服务         | 轻量、超高性能，专为边缘环境设计。  |
| **API风格**        | REST               | -     | 前后端通信          | 成熟、通用的标准。                  |
| **数据库**         | Cloudflare D1      | -     | 关系型数据存储      | Cloudflare原生SQL数据库。           |
| **ORM**            | Drizzle ORM        | ~0.30 | 数据库交互与迁移    | 提供类型安全的SQL查询和Schema迁移。 |
| **文件存储**       | Cloudflare R2      | -     | 存储生成的Markdown  | S3兼容，成本效益高。                |
| **AI服务**         | GLM API           | -     | 大语言模型服务      | 高质量、成本可控的AI处理。          |
| **认证模式**       | JWT                | -     | 用户认证与授权      | 无状态、标准化的认证方案。          |
| **并发控制**       | 自定义实现         | -     | GLM API调用管理     | 严格控制并发数为1，确保稳定性。      |
| **重试机制**       | 指数退避算法       | -     | API调用失败处理     | 智能重试，提高成功率。              |
| **队列服务**       | Cloudflare Queues  | -     | 异步任务处理        | 付费版特性，可靠的消息传递。        |
| **定时任务**       | Cloudflare Crons   | -     | 定时任务调度        | 付费版特性，支持250个触发器。       |
| **单元/集成测试**  | Vitest             | ~1.6  | 前后端单元/集成测试 | 现代、快速的测试框架。              |
| **端到端测试**     | Playwright         | ~1.46 | 模拟真实用户交互    | 功能强大，由微软维护。              |
| **基础设施即代码** | Wrangler           | ~3.0  | Cloudflare资源管理  | Cloudflare官方工具。                |
| **CI/CD**          | GitHub Actions     | -     | 自动化构建和部署    | 与代码托管无缝集成。                |
| **监控**           | Workers Analytics  | -     | 服务性能和使用情况  | Cloudflare内置。                    |
| **成本监控**       | 自定义实现         | -     | GLM API成本统计     | 实时追踪API调用成本。               |
| **日志**           | Cloudflare Logpush | -     | 日志收集与分析      | 可靠的日志收集方案。                |

导出到 Google 表格



## **4. 数据模型 (Data Models)**

### 核心业务模型
- **`User`**: 存储用户账户信息。
- **`Source`**: 存储用户订阅的RSS feed信息。
- **`Note`**: 记录系统为用户处理并生成的每一篇笔记的元数据。
- **`SyncCredential`**: 记录为用户生成的R2访问凭证的元数据，用于管理和撤销。
- *(还包含 `Category`, `UserInterest`, `SourceCategory` 等支持推荐功能的模型)*

### GLM API集成模型
- **`GLMConfig`**: GLM API配置信息，包含API密钥、模型选择等。
- **`GLMRequestQueue`**: 请求队列管理，跟踪每个AI处理任务的状态。
- **`GLMUsageStats`**: API调用统计，用于成本控制和性能监控。
- **`GLMCallLog`**: 详细的API调用日志，用于调试和审计。
- **`GLMRetryLog`**: 重试记录，跟踪失败请求的重试情况。

### 多用户访问控制模型
- **`UserR2Access`**: 用户R2访问配置，管理路径前缀和权限。
- **`AccessLog`**: 访问控制日志，记录所有文件访问操作。
- **`UserDirectoryQuota`**: 用户目录配额管理。



## **5. API 规范 (API Specification)**



*(基于OpenAPI 3.0.1的YAML格式定义，包含了对Auth, Users, Sources, Credentials等资源的操作，如POST /auth/register, GET /sources, POST /credentials等)*