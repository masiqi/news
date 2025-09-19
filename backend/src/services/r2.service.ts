// r2.service.ts
// R2存储服务，用于管理用户文件存储

export class R2Service {
  private readonly r2Bucket: R2Bucket;
  private readonly env: CloudflareBindings;

  constructor(env: CloudflareBindings) {
    this.env = env;
    this.r2Bucket = env.R2_BUCKET;
  }

  /**
   * 为用户创建存储目录（支持新的路径前缀格式）
   * @param userId 用户ID
   * @returns Promise<boolean> 是否创建成功
   */
  async createUserDirectory(userId: number): Promise<boolean> {
    try {
      // 使用新的路径前缀格式：user-{userId}/
      const userDirPath = `user-${userId}/.gitkeep`;
      await this.r2Bucket.put(userDirPath, new Uint8Array());
      
      // 创建用户的默认news目录
      const newsDirPath = `user-${userId}/news/.gitkeep`;
      await this.r2Bucket.put(newsDirPath, new Uint8Array());
      
      console.log(`[SUCCESS] 用户${userId}的R2存储目录创建成功，路径：user-${userId}/`);
      return true;
    } catch (error) {
      console.error(`为用户${userId}创建存储目录失败:`, error);
      return false;
    }
  }

  /**
   * 检查用户目录是否存在（支持新的路径前缀格式）
   * @param userId 用户ID
   * @returns Promise<boolean> 目录是否存在
   */
  async userDirectoryExists(userId: number): Promise<boolean> {
    try {
      const userDirPath = `user-${userId}/.gitkeep`;
      const object = await this.r2Bucket.get(userDirPath);
      return object !== null;
    } catch (error) {
      console.error(`检查用户${userId}目录存在性失败:`, error);
      return false;
    }
  }

  /**
   * 删除用户存储目录（谨慎使用）
   * @param userId 用户ID
   * @returns Promise<boolean> 是否删除成功
   */
  async deleteUserDirectory(userId: number): Promise<boolean> {
    try {
      // 使用新的路径前缀格式进行删除
      const prefix = `user-${userId}/`;
      const list = await this.r2Bucket.list({ prefix });
      
      // 删除所有匹配的对象
      let deletedCount = 0;
      for (const object of list.objects) {
        await this.r2Bucket.delete(object.key);
        deletedCount++;
      }
      
      console.log(`[SUCCESS] 用户${userId}的R2存储目录删除成功，共删除${deletedCount}个文件`);
      return true;
    } catch (error) {
      console.error(`删除用户${userId}存储目录失败:`, error);
      return false;
    }
  }

