# 新闻平台项目结构说明

## 目录结构

```
news-platform/
├── backend/                    # 后端主目录
│   ├── src/                    # 源代码目录
│   │   ├── index.ts         # 主入口文件，路由注册
│   │   ├── routes/           # HTTP路由定义
│   │   │   ├── auth.ts        # 认证相关路由
│   │   │   ├── sources.ts     # RSS源管理路由
│   │   │   ├── users.ts       # 用户管理路由
│   │   │   ├── system.ts      # 系统管理路由
│   │   │   ├── topics.ts      # 话题管理路由
│   │   │   ├── web-content.ts  # Web内容管理路由
│   │   │   └── test-ai-binding.ts  # AI绑定测试路由
│   │   ├── services/         # 业务服务目录
│   │   │   ├── llm-extractor.ts        # LLM内容提取服务
│   │   │   └── llm-content-extractor.ts  # LLM内容提取服务
│   │   ├── db/              # 数据库相关
│   │   │   └── schema.ts     # 数据库模式定义
│   │   └── services/        # 其他服务
│   │       └── content-cache.service.ts  # 内容缓存服务
│   ├── public/                # 静态资源目录
│   ├── wrangler.jsonc      # Cloudflare Workers配置
│   ├── .dev.vars         # 开发环境变量
│   ├── .dev.vars.example  # 开发环境变量示例
│   ├── worker-configuration.d.ts  # Worker类型定义
│   └── package.json      # 项目依赖配置
└── services/               # 独立服务目录
    └── llm-extractor.ts  # LLM内容提取器
```

## 核心文件说明

### 路由配置 (`src/routes/`)
- `auth.ts` - 用户认证、授权相关路由
- `sources.ts` - RSS源的增删改查路由
- `users.ts` - 用户管理相关路由
- `system.ts` - 系统配置、状态查询路由
- `topics.ts` - 话题分类、管理路由
- `web-content.ts` - Web内容管理路由
- `test-ai-binding.ts` - AI服务绑定测试路由

### 业务服务 (`src/services/` 和 `services/`)
- `llm-extractor.ts` - 基于智谱AI的新闻内容提取服务
- `llm-content-extractor.ts` - LLM内容处理服务
- `content-cache.service.ts` - 内容缓存服务

### 环境变量配置
- `.dev.vars` - 开发环境变量（不提交到版本库）
- `.dev.vars.example` - 开发环境变量示例模板
- `wrangler.jsonc` - Cloudflare Workers配置

## 服务职责

### LLM内容提取服务
**位置**: `services/llm-extractor.ts`
**功能**: 
- 使用智谱AI的glm-4.5-flash模型
- 从HTML网页中智能提取新闻正文
- 提取标题、摘要、时间、作者、来源等信息
- 生成主题标签和关键词
- 支持一次调用完成所有任务

### 特点优势
- **免费使用**: glm-4.5-flash完全免费
- **高质量**: 智谱AI的中文理解能力优秀
- **大上下文**: 128K上下文支持，处理复杂页面
- **安全性**: API Key通过环境变量管理
- **通用性**: 适用于任何结构的中文新闻网站
- **维护简单**: 无需维护复杂HTML解析规则

## 使用说明

### 环境配置
1. 复制 `.dev.vars.example` 为 `.dev.vars`
2. 设置实际的智谱AI API Key:
   ```
   ZHIPUAI_API_KEY=your_actual_api_key_here
   ```

### 启动服务
```bash
cd backend
npm run dev
```

### API使用
```bash
# LLM内容提取
curl -X POST http://localhost:8787/llm-extractor/extract \
  -H "Authorization: Bearer development_jwt_secret_key_for_local_testing_only" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/news/article.html",
    "title": "新闻标题"
  }'
```

## 开发规范

### 路由命名
- 使用连字符分隔：`llm-extractor`
- 功能清晰：路由名要体现其功能
- 统一风格：所有路由保持相同的命名风格

### 服务分层
- **routes层**: 处理HTTP请求、参数验证、响应格式化
- **services层**: 业务逻辑处理、外部API调用、数据计算
- **缓存层**: 数据缓存、性能优化

### 配置管理
- **敏感信息**: 使用环境变量，不硬编码在代码中
- **环境隔离**: 开发、测试、生产环境使用不同配置
- **示例文件**: 提供配置模板便于新开发者快速上手

## 扩展指南

### 添加新服务
1. 在 `services/` 目录下创建新的服务文件
2. 在 `src/index.ts` 中导入并注册路由
3. 如需环境变量，在 `.dev.vars.example` 中添加说明

### 修改现有服务
1. 直接在 `services/` 目录下修改对应文件
2. 如需要新的环境变量，更新 `.dev.vars.example`
3. 确保向后兼容性

### 部署注意事项
1. 确保生产环境的环境变量已正确设置
2. 测试所有API端点功能正常
3. 检查智谱AI API Key的有效性
4. 监控服务性能和错误日志