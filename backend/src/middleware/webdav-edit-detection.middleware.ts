// WebDAV编辑检测中间件
// 检测用户的WebDAV编辑操作并触发编辑隔离机制

import { Context, Next } from 'hono';
import { UserEditIsolationService } from '../services/user-edit-isolation.service';
import type { WebDAVAuthUser } from './webdav-auth.middleware';

export interface WebDAVEditDetectionConfig {
  enabled: boolean;
  isolationService: UserEditIsolationService;
  excludedPaths: string[];
  maxFileSize: number; // 最大文件大小限制，字节
}

const DEFAULT_CONFIG: WebDAVEditDetectionConfig = {
  enabled: true,
  excludedPaths: ['/.git', '/.gitkeep', '/.DS_Store'],
  maxFileSize: 10 * 1024 * 1024 // 10MB
};

export class WebDAVEditDetectionMiddleware {
  private config: WebDAVEditDetectionConfig;

  constructor(config: Partial<WebDAVEditDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 中间件函数
   */
  async middleware(c: Context, next: Next): Promise<Response> {
    if (!this.config.enabled) {
      return next();
    }

    // 获取认证用户
    const authUser = c.get('webdavUser') as WebDAVAuthUser;
    if (!authUser) {
      return next();
    }

    const method = c.req.method;
    const path = c.req.path.replace('/webdav', '');

    // 检查是否在排除路径中
    if (this.isExcludedPath(path)) {
      return next();
    }

    // 根据HTTP方法检测编辑操作
    const operation = this.detectEditOperation(method, path);
    if (!operation) {
      return next();
    }

    console.log(`[WEBDAV_EDIT_DETECTION] 检测到编辑操作: ${method} ${path} -> ${operation}`);

    try {
      // 预处理：在执行实际操作前检测和创建副本
      const preprocessResult = await this.preprocessEditOperation(authUser, path, operation, c);
      
      if (!preprocessResult.success) {
        console.warn(`[WEBDAV_EDIT_DETECTION] 预处理失败: ${preprocessResult.error}`);
        // 继续执行原始操作，不影响用户体验
      }

      // 执行原始WebDAV操作
      const response = await next();

      // 后处理：记录编辑事件和更新状态
      if (response.status >= 200 && response.status < 300) {
        await this.postprocessEditOperation(authUser, path, operation, c, preprocessResult.copyPath);
      }

      return response;

    } catch (error) {
      console.error(`[WEBDAV_EDIT_DETECTION] 编辑检测处理失败:`, error);
      // 确保不影响原始功能
      return next();
    }
  }

  /**
   * 检查路径是否被排除
   */
  private isExcludedPath(path: string): boolean {
    return this.config.excludedPaths.some(excluded => 
      path === excluded || path.startsWith(excluded + '/')
    );
  }

  /**
   * 根据HTTP方法检测编辑操作类型
   */
  private detectEditOperation(method: string, path: string): 'create' | 'update' | 'delete' | 'move' | 'copy' | null {
    switch (method.toUpperCase()) {
      case 'PUT':
        return 'update';
      case 'DELETE':
        return 'delete';
      case 'MOVE':
        return 'move';
      case 'COPY':
        return 'copy';
      case 'MKCOL':
        return 'create';
      default:
        return null;
    }
  }

  /**
   * 预处理编辑操作
   */
  private async preprocessEditOperation(
    authUser: WebDAVAuthUser,
    path: string,
    operation: 'create' | 'update' | 'delete' | 'move' | 'copy',
    c: Context
  ): Promise<{ success: boolean; copyPath?: string; error?: string }> {
    try {
      let content: ArrayBuffer | undefined;
      let targetPath: string | undefined;

      // 根据操作类型获取相关信息
      switch (operation) {
        case 'PUT':
        case 'UPDATE':
          // 对于PUT操作，获取上传的内容
          if (c.req.raw.body) {
            content = await c.req.raw.arrayBuffer();
            // 检查文件大小
            if (content.byteLength > this.config.maxFileSize) {
              return { 
                success: false, 
                error: `文件大小超过限制 (${content.byteLength} > ${this.config.maxFileSize})` 
              };
            }
          }
          break;

        case 'MOVE':
        case 'COPY':
          // 获取目标路径
          const destination = c.req.header('Destination');
          if (destination) {
            try {
              const destUrl = new URL(destination);
              targetPath = destUrl.pathname.replace('/webdav', '');
            } catch (error) {
              console.warn(`[WEBDAV_EDIT_DETECTION] 无法解析目标路径: ${destination}`);
            }
          }
          break;
      }

      // 使用编辑隔离服务处理
      return await this.config.isolationService.detectAndCreateEditCopy(
        authUser,
        path,
        operation,
        content,
        targetPath
      );

    } catch (error) {
      console.error(`[WEBDAV_EDIT_DETECTION] 预处理失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 后处理编辑操作
   */
  private async postprocessEditOperation(
    authUser: WebDAVAuthUser,
    path: string,
    operation: 'create' | 'update' | 'delete' | 'move' | 'copy',
    c: Context,
    copyPath?: string
  ): Promise<void> {
    try {
      // 这里可以添加更多的后处理逻辑
      // 比如记录审计日志、触发通知等

      console.log(`[WEBDAV_EDIT_DETECTION] 编辑操作完成: ${operation} ${path}`);

      // 如果有副本路径，记录到上下文供其他中间件使用
      if (copyPath) {
        c.set('editCopyPath', copyPath);
      }

    } catch (error) {
      console.error(`[WEBDAV_EDIT_DETECTION] 后处理失败:`, error);
      // 后处理失败不影响主流程
    }
  }

  /**
   * 创建WebDAV编辑检测中间件实例
   */
  static create(config: Partial<WebDAVEditDetectionConfig> = {}) {
    const middleware = new WebDAVEditDetectionMiddleware(config);
    return middleware.middleware.bind(middleware);
  }
}

/**
 * 创建WebDAV编辑检测中间件的便利函数
 */
export function webDAVEditDetection(config: Partial<WebDAVEditDetectionConfig> = {}) {
  return WebDAVEditDetectionMiddleware.create(config);
}