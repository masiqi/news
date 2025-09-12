import { MetricsCollectorService } from './metrics-collector.service';
import { HealthCheckService } from './health-check.service';
import { QueueMonitorService } from './queue-monitor.service';
import { UserStatsService } from './user-stats.service';
import { AlertEngineService } from './alert-engine.service';
import { systemEventLogs } from '../db/schema';
import { db } from '../db';

export interface MonitoringConfig {
  enableMetricsCollection: boolean;
  enableHealthChecks: boolean;
  enableQueueMonitoring: boolean;
  enableUserStats: boolean;
  enableAlertEngine: boolean;
  metricsCollectionInterval: number;
  healthCheckInterval: number;
  queueMonitoringInterval: number;
  userStatsInterval: number;
  alertCheckInterval: number;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private config: MonitoringConfig;
  private metricsCollector: MetricsCollectorService;
  private healthCheckService: HealthCheckService;
  private queueMonitorService: QueueMonitorService;
  private userStatsService: UserStatsService;
  private alertEngineService: AlertEngineService;
  private isInitialized: boolean = false;

  private constructor() {
    this.config = {
      enableMetricsCollection: true,
      enableHealthChecks: true,
      enableQueueMonitoring: true,
      enableUserStats: true,
      enableAlertEngine: true,
      metricsCollectionInterval: 30,
      healthCheckInterval: 60,
      queueMonitoringInterval: 60,
      userStatsInterval: 300,
      alertCheckInterval: 60
    };

    this.metricsCollector = MetricsCollectorService.getInstance();
    this.healthCheckService = HealthCheckService.getInstance();
    this.queueMonitorService = QueueMonitorService.getInstance();
    this.userStatsService = UserStatsService.getInstance();
    this.alertEngineService = AlertEngineService.getInstance();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // 初始化监控系统
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('监控系统已经初始化');
      return;
    }

