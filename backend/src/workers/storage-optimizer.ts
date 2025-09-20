// 存储优化Worker - 定期执行存储优化任务
// 在后台自动执行存储清理、压缩、生命周期管理等优化操作

import { drizzle } from 'drizzle-orm/d1';
import { StorageOptimizationService } from '../services/storage-optimization.service';

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  // 其他环境变量
}

// 默认优化配置
const DEFAULT_OPTIMIZATION_CONFIG = {
  // 执行调度
  schedule: '0 2 * * *', // 每天凌晨2点执行
  
  // 优化配置
  minReferenceCount: 0,
  maxUnusedDays: 30,
  enableCompression: true,
  compressionThreshold: 1024 * 1024, // 1MB
  enableLifecycle: true,
  defaultTTL: 90,
  tieredStorage: true,
  enableQuota: true,
  defaultUserQuota: 1024 * 1024 * 1024, // 1GB
  quotaEnforcement: true,
  
  // 执行控制
  maxExecutionTime: 30 * 60 * 1000, // 30分钟最大执行时间
  enableDryRun: false, // 试运行模式
  notifyOnCompletion: true
};

export default {
  /**
   * HTTP请求处理 - 用于手动触发优化
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 健康检查端点
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 手动触发优化
      if (path === '/optimize' && request.method === 'POST') {
        const body = await request.json();
        const { type = 'full', config = {} } = body;

        const optimizationService = new StorageOptimizationService(env.DB, env, {
          ...DEFAULT_OPTIMIZATION_CONFIG,
          ...config
        });

        const result = await optimizationService.runFullOptimization();

        return new Response(JSON.stringify({
          success: result.success,
          message: result.success ? '存储优化完成' : '存储优化失败',
          data: result
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 500
        });
      }

      // 获取优化状态
      if (path === '/status') {
        const optimizationService = new StorageOptimizationService(env.DB, env, DEFAULT_OPTIMIZATION_CONFIG);
        const stats = await optimizationService.getStorageOptimizationStats();

        return new Response(JSON.stringify({
          status: 'operational',
          lastOptimization: null, // 可以从数据库获取
          stats: stats
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] HTTP请求处理失败:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        details: error.message
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  },

  /**
   * 定时任务处理 - 按计划执行存储优化
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[STORAGE_OPTIMIZATION_WORKER] 开始定时存储优化任务: ${event.cron}`);

    try {
      const startTime = Date.now();
      const optimizationService = new StorageOptimizationService(env.DB, env, DEFAULT_OPTIMIZATION_CONFIG);

      // 检查是否有正在执行的优化任务
      const isOptimizationRunning = await this.checkOptimizationStatus(env.DB);
      if (isOptimizationRunning) {
        console.warn('[STORAGE_OPTIMIZATION_WORKER] 优化任务已在运行中，跳过本次执行');
        return;
      }

      // 标记优化开始
      await this.markOptimizationStart(env.DB);

      // 执行优化前健康检查
      const healthCheck = await this.performHealthCheck(env.DB);
      if (!healthCheck.healthy) {
        console.error('[STORAGE_OPTIMIZATION_WORKER] 系统健康检查失败，跳过优化:', healthCheck.issues);
        await this.markOptimizationEnd(env.DB, 'failed', healthCheck.issues.join(', '));
        return;
      }

      console.log('[STORAGE_OPTIMIZATION_WORKER] 系统健康检查通过，开始执行优化');

      // 执行完整优化
      const result = await optimizationService.runFullOptimization();

      // 记录优化结果
      await this.recordOptimizationResult(env.DB, {
        startTime: new Date(startTime),
        endTime: new Date(),
        type: 'scheduled',
        success: result.success,
        totalSaved: result.totalSaved,
        duration: result.duration,
        results: result.results,
        stats: result.stats
      });

      // 发送通知（如果配置了）
      if (DEFAULT_OPTIMIZATION_CONFIG.notifyOnCompletion) {
        await this.sendOptimizationNotification(env, result);
      }

      // 标记优化结束
      await this.markOptimizationEnd(env.DB, result.success ? 'completed' : 'failed', 
        result.success ? '优化完成' : '优化失败');

      console.log(`[STORAGE_OPTIMIZATION_WORKER] 定时优化任务完成，耗时: ${result.duration}ms，节省空间: ${result.totalSaved}字节`);

    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 定时优化任务失败:', error);
      
      // 记录失败
      await this.markOptimizationEnd(env.DB, 'failed', error.message);
      
      // 发送错误通知
      if (DEFAULT_OPTIMIZATION_CONFIG.notifyOnCompletion) {
        await this.sendErrorNotification(env, error);
      }
    }
  },

  /**
   * 队列消息处理 - 处理异步优化任务
   */
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    console.log(`[STORAGE_OPTIMIZATION_WORKER] 处理队列消息批次，包含 ${batch.messages.length} 条消息`);

    for (const message of batch.messages) {
      try {
        const { type, config, taskId } = message.body;

        console.log(`[STORAGE_OPTIMIZATION_WORKER] 处理队列消息: ${type}, 任务ID: ${taskId}`);

        const optimizationService = new StorageOptimizationService(env.DB, env, {
          ...DEFAULT_OPTIMIZATION_CONFIG,
          ...config
        });

        let result;

        switch (type) {
          case 'full_optimization':
            result = await optimizationService.runFullOptimization();
            break;
          case 'cleanup_unused':
            result = await optimizationService.cleanupUnusedContent();
            break;
          case 'compress_files':
            result = await optimizationService.compressLargeFiles();
            break;
          case 'lifecycle_policy':
            result = await optimizationService.applyLifecyclePolicy();
            break;
          case 'quota_management':
            result = await optimizationService.manageUserQuotas();
            break;
          case 'defragment':
            result = await optimizationService.defragmentStorage();
            break;
          default:
            console.warn(`[STORAGE_OPTIMIZATION_WORKER] 未知的优化类型: ${type}`);
            continue;
        }

        // 更新任务状态
        await this.updateTaskStatus(env.DB, taskId, 'completed', result);

        console.log(`[STORAGE_OPTIMIZATION_WORKER] 队列任务完成: ${taskId}`);

      } catch (error) {
        console.error(`[STORAGE_OPTIMIZATION_WORKER] 处理队列消息失败:`, error);
        
        // 更新任务状态为失败
        if (message.body.taskId) {
          await this.updateTaskStatus(env.DB, message.body.taskId, 'failed', { error: error.message });
        }
      }
    }
  }

  // 私有辅助方法

  /**
   * 检查优化任务状态
   */
  private async checkOptimizationStatus(db: D1Database): Promise<boolean> {
    try {
      // 这里应该查询优化任务状态表
      // 由于没有专门的表，暂时返回false
      return false;
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 检查优化状态失败:', error);
      return false;
    }
  }

  /**
   * 标记优化开始
   */
  private async markOptimizationStart(db: D1Database): Promise<void> {
    try {
      // 这里应该在优化任务状态表中插入记录
      console.log('[STORAGE_OPTIMIZATION_WORKER] 标记优化任务开始');
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 标记优化开始失败:', error);
    }
  }

  /**
   * 标记优化结束
   */
  private async markOptimizationEnd(db: D1Database, status: 'completed' | 'failed', message: string): Promise<void> {
    try {
      // 这里应该更新优化任务状态表
      console.log(`[STORAGE_OPTIMIZATION_WORKER] 标记优化任务结束: ${status} - ${message}`);
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 标记优化结束失败:', error);
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(db: D1Database): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // 检查数据库连接
      await db.prepare('SELECT 1').first();
      
      // 检查存储空间（模拟）
      // 这里可以添加更多的健康检查逻辑
      
      return { healthy: issues.length === 0, issues };
    } catch (error) {
      issues.push(`健康检查失败: ${error.message}`);
      return { healthy: false, issues };
    }
  }

  /**
   * 记录优化结果
   */
  private async recordOptimizationResult(db: D1Database, result: any): Promise<void> {
    try {
      // 这里应该在优化历史表中插入记录
      console.log(`[STORAGE_OPTIMIZATION_WORKER] 记录优化结果: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 记录优化结果失败:', error);
    }
  }

  /**
   * 发送优化完成通知
   */
  private async sendOptimizationNotification(env: Env, result: any): Promise<void> {
    try {
      // 这里可以集成邮件、短信、webhook等通知方式
      console.log(`[STORAGE_OPTIMIZATION_WORKER] 发送优化完成通知: 节省 ${result.totalSaved} 字节`);
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 发送通知失败:', error);
    }
  }

  /**
   * 发送错误通知
   */
  private async sendErrorNotification(env: Env, error: Error): Promise<void> {
    try {
      console.log(`[STORAGE_OPTIMIZATION_WORKER] 发送错误通知: ${error.message}`);
    } catch (notificationError) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 发送错误通知失败:', notificationError);
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(db: D1Database, taskId: string, status: string, result: any): Promise<void> {
    try {
      console.log(`[STORAGE_OPTIMIZATION_WORKER] 更新任务状态: ${taskId} -> ${status}`);
    } catch (error) {
      console.error('[STORAGE_OPTIMIZATION_WORKER] 更新任务状态失败:', error);
    }
  }
};

/**
 * 优化任务类型
 */
export type OptimizationTaskType = 
  | 'full_optimization'
  | 'cleanup_unused'
  | 'compress_files'
  | 'lifecycle_policy'
  | 'quota_management'
  | 'defragment';

/**
 * 优化任务消息格式
 */
export interface OptimizationTaskMessage {
  type: OptimizationTaskType;
  config?: any;
  taskId: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high';
}