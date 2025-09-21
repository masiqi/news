// 自动Markdown存储服务
// 集成LLM处理结果与用户R2存储，实现自动化markdown文件生成和存储

import { R2Service } from './r2.service';
import { UserAutoStorageService, type UserAutoStorageConfig } from './user-auto-storage.service';
import { MarkdownGenerator } from './ai/markdown-generator';
import { ProcessingResult } from './ai/types';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userStorageStats } from '../db/schema';

export interface AutoStorageResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
  processingTime: number;
}

export interface StorageMetadata {
  userId: number;
  sourceId: number;
  entryId: number;
  title: string;
  sourceName?: string;
  processedAt: Date;
}

export class AutoMarkdownStorageService {
  private r2Service: R2Service;
  private storageConfigService: UserAutoStorageService;
  private markdownGenerator: MarkdownGenerator;
  private db: any;

  constructor(env: any) {
    this.r2Service = new R2Service(env);
    this.storageConfigService = new UserAutoStorageService(env.DB);
    this.markdownGenerator = new MarkdownGenerator();
    this.db = drizzle(env.DB);
  }

  /**
   * 主要入口：处理AI分析结果并自动存储到用户R2空间
   */
  async processAndStoreMarkdown(params: {
    userId: number;
    sourceId: number;
    entryId: number;
    analysisResult: ProcessingResult;
    originalContent: string;
    metadata?: StorageMetadata;
  }): Promise<AutoStorageResult> {
    const startTime = Date.now();
    
    try {
      const { userId, sourceId, entryId, analysisResult, originalContent, metadata } = params;
      
      console.log(`开始自动存储处理: 用户${userId}, 条目${entryId}`);
      
      // 1. 检查用户是否启用了自动存储
      const autoStorageEnabled = await this.storageConfigService.isAutoStorageEnabled(userId);
      if (!autoStorageEnabled) {
        console.log(`用户${userId}未启用自动存储，跳过`);
        return {
          success: false,
          error: '用户未启用自动存储',
          processingTime: Date.now() - startTime
        };
      }

      // 2. 检查每日存储配额
      const quotaCheck = await this.storageConfigService.checkDailyQuota(userId);
      if (!quotaCheck.withinLimit) {
        console.log(`用户${userId}已超过每日存储配额，跳过`);
        return {
          success: false,
          error: `已超过每日存储配额 (${quotaCheck.usedCount}文件)`,
          processingTime: Date.now() - startTime
        };
      }

      // 3. 获取用户存储配置
      const userConfig = await this.storageConfigService.getUserConfig(userId);
      
      // 4. 生成markdown内容
      const markdownContent = await this.generateMarkdownForUser(
        analysisResult,
        originalContent,
        userConfig
      );

      // 5. 验证文件大小
      const fileSize = new Blob([markdownContent]).size;
      if (!this.storageConfigService.validateFileSize(fileSize, userConfig)) {
        return {
          success: false,
          error: `文件大小超过限制 (${fileSize} > ${userConfig.maxFileSize})`,
          processingTime: Date.now() - startTime
        };
      }

      // 6. 确保用户目录存在
      const userDirExists = await this.r2Service.userDirectoryExists(userId);
      if (!userDirExists) {
        const dirCreated = await this.r2Service.createUserDirectory(userId);
        if (!dirCreated) {
          return {
            success: false,
            error: '创建用户存储目录失败',
            processingTime: Date.now() - startTime
          };
        }
      }

      // 7. 生成文件名
      const fileName = this.storageConfigService.generateFileName(
        userConfig.filenamePattern,
        {
          title: analysisResult.title,
          id: entryId,
          sourceName: metadata?.sourceName,
          date: new Date()
        }
      );

      // 8. 上传到R2
      const filePath = await this.r2Service.uploadUserFile(
        userId,
        fileName,
        markdownContent,
        userConfig.storagePath
      );

      // 9. 记录存储日志
      await this.logStorage({
        userId,
        sourceId,
        entryId,
        filePath,
        fileSize,
        status: 'success'
      });

      // 10. 更新统计信息
      await this.updateStorageStats(userId, fileSize);

      const processingTime = Date.now() - startTime;
      
      console.log(`[SUCCESS] 自动存储完成: 用户${userId}, 文件:${filePath}, 大小:${fileSize}字节, 耗时:${processingTime}ms`);
      
      return {
        success: true,
        filePath,
        fileSize,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      console.error('自动存储失败:', error);
      
      // 记录失败日志
      if (params.userId && params.entryId) {
        await this.logStorage({
          userId: params.userId,
          sourceId: params.sourceId,
          entryId: params.entryId,
          filePath: '',
          fileSize: 0,
          status: 'failed',
          error: errorMessage
        });
      }
      
      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * 根据用户配置生成定制化的markdown内容
   */
  private async generateMarkdownForUser(
    analysisResult: ProcessingResult,
    originalContent: string,
    userConfig: UserAutoStorageConfig
  ): Promise<string> {
    try {
      // 根据用户选择的格式生成markdown
      switch (userConfig.fileFormat) {
        case 'academic':
          return this.markdownGenerator.generateAcademicMarkdown(analysisResult);
          
        case 'concise':
          return this.markdownGenerator.generateConciseMarkdown(analysisResult);
          
        case 'standard':
        default:
          if (userConfig.includeMetadata) {
            return await this.markdownGenerator.generateDocument({
              result: analysisResult,
              config: {
                userId: userConfig.userId,
                language: 'zh-CN',
                style: 'standard',
                maxTokens: 2000,
                includeAnalysis: true,
                templateId: undefined
              }
            });
          } else {
            return this.markdownGenerator.generateSimpleMarkdown(analysisResult);
          }
      }
    } catch (error) {
      console.error('生成用户定制markdown失败:', error);
      // 降级到简单markdown
      return this.markdownGenerator.generateSimpleMarkdown(analysisResult);
    }
  }

  /**
   * 记录存储日志
   */
  private async logStorage(params: {
    userId: number;
    sourceId: number;
    entryId: number;
    filePath: string;
    fileSize: number;
    status: 'success' | 'failed';
    error?: string;
  }): Promise<void> {
    try {
      await this.storageConfigService.logStorage({
        ...params,
        processingTime: Date.now() - (this as any).processingStartTime || 0
      });
    } catch (error) {
      console.error('记录存储日志失败:', error);
    }
  }

  /**
   * 更新用户存储统计
   */
  private async updateStorageStats(userId: number, fileSize: number): Promise<void> {
    try {
      await this.storageConfigService.updateStorageStats(userId, fileSize);
    } catch (error) {
      console.error('更新存储统计失败:', error);
    }
  }

  /**
   * 批量处理多个条目
   */
  async batchProcessAndStore(items: Array<{
    userId: number;
    sourceId: number;
    entryId: number;
    analysisResult: ProcessingResult;
    originalContent: string;
    metadata?: StorageMetadata;
  }>): Promise<AutoStorageResult[]> {
    console.log(`开始批量自动存储处理: ${items.length}个条目`);
    
    // 限制并发数量，避免过载
    const batchSize = 5;
    const results: AutoStorageResult[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => 
        this.processAndStoreMarkdown(item).catch(error => ({
          success: false,
          error: error instanceof Error ? error.message : '批量处理失败',
          processingTime: 0
        }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          success: false,
          error: '处理失败',
          processingTime: 0
        }
      ));
      
      // 批次间延迟，避免速率限制
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`批量处理完成: 成功${successCount}个, 失败${failureCount}个`);
    
    return results;
  }

  /**
   * 重新生成特定条目的markdown文件
   */
  async regenerateMarkdown(params: {
    userId: number;
    entryId: number;
    force?: boolean;
  }): Promise<AutoStorageResult> {
    try {
      const { userId, entryId, force = false } = params;
      
      console.log(`重新生成markdown: 用户${userId}, 条目${entryId}`);
      
      // TODO: 实现重新生成逻辑
      // 1. 从数据库获取原始内容和分析结果
      // 2. 调用processAndStoreMarkdown进行处理
      
      return {
        success: false,
        error: '重新生成功能待实现',
        processingTime: 0
      };
    } catch (error) {
      console.error('重新生成markdown失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '重新生成失败',
        processingTime: 0
      };
    }
  }

  /**
   * 获取用户存储的markdown文件列表
   */
  async getUserMarkdownFiles(userId: number): Promise<Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    createdAt: string;
    fileUrl?: string;
    title?: string;
    entryId?: number;
  }>> {
    try {
      const userConfig = await this.storageConfigService.getUserConfig(userId);
      const storagePath = (userConfig.storagePath || '').trim();
      const normalizedPath = storagePath.replace(/^\/+|\/+$/g, '');

      const markdownPattern = /\.(md|markdown|mdx)$/i;
      console.log(`[AUTO_STORAGE] 用户${userId}配置的存储路径: ${normalizedPath || '(root)'}`);
      const results: Array<{
        fileName: string;
        filePath: string;
        fileSize: number;
        createdAt: string;
        fileUrl?: string;
        title?: string;
        entryId?: number;
      }> = [];
      const seenPaths = new Set<string>();

      const collectFiles = async (subPath?: string) => {
        const list = await this.r2Service.listUserFiles(userId, subPath || undefined);
        console.log(`[AUTO_STORAGE] 路径${subPath || '(root)'} 扫描到 ${list.length} 项`);
        for (const file of list) {
          const relativePath = file.key.replace(`user-${userId}/`, '');
          if (!markdownPattern.test(relativePath)) {
            continue;
          }
          if (seenPaths.has(relativePath)) {
            continue;
          }
          seenPaths.add(relativePath);

          const fileName = relativePath.split('/').pop() || relativePath;
          const encodedPath = encodeURIComponent(relativePath);

          results.push({
            fileName,
            filePath: relativePath,
            fileSize: file.size,
            createdAt: file.lastModified.toISOString(),
            fileUrl: `/api/user/auto-storage/download?path=${encodedPath}`
          });
        }
      };

      if (normalizedPath) {
        await collectFiles(normalizedPath);
      }

      // 兼容历史数据：尝试扫描用户根目录
      await collectFiles();

      // 按时间倒序返回，最新的文件排在前面
      const sorted = results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log(`[AUTO_STORAGE] 用户${userId} 最终可见Markdown文件数量: ${sorted.length}`);
      if (sorted.length > 0) {
        console.log(`[AUTO_STORAGE] 示例文件: ${sorted[0].filePath}`);
      }
      return sorted;
    } catch (error) {
      console.error(`获取用户${userId}的markdown文件失败:`, error);
      return [];
    }
  }

  /**
   * 下载用户的markdown文件
   */
  async downloadUserMarkdownFile(userId: number, fileName: string): Promise<{
    success: boolean;
    content?: string | ArrayBuffer;
    fileSize?: number;
    error?: string;
  }> {
    try {
      console.log(`下载用户${userId}的markdown文件: ${fileName}`);
      
      // 验证文件名安全性
      if (!fileName || !fileName.endsWith('.md') || fileName.includes('../') || fileName.includes('..\\')) {
        return {
          success: false,
          error: '无效的文件名'
        };
      }

      const userConfig = await this.storageConfigService.getUserConfig(userId);
      const storagePath = (userConfig.storagePath || '').trim().replace(/^\/+|\/+$/g, '');
      const relativePath = storagePath ? `${storagePath}/${fileName}` : fileName;

      let result = await this.downloadUserMarkdownFileByPath(userId, relativePath);

      if (!result.success && storagePath) {
        // 回退到根目录以兼容历史存储结构
        result = await this.downloadUserMarkdownFileByPath(userId, fileName);
      }

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        content: result.content,
        fileSize: result.fileSize
      };
      
    } catch (error) {
      console.error(`下载用户${userId}的markdown文件失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载文件失败'
      };
    }
  }

  async downloadUserMarkdownFileByPath(userId: number, relativePath: string): Promise<{
    success: boolean;
    content?: string | ArrayBuffer;
    fileSize?: number;
    error?: string;
  }> {
    try {
      if (!relativePath) {
        return { success: false, error: '未提供文件路径' };
      }

      if (relativePath.includes('..')) {
        return { success: false, error: '无效的文件路径' };
      }

      const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
      const segments = normalized.split('/').filter(Boolean);
      const fileName = segments.pop();

      if (!fileName || !/\.(md|markdown|mdx)$/i.test(fileName)) {
        return { success: false, error: '不支持的文件类型' };
      }

      const subPath = segments.join('/');
      const result = await this.r2Service.downloadUserFile(userId, fileName, subPath || undefined);

      return {
        success: true,
        content: result.content,
        fileSize: result.metadata.size
      };
    } catch (error) {
      console.error(`按路径下载用户${userId}的markdown文件失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载文件失败'
      };
    }
  }