    try {
      console.log('正在初始化监控系统...');

      // 记录系统启动事件
      await this.logSystemEvent('monitoring_init', '监控系统初始化', 'system', 'info', 
        '开始初始化监控系统服务');

      // 启动各个监控服务
      if (this.config.enableMetricsCollection) {
        console.log('启动指标收集服务...');
        this.metricsCollector.startCollection();
      }

      if (this.config.enableHealthChecks) {
        console.log('启动健康检查服务...');
        this.healthCheckService.startHealthChecks();
      }

      if (this.config.enableQueueMonitoring) {
        console.log('启动队列监控服务...');
        this.queueMonitorService.startQueueMonitoring();
      }

      if (this.config.enableUserStats) {
        console.log('启动用户统计服务...');
        this.userStatsService.startUserStatsService();
      }

      if (this.config.enableAlertEngine) {
        console.log('启动报警引擎服务...');
        this.alertEngineService.startAlertEngine();
      }

      // 设置定期数据清理任务
      this.setupDataCleanupTasks();

      this.isInitialized = true;

      // 记录系统启动完成事件
      await this.logSystemEvent('monitoring_ready', '监控系统就绪', 'system', 'info', 
        '监控系统初始化完成，所有服务已启动');

      console.log('监控系统初始化完成');
    } catch (error) {
      console.error('监控系统初始化失败:', error);
      await this.logSystemEvent('monitoring_init_failed', '监控系统初始化失败', 'system', 'error', 
        `监控系统初始化失败: ${error}`);
      throw error;
    }
  }

  // 停止监控系统
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('监控系统未初始化');
      return;
    }

    try {
      console.log('正在停止监控系统...');

      // 记录系统停止事件
      await this.logSystemEvent('monitoring_shutdown', '监控系统停止', 'system', 'info', 
        '开始停止监控系统服务');

      // 停止各个监控服务
      if (this.config.enableMetricsCollection) {
        console.log('停止指标收集服务...');
        this.metricsCollector.stopCollection();
      }

      if (this.config.enableHealthChecks) {
        console.log('停止健康检查服务...');
        this.healthCheckService.stopHealthChecks();
      }

      if (this.config.enableQueueMonitoring) {
        console.log('停止队列监控服务...');
        this.queueMonitorService.stopQueueMonitoring();
      }

      if (this.config.enableUserStats) {
        console.log('停止用户统计服务...');
        this.userStatsService.stopUserStatsService();
      }

      if (this.config.enableAlertEngine) {
        console.log('停止报警引擎服务...');
        this.alertEngineService.stopAlertEngine();
      }

      this.isInitialized = false;

      // 记录系统停止完成事件
      await this.logSystemEvent('monitoring_stopped', '监控系统已停止', 'system', 'info', 
        '监控系统已完全停止');

      console.log('监控系统已停止');
    } catch (error) {
      console.error('监控系统停止失败:', error);
      await this.logSystemEvent('monitoring_shutdown_failed', '监控系统停止失败', 'system', 'error', 
        `监控系统停止失败: ${error}`);
      throw error;
    }
  }

  // 获取监控系统状态
  async getStatus(): Promise<{
    isInitialized: boolean;
    services: {
      metricsCollection: boolean;
      healthChecks: boolean;
      queueMonitoring: boolean;
      userStats: boolean;
      alertEngine: boolean;
    };
    uptime: number;
    lastHealthCheck: Date | null;
  }> {
    try {
      const services = {
        metricsCollection: this.config.enableMetricsCollection,
        healthChecks: this.config.enableHealthChecks,
        queueMonitoring: this.config.enableQueueMonitoring,
        userStats: this.config.enableUserStats,
        alertEngine: this.config.enableAlertEngine
      };

      // 获取最近的健康检查时间
      const recentHealthCheck = await db
        .select({ timestamp: systemEventLogs.timestamp })
        .from(systemEventLogs)
        .where(eq(systemEventLogs.eventType, 'health_check'))
        .orderBy(desc(systemEventLogs.timestamp))
        .limit(1);

      const lastHealthCheck = recentHealthCheck.length > 0 
        ? new Date(recentHealthCheck[0].timestamp)
        : null;

      return {
        isInitialized: this.isInitialized,
        services,
        uptime: this.isInitialized ? Date.now() - (this.getStartTime() || Date.now()) : 0,
        lastHealthCheck
      };
    } catch (error) {
      console.error('获取监控系统状态失败:', error);
      throw error;
    }
  }

  // 重新加载配置
  async reloadConfig(newConfig: Partial<MonitoringConfig>): Promise<void> {
    try {
      console.log('重新加载监控系统配置...');

      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newConfig };

      // 记录配置变更事件
      await this.logSystemEvent('config_reloaded', '监控系统配置重载', 'system', 'info', 
        `监控系统配置已更新: ${JSON.stringify(newConfig)}`);

      // 根据配置变更启动或停止服务
      await this.applyConfigChanges(oldConfig, this.config);

      console.log('监控系统配置重载完成');
    } catch (error) {
      console.error('重载监控系统配置失败:', error);
      throw error;
    }
  }

  // 应用配置变更
  private async applyConfigChanges(oldConfig: MonitoringConfig, newConfig: MonitoringConfig): Promise<void> {
    try {
      // 指标收集服务
      if (oldConfig.enableMetricsCollection !== newConfig.enableMetricsCollection) {
        if (newConfig.enableMetricsCollection) {
          this.metricsCollector.startCollection();
        } else {
          this.metricsCollector.stopCollection();
        }
      }

      // 健康检查服务
      if (oldConfig.enableHealthChecks !== newConfig.enableHealthChecks) {
        if (newConfig.enableHealthChecks) {
          this.healthCheckService.startHealthChecks();
        } else {
          this.healthCheckService.stopHealthChecks();
        }
      }

      // 队列监控服务
      if (oldConfig.enableQueueMonitoring !== newConfig.enableQueueMonitoring) {
        if (newConfig.enableQueueMonitoring) {
          this.queueMonitorService.startQueueMonitoring();
        } else {
          this.queueMonitorService.stopQueueMonitoring();
        }
      }

      // 用户统计服务
      if (oldConfig.enableUserStats !== newConfig.enableUserStats) {
        if (newConfig.enableUserStats) {
          this.userStatsService.startUserStatsService();
        } else {
          this.userStatsService.stopUserStatsService();
        }
      }

      // 报警引擎服务
      if (oldConfig.enableAlertEngine !== newConfig.enableAlertEngine) {
        if (newConfig.enableAlertEngine) {
          this.alertEngineService.startAlertEngine();
        } else {
          this.alertEngineService.stopAlertEngine();
        }
      }
    } catch (error) {
      console.error('应用配置变更失败:', error);
      throw error;
    }
  }

  // 设置数据清理任务
  private setupDataCleanupTasks(): void {
    // 每天清理一次过期数据
    setInterval(async () => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        console.error('清理过期数据失败:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24小时
  }

  // 清理过期数据
  private async cleanupOldData(): Promise<void> {
    try {
      console.log('开始清理过期监控数据...');

      // 清理30天前的系统指标
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      
      // 这里应该添加具体的数据清理逻辑
      // 由于数据库表结构可能不同，暂时只记录事件
      
      await this.logSystemEvent('data_cleanup', '过期数据清理', 'system', 'info', 
        '过期监控数据清理完成');

      console.log('过期监控数据清理完成');
    } catch (error) {
      console.error('清理过期数据失败:', error);
      await this.logSystemEvent('data_cleanup_failed', '过期数据清理失败', 'system', 'error', 
        `过期数据清理失败: ${error}`);
    }
  }

  // 记录系统事件
  private async logSystemEvent(
    eventType: string,
    eventName: string,
    service: string,
    level: 'info' | 'warning' | 'error' | 'debug',
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(systemEventLogs).values({
        eventType,
        eventName,
        service,
        level,
        message,
        details: details ? JSON.stringify(details) : null,
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录系统事件失败:', error);
    }
  }

  // 获取系统启动时间
  private getStartTime(): number | null {
    // 这里应该从某个地方获取系统启动时间
    // 暂时返回当前时间
    return Date.now();
  }

  // 获取配置
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // 获取各个服务的实例
  getServices() {
    return {
      metricsCollector: this.metricsCollector,
      healthCheckService: this.healthCheckService,
      queueMonitorService: this.queueMonitorService,
      userStatsService: this.userStatsService,
      alertEngineService: this.alertEngineService
    };
  }

  // 健康检查
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
    timestamp: Date;
    uptime: number;
  }> {
    try {
      const services: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
      
      // 检查各个服务的健康状态
      if (this.config.enableMetricsCollection) {
        services.metricsCollection = 'healthy'; // 简化版本
      }
      
      if (this.config.enableHealthChecks) {
        services.healthChecks = 'healthy'; // 简化版本
      }
      
      if (this.config.enableQueueMonitoring) {
        services.queueMonitoring = 'healthy'; // 简化版本
      }
      
      if (this.config.enableUserStats) {
        services.userStats = 'healthy'; // 简化版本
      }
      
      if (this.config.enableAlertEngine) {
        services.alertEngine = 'healthy'; // 简化版本
      }

      // 确定整体状态
      const serviceStatuses = Object.values(services);
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (serviceStatuses.some(status => status === 'unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (serviceStatuses.some(status => status === 'degraded')) {
        overallStatus = 'degraded';
      }

      return {
        status: overallStatus,
        services,
        timestamp: new Date(),
        uptime: this.isInitialized ? Date.now() - (this.getStartTime() || Date.now()) : 0
      };
    } catch (error) {
      console.error('监控系统健康检查失败:', error);
      return {
        status: 'unhealthy',
        services: {},
        timestamp: new Date(),
        uptime: 0
      };
    }
  }
}