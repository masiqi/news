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
   * 为用户创建存储目录
   * @param userId 用户ID
   * @returns Promise<boolean> 是否创建成功
   */
  async createUserDirectory(userId: number): Promise<boolean> {
    try {
      // 创建用户根目录标记文件
      const userDirPath = `${userId}/.gitkeep`;
      await this.r2Bucket.put(userDirPath, new Uint8Array());
      
      // 可以在这里创建用户的默认子目录结构
      const defaultDirs = ['sources', 'notes', 'exports'];
      for (const dir of defaultDirs) {
        const dirPath = `${userId}/${dir}/.gitkeep`;
        await this.r2Bucket.put(dirPath, new Uint8Array());
      }
      
      return true;
    } catch (error) {
      console.error(`为用户${userId}创建存储目录失败:`, error);
      return false;
    }
  }

  /**
   * 检查用户目录是否存在
   * @param userId 用户ID
   * @returns Promise<boolean> 目录是否存在
   */
  async userDirectoryExists(userId: number): Promise<boolean> {
    try {
      const userDirPath = `${userId}/.gitkeep`;
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
      // 注意：R2没有直接删除目录的功能，需要列出并删除所有对象
      // 这里只是一个示例实现，实际使用中需要更复杂的逻辑
      
      const prefix = `${userId}/`;
      const list = await this.r2Bucket.list({ prefix });
      
      // 删除所有匹配的对象
      for (const object of list.objects) {
        await this.r2Bucket.delete(object.key);
      }
      
      return true;
    } catch (error) {
      console.error(`删除用户${userId}存储目录失败:`, error);
      return false;
    }
  }
}