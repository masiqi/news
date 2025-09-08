import { db } from '../index';
import { 
  processingTasks, 
  statusHistories, 
  userStatistics 
} from '../../db/schema';
import { eq, and, or, desc, asc, sql, gte, lte, isNull } from 'drizzle-orm';

export interface ProcessingTask {
  id: number;
  userId: number;
  sourceId: number;
  type: 'rss_fetch' | 'ai_process' | 'content_storage' | 'error_retry';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  progress: number;
  title: string;
  description?: string;
  errorMessage?: string;
  resultData?: any;
  retryCount: number;
  maxRetries: number;
  estimatedDuration?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusHistory {
  id: number;
  taskId: number;
  previousStatus: string;
  newStatus: string;
  progress: number;
  message?: string;
  metadata?: any;
  timestamp: Date;
}

export interface UserStatistics {
  id: number;
  userId: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  processingTasks: number;
  averageProcessingTime: number;
  tasksToday: number;
  tasksThisWeek: number;
  tasksThisMonth: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class StatusService {
  /**
   * 获取用户当前状态
   */
  async getCurrentStatus(userId: number): Promise<{
    tasks: ProcessingTask[];
    statistics: UserStatistics;
  }> {
    try {
      // 获取用户当前任务
      const tasks = await db
        .select()
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .orderBy(desc(processingTasks.updatedAt))
        .limit(50);

      // 获取用户统计
      const [statistics] = await db
        .select()
        .from(userStatistics)
        .where(eq(userStatistics.userId, userId))
        .limit(1);

      // 如果没有统计记录，创建一个
      if (!statistics) {
        const newStats = await this.initializeStatistics(userId);
        return { tasks, statistics: newStats };
      }

      return { tasks, statistics };
    } catch (error) {
      console.error('获取用户当前状态失败:', error);
      throw new Error('获取用户当前状态失败');
    }
  }

  /**
   * 获取任务状态历史
   */
  async getStatusHistory(userId: number, options: {
    taskId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    history: StatusHistory[];
    total: number;
  }> {
    try {
      let query = db
        .select()
        .from(statusHistories)
        .innerJoin(processingTasks, eq(statusHistories.taskId, processingTasks.id))
        .where(eq(processingTasks.userId, userId));

      if (options.taskId) {
        query = query.where(eq(statusHistories.taskId, options.taskId));
      }

      const [countResult] = await db
        .select({ total: sql`count(*)`.mapWith(Number) })
        .from(statusHistories)
        .innerJoin(processingTasks, eq(statusHistories.taskId, processingTasks.id))
        .where(eq(processingTasks.userId, userId))
        .limit(1);

      const history = await query
        .orderBy(desc(statusHistories.timestamp))
        .limit(options.limit || 20)
        .offset(options.offset || 0);

      return {
        history: history.map(item => ({
          ...item,
          metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
        })),
        total: countResult?.total || 0,
      };
    } catch (error) {
      console.error('获取状态历史失败:', error);
      throw new Error('获取状态历史失败');
    }
  }

  /**
   * 获取统计数据
   */
  async getStatistics(userId: number, period: 'today' | 'week' | 'month' = 'today'): Promise<UserStatistics> {
    try {
      const [statistics] = await db
        .select()
        .from(userStatistics)
        .where(eq(userStatistics.userId, userId))
        .limit(1);

      if (!statistics) {
        return await this.initializeStatistics(userId);
      }

      // 更新统计数据
      await this.updateStatistics(userId, period);

      const [updatedStats] = await db
        .select()
        .from(userStatistics)
        .where(eq(userStatistics.userId, userId))
        .limit(1);

      return updatedStats || statistics;
    } catch (error) {
      console.error('获取统计数据失败:', error);
      throw new Error('获取统计数据失败');
    }
  }

  /**
   * 创建处理任务
   */
  async createTask(task: {
    userId: number;
    sourceId: number;
    type: ProcessingTask['type'];
    title: string;
    description?: string;
    estimatedDuration?: number;
    maxRetries?: number;
  }): Promise<ProcessingTask> {
    try {
      const [newTask] = await db
        .insert(processingTasks)
        .values({
          userId: task.userId,
          sourceId: task.sourceId,
          type: task.type,
          status: 'pending',
          progress: 0,
          title: task.title,
          description: task.description,
          maxRetries: task.maxRetries || 3,
          estimatedDuration: task.estimatedDuration,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 记录状态历史
      await this.recordStatusHistory(newTask.id, 'pending', 'pending', 0, '任务创建');

      // 更新用户统计
      await this.updateStatistics(task.userId, 'today');

      return newTask;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw new Error('创建任务失败');
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: number, updates: {
    status?: ProcessingTask['status'];
    progress?: number;
    errorMessage?: string;
    resultData?: any;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<ProcessingTask | null> {
    try {
      const [currentTask] = await db
        .select()
        .from(processingTasks)
        .where(eq(processingTasks.id, taskId))
        .limit(1);

      if (!currentTask) {
        return null;
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }
      if (updates.progress !== undefined) {
        updateData.progress = updates.progress;
      }
      if (updates.errorMessage !== undefined) {
        updateData.errorMessage = updates.errorMessage;
      }
      if (updates.resultData !== undefined) {
        updateData.resultData = JSON.stringify(updates.resultData);
      }
      if (updates.startedAt !== undefined) {
        updateData.startedAt = updates.startedAt;
      }
      if (updates.completedAt !== undefined) {
        updateData.completedAt = updates.completedAt;
      }

      // 更新任务
      const [updatedTask] = await db
        .update(processingTasks)
        .set(updateData)
        .where(eq(processingTasks.id, taskId))
        .returning();

      if (!updatedTask) {
        return null;
      }

      // 记录状态历史
      if (updates.status && updates.status !== currentTask.status) {
        await this.recordStatusHistory(
          taskId,
          currentTask.status,
          updates.status,
          updates.progress || currentTask.progress,
          '状态更新'
        );
      }

      // 如果任务完成或失败，更新统计
      if (updates.status && ['completed', 'failed'].includes(updates.status)) {
        await this.updateStatistics(currentTask.userId, 'today');
      }

      return {
        ...updatedTask,
        resultData: updatedTask.resultData ? JSON.parse(updatedTask.resultData) : undefined,
      };
    } catch (error) {
      console.error('更新任务状态失败:', error);
      throw new Error('更新任务状态失败');
    }
  }

  /**
   * 开始任务处理
   */
  async startTask(taskId: number): Promise<ProcessingTask> {
    try {
      const [task] = await db
        .select()
        .from(processingTasks)
        .where(eq(processingTasks.id, taskId))
        .limit(1);

      if (!task) {
        throw new Error('任务不存在');
      }

      const [updatedTask] = await db
        .update(processingTasks)
        .set({
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(processingTasks.id, taskId))
        .returning();

      // 记录状态历史
      await this.recordStatusHistory(taskId, task.status, 'processing', task.progress, '开始处理');

      return updatedTask;
    } catch (error) {
      console.error('开始任务失败:', error);
      throw new Error('开始任务失败');
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: number, progress: number, message?: string): Promise<ProcessingTask> {
    try {
      const [task] = await db
        .select()
        .from(processingTasks)
        .where(eq(processingTasks.id, taskId))
        .limit(1);

      if (!task) {
        throw new Error('任务不存在');
      }

      const [updatedTask] = await db
        .update(processingTasks)
        .set({
          progress,
          updatedAt: new Date(),
        })
        .where(eq(processingTasks.id, taskId))
        .returning();

      // 记录状态历史
      await this.recordStatusHistory(taskId, task.status, task.status, progress, message || '进度更新');

      return updatedTask;
    } catch (error) {
      console.error('更新任务进度失败:', error);
      throw new Error('更新任务进度失败');
    }
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: number, resultData?: any): Promise<ProcessingTask> {
    return await this.updateTaskStatus(taskId, {
      status: 'completed',
      progress: 100,
      resultData,
      completedAt: new Date(),
    });
  }

  /**
   * 失败任务
   */
  async failTask(taskId: number, errorMessage: string): Promise<ProcessingTask> {
    const [task] = await db
      .select()
      .from(processingTasks)
      .where(eq(processingTasks.id, taskId))
      .limit(1);

    if (!task) {
      throw new Error('任务不存在');
    }

    // 检查是否需要重试
    if (task.retryCount < task.maxRetries) {
      return await this.updateTaskStatus(taskId, {
        status: 'retrying',
        errorMessage,
      });
    }

    return await this.updateTaskStatus(taskId, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });
  }

  /**
   * 获取待处理任务
   */
  async getPendingTasks(limit: number = 20): Promise<ProcessingTask[]> {
    try {
      return await db
        .select()
        .from(processingTasks)
        .where(
          or(
            eq(processingTasks.status, 'pending'),
            eq(processingTasks.status, 'retrying')
          )
        )
        .orderBy(asc(processingTasks.retryCount), asc(processingTasks.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('获取待处理任务失败:', error);
      throw new Error('获取待处理任务失败');
    }
  }

  /**
   * 获取进行中的任务
   */
  async getProcessingTasks(limit: number = 10): Promise<ProcessingTask[]> {
    try {
      return await db
        .select()
        .from(processingTasks)
        .where(eq(processingTasks.status, 'processing'))
        .orderBy(asc(processingTasks.startedAt))
        .limit(limit);
    } catch (error) {
      console.error('获取进行中任务失败:', error);
      throw new Error('获取进行中任务失败');
    }
  }

  /**
   * 记录状态历史
   */
  private async recordStatusHistory(
    taskId: number,
    previousStatus: string,
    newStatus: string,
    progress: number,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(statusHistories).values({
        taskId,
        previousStatus,
        newStatus,
        progress,
        message,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('记录状态历史失败:', error);
      // 不抛出错误，避免影响主要功能
    }
  }

  /**
   * 初始化用户统计
   */
  private async initializeStatistics(userId: number): Promise<UserStatistics> {
    try {
      const [stats] = await db
        .insert(userStatistics)
        .values({
          userId,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          processingTasks: 0,
          averageProcessingTime: 0,
          tasksToday: 0,
          tasksThisWeek: 0,
          tasksThisMonth: 0,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return stats;
    } catch (error) {
      console.error('初始化用户统计失败:', error);
      throw new Error('初始化用户统计失败');
    }
  }

  /**
   * 更新用户统计
   */
  private async updateStatistics(userId: number, period: string): Promise<void> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 计算各个时间段的统计
      const [totalTasks] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId));

      const [completedTasks] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            eq(processingTasks.status, 'completed')
          )
        );

      const [failedTasks] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            eq(processingTasks.status, 'failed')
          )
        );

      const [processingTasksCount] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            eq(processingTasks.status, 'processing')
          )
        );

      const [tasksToday] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            gte(processingTasks.createdAt, todayStart)
          )
        );

      const [tasksThisWeek] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            gte(processingTasks.createdAt, weekStart)
          )
        );

      const [tasksThisMonth] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            gte(processingTasks.createdAt, monthStart)
          )
        );

