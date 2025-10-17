# Cerebras 配置摘要

## ✅ 已完成的配置

### 1. 模型信息
- **默认模型**: `qwen-3-235b-a22b-instruct-2507`
- **备用模型**: `gpt-oss-120b`
- **API 端点**: `https://api.cerebras.ai/v1`

### 2. 配置文件更新

**环境变量** (`backend/.env.example`):
```bash
CEREBRAS_API_KEY=your_cerebras_api_key_here
CEREBRAS_API_URL=https://api.cerebras.ai/v1
CEREBRAS_MODELS=qwen-3-235b-a22b-instruct-2507,gpt-oss-120b
CEREBRAS_DEFAULT_MODEL=qwen-3-235b-a22b-instruct-2507
```

**生产配置** (`backend/wrangler.jsonc`):
```jsonc
"vars": {
  "DEFAULT_LLM_PROVIDER": "cerebras",
  "ENABLE_LLM_FALLBACK": "true",
  "CEREBRAS_API_URL": "https://api.cerebras.ai/v1",
  "CEREBRAS_DEFAULT_MODEL": "qwen-3-235b-a22b-instruct-2507",
  ...
}
```

### 3. 服务集成

**新增服务**:
- ✅ `backend/src/services/cerebras.service.ts` - Cerebras API 集成

**更新服务**:
- ✅ `backend/src/services/llm-config.service.ts` - 添加 Cerebras 提供商（优先级 1）
- ✅ `backend/src/services/unified-llm.service.ts` - 集成四级容错策略

### 4. 部署脚本优化

**管理后台** (`admin/deploy.sh`):
- ✅ 移除交互式 API URL 确认
- ✅ 自动使用 `config.json` 配置

## 🚀 下一步操作

### 设置 Cerebras API Key

```bash
cd backend
npx wrangler secret put CEREBRAS_API_KEY
# 输入您的 Cerebras API key
```

### 部署所有服务

```bash
cd /work/llm/news
bash deploy-all.sh
```

选择选项 **1**（全部部署）即可。

## 📊 四级容错架构

```
┌─────────────────────────────────────┐
│  Cerebras Qwen 3 235B (第一级)       │  ← 默认
│  - 超快速推理（业界最快）              │
│  - 128K 长上下文                      │
│  - 中文理解极佳                        │
└─────────────────────────────────────┘
              ↓ 失败降级
┌─────────────────────────────────────┐
│  智谱 AI GLM-4.5-Flash (第二级)      │
│  - 中文理解优秀                        │
│  - 响应速度快                          │
└─────────────────────────────────────┘
              ↓ 失败降级
┌─────────────────────────────────────┐
│  OpenRouter GLM-4.5-Air (第三级)     │
│  - 免费额度                            │
│  - 高并发支持                          │
└─────────────────────────────────────┘
              ↓ 失败降级
┌─────────────────────────────────────┐
│  Cloudflare Workers AI (第四级)      │
│  - 完全免费                            │
│  - 最终兜底                            │
└─────────────────────────────────────┘
```

## 🎯 Qwen 3 235B 优势

### 为什么选择 Qwen 3？

1. **中文理解顶尖** - 阿里通义千问专门针对中文优化
2. **超大参数量** - 235B 参数，理解能力强大
3. **长上下文** - 支持 128K tokens，可处理长文章
4. **Cerebras 加速** - 推理速度业界最快
5. **性价比极高** - $0.0006/1K tokens

### 对比其他模型

| 模型 | 参数量 | 中文能力 | 上下文 | 速度 |
|------|--------|---------|--------|------|
| Qwen 3 235B (Cerebras) | 235B | ⭐️⭐️⭐️⭐️⭐️ | 128K | ⚡️⚡️⚡️⚡️⚡️ |
| GLM-4.5-Flash | 45B | ⭐️⭐️⭐️⭐️⭐️ | 32K | ⭐️⭐️⭐️⭐️ |
| GPT-4 Turbo | 1.76T | ⭐️⭐️⭐️⭐️ | 128K | ⭐️⭐️⭐️ |
| Llama 3.1 70B | 70B | ⭐️⭐️⭐️ | 128K | ⭐️⭐️⭐️ |

## 📝 配置验证

部署后检查日志：

```bash
npx wrangler tail moxiang-distill
```

应该看到：
```
=== Cerebras API 分析开始 ===
[API端点] https://api.cerebras.ai/v1/chat/completions
[模型] qwen-3-235b-a22b-instruct-2507
...
[SUCCESS] Cerebras Qwen 3 235B 分析成功完成
```

## 🔧 切换模型

如需使用 GPT OSS 120B：

```jsonc
// backend/wrangler.jsonc
"vars": {
  "CEREBRAS_DEFAULT_MODEL": "gpt-oss-120b",
  ...
}
```

重新部署即可生效。

## 📚 相关文档

- **详细配置指南**: `CEREBRAS_SETUP.md`
- **部署文档**: `DEPLOYMENT.md`
- **API 文档**: `backend/API_KEY_SETUP.md`

---

**状态**: ✅ 配置完成，随时可部署
**建议**: 设置 API key 后立即部署测试