  /**
   * 获取用户的存储使用情况
   * @param userId 用户ID
   * @returns Promise<{totalSize: number, fileCount: number}> 存储使用情况
   */
  async getUserStorageUsage(userId: number): Promise<{totalSize: number, fileCount: number}> {
    try {
      const prefix = `user-${userId}/`;
      const list = await this.r2Bucket.list({ prefix });
      
      let totalSize = 0;
      let fileCount = 0;
      
      for (const object of list.objects) {
        totalSize += object.size || 0;
        fileCount++;
      }
      
      return { totalSize, fileCount };
    } catch (error) {
      console.error(`获取用户${userId}存储使用情况失败:`, error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  /**
   * 验证用户是否有权限访问指定路径
   * @param userId 用户ID
   * @param resourcePath 资源路径
   * @returns Promise<boolean> 是否有权限
   */
  async validateUserAccess(userId: number, resourcePath: string): Promise<boolean> {
    try {
      // 检查路径是否属于用户
      const expectedPrefix = `user-${userId}/`;
      if (!resourcePath.startsWith(expectedPrefix)) {
        return false;
      }
      
      // 检查用户目录是否存在
      return await this.userDirectoryExists(userId);
    } catch (error) {
      console.error(`验证用户${userId}访问权限失败:`, error);
      return false;
    }
  }

  /**
   * 上传文件到用户的存储空间
   * @param userId 用户ID
   * @param fileName 文件名
   * @param content 文件内容
   * @param subPath 子路径（可选）
   * @returns Promise<string> 文件路径
   */
  async uploadUserFile(userId: number, fileName: string, content: string | ArrayBuffer, subPath?: string): Promise<string> {
    try {
      // 构建文件路径
      let filePath = `user-${userId}/`;
      if (subPath) {
        // 清理子路径，防止路径遍历
        const cleanSubPath = subPath.replace(/[^a-zA-Z0-9-_]/g, '').replace(/\.\./g, '');
        if (cleanSubPath) {
          filePath += cleanSubPath + '/';
        }
      }
      filePath += fileName;
      
      // 上传文件
      if (typeof content === 'string') {
        await this.r2Bucket.put(filePath, content);
      } else {
        await this.r2Bucket.put(filePath, content);
      }
      
      console.log(`[SUCCESS] 文件上传成功：${filePath}`);
      return filePath;
    } catch (error) {
      console.error(`上传文件到用户${userId}存储空间失败:`, error);
      throw error;
    }
  }

  /**
   * 获取用户的文件列表
   * @param userId 用户ID
   * @param subPath 子路径（可选）
   * @returns Promise<Array<{key: string, size: number, lastModified: Date}>> 文件列表
   */
  async listUserFiles(userId: number, subPath?: string): Promise<Array<{key: string, size: number, lastModified: Date}>> {
    try {
      let prefix = `user-${userId}/`;
      if (subPath) {
        const cleanSubPath = subPath.replace(/[^a-zA-Z0-9-_]/g, '').replace(/\.\./g, '');
        if (cleanSubPath) {
          prefix += cleanSubPath + '/';
        }
      }
      
      const list = await this.r2Bucket.list({ prefix });
      
      return list.objects.map(obj => ({
        key: obj.key,
        size: obj.size || 0,
        lastModified: new Date(obj.uploaded || Date.now())
      }));
    } catch (error) {
      console.error(`获取用户${userId}文件列表失败:`, error);
      return [];
    }
  }

  /**
   * 下载用户的文件
   * @param userId 用户ID
   * @param fileName 文件名
   * @param subPath 子路径（可选）
   * @returns Promise<{content: string | ArrayBuffer, metadata: any}> 文件内容和元数据
   */
  async downloadUserFile(userId: number, fileName: string, subPath?: string): Promise<{content: string | ArrayBuffer, metadata: any}> {
    try {
      // 构建文件路径
      let filePath = `user-${userId}/`;
      if (subPath) {
        const cleanSubPath = subPath.replace(/[^a-zA-Z0-9-_]/g, '').replace(/\.\./g, '');
        if (cleanSubPath) {
          filePath += cleanSubPath + '/';
        }
      }
      filePath += fileName;
      
      // 验证访问权限
      const hasAccess = await this.validateUserAccess(userId, filePath);
      if (!hasAccess) {
        throw new Error(`用户${userId}没有权限访问文件：${filePath}`);
      }
      
      // 获取文件
      const object = await this.r2Bucket.get(filePath);
      if (!object) {
        throw new Error(`文件不存在：${filePath}`);
      }
      
      const content = await object.text();
      
      return {
        content,
        metadata: {
          key: object.key,
          size: object.size,
          etag: object.etag,
          lastModified: object.uploaded
        }
      };
    } catch (error) {
      console.error(`下载用户${userId}文件失败:`, error);
      throw error;
    }
  }

  /**
   * 删除用户的文件
   * @param userId 用户ID
   * @param fileName 文件名
   * @param subPath 子路径（可选）
   * @returns Promise<boolean> 是否删除成功
   */
  async deleteUserFile(userId: number, fileName: string, subPath?: string): Promise<boolean> {
    try {
      // 构建文件路径
      let filePath = `user-${userId}/`;
      if (subPath) {
        const cleanSubPath = subPath.replace(/[^a-zA-Z0-9-_]/g, '').replace(/\.\./g, '');
        if (cleanSubPath) {
          filePath += cleanSubPath + '/';
        }
      }
      filePath += fileName;
      
      // 验证访问权限
      const hasAccess = await this.validateUserAccess(userId, filePath);
      if (!hasAccess) {
        throw new Error(`用户${userId}没有权限删除文件：${filePath}`);
      }
      
      // 删除文件
      await this.r2Bucket.delete(filePath);
      console.log(`[SUCCESS] 文件删除成功：${filePath}`);
      return true;
    } catch (error) {
      console.error(`删除用户${userId}文件失败:`, error);
      return false;
    }
  }

  /**
   * WebDAV: 列出对象（支持分页和前缀过滤）
   * @param options 列表选项
   * @returns Promise<{objects: R2Object[], truncated: boolean, cursor?: string, delimitedPrefixes?: string[]}> 列表结果
   */
  async listObjects(options: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<{
    objects: any[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes?: string[];
  }> {
    try {
      const result = await this.r2Bucket.list(options);
      return {
        objects: result.objects || [],
        truncated: result.truncated || false,
        cursor: result.cursor,
        delimitedPrefixes: result.delimitedPrefixes || []
      };
    } catch (error) {
      console.error('R2列出对象失败:', error);
      throw error;
    }
  }

  /**
   * WebDAV: 获取对象信息
   * @param key 对象键
   * @returns Promise<any | null> 对象信息
   */
  async headObject(key: string): Promise<any | null> {
    try {
      const object = await this.r2Bucket.head(key);
      return object;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error as any).status === 404) {
        return null;
      }
      console.error(`R2获取对象信息失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * WebDAV: 获取对象内容
   * @param key 对象键
   * @returns Promise<any | null> 对象内容
   */
  async getObject(key: string): Promise<any | null> {
    try {
      const object = await this.r2Bucket.get(key);
      return object;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error as any).status === 404) {
        return null;
      }
      console.error(`R2获取对象失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * WebDAV: 上传对象
   * @param key 对象键
   * @param content 内容
   * @param options 上传选项
   * @returns Promise<{key: string, uploaded: Date, etag: string, version: string}> 上传结果
   */
  async putObject(key: string, content: string | ArrayBuffer | ReadableStream, options?: {
    httpMetadata?: Record<string, string>;
    customMetadata?: Record<string, string>;
    md5?: string;
  }): Promise<{
    key: string;
    uploaded: Date;
    etag: string;
    version: string;
  }> {
    try {
      const result = await this.r2Bucket.put(key, content, options);
      return {
        key: result.key,
        uploaded: result.uploaded,
        etag: result.etag,
        version: result.version
      };
    } catch (error) {
      console.error(`R2上传对象失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * WebDAV: 删除对象
   * @param key 对象键
   * @returns Promise<void>
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.r2Bucket.delete(key);
    } catch (error) {
      console.error(`R2删除对象失败: ${key}`, error);
      throw error;
    }
  }
}