      // 计算平均处理时间
      const [avgTimeResult] = await db
        .select({
          avgTime: sql`AVG(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)`.mapWith(Number),
        })
        .from(processingTasks)
        .where(
          and(
            eq(processingTasks.userId, userId),
            eq(processingTasks.status, 'completed'),
            isNull(processingTasks.startedAt).not(),
            isNull(processingTasks.completedAt).not()
          )
        );

      // 更新统计数据
      await db
        .update(userStatistics)
        .set({
          totalTasks: totalTasks?.count || 0,
          completedTasks: completedTasks?.count || 0,
          failedTasks: failedTasks?.count || 0,
          processingTasks: processingTasksCount?.count || 0,
          averageProcessingTime: Math.round(avgTimeResult?.avgTime || 0),
          tasksToday: tasksToday?.count || 0,
          tasksThisWeek: tasksThisWeek?.count || 0,
          tasksThisMonth: tasksThisMonth?.count || 0,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userStatistics.userId, userId));
    } catch (error) {
      console.error('更新用户统计失败:', error);
      // 不抛出错误，避免影响主要功能
    }
  }

  /**
   * 清理过期任务
   */
  async cleanupOldTasks(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const [result] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(processingTasks)
        .where(
          and(
            inArray(processingTasks.status, ['completed', 'failed']),
            lt(processingTasks.updatedAt, cutoffDate)
          )
        )
        .limit(1);

      await db
        .delete(processingTasks)
        .where(
          and(
            inArray(processingTasks.status, ['completed', 'failed']),
            lt(processingTasks.updatedAt, cutoffDate)
          )
        );

      return result?.count || 0;
    } catch (error) {
      console.error('清理过期任务失败:', error);
      throw new Error('清理过期任务失败');
    }
  }

  /**
   * 获取任务统计汇总
   */
  async getTaskSummary(userId: number): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    successRate: number;
    averageTime: number;
  }> {
    try {
      const [summary] = await db
        .select({
          total: sql`count(*)`.mapWith(Number),
          pending: sql`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
          processing: sql`SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)`.mapWith(Number),
          completed: sql`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`.mapWith(Number),
          failed: sql`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`.mapWith(Number),
          averageTime: sql`AVG(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)`.mapWith(Number),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .limit(1);

      const successRate = summary && summary.completed > 0 
        ? (summary.completed / summary.total * 100).toFixed(1) 
        : '0';

      return {
        total: summary?.total || 0,
        pending: summary?.pending || 0,
        processing: summary?.processing || 0,
        completed: summary?.completed || 0,
        failed: summary?.failed || 0,
        successRate: parseFloat(successRate),
        averageTime: Math.round(summary?.averageTime || 0),
      };
    } catch (error) {
      console.error('获取任务统计汇总失败:', error);
      throw new Error('获取任务统计汇总失败');
    }
  }
}