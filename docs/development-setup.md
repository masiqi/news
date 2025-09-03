# 项目启动指南

本指南将帮助您启动AI资讯服务平台的所有组件，包括前端、后端和管理后台。

## 项目结构

```
news/
├── frontend/     # Next.js前端应用
├── backend/      # Hono.js后端API服务
├── admin/        # AMIS管理后台
└── docs/         # 项目文档
```

## 环境要求

- Node.js v18.x 或更高版本
- npm 9.x 或更高版本
- Cloudflare Wrangler CLI
- 访问Cloudflare账户（用于部署）

## 安装依赖

在项目根目录下运行：

```bash
npm install
```

这将安装所有工作区的依赖，包括frontend、backend和admin。

## 启动服务

### 1. 启动所有服务（推荐）

使用Turborepo同时启动所有服务：

```bash
npm run dev
```

这将同时启动：
- 前端应用 (http://localhost:3000)
- 后端API服务 (http://localhost:8787)
- 管理后台 (需要单独启动，见下方说明)

### 2. 单独启动各服务

#### 启动前端应用

```bash
cd frontend
npm run dev
```

前端应用将在 http://localhost:3000 上运行。

#### 启动后端API服务

```bash
cd backend
npm run dev
```

后端API服务将在 http://localhost:8787 上运行。

使用Wrangler启动后端服务的优势：
- 提供与生产环境一致的开发环境
- 支持Cloudflare Workers的所有特性
- 提供本地模拟的D1数据库
- 支持实时重载和调试

#### 启动管理后台

管理后台是一个静态HTML应用，使用AMIS框架构建。可以通过以下方式启动：

1. 使用简单的HTTP服务器：

```bash
cd admin
npx serve
```

或者使用Python的HTTP服务器：

```bash
cd admin
python -m http.server 8000
```

管理后台将在 http://localhost:8000 上运行。

2. 或者直接在浏览器中打开 `admin/index.html` 文件。

## 环境变量配置

### 后端环境变量

后端服务需要以下环境变量：

- `JWT_SECRET`: JWT签名密钥
- `DB`: D1数据库绑定

在开发环境中，这些变量可以在 `wrangler.jsonc` 中配置或通过命令行传递。

### 前端环境变量

前端应用需要以下环境变量：

- `NEXT_PUBLIC_BACKEND_URL`: 后端API服务URL (默认: http://localhost:8787)

## 数据库设置

### 本地开发数据库

Wrangler会自动创建本地D1数据库用于开发。数据库模式由Drizzle ORM管理。

### 数据库迁移

如果需要重置或更新数据库模式：

```bash
cd backend
npx drizzle-kit push
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
# 然后将构建产物部署到您选择的托管平台
```

## 常见问题

### 1. Node.js版本问题

如果遇到Node.js版本不兼容问题，请使用nvm切换到支持的版本：

```bash
nvm install 18
nvm use 18
```

### 2. Wrangler认证问题

如果Wrangler提示需要认证：

```bash
npx wrangler login
```

### 3. 端口冲突

如果默认端口被占用，可以在相应应用的配置文件中修改端口：
- 前端: `frontend/next.config.ts`
- 后端: `backend/wrangler.jsonc`

### 4. 依赖安装问题

如果遇到依赖安装问题，可以尝试：

```bash
npm install --legacy-peer-deps
```

或

```bash
npm install --force
```

## 开发工作流

1. 启动所有服务：`npm run dev`
2. 访问前端：http://localhost:3000
3. 访问后端API文档：http://localhost:8787/api/docs (如果已实现)
4. 访问管理后台：http://localhost:8000
5. 修改代码，服务将自动重载
6. 提交代码前运行测试：`npm run test`

## 测试账户

注册页面：http://localhost:3000/register
登录页面：http://localhost:3000/login
仪表板：http://localhost:3000/dashboard

系统预设公共RSS源由系统用户(ID=1)提供。