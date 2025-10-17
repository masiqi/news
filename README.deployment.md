# 快速部署指南

## 🚀 一键部署

最简单的方式，在项目根目录运行：

```bash
./deploy-all.sh
```

选择你需要的部署选项即可！

## 📦 各服务独立部署

### 后端 API
```bash
cd backend
./deploy.sh
```

### 管理后台
```bash
cd admin
./deploy.sh
```

### 前端网站
```bash
cd frontend
./deploy.sh
```

## 📋 前提条件

1. 安装 Node.js (>= 18.x)
2. 登录 Cloudflare:
   ```bash
   npx wrangler login
   ```
3. 确保已开通 Workers 付费套餐

## 📖 详细文档

查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 获取完整的部署文档。

## 🌐 部署后的访问地址

- **后端 API**: https://moxiang-distill.masiqi.workers.dev
- **管理后台**: https://moxiang-distill-admin.pages.dev
- **前端网站**: https://moxiang-distill-frontend.pages.dev

## 💡 提示

- 首次部署可能需要几分钟才能完全生效
- 可以在 Cloudflare Dashboard 绑定自定义域名
- 使用 `npx wrangler tail` 查看 Worker 日志
