import { db } from '../db';
import { serviceHealth, systemEventLogs } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface HealthCheckResult {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorMessage?: string;
  uptime: number;
  details?: Record<string, any>;
}

export interface HealthCheckConfig {
  serviceName: string;
  endpoint?: string;
  timeout: number;
  expectedStatusCode?: number;
  checkInterval: number;
  maxRetries: number;
  retryDelay: number;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private healthChecks: Map<string, HealthCheckConfig> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  // 注册健康检查
  registerHealthCheck(config: HealthCheckConfig): void {
    this.healthChecks.set(config.serviceName, config);
    console.log(`已注册健康检查: ${config.serviceName}`);
    
    // 立即执行一次检查
    this.performHealthCheck(config.serviceName);
    
    // 设置定时检查
    const interval = setInterval(() => {
      this.performHealthCheck(config.serviceName);
    }, config.checkInterval * 1000);
    
    this.checkIntervals.set(config.serviceName, interval);
  }

  // 取消健康检查
  unregisterHealthCheck(serviceName: string): void {
    const interval = this.checkIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(serviceName);
    }
    
    this.healthChecks.delete(serviceName);
    console.log(`已取消健康检查: ${serviceName}`);
  }

  // 执行健康检查
  async performHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    const config = this.healthChecks.get(serviceName);
    if (!config) {
      throw new Error(`未找到服务 ${serviceName} 的健康检查配置`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // 模拟健康检查逻辑
      result = await this.executeHealthCheck(config);
      
      // 更新数据库中的健康状态
      await this.updateServiceHealthStatus(serviceName, result);
      
      // 记录系统事件
      await this.logHealthCheckEvent(serviceName, result);
      
    } catch (error) {
      result = {
        serviceName,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : '健康检查失败',
        uptime: 0
      };
      
      // 更新数据库中的健康状态
      await this.updateServiceHealthStatus(serviceName, result);
      
      // 记录系统事件
      await this.logHealthCheckEvent(serviceName, result);
    }

    return result;
  }

  private async executeHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // 这里实现具体的健康检查逻辑
      // 例如：HTTP请求、数据库连接、文件系统检查等
      
      // 模拟健康检查
      const responseTime = Math.floor(Math.random() * 1000);
      const isHealthy = Math.random() > 0.1; // 90% 概率健康
      
      if (!isHealthy) {
        throw new Error('服务响应异常');
      }

      return {
        serviceName: config.serviceName,
        status: 'healthy',
        responseTime,
        uptime: Math.floor(Math.random() * 86400),
        details: {
          checked_at: new Date().toISOString(),
          method: config.endpoint ? 'HTTP' : 'INTERNAL',
          response_time: responseTime
        }
      };
      
    } catch (error) {
      throw new Error(`健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async updateServiceHealthStatus(serviceName: string, result: HealthCheckResult): Promise<void> {
    try {
      // 获取当前健康状态
      const currentHealth = await db
        .select()
        .from(serviceHealth)
        .where(eq(serviceHealth.serviceName, serviceName))
        .limit(1);

      let consecutiveFailures = 0;
      let uptime = result.uptime;

      if (currentHealth.length > 0) {
        const current = currentHealth[0];
        
        // 计算连续失败次数
        if (result.status === 'unhealthy' && current.status === 'unhealthy') {
          consecutiveFailures = current.consecutiveFailures + 1;
        } else if (result.status !== 'unhealthy') {
          consecutiveFailures = 0;
          uptime = current.uptime + (Date.now() - current.lastCheck) / 1000;
        }
      }

      // 更新或插入健康状态
      await db.insert(serviceHealth).values({
        serviceName,
        status: result.status,
        lastCheck: Date.now(),
        responseTime: result.responseTime,
        errorMessage: result.errorMessage,
        consecutiveFailures,
        uptime,
        recoveryTime: result.status === 'healthy' ? result.responseTime : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).onConflictDoUpdate({
        target: serviceHealth.serviceName,
        set: {
          status: result.status,
          lastCheck: Date.now(),
          responseTime: result.responseTime,
          errorMessage: result.errorMessage,
          consecutiveFailures,
          uptime,
          recoveryTime: result.status === 'healthy' ? result.responseTime : undefined,
          updatedAt: Date.now()
        }
      });

    } catch (error) {
      console.error(`更新服务健康状态失败 ${serviceName}:`, error);
    }
  }

  private async logHealthCheckEvent(serviceName: string, result: HealthCheckResult): Promise<void> {
    try {
      const level = result.status === 'healthy' ? 'info' : 
                   result.status === 'degraded' ? 'warning' : 'error';
      
      await db.insert(systemEventLogs).values({
        eventType: 'health_check',
        eventName: '服务健康检查',
        service: serviceName,
        level,
        message: `服务健康状态: ${result.status}, 响应时间: ${result.responseTime}ms`,
        details: JSON.stringify({
          status: result.status,
          response_time: result.responseTime,
          error_message: result.errorMessage,
          uptime: result.uptime,
          check_details: result.details
        }),
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录健康检查事件失败:', error);
    }
  }

  // 获取服务健康状态
  async getServiceHealth(serviceName?: string): Promise<HealthCheckResult[]> {
    try {
      let query = db
        .select({
          serviceName: serviceHealth.serviceName,
          status: serviceHealth.status,
          responseTime: serviceHealth.responseTime,
          errorMessage: serviceHealth.errorMessage,
          uptime: serviceHealth.uptime,
          lastCheck: serviceHealth.lastCheck
        })
        .from(serviceHealth)
        .where(eq(serviceHealth.isActive, true));

      if (serviceName) {
        query = query.where(eq(serviceHealth.serviceName, serviceName));
      }

      const results = await query;
      
      return results.map(row => ({
        serviceName: row.serviceName,
        status: row.status,
        responseTime: row.responseTime,
        errorMessage: row.errorMessage || undefined,
        uptime: row.uptime,
        details: {
          last_check: new Date(row.lastCheck).toISOString()
        }
      }));
    } catch (error) {
      console.error('获取服务健康状态失败:', error);
      throw error;
    }
  }

  // 获取所有服务的健康状态概览
  async getHealthOverview(): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    services: HealthCheckResult[];
  }> {
    try {
      const services = await this.getServiceHealth();
      
      const overview = {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        degraded: services.filter(s => s.status === 'degraded').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length,
        services
      };

      return overview;
    } catch (error) {
      console.error('获取健康状态概览失败:', error);
      throw error;
    }
  }

  // 执行健康检查并返回结果
  async checkServiceHealth(serviceName: string): Promise<HealthCheckResult> {
    return await this.performHealthCheck(serviceName);
  }

  // 批量检查所有服务健康状态
  async checkAllServicesHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const serviceName of this.healthChecks.keys()) {
      try {
        const result = await this.performHealthCheck(serviceName);
        results.push(result);
      } catch (error) {
        console.error(`检查服务 ${serviceName} 健康状态失败:`, error);
        results.push({
          serviceName,
          status: 'unhealthy',
          responseTime: 0,
          errorMessage: error instanceof Error ? error.message : '健康检查失败',
          uptime: 0
        });
      }
    }
    
    return results;
  }

  // 获取健康检查统计信息
  async getHealthStats(timeRange: string = '1h'): Promise<{
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageResponseTime: number;
    uptime: number;
  }> {
    try {
      const now = Date.now();
      let startTime: number;
      
      switch (timeRange) {
        case '1h':
          startTime = now - 60 * 60 * 1000;
          break;
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now - 60 * 60 * 1000;
      }

      // 从系统事件日志中获取健康检查统计
      const events = await db
        .select()
        .from(systemEventLogs)
        .where(
          and(
            eq(systemEventLogs.eventType, 'health_check'),
            gte(systemEventLogs.timestamp, startTime)
          )
        );

      const totalChecks = events.length;
      const successfulChecks = events.filter(e => e.level === 'info').length;
      const failedChecks = events.filter(e => e.level === 'error').length;
      
      const responseTimes = events
        .filter(e => e.details)
        .map(e => {
          try {
            const details = JSON.parse(e.details || '{}');
            return details.response_time || 0;
          } catch {
            return 0;
          }
        })
        .filter(time => time > 0);

      const averageResponseTime = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // 计算正常运行时间
      const uptimeEvents = events.filter(e => e.level === 'info');
      const uptime = uptimeEvents.length > 0 
        ? Math.round((uptimeEvents.length / totalChecks) * 100)
        : 0;

      return {
        totalChecks,
        successfulChecks,
        failedChecks,
        averageResponseTime,
        uptime
      };
    } catch (error) {
      console.error('获取健康检查统计失败:', error);
      throw error;
    }
  }

  // 启动所有健康检查
  startHealthChecks(): void {
    console.log('启动服务健康检查...');
    
    // 注册默认服务健康检查
    const defaultServices = [
      {
        serviceName: 'api',
        timeout: 5000,
        checkInterval: 60,
        maxRetries: 3,
        retryDelay: 1000
      },
      {
        serviceName: 'database',
        timeout: 3000,
        checkInterval: 60,
        maxRetries: 3,
        retryDelay: 1000
      },
      {
        serviceName: 'queue',
        timeout: 3000,
        checkInterval: 60,
        maxRetries: 3,
        retryDelay: 1000
      },
      {
        serviceName: 'storage',
        timeout: 5000,
        checkInterval: 120,
        maxRetries: 3,
        retryDelay: 1000
      }
    ];

    for (const service of defaultServices) {
      this.registerHealthCheck(service);
    }
  }

  // 停止所有健康检查
  stopHealthChecks(): void {
    console.log('停止服务健康检查...');
    
    for (const [serviceName, interval] of this.checkIntervals.entries()) {
      clearInterval(interval);
    }
    
    this.checkIntervals.clear();
    this.healthChecks.clear();
  }
}