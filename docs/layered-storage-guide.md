# 分层存储架构使用指南

## 概述

本项目实现了基于写时复制（Copy-on-Write）的分层存储架构，优化存储空间同时保持用户编辑隔离。

## 核心概念

### 1. 共享内容池 (Shared Content Pool)
- **作用**: 存储处理后的Markdown内容，所有用户共享
- **路径**: `shared-content/{content_hash}/original.md`
- **优势**: 相同内容只存储一次，大幅节省存储空间

### 2. 用户空间 (User Space)  
- **作用**: 每个用户的独立存储空间
- **路径**: `users/{user_id}/notes/{entry_id}.md`
- **特点**: 初始时指向共享内容，编辑后创建独立副本

### 3. 写时复制 (Copy-on-Write)
- **机制**: 用户第一次编辑内容时才创建独立副本
- **好处**: 未编辑的用户继续共享原始内容，节省空间

## 使用方式

### 1. 基本存储流程

```typescript
import { SharedContentPoolService } from './services/shared-content-pool.service';
import { R2Service } from './services/r2.service';

// 初始化服务
const r2Service = new R2Service(env);
const sharedContentPool = new SharedContentPoolService(db, r2Service);

// 1. 处理RSS内容后存储到共享池
const contentHash = await computeHash(markdownContent);
const sharedContent = await sharedContentPool.storeToSharedPool(
  contentHash,
  markdownContent,
  {
    title: 'Article Title',
    source: 'News Source',
    publishedAt: new Date(),
    processingTime: 1000,
    modelUsed: 'glm-4.5-flash',
    wordCount: 500,
    entryId: 123
  }
);

// 2. 为每个用户创建副本
for (const user of targetUsers) {
  await sharedContentPool.createUserCopy(user.id, entryId, contentHash);
}
```

### 2. 处理用户编辑

```typescript
// 在WebDAV PUT操作中检测用户编辑
async handleWebDAVPut(userId, entryId, newContent) {
  try {
    const result = await sharedContentPool.handleUserContentUpdate(
      userId,
      entryId,
      newContent
    );
    
    if (result.isNewCopy) {
      console.log('用户创建了独立副本');
    } else {
      console.log('内容未发生变化');
    }
    
    return { success: true, path: result.path };
  } catch (error) {
    console.error('处理用户编辑失败:', error);
    return { success: false, error: error.message };
  }
}
```

### 3. 获取用户内容

```typescript
// 获取用户的实际内容（可能是共享的或独立的）
const userContent = await sharedContentPool.getUserContent(userId, entryId);

console.log('内容:', userContent.content);
console.log('路径:', userContent.path);
console.log('是否已修改:', userContent.isModified);
```

## 集成点

### 1. AI处理Worker集成

在 `src/workers/ai-processor.ts` 中已经集成：

```typescript
// 计算内容哈希
const contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(markdownContent))
  .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));

// 存储到共享内容池
const sharedContent = await sharedContentPool.storeToSharedPool(
  contentHash,
  markdownContent,
  sharedContentMetadata
);

// 为用户创建副本
const userCopy = await sharedContentPool.createUserCopy(
  userId,
  parseInt(entryId),
  contentHash
);
```

### 2. WebDAV中间件集成

使用 `src/middleware/webdav-edit-detection.ts` 检测用户编辑：

```typescript
import { createWebDAVEditDetectionMiddleware } from '../middleware/webdav-edit-detection';

const webDAVMiddleware = createWebDAVEditDetectionMiddleware(sharedContentPool);

// 在WebDAV服务中使用
app.use('/webdav/*', webDAVMiddleware(handleWebDAVRequest));
```

## 存储优化

### 1. 自动清理孤立内容

```typescript
// 清理不再被引用的共享内容
const cleanupResult = await sharedContentPool.cleanupOrphanedContent();

console.log(`清理了 ${cleanupResult.removed} 个孤立内容`);
console.log(`释放了 ${cleanupResult.spaceFreed} 字节空间`);
```

### 2. 存储统计

```typescript
// 获取存储使用统计
const stats = await sharedContentPool.getStorageStats();

console.log(`共享文件数: ${stats.totalSharedFiles}`);
console.log(`用户文件数: ${stats.totalUserFiles}`);
console.log(`总存储使用: ${stats.totalStorageUsed} 字节`);
console.log(`节省空间: ${stats.sharedContentSavings} 字节`);
console.log(`压缩比率: ${(stats.compressionRatio * 100).toFixed(1)}%`);
```

## 性能优化建议

### 1. 批量操作

```typescript
// 批量为多个用户创建副本
const userEntries = [
  { userId: 'user1', entryId: 123, contentHash: 'hash1' },
  { userId: 'user2', entryId: 123, contentHash: 'hash1' },
  // ...
];

for (const { userId, entryId, contentHash } of userEntries) {
  await sharedContentPool.createUserCopy(userId, entryId, contentHash);
}
```

### 2. 缓存策略

```typescript
// 缓存频繁访问的内容
const contentCache = new Map();

async function getCachedContent(userId, entryId) {
  const cacheKey = `${userId}:${entryId}`;
  
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey);
  }
  
  const content = await sharedContentPool.getUserContent(userId, entryId);
  contentCache.set(cacheKey, content);
  
  return content;
}
```

## 监控和日志

### 1. 关键指标监控

- 共享内容命中率
- 用户编辑频率
- 存储空间使用率
- 清理操作效率

### 2. 日志记录

```typescript
// 启用详细日志记录
console.log(`[SharedContentPool] 存储内容: ${contentHash}`);
console.log(`[UserCopy] 创建用户副本: ${userId} - ${entryId}`);
console.log(`[EditDetection] 检测到用户编辑: ${userId} - ${entryId}`);
console.log(`[Cleanup] 清理孤立内容: ${removed} 个文件`);
```

## 故障排除

### 1. 常见问题

**问题**: 用户文件无法访问
**解决**: 检查用户副本是否正确创建，验证R2存储权限

**问题**: 存储空间未节省
**解决**: 确认内容哈希计算正确，检查是否创建了不必要的副本

**问题**: 编辑检测不工作
**解决**: 验证WebDAV中间件是否正确集成，检查哈希比较逻辑

### 2. 调试方法

```typescript
// 检查共享内容状态
const sharedContent = await db.select().from(contentLibrary).where(eq(contentLibrary.contentHash, hash)).get();

// 检查用户引用状态
const userRef = await db.select().from(userStorageRefs).where(
  and(eq(userStorageRefs.userId, userId), eq(userStorageRefs.entryId, entryId))
).get();

// 验证文件是否存在
const fileExists = await r2Service.fileExists(path);
```

## 扩展功能

### 1. 版本管理（未来扩展）

```typescript
// 保存用户编辑历史
await sharedContentPool.saveVersion(userId, entryId, oldContent, newContent);

// 获取内容版本历史
const versions = await sharedContentPool.getVersionHistory(userId, entryId);

// 恢复到指定版本
await sharedContentPool.restoreVersion(userId, entryId, versionId);
```

### 2. 内容压缩（未来扩展）

```typescript
// 启用内容压缩
const compressed = await sharedContentPool.compressContent(markdownContent);

// 计算压缩比率
const compressionRatio = await sharedContentPool.getCompressionRatio(contentHash);
```

这个分层存储架构在保持简单性的同时实现了显著的存储优化，适合Serverless环境的部署需求。