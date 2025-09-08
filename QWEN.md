# AI资讯服务平台 - 项目上下文指南

## 项目概述

这是一个基于Cloudflare技术栈的AI资讯服务平台，采用无服务器架构。平台允许用户订阅RSS源并接收AI处理后的Markdown笔记，这些笔记会存储在安全的个人云存储中，用户可以通过生成的只读凭证同步到Obsidian等工具中。

### 核心特性
- 用户注册和登录系统（JWT认证）
- RSS源管理（订阅、查看、编辑、删除）
- 自动内容抓取和AI处理
- Markdown笔记生成和存储（Cloudflare R2）
- 只读同步凭证生成
- 管理后台（AMIS框架）

## 技术架构

### 整体架构
- **平台**: Cloudflare生态系统 (Pages, Workers, D1, R2, Queues, Workers AI)
- **架构模式**: 无服务器，Monorepo由Turborepo管理
- **前后端分离**: 前端(Next.js)与后端(Hono.js)完全分离

### 技术栈详情

| 类别 | 技术 | 用途 |
|------|------|------|
| **前端** | Next.js 15.5.2 | 用户界面构建 |
| **前端语言** | TypeScript 5.x | 前端开发语言 |
| **UI框架** | Tailwind CSS 4.x | 样式框架 |
| **状态管理** | Zustand 4.5 | 客户端状态管理 |
| **后端** | Hono.js 4.9.5 | API服务 |
| **后端语言** | TypeScript 5.x | 后端开发语言 |
| **数据库** | Cloudflare D1 | 关系型数据存储 |
| **ORM** | Drizzle ORM 0.44.5 | 数据库交互与迁移 |
| **文件存储** | Cloudflare R2 | Markdown文件存储 |
| **认证** | JWT | 用户认证与授权 |
| **异步处理** | Cloudflare Queues | 任务队列处理 |
| **AI处理** | Cloudflare Workers AI | 内容分析处理 |
| **管理后台** | AMIS 6.13.0 | 管理界面构建 |

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

实际目录结构：
```
news/
├── frontend/         # Next.js前端应用
├── backend/          # Hono.js后端API服务
├── admin/            # AMIS管理后台
├── docs/             # 项目文档
└── package.json      # 根级package.json
```

## 开发环境设置

### 环境要求
- Node.js v18.x 或更高版本
- npm 9.x 或更高版本
- Cloudflare Wrangler CLI

### 安装依赖
```bash
npm install
```

### 启动开发服务器

#### 方法1: 使用Turborepo启动（推荐）
```bash
npm run dev
```

#### 方法2: 使用启动脚本启动
```bash
./start.sh
```

#### 单独启动各服务

**启动前端应用:**
```bash
cd frontend
npm run dev
# 或使用启动脚本
./start.sh
```
访问地址: http://localhost:3000

**启动后端API服务:**
```bash
cd backend
npm run dev
# 或使用启动脚本
./start.sh
```
访问地址: http://localhost:8787

**启动管理后台:**
```bash
cd admin
node server.js
# 或使用启动脚本
./start.sh
```
访问地址: http://localhost:8101

### 环境变量配置

**后端环境变量:**
- `JWT_SECRET`: JWT签名密钥
- `DB`: D1数据库绑定

**前端环境变量:**
- `NEXT_PUBLIC_BACKEND_URL`: 后端API服务URL (默认: http://localhost:8787)

## 开发工作流

1. 克隆仓库
2. 安装依赖: `npm install`
3. 启动开发服务器: `npm run dev`
4. 访问前端: http://localhost:3000
5. 访问后端API: http://localhost:8787
6. 访问管理后台: http://localhost:8101
7. 修改代码，服务将自动重载

### 数据库设置
Wrangler会自动创建本地D1数据库用于开发。数据库模式由Drizzle ORM管理。

数据库迁移命令:
```bash
cd backend
npx drizzle-kit push
```

## 测试

### 测试框架
- **单元/集成测试**: Vitest
- **端到端测试**: Playwright

### 运行测试
```bash
npm run test
```

## 部署

### 部署后端到Cloudflare
```bash
cd backend
npm run deploy
```

### 构建和部署前端
```bash
cd frontend
npm run build
```

## 重要设计原则

1. **安全性优先**: 所有数据必须在架构层面实现严格的多租户隔离
2. **可靠性**: 异步处理流程必须包含失败重试和死信队列机制
3. **用户体验**: "一次性极简配置"的设计理念
4. **可测试性**: 所有功能都必须是可测试的
5. **成本控制**: 每位用户免费额度上限为每日处理100篇文章

## 核心组件

1. **用户管理系统**: 注册、登录、会话管理
2. **RSS源管理系统**: 用户RSS源的增删改查
3. **内容处理管道**: 
   - RSS内容抓取
   - AI内容分析
   - Markdown笔记生成
   - R2存储交付
4. **同步凭证系统**: 只读凭证生成用于外部工具集成
5. **管理后台系统**: 管理员界面（AMIS框架）

## 常见问题解决

### Node.js版本问题
推荐使用Node.js LTS版本（v18或v20）:
```bash
nvm install 18
nvm use 18
```

### 依赖冲突问题
清理并重新安装依赖:
```bash
# 在项目根目录执行
rm -rf node_modules package-lock.json
cd frontend && rm -rf node_modules package-lock.json && cd ..
cd backend && rm -rf node_modules package-lock.json && cd ..
cd admin && rm -rf node_modules package-lock.json && cd ..
npm install
```

### 端口冲突
如果默认端口被占用，启动脚本会自动检测并终止占用端口的进程。

## 文档资源

- [产品需求文档](docs/prd.md)
- [架构文档](docs/architecture.md)
- [用户故事列表](docs/STORIES.md)
- [开发设置指南](docs/development-setup.md)