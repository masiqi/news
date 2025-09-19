import { MonitoringService } from '../services/monitoring';
import { db } from '../db';

/**
 * 监控系统启动器
 * 在应用启动时调用此函数来初始化和启动所有监控服务
 */
export async function initializeMonitoring(): Promise<void> {
  try {
    console.log('[START] 启动监控系统...');
    
    const monitoringService = MonitoringService.getInstance();
    
    // 初始化监控系统
    await monitoringService.initialize();
    
    console.log('[SUCCESS] 监控系统启动成功');
    
    // 获取系统状态
    const status = await monitoringService.getStatus();
    console.log('[STATS] 监控系统状态:', JSON.stringify(status, null, 2));
    
  } catch (error) {
    console.error('[ERROR] 监控系统启动失败:', error);
    throw error;
  }
}

/**
 * 监控系统停止器
 * 在应用关闭时调用此函数来优雅地停止所有监控服务
 */
export async function shutdownMonitoring(): Promise<void> {
  try {
    console.log('[STOP] 停止监控系统...');
    
    const monitoringService = MonitoringService.getInstance();
    
    // 停止监控系统
    await monitoringService.shutdown();
    
    console.log('[SUCCESS] 监控系统已停止');
    
  } catch (error) {
    console.error('[ERROR] 监控系统停止失败:', error);
    throw error;
  }
}

/**
 * 获取监控系统状态
 */
export async function getMonitoringStatus() {
  try {
    const monitoringService = MonitoringService.getInstance();
    return await monitoringService.getStatus();
  } catch (error) {
    console.error('获取监控系统状态失败:', error);
    throw error;
  }
}

/**
 * 监控系统健康检查
 */
export async function monitoringHealthCheck() {
  try {
    const monitoringService = MonitoringService.getInstance();
    return await monitoringService.healthCheck();
  } catch (error) {
    console.error('监控系统健康检查失败:', error);
    throw error;
  }
}

/**
 * 重载监控系统配置
 */
export async function reloadMonitoringConfig(config: any) {
  try {
    const monitoringService = MonitoringService.getInstance();
    await monitoringService.reloadConfig(config);
    console.log('[SUCCESS] 监控系统配置重载成功');
  } catch (error) {
    console.error('[ERROR] 监控系统配置重载失败:', error);
    throw error;
  }
}

// 默认导出初始化函数
export default initializeMonitoring;