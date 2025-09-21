# 🔐 API密钥安全配置指南

## 文件说明

### 1. `.env` (本地开发，⚠️ 不要提交到Git)
包含您的真实API密钥，仅在本地开发环境使用：
```bash
# 智谱AI API Key
ZHIPUAI_API_KEY=your_new_zhipuai_api_key_here

# OpenRouter API Key  
OPENROUTER_API_KEY=your_new_openrouter_api_key_here

# JWT密钥
JWT_SECRET=development_jwt_secret_key_for_local_testing_only

# 管理员用户名
ADMIN_USERNAME=admin

# 管理员密码
ADMIN_PASSWORD=admin123

# 开发环境标识
NODE_ENV=development
```

### 2. `.env.example` (模板，✅ 可提交到Git)
作为模板文件，不包含真实密钥：
```bash
# 智谱AI API Key
ZHIPUAI_API_KEY=your_zhipuai_api_key_here

# OpenRouter API Key  
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 3. `wrangler.jsonc` (生产环境配置)
生产环境通过Cloudflare环境变量设置，不要在这里硬编码密钥。

## 安全最佳实践

### ✅ 推荐做法
1. **本地开发**：使用`.env`文件 + `dotenv`
2. **生产环境**：使用Cloudflare环境变量
3. **团队协作**：`.env`添加到`.gitignore`，只分享`.env.example`
4. **定期轮换**：定期更换API密钥

### ❌ 避免做法
1. 不要将真实密钥提交到Git
2. 不要在代码中硬编码密钥
3. 不要在客户端代码中暴露密钥
4. 不要使用不安全的密钥存储方式

## 环境变量设置方法

### 本地开发
1. 复制模板文件：`cp .env.example .env`
2. 编辑`.env`文件，填入您的真实API密钥
3. 重启开发服务器

### 生产环境 (Cloudflare Workers)
```bash
# 设置智谱AI密钥
wrangler secret put ZHIPUAI_API_KEY

# 设置OpenRouter密钥
wrangler secret put OPENROUTER_API_KEY

# 设置JWT密钥
wrangler secret put JWT_SECRET
```

## 密钥轮换建议

1. **智谱AI**：每3-6个月轮换一次
2. **OpenRouter**：每3-6个月轮换一次
3. **JWT密钥**：部署到生产环境时必须更换