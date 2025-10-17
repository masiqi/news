# 部署指南

墨香蒸馏 - Cloudflare 平台部署文档

## 📋 前置要求

1. **Node.js 环境**
   - Node.js >= 18.x
   - npm 或 yarn

2. **Cloudflare 账户**
   - 已注册 Cloudflare 账户
   - 已开通 Workers 付费套餐（用于队列功能）
   - 已登录 Wrangler CLI

3. **登录 Cloudflare**
   ```bash
   npx wrangler login
   ```

## 🚀 快速部署

### 方式一：一键部署所有服务

在项目根目录运行：

```bash
./deploy-all.sh
```

根据提示选择部署内容：
- 选项 1: 全部部署 (后端 + 管理后台 + 前端)
- 选项 2: 仅部署后端
- 选项 3: 仅部署管理后台
- 选项 4: 仅部署前端
- 选项 5: 后端 + 管理后台
- 选项 6: 管理后台 + 前端

### 方式二：分别部署各个服务

#### 1. 部署后端 (Cloudflare Workers)

```bash
cd backend
./deploy.sh
```

**功能：**
- 自动安装依赖
- 构建项目
- 可选执行数据库迁移
- 部署 Worker
- 健康检查验证

**部署后地址：**
- API: `https://moxiang-distill.masiqi.workers.dev`
- 健康检查: `https://moxiang-distill.masiqi.workers.dev/api/health`

#### 2. 部署管理后台 (Cloudflare Pages)

```bash
cd admin
./deploy.sh
```

**功能：**
- 检查配置文件
- 可选更新 API URL
- 部署静态文件到 Pages

**部署后地址：**
- 管理后台: `https://moxiang-distill-admin.pages.dev`

#### 3. 部署前端 (Cloudflare Pages)

```bash
cd frontend
./deploy.sh
```

**功能：**
- 安装依赖
- 构建静态网站
- 部署到 Pages

**部署后地址：**
- 前端网站: `https://moxiang-distill-frontend.pages.dev`

## 🔧 手动部署步骤

### 后端部署

1. **准备数据库和队列**

   ```bash
   # 创建 D1 数据库
   npx wrangler d1 create news-db

   # 创建队列
   npx wrangler queues create rss-fetcher-queue
   npx wrangler queues create ai-processor-queue

   # 创建 R2 存储桶
   npx wrangler r2 bucket create news
   ```

2. **更新配置**

   编辑 `backend/wrangler.jsonc`，填入正确的数据库 ID 和队列名称。

3. **执行数据库迁移**

   ```bash
   cd backend
   bash migrate-db.sh
   ```

4. **部署 Worker**

   ```bash
   npm install
   npm run build
   npx wrangler deploy
   ```

### 管理后台部署

1. **更新配置**

   编辑 `admin/config.json`：
   ```json
   {
     "apiUrl": "https://moxiang-distill.masiqi.workers.dev",
     "adminTitle": "墨香蒸馏 - 管理后台"
   }
   ```

2. **创建 Pages 项目并部署**

   ```bash
   cd admin
   npx wrangler pages project create moxiang-distill-admin --production-branch=main
   npx wrangler pages deploy . --project-name=moxiang-distill-admin --commit-dirty=true
   ```

### 前端部署

1. **配置环境变量**

   创建 `frontend/.env.local`：
   ```
   NEXT_PUBLIC_API_URL=https://moxiang-distill.masiqi.workers.dev
   ```

2. **构建并部署**

   ```bash
   cd frontend
   npm install
   npm run build
   npx wrangler pages project create moxiang-distill-frontend --production-branch=main
   npx wrangler pages deploy out --project-name=moxiang-distill-frontend --commit-dirty=true
   ```

## 📊 部署架构

