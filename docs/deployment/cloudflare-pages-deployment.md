# Cloudflare Pages 部署指南

## 方案一：Next.js 静态导出 + Cloudflare Pages

### 1. 修改 Next.js 配置

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export', // 静态导出
  trailingSlash: true,
  images: {
    unoptimized: true // 静态部署不支持图片优化
  },
  // 其他配置...
};
```

### 2. 添加导出脚本

```json
// package.json
{
  "scripts": {
    "export": "next build && next export",
    "deploy:cf": "npm run export && wrangler pages deploy out"
  }
}
```

### 3. 自动化部署脚本

```bash
#!/bin/bash
# deploy.sh
set -e

echo "🚀 开始构建静态站点..."
npm run export

echo "☁️ 部署到 Cloudflare Pages..."
wrangler pages deploy out --branch main

echo "✅ 部署完成！"
```

## 方案二：Cloudflare Pages + GitHub Actions

### 1. 创建 GitHub Actions 工作流

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build static export
      run: npm run export
    
    - name: Deploy to Cloudflare Pages
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        command: pages deploy out --project-name your-project-name
```

## 方案三：完全静态架构（推荐）

### 架构调整

```
frontend/ (Next.js 静态站点)
├── public/
│   ├── static/ (静态资源)
│   └── api/ (API代理配置)
├── src/
│   ├── app/ (页面组件)
│   ├── components/ (UI组件)
│   └── lib/ (工具函数)
└── out/ (构建输出)

backend/ (Cloudflare Workers API)
├── src/
│   ├── routes/ (API路由)
│   └── middleware/ (中间件)
└── wrangler.toml
```

### 部署命令

```bash
# 一键部署脚本
#!/bin/bash

echo "🔨 构建前端静态站点..."
cd frontend
npm run export
cd ..

echo "☁️ 部署后端 API..."
cd backend
wrangler deploy
cd ..

echo "🌐 部署前端静态站点..."
wrangler pages deploy frontend/out --project-name news-frontend

echo "✅ 全部部署完成！"
echo "前端地址: https://news-frontend.pages.dev"
echo "后端API: https://news-api.workers.dev"
```

## 性能优化建议

### 1. 代码分割
```typescript
// next.config.ts
experimental: {
  optimizePackageImports: ['amis', 'amis-editor']
}
```

### 2. 预渲染策略
```typescript
// 生成静态页面
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }];
}
```

### 3. 缓存优化
```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=3600' }
      ]
    }
  ];
}
```

## 部署检查清单

- [ ] 移除所有客户端 API 调用
- [ ] 配置静态图片处理
- [ ] 设置环境变量
- [ ] 配置域名和 SSL
- [ ] 测试表单提交（如需要）
- [ ] 配置错误页面
- [ ] 设置访问分析

## 相关命令

```bash
# 本地构建测试
npm run export

# 预览部署
wrangler pages dev out

# 生产部署
wrangler pages deploy out

# 查看部署状态
wrangler pages list
```