  /**
   * 删除用户的markdown文件
   */
  async deleteUserMarkdownFile(userId: number, fileName: string): Promise<boolean> {
    try {
      // 从文件名提取路径信息
      const userConfig = await this.storageConfigService.getUserConfig(userId);
      
      const success = await this.r2Service.deleteUserFile(
        userId,
        fileName,
        userConfig.storagePath
      );
      
      if (success) {
        console.log(`删除用户${userId}的markdown文件: ${fileName}`);
      }
      
      return success;
    } catch (error) {
      console.error(`删除用户${userId}的markdown文件失败:`, error);
      return false;
    }
  }

  /**
   * 获取用户存储统计信息
   */
  async getUserStorageStats(userId: number): Promise<{
    totalFiles: number;
    totalSize: number;
    todayFiles: number;
    todaySize: number;
    lastStorageAt?: Date;
  }> {
    try {
      const stats = await this.db
        .select()
        .from(userStorageStats)
        .where(eq(userStorageStats.userId, userId))
        .get();

      if (stats) {
        return {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          todayFiles: stats.todayFiles,
          todaySize: stats.todaySize,
          lastStorageAt: stats.lastStorageAt ? new Date(stats.lastStorageAt) : undefined
        };
      }

      return {
        totalFiles: 0,
        totalSize: 0,
        todayFiles: 0,
        todaySize: 0
      };
    } catch (error) {
      console.error(`获取用户${userId}存储统计失败:`, error);
      return {
        totalFiles: 0,
        totalSize: 0,
        todayFiles: 0,
        todaySize: 0
      };
    }
  }
}
