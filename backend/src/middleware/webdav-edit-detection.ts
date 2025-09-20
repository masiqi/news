// src/middleware/webdav-edit-detection.ts
// WebDAV编辑检测中间件 - 实现写时复制机制

import { SharedContentPoolService } from '../services/shared-content-pool.service';

interface WebDAVRequest {
  method: string;
  path: string;
  userId: string;
  headers: Record<string, string>;
  body?: string;
}

interface WebDAVResponse {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

export class WebDAVEditDetectionMiddleware {
  private readonly USER_NOTES_PATH = '/notes/';

  constructor(
    private sharedContentPool: SharedContentPoolService,
    private next: (req: WebDAVRequest) => Promise<WebDAVResponse>
  ) {}

  /**
   * 处理WebDAV请求，检测用户编辑
   */
  async handleRequest(req: WebDAVRequest): Promise<WebDAVResponse> {
    const { method, path, userId } = req;

    // 只处理PUT请求（文件更新）和用户笔记路径
    if (method === 'PUT' && path.startsWith(this.USER_NOTES_PATH)) {
      return this.handleFileUpdate(req);
    }

    // 其他请求直接传递给下一个处理器
    return this.next(req);
  }

  /**
   * 处理文件更新请求
   */
  private async handleFileUpdate(req: WebDAVRequest): Promise<WebDAVResponse> {
    const { path, userId, body } = req;

    try {
      console.log(`WebDAV编辑检测: 用户 ${userId} 更新文件 ${path}`);

      // 从路径中提取entryId
      const entryId = this.extractEntryIdFromPath(path);
      if (!entryId) {
        console.warn(`无法从路径提取entryId: ${path}`);
        return this.next(req);
      }

      // 如果没有新内容，直接传递
      if (!body) {
        console.warn(`文件内容为空: ${path}`);
        return this.next(req);
      }

      // 处理用户内容更新（写时复制）
      const updateResult = await this.sharedContentPool.handleUserContentUpdate(
        userId,
        parseInt(entryId),
        body
      );

      console.log(`WebDAV编辑处理完成: ${userId} - ${entryId}, 新副本: ${updateResult.isNewCopy}`);

      // 返回成功响应
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'DAV': '1, 2',
          'X-Edit-Detected': updateResult.isNewCopy ? 'true' : 'false',
          'X-Content-Hash': updateResult.path
        },
        body: this.createSuccessResponse(updateResult.isNewCopy)
      };

    } catch (error) {
      console.error(`WebDAV编辑检测失败: ${path}`, error);
      
      // 如果处理失败，回退到原始处理方式
      try {
        return await this.next(req);
      } catch (fallbackError) {
        console.error('WebDAV回退处理也失败:', fallbackError);
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/xml',
            'DAV': '1'
          },
          body: this.createErrorResponse('处理文件更新失败')
        };
      }
    }
  }

  /**
   * 从WebDAV路径提取entryId
   */
  private extractEntryIdFromPath(path: string): string | null {
    // 路径格式: /notes/{entryId}.md 或 /users/{userId}/notes/{entryId}.md
    const patterns = [
      /\/notes\/(\d+)\.md$/,
      /\/users\/[^\/]+\/notes\/(\d+)\.md$/,
      /\/notes\/(\d+)$/,
      /\/users\/[^\/]+\/notes\/(\d+)$/
    ];

    for (const pattern of patterns) {
      const match = path.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 创建成功响应
   */
  private createSuccessResponse(isNewCopy: boolean): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${isNewCopy ? 'new-copy' : 'shared-content'}"</d:getetag>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(message: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/</d:href>
    <d:propstat>
      <d:prop/>
      <d:status>HTTP/1.1 500 Internal Server Error</d:status>
      <d:error>${message}</d:error>
    </d:propstat>
  </d:response>
</d:multistatus>`;
  }

  /**
   * 获取用户编辑统计
   */
  async getUserEditStats(userId: string): Promise<{
    totalFiles: number;
    modifiedFiles: number;
    sharedFiles: number;
    totalSize: number;
    savedSpace: number;
  }> {
    try {
      // 这里需要调用共享内容池的统计方法
      // 目前返回模拟数据，实际实现需要扩展SharedContentPoolService
      return {
        totalFiles: 0,
        modifiedFiles: 0,
        sharedFiles: 0,
        totalSize: 0,
        savedSpace: 0
      };
    } catch (error) {
      console.error(`获取用户编辑统计失败: ${userId}`, error);
      return {
        totalFiles: 0,
        modifiedFiles: 0,
        sharedFiles: 0,
        totalSize: 0,
        savedSpace: 0
      };
    }
  }

  /**
   * 获取系统存储优化统计
   */
  async getSystemOptimizationStats(): Promise<{
    totalUsers: number;
    totalFiles: number;
    sharedContentRatio: number;
    spaceSaved: number;
    lastCleanupAt: Date;
  }> {
    try {
      const storageStats = await this.sharedContentPool.getStorageStats();
      
      return {
        totalUsers: 0, // 需要从用户表统计
        totalFiles: storageStats.totalSharedFiles + storageStats.totalUserFiles,
        sharedContentRatio: storageStats.compressionRatio,
        spaceSaved: storageStats.sharedContentSavings,
        lastCleanupAt: storageStats.lastCleanupAt
      };
    } catch (error) {
      console.error('获取系统优化统计失败:', error);
      return {
        totalUsers: 0,
        totalFiles: 0,
        sharedContentRatio: 0,
        spaceSaved: 0,
        lastCleanupAt: new Date()
      };
    }
  }
}

/**
 * 创建WebDAV编辑检测中间件
 */
export function createWebDAVEditDetectionMiddleware(
  sharedContentPool: SharedContentPoolService
) {
  return (next: (req: WebDAVRequest) => Promise<WebDAVResponse>) => {
    return new WebDAVEditDetectionMiddleware(sharedContentPool, next);
  };
}