# **2. 高层架构 (High Level Architecture)**

## **2.1 技术摘要 (Technical Summary)**

本平台将采用一个基于Cloudflare生态系统的、完全无服务器的全栈架构。前端使用Next.js，后端API服务使用Hono.js，通过Turborepo管理的Monorepo进行组织。系统将采用基于Cloudflare Queues的可靠异步处理模型处理LLM任务，并通过动态生成的范围限定凭证确保严格的安全隔离。

## **2.2 平台与基础设施 (Platform and Infrastructure)**

- **平台**: **Cloudflare** (Pages, Workers, D1, R2, Queues, Workers AI)。
- **部署网络**: Cloudflare 全球边缘网络。

## **2.3 代码仓库结构 (Repository Structure)**

- **结构**: **Monorepo**。
- **管理工具**: **Turborepo**。
- **包组织**: `frontend` (Next.js), `admin` (Amis), `backend` (Hono.js), `packages/shared`, `packages/db` (Drizzle ORM)。

## **2.4 高层架构图 (High Level Architecture Diagram)**

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
        F[Cloudflare Workers AI: LLM]
        G[Cloudflare D1: 数据库]
        H[Cloudflare R2: Markdown文件存储]
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
    E -- 调用 --> F
    E -- 获取文章内容 --> C
    E -- 读写任务状态 --> G
    F -- 分析结果 --> E
    E -- 写入Markdown文件 --> H

    I -- 使用专用凭证同步 --> H
```

## **2.5 架构模式 (Architectural Patterns)**

- **无服务器架构 (Serverless Architecture)**
- **Monorepo**
- **前后端分离 (Decoupled Frontend/Backend)**
- **基于队列的异步处理 (Queue-Based Asynchronous Processing)**
- **仓库模式 (Repository Pattern)** (通过Drizzle ORM)