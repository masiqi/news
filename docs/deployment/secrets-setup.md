# GitHub Actions Secrets 配置指南

## 1. 获取 Cloudflare API Token

1. 登录 Cloudflare Dashboard
2. 进入 My Profile → API Tokens → Create Token
3. 选择 Edit Cloudflare Workers 模板
4. 配置权限：
   - Zone:Zone:Read
   - Zone:DNS:Edit
   - Account:Cloudflare Pages:Edit
   - Account:Workers Scripts:Edit
   - Account:Workers KV Storage:Edit
   - Account:Workers R2 Storage:Edit
   - Account:Workers D1 Storage:Edit
   - Account:Workers Queues:Edit
5. 生成并复制 API Token

## 2. 获取 D1 Database ID

1. 在 Cloudflare Dashboard 中进入 Workers & Pages
2. 创建 D1 数据库（如果还没有）
3. 复制数据库 ID

## 3. 获取 AI API Keys

### 智谱 AI (ZhipuAI)
1. 访问 https://open.bigmodel.cn/
2. 注册并获取 API Key

### OpenRouter
1. 访问 https://openrouter.ai/
2. 注册并获取 API Key

## 4. 设置 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加以下 secrets：

### 必须的 Secrets
- `CLOUDFLARE_API_KEY`: Cloudflare API Token
- `JWT_SECRET`: 至少 32 个字符的随机字符串
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码
- `D1_DATABASE_ID`: D1 数据库 ID

### 可选的 Secrets
- `ZHIPUAI_API_KEY`: 智谱 AI API Key
- `OPENROUTER_API_KEY`: OpenRouter API Key

## 5. 设置 Repository Variables

在 Settings → Secrets and variables → Actions → Variables 中添加：

- `DEFAULT_LLM_PROVIDER`: `auto`
- `ENABLE_LLM_FALLBACK`: `true`
- `FRONTEND_PAGES_PROJECT`: `moxiang-distill-frontend`
- `ADMIN_PAGES_PROJECT`: `moxiang-distill-admin`
- `FRONTEND_DOMAIN`: `your-frontend.pages.dev`
- `ADMIN_DOMAIN`: `your-admin.pages.dev`

## 6. 生成 JWT Secret

使用以下命令生成安全的 JWT Secret：
```bash
openssl rand -hex 32
# 或者
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 7. 初始部署

### 方式一：使用 GitHub Actions（推荐）
1. 推送代码到 main 分支
2. GitHub Actions 会自动部署

### 方式二：使用本地脚本
```bash
# 复制配置模板
cp .env.deploy.template .env.deploy

# 编辑配置文件
nano .env.deploy

# 运行部署脚本
./deploy.sh
```