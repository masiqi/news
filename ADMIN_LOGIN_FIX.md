# 管理后台登录问题修复

## 🐛 问题描述

管理后台登录时，请求发送到了错误的地址：
- **错误**: `https://moxiang-distill-admin.pages.dev/auth/admin-login`
- **正确**: `https://moxiang-distill.masiqi.workers.dev/auth/admin-login`

## ✅ 修复方案

### 修改内容

**文件**: `admin/index.html`

**修复点 1**: 配置加载逻辑
```javascript
// 从 config.json 动态加载后端 API 地址
(async function initializeBackendUrlHelpers() {
    try {
        const response = await fetch('/config.json');
        const config = await response.json();
        window.ADMIN_BACKEND_BASE_URL = config.apiUrl || '';
        console.log('[Config] 后端 API 地址:', window.ADMIN_BACKEND_BASE_URL);
    } catch (error) {
        console.error('[Config] 加载配置失败:', error);
    }
})();
```

**修复点 2**: 等待配置加载完成
```javascript
async function loadComponents() {
    // 等待后端 URL 配置加载完成
    let retries = 0;
    while (!window.ADMIN_BACKEND_BASE_URL && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }
    // 然后再加载组件
}
```

## 🧪 验证测试

### 1. 后端 API 测试

```bash
curl -X POST 'https://moxiang-distill.masiqi.workers.dev/auth/admin-login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123456"}'
```

**预期响应**:
```json
{
  "message": "管理员登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 0,
    "username": "admin",
    "isAdmin": true
  }
}
```

✅ **状态**: 通过

### 2. 前端配置测试

访问管理后台 (https://moxiang-distill-admin.pages.dev)，打开浏览器控制台，应该看到：

```
[Config] 后端 API 地址: https://moxiang-distill.masiqi.workers.dev
[Config] 配置加载成功: https://moxiang-distill.masiqi.workers.dev
```

### 3. 登录流程测试

1. 访问 https://moxiang-distill-admin.pages.dev
2. 输入用户名: `admin`
3. 输入密码: `Admin@123456`
4. 点击登录

**预期结果**:
- 请求发送到: `https://moxiang-distill.masiqi.workers.dev/auth/admin-login`
- 登录成功，跳转到管理后台首页

## 📋 配置文件

**`admin/config.json`**:
```json
{
  "apiUrl": "https://moxiang-distill.masiqi.workers.dev",
  "adminTitle": "墨香蒸馏 - 管理后台"
}
```

## 🔧 登录凭据

### 管理员账号

- **用户名**: `admin`
- **密码**: `Admin@123456`

### 修改密码

在 `backend/wrangler.jsonc` 中修改：
```jsonc
"vars": {
  "ADMIN_USERNAME": "admin",
  "ADMIN_PASSWORD": "your_new_password"
}
```

然后重新部署后端：
```bash
cd backend
npx wrangler deploy
```

## 🚀 部署

修复后需要重新部署管理后台：

```bash
cd admin
bash deploy.sh
```

## 📊 部署状态

- ✅ 后端 API: https://moxiang-distill.masiqi.workers.dev
- ✅ 管理后台: https://moxiang-distill-admin.pages.dev
- ✅ 配置加载: 正常
- ✅ 登录功能: 正常

## 🔍 故障排除

### 问题 1: 配置未加载

**症状**: 控制台没有显示配置加载信息

**解决**:
1. 清除浏览器缓存
2. 强制刷新 (Ctrl+Shift+R / Cmd+Shift+R)
3. 检查 `config.json` 是否存在

### 问题 2: 登录请求发到错误地址

**症状**: 请求仍然发送到 `*.pages.dev/auth/admin-login`

**解决**:
1. 打开浏览器控制台
2. 运行: `console.log(window.ADMIN_BACKEND_BASE_URL)`
3. 应该输出: `https://moxiang-distill.masiqi.workers.dev`
4. 如果不正确，刷新页面等待配置加载

### 问题 3: 401 Unauthorized

**症状**: 密码错误

**解决**:
- 使用正确的密码: `Admin@123456`（注意大小写）
- 或在 wrangler.jsonc 中查看配置的密码

## 💡 技术说明

### API 路由结构

后端路由挂载在 `backend/src/index.ts:63`:
```typescript
app.route("/auth", authRoutes);
```

管理员登录路由在 `backend/src/routes/auth.ts:237`:
```typescript
authRoutes.post("/admin-login", async (c) => {
  // 登录逻辑
});
```

**完整路径**: `/auth/admin-login`

### 配置加载流程

1. 页面加载时，异步 fetch `/config.json`
2. 解析 JSON，设置 `window.ADMIN_BACKEND_BASE_URL`
3. 等待配置加载完成（最多 5 秒）
4. 加载组件，组件使用 `buildAdminBackendUrl()` 构建 API 路径
5. 登录请求发送到正确的后端地址

## ✅ 修复验证清单

- [x] 配置从 `config.json` 动态加载
- [x] 组件等待配置加载完成
- [x] 后端 API 正常响应
- [x] 登录请求发送到正确地址
- [x] 管理后台重新部署
- [x] 登录功能测试通过
