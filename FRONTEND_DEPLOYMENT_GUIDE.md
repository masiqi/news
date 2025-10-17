# 前端和管理后台部署指南

## ✅ 管理后台部署成功！

**部署地址**：https://moxiang-distill-admin.pages.dev

**临时预览地址**：https://71eb74d8.moxiang-distill-admin.pages.dev

### 管理员登录信息
- **用户名**：`admin`
- **密码**：`Admin@123456`

---

## 📋 前端部署状态

### ⚠️ 前端构建失败

前端 Next.js 应用在构建时遇到了以下问题：

#### 主要错误
1. **缺少 UI 组件**：多个页面引用了不存在的 UI 组件
   - `@/components/ui/alert`
   - `@/components/ui/badge`
   - `@/components/ui/button`
   - `@/components/ui/card`
   - `@/components/ui/tabs`
   - 等等...

2. **重复定义变量**：`InterestSelector.tsx` 中 `selectedInterests` 变量定义了多次

3. **类型错误**：一些 TypeScript 类型定义问题

### 解决方案

#### 方案 1：安装 shadcn/ui 组件库（推荐）

前端使用了 shadcn/ui 组件库，但组件文件缺失。需要初始化并安装组件：

```bash
cd frontend

# 1. 初始化 shadcn/ui
npx shadcn@latest init

# 2. 安装所需组件
npx shadcn@latest add alert
npx shadcn@latest add badge
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add tabs
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add checkbox

# 3. 重新构建
npm run build

# 4. 部署
wrangler pages deploy out --project-name="moxiang-distill-frontend" --commit-message="Initial deployment"
```

#### 方案 2：简化前端（快速方案）

如果暂时只需要管理功能，可以：

1. 使用管理后台（已成功部署）
2. 等待修复前端 UI 组件问题后再部署

#### 方案 3：手动创建缺失组件

创建简化版本的 UI 组件：

```bash
cd frontend
mkdir -p src/components/ui

# 创建基础组件（示例）
cat > src/components/ui/alert.tsx << 'EOF'
import * as React from "react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={`rounded-lg border p-4 ${className}`}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={`mb-1 font-medium leading-none tracking-tight ${className}`}
      {...props}
    />
  )
)
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`text-sm [&_p]:leading-relaxed ${className}`}
      {...props}
    />
  )
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
EOF

# 对其他组件重复此过程...
```

---

## 🚀 管理后台使用指南

### 访问管理后台

1. 打开浏览器访问：https://moxiang-distill-admin.pages.dev
2. 使用管理员账号登录
3. 开始配置系统

### 主要功能

- **用户管理**：查看和管理注册用户
- **RSS 源管理**：添加、编辑、删除 RSS 源
- **文章管理**：查看抓取的文章
- **系统配置**：配置 AI 处理参数
- **监控面板**：查看系统运行状态

### 配置 API 连接

管理后台已自动配置连接到：
```
https://moxiang-distill.masiqi.workers.dev
```

如果需要修改，编辑 `admin/config.json`：
```json
{
  "apiUrl": "你的API地址",
  "adminTitle": "墨香蒸馏 - 管理后台"
}
```

---

## 📦 部署命令参考

### 管理后台

```bash
# 进入管理后台目录
cd admin

# 创建 Pages 项目（首次）
wrangler pages project create moxiang-distill-admin --production-branch=main

# 部署
wrangler pages deploy . --project-name="moxiang-distill-admin" --commit-message="Update admin"

# 查看部署列表
wrangler pages deployment list --project-name="moxiang-distill-admin"
```

### 前端（修复后）

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm ci

# 构建生产版本
NODE_ENV=production npm run build

# 创建 Pages 项目（首次）
wrangler pages project create moxiang-distill-frontend --production-branch=main

# 部署
wrangler pages deploy out --project-name="moxiang-distill-frontend" --commit-message="Deploy frontend"
```

---

## 🔧 配置自定义域名

### 通过 Cloudflare Dashboard

1. 访问 https://dash.cloudflare.com/pages
2. 选择项目（moxiang-distill-admin 或 moxiang-distill-frontend）
3. 进入 "Custom domains" 标签
4. 点击 "Set up a custom domain"
5. 输入域名并按照提示完成 DNS 配置

### 通过 Wrangler CLI

```bash
# 添加自定义域名
wrangler pages domain add <your-domain.com> --project-name="moxiang-distill-admin"
```

---

## 📊 当前部署状态总结

| 组件 | 状态 | URL |
|------|------|-----|
| 后端 API | ✅ 已部署 | https://moxiang-distill.masiqi.workers.dev |
| 管理后台 | ✅ 已部署 | https://moxiang-distill-admin.pages.dev |
| 前端应用 | ❌ 待修复 | 需要安装 UI 组件库 |
| D1 数据库 | ✅ 已创建 | news-db (31 张表) |
| R2 存储 | ✅ 已配置 | news |
| 队列 | ✅ 已创建 | rss-fetcher-queue, ai-processor-queue |

---

## 🐛 故障排查

### 管理后台无法连接 API

1. 检查 `config.json` 中的 API URL 是否正确
2. 确认后端 Worker 已部署并运行：
   ```bash
   curl https://moxiang-distill.masiqi.workers.dev/api/health
   ```
3. 检查浏览器控制台是否有 CORS 错误

### 前端构建失败

1. 确保已安装所有依赖：`npm ci`
2. 检查 Node.js 版本：`node --version`（建议 v18+）
3. 查看详细错误日志
4. 按照上面的"方案 1"安装缺失组件

---

## 📚 后续步骤

1. ✅ **立即可用**：使用管理后台管理系统
2. 🔧 **修复前端**：按照方案 1 安装 shadcn/ui 组件
3. 🌐 **配置域名**：为管理后台和前端配置自定义域名
4. 🔒 **安全加固**：修改默认管理员密码
5. 📊 **监控配置**：设置日志和监控告警

---

## 💡 提示

- 管理后台已经可以完整使用，包括所有管理功能
- 前端用户界面需要修复后才能部署
- 建议先使用管理后台进行系统配置和测试
- 修复前端后可以通过相同方式部署

如需帮助，请参考：
- Cloudflare Pages 文档：https://developers.cloudflare.com/pages/
- Next.js 部署指南：https://nextjs.org/docs/deployment
- shadcn/ui 文档：https://ui.shadcn.com/
