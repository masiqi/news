# AI资讯服务平台

一个基于Cloudflare技术栈的AI资讯服务平台，允许用户订阅RSS源并接收AI处理后的Markdown笔记。

## 项目概述

本项目是一个服务器less架构的AI资讯服务平台，使用Cloudflare生态系统构建。平台允许用户注册、配置个性化的RSS源，并接收AI处理后的内容作为Markdown笔记，这些笔记会存储在安全的个人云存储中，用户可以通过生成的只读凭证同步到Obsidian等工具中。

## 技术架构

- **平台**: Cloudflare生态系统 (Pages, Workers, D1, R2, Queues, Workers AI)
- **架构模式**: 无服务器，Monorepo由Turborepo管理
- **前端**: Next.js with TypeScript
- **后端**: Hono.js API服务 with TypeScript
- **数据库**: Cloudflare D1 with Drizzle ORM
- **文件存储**: Cloudflare R2 for Markdown文件
- **认证**: 基于JWT
- **异步处理**: Cloudflare Queues with 生产者-消费者模式
- **AI处理**: Cloudflare Workers AI

## 项目结构

```
news/
├── apps/
│   ├── web/          # Next.js前端应用
│   ├── api/          # Hono.js后端API服务
│   └── admin/        # AMIS管理后台
├── packages/
│   ├── shared/       # 共享代码
│   └── db/           # 数据库层
└── docs/             # 项目文档
```

## 快速开始

### 环境要求

- Node.js v18.x 或更高版本
- npm 9.x 或更高版本
- Cloudflare Wrangler CLI

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

这将同时启动前端、后端和管理后台服务。

### 单独启动服务

#### 启动前端应用

```bash
cd frontend
npm run dev
```

#### 启动后端API服务

```bash
cd backend
npm run dev
```

#### 启动管理后台

```bash
cd admin
npx serve
```

详细启动指南请查看 [开发设置文档](docs/development-setup.md)。

## 功能特性

### 用户管理
- 用户注册和登录
- JWT令牌认证
- 会话管理

### RSS源管理
- 订阅个性化RSS源
- 公共/私有源区分
- 源复制功能

### 内容处理
- RSS内容抓取
- AI内容处理和分析
- Markdown笔记生成
- 内容缓存和共享处理优化

### 存储和同步
- Cloudflare R2对象存储
- 只读同步凭证生成
- 与Obsidian等工具集成

### 管理后台
- 用户管理
- 系统监控
- 数据分析

## 开发指南

### 项目设置

1. 克隆仓库
2. 安装依赖: `npm install`
3. 启动开发服务器: `npm run dev`

### 代码规范

- 使用TypeScript
- 遵循各框架的最佳实践
- 保持代码风格一致

### 测试

- 单元测试: Vitest
- 端到端测试: Playwright

### 部署

- 前端: Cloudflare Pages
- 后端: Cloudflare Workers
- 数据库: Cloudflare D1

## 文档

- [产品需求文档](docs/prd.md)
- [架构文档](docs/architecture.md)
- [用户故事](docs/stories/)
- [开发设置指南](docs/development-setup.md)

## 贡献

欢迎贡献代码和提出建议。请遵循项目的代码规范和提交指南。

## 许可证

MIT License

## 联系方式

如有问题，请提交GitHub Issue。