```
┌─────────────────┐
│   用户浏览器     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────┐
│ 前端  │  │ 管理  │
│Pages │  │Pages  │
└───┬──┘  └──┬────┘
    │        │
    └────┬───┘
         │
    ┌────▼────────┐
    │ 后端 Worker │
    └─────┬───────┘
          │
    ┌─────┴──────┐
    │            │
┌───▼──┐  ┌─────▼──┐  ┌──────▼─────┐
│  D1  │  │   R2   │  │  Queues    │
│ 数据库│  │  存储  │  │  消息队列  │
└──────┘  └────────┘  └────────────┘
```

## 🔐 首次配置

### 1. 创建管理员账户

部署完成后，通过 API 创建管理员账户：

```bash
curl -X POST https://moxiang-distill.masiqi.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password",
    "username": "admin"
  }'
```

### 2. 添加 RSS 源

登录后可以通过前端或管理后台添加 RSS 源。

### 3. 配置定时任务（可选）

在 `backend/wrangler.jsonc` 中配置 Cron Trigger：

```jsonc
{
  "triggers": {
    "crons": ["0 */6 * * *"]  // 每6小时执行一次
  }
}
```

## 📝 环境变量

### 后端 (backend/.env.production)

```env
JWT_SECRET=your-secure-jwt-secret
NODE_ENV=production
```

### 前端 (frontend/.env.local)

```env
NEXT_PUBLIC_API_URL=https://moxiang-distill.masiqi.workers.dev
```

### 管理后台 (admin/config.json)

```json
{
  "apiUrl": "https://moxiang-distill.masiqi.workers.dev",
  "adminTitle": "墨香蒸馏 - 管理后台"
}
```

## 🐛 故障排查

### 部署失败

1. **检查登录状态**
   ```bash
   npx wrangler whoami
   ```

2. **查看 Worker 日志**
   ```bash
   npx wrangler tail moxiang-distill
   ```

3. **检查配置文件**
   - 确认 `wrangler.jsonc` 中的 binding ID 正确
   - 确认队列名称为小写字母加连字符

### 健康检查失败

```bash
# 测试后端健康状态
curl https://moxiang-distill.masiqi.workers.dev/api/health
```

预期响应：
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "memory": "ok",
    "storage": "ok"
  },
  "timestamp": "2025-10-13T16:22:29.483Z"
}
```

### 前端无法连接后端

1. 检查 `.env.local` 中的 API URL 是否正确
2. 检查浏览器控制台的 CORS 错误
3. 确认后端已正确部署并运行

## 🔄 更新部署

当代码有更新时，重新运行对应的部署脚本即可：

```bash
# 更新所有服务
./deploy-all.sh

# 或单独更新
cd backend && ./deploy.sh
cd admin && ./deploy.sh
cd frontend && ./deploy.sh
```

## 📈 监控和维护

1. **Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 查看 Workers、Pages、D1、R2 的使用情况

2. **查看日志**
   ```bash
   # Worker 日志
   npx wrangler tail moxiang-distill

   # Pages 部署日志
   npx wrangler pages deployment list --project-name=moxiang-distill-frontend
   ```

3. **数据库管理**
   ```bash
   # 查询数据库
   npx wrangler d1 execute news-db --remote --command="SELECT * FROM users LIMIT 10"
   ```

## 🔗 相关链接

- Cloudflare Workers 文档: https://developers.cloudflare.com/workers/
- Cloudflare Pages 文档: https://developers.cloudflare.com/pages/
- Cloudflare D1 文档: https://developers.cloudflare.com/d1/
- Wrangler CLI 文档: https://developers.cloudflare.com/workers/wrangler/

## 💡 最佳实践

1. **使用版本控制**: 在 `.gitignore` 中排除敏感配置文件
2. **定期备份**: 定期导出 D1 数据库备份
3. **监控使用量**: 关注 Cloudflare Dashboard 的用量指标
4. **设置告警**: 配置 Cloudflare Workers 的错误告警
5. **自定义域名**: 为 Pages 项目绑定自定义域名以获得更好的用户体验

## 📧 支持

如有问题，请查看项目 GitHub Issues 或联系开发团队。
