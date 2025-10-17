# 部署脚本使用示例

## 📝 使用场景示例

### 场景 1: 首次完整部署

首次部署整个项目：

```bash
# 方式 1: 使用部署脚本
./deploy-all.sh
# 选择选项 1 (全部部署)

# 方式 2: 使用 npm 脚本
npm run deploy
# 然后选择选项 1
```

**执行流程：**
1. ✅ 检查环境和 Cloudflare 登录状态
2. 📦 部署后端 Worker
3. ⚙️ 部署管理后台到 Pages
4. 🌐 部署前端网站到 Pages
5. 🎉 显示所有访问地址

---

### 场景 2: 仅更新后端代码

修改了后端代码，只需要重新部署后端：

```bash
# 方式 1: 直接运行后端部署脚本
cd backend
./deploy.sh

# 方式 2: 使用 npm 脚本
npm run deploy:backend
```

**执行流程：**
1. 📦 安装后端依赖
2. 🔨 构建后端项目
3. 🗄️ 询问是否执行数据库迁移
4. ☁️ 部署 Worker
5. 🏥 健康检查验证

---

### 场景 3: 更新前端样式

仅修改了前端样式或页面：

```bash
# 方式 1: 直接运行前端部署脚本
cd frontend
./deploy.sh

# 方式 2: 使用 npm 脚本
npm run deploy:frontend
```

**执行流程：**
1. 📦 安装前端依赖
2. 🔨 构建静态网站
3. ☁️ 部署到 Pages
4. ✅ 显示访问地址

---

### 场景 4: 更新管理后台配置

修改了管理后台的 API 地址或其他配置：

```bash
# 方式 1: 直接运行管理后台部署脚本
cd admin
./deploy.sh

# 方式 2: 使用 npm 脚本
npm run deploy:admin
```

**执行流程：**
1. 📋 显示当前配置
2. 🔧 询问是否更新 API URL
3. ☁️ 部署到 Pages
4. ✅ 显示访问地址

---

### 场景 5: 部署后端和管理后台

后端 API 有更新，需要同时更新管理后台：

```bash
./deploy-all.sh
# 选择选项 5 (后端 + 管理后台)
```

---

### 场景 6: 部署管理后台和前端

更新了前端页面和管理后台配置：

```bash
./deploy-all.sh
# 选择选项 6 (管理后台 + 前端)
```

---

## 🔧 高级用法

### 自定义提交信息

前端和管理后台的部署脚本会自动生成带时间戳的提交信息，如需自定义：

```bash
# 修改部署脚本中的 COMMIT_MESSAGE 变量
cd frontend
# 编辑 deploy.sh
COMMIT_MESSAGE="修复登录页面样式问题"
./deploy.sh
```

### 跳过数据库迁移

后端部署时如果不需要执行迁移：

```bash
cd backend
./deploy.sh
# 当询问是否执行数据库迁移时，输入 n 或直接回车
```

### 查看部署日志

```bash
# 查看 Worker 实时日志
npx wrangler tail moxiang-distill

# 查看 Pages 部署历史
npx wrangler pages deployment list --project-name=moxiang-distill-frontend
```

---

## 🐛 常见问题处理

### 问题 1: 未登录 Cloudflare

**错误信息：**
```
❌ 未登录 Cloudflare，请先运行: npx wrangler login
```

**解决方法：**
```bash
npx wrangler login
# 浏览器会打开，完成登录授权
```

---

### 问题 2: 权限不足

**错误信息：**
```
Permission denied: ./deploy.sh
```

**解决方法：**
```bash
chmod +x deploy-all.sh
chmod +x backend/deploy.sh
chmod +x admin/deploy.sh
chmod +x frontend/deploy.sh
```

---

### 问题 3: 构建失败

**后端构建失败：**
```bash
cd backend
npm install
npm run build
# 查看具体错误信息
```

**前端构建失败：**
```bash
cd frontend
npm install
npm run build
# 查看具体错误信息
```

---

### 问题 4: Pages 项目不存在

**错误信息：**
```
Project not found
```

**解决方法：**
部署脚本会自动创建项目，如果仍然失败，手动创建：

```bash
# 前端
npx wrangler pages project create moxiang-distill-frontend --production-branch=main

# 管理后台
npx wrangler pages project create moxiang-distill-admin --production-branch=main
```

---

## 📊 部署时间参考

| 服务 | 依赖安装 | 构建时间 | 部署时间 | 总计 |
|------|---------|---------|---------|------|
| 后端 | ~30s | ~10s | ~20s | ~60s |
| 管理后台 | N/A | N/A | ~15s | ~15s |
| 前端 | ~25s | ~30s | ~20s | ~75s |
| **全部** | ~55s | ~40s | ~55s | **~150s** |

*时间仅供参考，实际时间取决于网络速度和项目大小*

---

## 🎯 最佳实践

1. **开发流程：**
   ```bash
   # 本地开发
   npm run dev

   # 测试构建
   npm run build

   # 部署到生产环境
   npm run deploy
   ```

2. **版本控制：**
   ```bash
   # 提交代码前先确保本地构建成功
   git add .
   git commit -m "feat: 新增功能"

   # 部署到 Cloudflare
   npm run deploy

   # 推送到远程仓库
   git push
   ```

3. **回滚策略：**
   ```bash
   # 查看历史部署
   npx wrangler pages deployment list --project-name=moxiang-distill-frontend

   # 如需回滚，重新部署之前的代码版本
   git checkout <previous-commit>
   npm run deploy
   git checkout main
   ```

---

## 💡 小贴士

- 🔄 **自动化部署**: 可以配置 GitHub Actions 自动部署
- 📊 **监控告警**: 在 Cloudflare Dashboard 设置错误告警
- 🔐 **环境变量**: 敏感信息不要提交到代码仓库
- 🌐 **自定义域名**: Pages 支持绑定自定义域名
- 📝 **日志收集**: 使用 `wrangler tail` 实时查看日志

---

## 🔗 相关命令速查

```bash
# 查看当前登录状态
npx wrangler whoami

# 查看 Worker 列表
npx wrangler deployments list

# 查看 Pages 项目列表
npx wrangler pages project list

# 查看 D1 数据库列表
npx wrangler d1 list

# 查看 R2 存储桶列表
npx wrangler r2 bucket list

# 查看队列列表
npx wrangler queues list
```

---

更多详细信息请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)
