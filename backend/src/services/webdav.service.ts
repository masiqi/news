// webdav.service.ts
// WebDAV核心服务，处理文件存储操作

import { R2Service } from './r2.service';
import type { WebDAVAuthUser } from '../middleware/webdav-auth.middleware';

export interface WebDAVFileItem {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  contentType?: string;
  etag?: string;
}

export interface WebDAVListResult {
  items: WebDAVFileItem[];
  isTruncated: boolean;
  cursor?: string;
}

export class WebDAVService {
  private r2Service: R2Service;

  constructor(env: any) {
    this.r2Service = new R2Service(env);
  }

  /**
   * 列出目录内容
   */
  async listDirectory(authUser: WebDAVAuthUser, path: string, cursor?: string): Promise<WebDAVListResult> {
    console.log(`[WEBDAV_SERVICE] 列出目录: 用户${authUser.id}, 路径: ${path}`);
    
    const r2Key = this.pathToR2Key(authUser, path);
    const delimiter = '/';
    
    try {
      // 列出R2对象
      const result = await this.r2Service.listObjects({
        prefix: r2Key,
        delimiter,
        cursor,
        limit: 1000
      });

      const items: WebDAVFileItem[] = [];

      // 处理文件
      if (result.objects) {
        for (const obj of result.objects) {
          const itemPath = this.r2KeyToPath(authUser, obj.key);
          
          // 跳过目录标记文件 (.gitkeep)
          if (obj.key.endsWith('/.gitkeep')) {
            continue;
          }
          
          items.push({
            name: this.getItemName(obj.key, authUser.userPathPrefix),
            path: itemPath,
            size: obj.size,
            lastModified: obj.uploaded,
            isDirectory: false,
            contentType: obj.httpMetadata?.contentType,
            etag: obj.etag
          });
        }
      }

      // 处理子目录
      if (result.delimitedPrefixes) {
        for (const prefix of result.delimitedPrefixes) {
          const dirPath = this.r2KeyToPath(authUser, prefix.replace(/\/$/, ''));
          items.push({
            name: this.getItemName(prefix.replace(/\/$/, ''), authUser.userPathPrefix),
            path: dirPath,
            size: 0,
            lastModified: new Date(),
            isDirectory: true
          });
        }
      }

      console.log(`[WEBDAV_SERVICE] 列出目录完成，找到${items.length}个项目`);
      
      return {
        items,
        isTruncated: result.truncated || false,
        cursor: result.cursor
      };

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 列出目录失败:`, error);
      throw new Error(`Failed to list directory: ${error}`);
    }
  }

  /**
   * 获取文件内容
   */
  async getFile(authUser: WebDAVAuthUser, path: string): Promise<{ content: ArrayBuffer; metadata: WebDAVFileItem }> {
    console.log(`[WEBDAV_SERVICE] 获取文件: 用户${authUser.id}, 路径: ${path}`);
    
    const r2Key = this.pathToR2Key(authUser, path);
    
    try {
      const result = await this.r2Service.getObject(r2Key);
      
      if (!result) {
        throw new Error('File not found');
      }

      const metadata: WebDAVFileItem = {
        name: this.getItemName(r2Key, authUser.userPathPrefix),
        path: this.r2KeyToPath(authUser, r2Key),
        size: result.size,
        lastModified: result.uploaded,
        isDirectory: false,
        contentType: result.httpMetadata?.contentType,
        etag: result.etag
      };

      console.log(`[WEBDAV_SERVICE] 获取文件成功，大小: ${result.size}字节`);
      
      return {
        content: result.arrayBuffer(),
        metadata
      };

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 获取文件失败:`, error);
      throw new Error(`Failed to get file: ${error}`);
    }
  }

  /**
   * 上传文件
   */
  async putFile(authUser: WebDAVAuthUser, path: string, content: ArrayBuffer, contentType?: string): Promise<WebDAVFileItem> {
    console.log(`[WEBDAV_SERVICE] 上传文件: 用户${authUser.id}, 路径: ${path}, 大小: ${content.byteLength}字节`);
    
    const r2Key = this.pathToR2Key(authUser, path);
    
    try {
      // 确保父目录存在
      await this.ensureParentDirectory(authUser, path);
      
      const result = await this.r2Service.putObject(r2Key, content, {
        httpMetadata: contentType ? { contentType } : undefined
      });

      const metadata: WebDAVFileItem = {
        name: this.getItemName(r2Key, authUser.userPathPrefix),
        path: this.r2KeyToPath(authUser, r2Key),
        size: content.byteLength,
        lastModified: result.uploaded,
        isDirectory: false,
        contentType,
        etag: result.etag
      };

      console.log(`[WEBDAV_SERVICE] 上传文件成功: ${r2Key}`);
      
      return metadata;

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 上传文件失败:`, error);
      throw new Error(`Failed to put file: ${error}`);
    }
  }

  /**
   * 删除文件或目录
   */
  async delete(authUser: WebDAVAuthUser, path: string): Promise<void> {
    console.log(`[WEBDAV_SERVICE] 删除: 用户${authUser.id}, 路径: ${path}`);
    
    const r2Key = this.pathToR2Key(authUser, path);
    
    try {
      // 检查是否为目录
      const isDirectory = await this.isDirectory(authUser, path);
      
      if (isDirectory) {
        // 递归删除目录内容
        await this.deleteDirectoryRecursive(authUser, path);
      } else {
        // 删除单个文件
        await this.r2Service.deleteObject(r2Key);
      }

      console.log(`[WEBDAV_SERVICE] 删除成功: ${r2Key}`);

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 删除失败:`, error);
      throw new Error(`Failed to delete: ${error}`);
    }
  }

  /**
   * 创建目录
   */
  async createDirectory(authUser: WebDAVAuthUser, path: string): Promise<void> {
    console.log(`[WEBDAV_SERVICE] 创建目录: 用户${authUser.id}, 路径: ${path}`);
    
    const r2Key = this.pathToR2Key(authUser, path);
    
    try {
      // 确保路径以斜杠结尾
      const directoryKey = r2Key.endsWith('/') ? r2Key : `${r2Key}/`;
      const markerKey = `${directoryKey}.gitkeep`;
      
      // 创建目录标记文件
      await this.r2Service.putObject(markerKey, new ArrayBuffer(0));
      
      console.log(`[WEBDAV_SERVICE] 创建目录成功: ${directoryKey}`);

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 创建目录失败:`, error);
      throw new Error(`Failed to create directory: ${error}`);
    }
  }

  /**
   * 检查路径是否存在
   */
  async exists(authUser: WebDAVAuthUser, path: string): Promise<boolean> {
    const r2Key = this.pathToR2Key(authUser, path);
    
    try {
      const isDir = await this.isDirectory(authUser, path);
      if (isDir) return true;
      
      const result = await this.r2Service.headObject(r2Key);
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为目录
   */
  async isDirectory(authUser: WebDAVAuthUser, path: string): Promise<boolean> {
    const r2Key = this.pathToR2Key(authUser, path);
    const directoryKey = r2Key.endsWith('/') ? r2Key : `${r2Key}/`;
    const markerKey = `${directoryKey}.gitkeep`;
    
    try {
      const result = await this.r2Service.headObject(markerKey);
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * 移动文件或目录
   */
  async move(authUser: WebDAVAuthUser, sourcePath: string, destinationPath: string): Promise<void> {
    console.log(`[WEBDAV_SERVICE] 移动: 用户${authUser.id}, 源路径: ${sourcePath}, 目标路径: ${destinationPath}`);
    
    try {
      // 检查源是否存在
      const sourceExists = await this.exists(authUser, sourcePath);
      if (!sourceExists) {
        throw new Error('Source not found');
      }

      // 检查目标是否已存在
      const destinationExists = await this.exists(authUser, destinationPath);
      if (destinationExists) {
        throw new Error('Destination already exists');
      }

      // 复制到目标
      await this.copy(authUser, sourcePath, destinationPath);
      
      // 删除源
      await this.delete(authUser, sourcePath);

      console.log(`[WEBDAV_SERVICE] 移动成功`);

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 移动失败:`, error);
      throw new Error(`Failed to move: ${error}`);
    }
  }

  /**
   * 复制文件或目录
   */
  async copy(authUser: WebDAVAuthUser, sourcePath: string, destinationPath: string): Promise<void> {
    console.log(`[WEBDAV_SERVICE] 复制: 用户${authUser.id}, 源路径: ${sourcePath}, 目标路径: ${destinationPath}`);
    
    try {
      const isDirectory = await this.isDirectory(authUser, sourcePath);
      
      if (isDirectory) {
        await this.copyDirectoryRecursive(authUser, sourcePath, destinationPath);
      } else {
        await this.copyFile(authUser, sourcePath, destinationPath);
      }

      console.log(`[WEBDAV_SERVICE] 复制成功`);

    } catch (error) {
      console.error(`[WEBDAV_SERVICE] 复制失败:`, error);
      throw new Error(`Failed to copy: ${error}`);
    }
  }

  // 私有辅助方法

  private pathToR2Key(authUser: WebDAVAuthUser, path: string): string {
    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
    
    // 安全验证：确保路径不包含可疑字符
    if (normalizedPath.includes('..') || normalizedPath.includes('//') || /[^a-zA-Z0-9-_\.\/~]/.test(normalizedPath)) {
      throw new Error(`Invalid path: ${path}`);
    }
    
    if (!normalizedPath) {
      return authUser.userPathPrefix;
    }
    
    // 确保路径以用户前缀开头，防止路径遍历攻击
    if (normalizedPath.startsWith(authUser.userPathPrefix)) {
      return normalizedPath;
    }
    
    return `${authUser.userPathPrefix}${normalizedPath}`;
  }

  private r2KeyToPath(authUser: WebDAVAuthUser, r2Key: string): string {
    const userPath = r2Key.substring(authUser.userPathPrefix.length);
    
    if (!userPath) {
      return '/';
    }
    
    return `/${userPath}`;
  }

  private getItemName(r2Key: string, userPrefix: string): string {
    const relativePath = r2Key.substring(userPrefix.length);
    const parts = relativePath.split('/').filter(part => part.length > 0);
    return parts[parts.length - 1] || '';
  }

  private async ensureParentDirectory(authUser: WebDAVAuthUser, path: string): Promise<void> {
    const pathParts = path.split('/').filter(part => part.length > 0);
    if (pathParts.length <= 1) return; // 已经在根目录

    const parentPath = `/${pathParts.slice(0, -1).join('/')}`;
    
    if (!(await this.exists(authUser, parentPath))) {
      await this.createDirectory(authUser, parentPath);
    }
  }

  private async deleteDirectoryRecursive(authUser: WebDAVAuthUser, path: string): Promise<void> {
    const r2Key = this.pathToR2Key(authUser, path);
    const directoryKey = r2Key.endsWith('/') ? r2Key : `${r2Key}/`;
    
    // 列出目录内容
    const result = await this.r2Service.listObjects({
      prefix: directoryKey,
      limit: 1000
    });

    // 递归删除所有文件
    if (result.objects) {
      for (const obj of result.objects) {
        await this.r2Service.deleteObject(obj.key);
      }
    }

    // 删除目录标记
    const markerKey = `${directoryKey}.gitkeep`;
    try {
      await this.r2Service.deleteObject(markerKey);
    } catch {
      // 标记文件可能不存在
    }
  }

  private async copyFile(authUser: WebDAVAuthUser, sourcePath: string, destinationPath: string): Promise<void> {
    const { content } = await this.getFile(authUser, sourcePath);
    await this.putFile(authUser, destinationPath, content);
  }

  private async copyDirectoryRecursive(authUser: WebDAVAuthUser, sourcePath: string, destinationPath: string): Promise<void> {
    // 创建目标目录
    await this.createDirectory(authUser, destinationPath);
    
    // 列出源目录内容
    const listResult = await this.listDirectory(authUser, sourcePath);
    
    // 复制所有项目
    for (const item of listResult.items) {
      const sourceItemPath = item.path;
      const relativePath = sourceItemPath.substring(sourcePath.length);
      const destinationItemPath = `${destinationPath}${relativePath}`;
      
      if (item.isDirectory) {
        await this.copyDirectoryRecursive(authUser, sourceItemPath, destinationItemPath);
      } else {
        await this.copyFile(authUser, sourceItemPath, destinationItemPath);
      }
    }
  }
}