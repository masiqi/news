# 部署指南

## 快速开始

### 方式一：GitHub Actions 自动部署（推荐）

1. **准备环境**
   ```bash
   # 复制配置模板
   cp .env.deploy.template .env.deploy
   
   # 根据 secrets-setup.md 配置 GitHub Secrets
   ```

2. **推送代码**
   ```bash
   git add .
   git commit -m "feat: add deployment configuration"
   git push origin main
   ```

3. **监控部署**
   - 进入 GitHub 仓库的 Actions 页面
   - 查看部署进度和日志

### 方式二：本地部署脚本

1. **准备环境**
   ```bash
   # 安装依赖
   npm install -g wrangler
   
   # 登录 Cloudflare
   wrangler login
   
   # 复制并编辑配置
   cp .env.deploy.template .env.deploy
   nano .env.deploy
   ```

2. **运行部署**
   ```bash
   # 完整部署
   ./deploy.sh
   
   # 或分步部署
   ./deploy.sh --check-only    # 仅检查环境
   ./deploy.sh --backend-only  # 仅部署后端
   ./deploy.sh --frontend-only # 仅部署前端
   ./deploy.sh --admin-only    # 仅部署管理后台
   ```

## 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Admin Panel   │    │   Backend API   │
│  (Next.js)      │    │   (Static)      │    │   (Hono.js)     │
│  Pages Hosting  │    │  Pages Hosting  │    │  Workers        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   Services     │
                    │  - D1 Database  │
                    │  - R2 Storage   │
                    │  - Queues       │
                    │  - AI Binding   │
                    └─────────────────┘
```

## 环境配置

### 开发环境
```bash
# 启动开发服务器
./start.sh

# 或分别启动
cd backend && npm run dev
cd frontend && npm run dev
cd admin && npm start
```

### 生产环境
```bash
# 使用脚本部署
./deploy.sh

# 或使用 GitHub Actions
git push origin main
```

## 域名配置

### 1. Cloudflare Pages 域名
- Frontend: `https://your-project.pages.dev`
- Admin: `https://your-admin.pages.dev`

### 2. 自定义域名
1. 在 Cloudflare Pages 中绑定自定义域名
2. 配置 DNS 记录指向 Pages
3. 启用 HTTPS

### 3. Workers 自定义域名
1. 在 Workers 设置中添加自定义域名
2. 配置 DNS 记录
3. 启用 HTTPS

## 监控和日志

### Cloudflare Dashboard
1. Workers & Pages → 查看应用状态
2. Analytics → 查看访问统计
3. Logs → 查看错误日志

### Health Check
```bash
# 检查后端 API
curl https://your-api.workers.dev/api/status

# 检查前端
curl -I https://your-frontend.pages.dev

# 检查管理后台
curl -I https://your-admin.pages.dev
```

## 故障排除

### 常见问题

1. **部署失败**
   - 检查 GitHub Secrets 配置
   - 验证 Cloudflare API Token 权限
   - 查看 Actions 日志

2. **前端无法访问后端**
   - 检查 CORS 配置
   - 验证 API URL 配置
   - 检查认证令牌

3. **数据库连接失败**
   - 验证 D1 Database ID
   - 检查数据库迁移
   - 查看 Workers 日志

### 回滚部署

```bash
# 回滚到上一个版本
git checkout HEAD~1
git push origin main --force

# 或在 Cloudflare Dashboard 中手动回滚
```

## 成本优化

### 免费额度
- Workers: 100k 请求/天
- Pages: 无限静态托管
- D1: 5GB 数据库 + 100k 读取/天
- R2: 10GB 存储
- Queues: 100k 消息/天

### 优化建议
1. 启用缓存减少 API 调用
2. 使用 CDN 加速静态资源
3. 监控使用量避免超出免费额度
4. 定期清理无用数据

## 安全最佳实践

1. **密钥管理**
   - 使用强密码和 JWT Secret
   - 定期轮换 API Keys
   - 不要在代码中硬编码密钥

2. **访问控制**
   - 启用 HTTPS
   - 配置 CORS 策略
   - 实施速率限制

3. **数据保护**
   - 加密敏感数据
   - 定期备份数据库
   - 监控异常访问