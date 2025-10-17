# Cerebras API 配置指南

## 📋 概述

已将 Cerebras 配置为默认 LLM 提供商，享受业界最快的推理速度和极高性价比。

## 🚀 快速开始

### 1. 获取 Cerebras API Key

访问 [Cerebras Cloud](https://cloud.cerebras.ai/) 注册并获取 API key。

### 2. 配置 Secret

**方式一：使用 wrangler secret（推荐）**

```bash
cd backend
npx wrangler secret put CEREBRAS_API_KEY
# 在提示时输入你的 Cerebras API key
```

**方式二：本地开发（.dev.vars 文件）**

```bash
cd backend
echo "CEREBRAS_API_KEY=your_cerebras_api_key_here" >> .dev.vars
```

### 3. 验证配置

部署后端并检查日志：

```bash
cd backend
bash deploy.sh
```

## 🔑 关于 Wrangler Secrets

### Secrets 是项目级隔离的

**重要说明**：Cloudflare Workers secrets 是**按项目（Worker）隔离**的，不会与其他项目冲突。

- 每个 Worker 有自己独立的 secrets 存储
- 在项目 A 设置的 `CEREBRAS_API_KEY` 不会影响项目 B
- 同一个 secret 名称可以在不同项目中设置不同的值

### 管理 Secrets

**查看已设置的 secrets：**
```bash
npx wrangler secret list
```

**更新 secret：**
```bash
npx wrangler secret put CEREBRAS_API_KEY
```

**删除 secret：**
```bash
npx wrangler secret delete CEREBRAS_API_KEY
```

## 🎯 四级容错策略

系统已配置智能容错机制（当 `DEFAULT_LLM_PROVIDER=cerebras` 且 `ENABLE_LLM_FALLBACK=true`）：

1. **第一级**: Cerebras Qwen 3 235B（默认）
2. **第二级**: 智谱 AI GLM-4.5-Flash（备用）
3. **第三级**: OpenRouter GLM-4.5-Air（备用）
4. **第四级**: Cloudflare Workers AI（最终备用）

如果 Cerebras 调用失败，系统会自动降级到下一个可用的提供商。

## 🔧 Cerebras 模型配置

**默认模型**: `qwen-3-235b-a22b-instruct-2507`（通义千问 3，235B 参数）

**可用模型**:
- `qwen-3-235b-a22b-instruct-2507` - 通义千问 3，235B 参数，中文理解极佳
- `gpt-oss-120b` - GPT OSS 120B，开源模型

**模型特性**:
- ✅ 128K 长上下文支持
- ✅ 中文理解能力顶尖
- ✅ 超快速推理（Cerebras 加速）
- ✅ 高质量新闻分析

## 🔧 配置文件位置

- **生产环境**: `backend/wrangler.jsonc` (vars.DEFAULT_LLM_PROVIDER)
- **环境变量示例**: `backend/.env.example`
- **LLM 配置服务**: `backend/src/services/llm-config.service.ts`
- **统一 LLM 服务**: `backend/src/services/unified-llm.service.ts`
- **Cerebras 服务**: `backend/src/services/cerebras.service.ts`

## 💡 为什么选择 Cerebras Qwen 3？

| 特性 | Cerebras Qwen 3 | GLM | OpenRouter | Cloudflare AI |
|------|-----------------|-----|------------|---------------|
| **推理速度** | ⚡️ 最快（业界领先） | 快 | 中等 | 快 |
| **并发能力** | 🚀 50+ | 5 | 20 | 10 |
| **每日限额** | 📊 10,000 | 1,000 | 1,000 | 1,000 |
| **成本** | 💰 $0.0006/1K tokens | $0.001 | 免费/付费 | 免费 |
| **中文支持** | ⭐️ 极佳（Qwen 3） | ⭐️ 极佳 | ✅ 良好 | ⚠️ 一般 |
| **长上下文** | ✅ 128K | ⚠️ 有限 | ✅ 支持 | ⚠️ 有限 |
| **模型规模** | 🎯 235B 参数 | 45B | 多种 | 8B |

## 🔄 切换 LLM 提供商

如果需要切换默认提供商，修改 `backend/wrangler.jsonc`：

```jsonc
"vars": {
  "DEFAULT_LLM_PROVIDER": "cerebras",  // 可选: cerebras, glm, openrouter, cloudflare, auto
  "ENABLE_LLM_FALLBACK": "true"
}
```

- `cerebras` - 仅使用 Cerebras
- `glm` - 仅使用智谱 AI
- `openrouter` - 仅使用 OpenRouter
- `cloudflare` - 仅使用 Cloudflare AI
- `auto` - 智能选择（Cerebras 优先，自动降级）

## 📊 监控和日志

查看 LLM 调用日志：

```bash
npx wrangler tail moxiang-distill
```

日志会显示：
- 使用的模型
- 处理时间
- 是否触发降级
- 错误信息（如有）

## ❓ 常见问题

**Q: Cerebras API key 会与其他项目冲突吗？**
A: 不会。Wrangler secrets 是按 Worker 项目隔离的，每个项目有独立的 secrets 存储。

**Q: 如何验证 Cerebras 配置是否生效？**
A: 部署后查看日志，应该看到 "Cerebras Qwen 3 235B" 的调用记录。

**Q: 可以切换到其他 Cerebras 模型吗？**
A: 可以，在 wrangler.jsonc 中修改 `CEREBRAS_DEFAULT_MODEL` 为 `gpt-oss-120b` 或其他可用模型。

**Q: 如果 Cerebras 配额用完了怎么办？**
A: 系统会自动降级到智谱 AI，无需人工干预。

**Q: 本地开发如何配置？**
A: 创建 `.dev.vars` 文件并添加 `CEREBRAS_API_KEY=your_key`。

## 🎉 部署

配置完成后，使用以下命令部署：

```bash
# 部署所有服务
bash deploy-all.sh

# 或仅部署后端
cd backend && bash deploy.sh
```

管理后台部署脚本已优化，不再需要手动确认 API URL。
