# 快速部署指南

## 🚀 一键部署

所有部署脚本已优化为**完全自动化、非交互式**。

### 基本用法

```bash
# 部署所有服务（默认）
bash deploy-all.sh

# 或指定模式
bash deploy-all.sh all          # 全部部署
bash deploy-all.sh backend      # 仅后端
bash deploy-all.sh admin        # 仅管理后台
bash deploy-all.sh frontend     # 仅前端
```

### 数字模式（兼容旧版）

```bash
bash deploy-all.sh 1  # 全部部署
bash deploy-all.sh 2  # 仅后端
bash deploy-all.sh 3  # 仅管理后台
bash deploy-all.sh 4  # 仅前端
```

## 📋 部署流程

### 1. 后端部署

```bash
cd backend
bash deploy.sh
```

**自动执行**:
- ✅ 安装依赖
- ✅ 数据库迁移（自动跳过已应用的迁移）
- ✅ 部署到 Cloudflare Workers
- ✅ 健康检查验证

**配置已生效**:
- Cerebras Qwen 3 235B 作为默认 LLM
- API 端点: `https://api.cerebras.ai/v1`
- 四级容错策略已启用

### 2. 管理后台部署

```bash
cd admin
bash deploy.sh
```

**自动执行**:
- ✅ 直接部署到 Cloudflare Pages（无需构建）
- ✅ 使用 config.json 中的 API URL

### 3. 前端部署

```bash
cd frontend
bash deploy.sh
```

**自动执行**:
- ✅ 安装依赖
- ✅ Next.js 静态构建
- ✅ 部署到 Cloudflare Pages

## 🔍 常见输出说明

### 数据库迁移输出

**正常输出**:
```
🚀 开始数据库迁移...
⏭️  0001_create_initial_tables.sql (已应用)
⏭️  0002_fearless_sprite.sql (已应用)
✅ 0003_add_source_visibility.sql
✅ 0004_add_rss_content_caching.sql

📊 迁移统计:
   新执行: 2
   已跳过: 2
✅ 数据库迁移完成！
```

- **⏭️** = 已应用过的迁移（跳过）
- **✅** = 新执行的迁移
- **❌** = 执行失败（仅显示真正的错误）

### 部署成功标志

**后端**:
```
✅ 后端部署成功！健康检查通过
🌐 API 地址: https://moxiang-distill.masiqi.workers.dev
```

**管理后台**:
```
✅ 管理后台部署成功！
🌐 访问地址: https://moxiang-distill-admin.pages.dev
```

**前端**:
```
✅ 前端部署成功！
🌐 访问地址: https://moxiang-distill-frontend.pages.dev
```

## 🛠️ 故障排除

### 部署失败

1. **检查登录状态**:
   ```bash
   npx wrangler whoami
   ```

2. **查看详细日志**:
   ```bash
   npx wrangler tail moxiang-distill
   ```

3. **重新部署**:
   ```bash
   bash deploy-all.sh backend  # 单独重试后端
   ```

### 数据库迁移问题

如果迁移完全失败（不是"已应用"错误），手动运行：

```bash
cd backend
bash migrate-db.sh
```

查看具体错误信息。

### Cerebras API 测试

部署后测试 Cerebras 配置：

```bash
# 查看环境变量
npx wrangler tail moxiang-distill | grep CEREBRAS

# 触发一次内容处理，观察日志
# 应该看到 "Cerebras Qwen 3 235B" 的调用
```

## 📊 部署时间参考

| 服务 | 预计时间 |
|------|---------|
| 后端 | ~10-15秒 |
| 管理后台 | ~5秒 |
| 前端 | ~30-40秒（含构建） |
| **总计** | **~1分钟** |

## 🎯 部署检查清单

部署后验证：

- [ ] 后端健康检查: `curl https://moxiang-distill.masiqi.workers.dev/api/health`
- [ ] 管理后台可访问: https://moxiang-distill-admin.pages.dev
- [ ] 前端可访问: https://moxiang-distill-frontend.pages.dev
- [ ] Cerebras 配置已加载（查看后端日志）
- [ ] 数据库连接正常

## 💡 小贴士

1. **首次部署**: 域名生效可能需要 2-5 分钟
2. **频繁部署**: Cloudflare 有缓存，可能看不到即时更新
3. **清除缓存**: 在 Cloudflare Dashboard 清除
4. **自定义域名**: 在 Cloudflare Pages 设置中绑定

## 🔗 相关文档

- **Cerebras 配置**: `CEREBRAS_SETUP.md`
- **完整部署指南**: `DEPLOYMENT.md`
- **配置摘要**: `CEREBRAS_CONFIG_SUMMARY.md`
