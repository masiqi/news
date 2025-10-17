'use client';

import { StatusOverviewProps, ExtendedUserStatistics, TaskSummary, PerformanceMetrics } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function StatusOverview({
  statistics,
  taskSummary,
  performanceMetrics,
  className = '',
}: StatusOverviewProps) {
  const getCompletionRateColor = (rate: string) => {
    const numRate = parseFloat(rate);
    if (numRate >= 80) return 'text-green-600';
    if (numRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 300) return 'text-green-600'; // 5分钟内
    if (time <= 600) return 'text-yellow-600'; // 10分钟内
    return 'text-red-600'; // 超过10分钟
  };

  const getStatusColor = (successRate: string) => {
    const numRate = parseFloat(successRate);
    if (numRate >= 80) return 'text-green-600';
    if (numRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 总体统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总任务数 */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              总任务数
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {statistics?.totalTasks || 0}
              </span>
              <span className="text-sm text-gray-500">
                任务
              </span>
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((taskSummary?.completed || 0) / (statistics?.totalTasks || 1)) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 font-medium">
                {taskSummary ? Math.round(((taskSummary.completed || 0) / taskSummary.total) * 100) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 完成率 */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              任务完成率
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline justify-between">
              <span className={cn(
                'text-3xl font-bold',
                getCompletionRateColor(taskSummary?.successRate || '0')
              )}>
                {taskSummary?.successRate || '0'}%
              </span>
              <Badge 
                variant={parseFloat(taskSummary?.successRate || '0') >= 80 ? 'default' : 'secondary'}
                className={parseFloat(taskSummary?.successRate || '0') >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
              >
                {parseFloat(taskSummary?.successRate || '0') >= 80 ? '优秀' : 
                 parseFloat(taskSummary?.successRate || '0') >= 60 ? '良好' : '待优化'}
              </Badge>
            </div>
            <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>已完成: {taskSummary?.completed || 0}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>失败: {taskSummary?.failed || 0}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 平均响应时间 */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              平均响应时间
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline justify-between">
              <span className={cn(
                'text-3xl font-bold',
                getResponseTimeColor(taskSummary?.averageTime || 0)
              )}>
                {formatDuration(taskSummary?.averageTime || 0)}
              </span>
              <Badge 
                variant={taskSummary?.averageTime ? (taskSummary.averageTime <= 300 ? 'default' : 'secondary') : 'secondary'}
                className={taskSummary?.averageTime ? (taskSummary.averageTime <= 300 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800') : 'bg-gray-100 text-gray-800'}
              >
                {taskSummary?.averageTime ? (taskSummary.averageTime <= 300 ? '优秀' : 
                   taskSummary.averageTime <= 600 ? '良好' : '较慢') : '无数据'}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>目标: ≤ 5分钟</span>
                <span className="text-xs font-medium">较上次 {performanceMetrics?.averageResponseTime ? ((taskSummary?.averageTime - performanceMetrics.averageResponseTime) / performanceMetrics.averageResponseTime * 100).toFixed(1) : '0'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 系统运行时间 */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              系统可用性
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-green-600">
                {performanceMetrics?.uptime || '100'}%
              </span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                正常运行
              </Badge>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>今日在线: {getOnlineTime()}小时</span>
                <span className="text-xs font-medium">优秀</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 活跃指标 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 进行中任务 */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              进行中任务
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-blue-600">
                  {statistics?.processingTasks || 0}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">正在处理的任务数量</p>
                <p className="text-sm font-medium text-gray-900">
                  平均 {(statistics?.processingTasks || 0) / 3} 个/小时
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 活跃RSS源 */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              活跃RSS源
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-green-600">
                  {statistics?.activeSources || 0}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">正常运行的RSS源数量</p>
                <p className="text-sm font-medium text-gray-900">
                  占比 {((statistics?.activeSources || 0) / (statistics?.totalTasks || 1) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 待处理任务 */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              待处理任务
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-orange-600">
                  {taskSummary?.pending || 0}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">等待处理的任务数量</p>
                <p className="text-sm font-medium text-gray-900">
                  预计 {(taskSummary?.pending || 0) * 2} 分钟处理完成
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 实时状态指标 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            实时性能指标
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 吞吐量 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {performanceMetrics?.throughput || 0}
              </div>
              <div className="text-sm text-gray-600">每分钟处理</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${Math.min((performanceMetrics?.throughput || 0) / 10 * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* 错误率 */}
            <div className="text-center">
              <div className={cn(
                'text-2xl font-bold',
                getStatusColor(performanceMetrics?.errorRate || '0')
              )}>
                {performanceMetrics?.errorRate || '0'}%
              </div>
              <div className="text-sm text-gray-600">错误率</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={cn(
                    'h-2 rounded-full',
                    parseFloat(performanceMetrics?.errorRate || '0') > 5 ? 'bg-red-600' : 
                    parseFloat(performanceMetrics?.errorRate || '0') > 2 ? 'bg-yellow-600' : 'bg-green-600'
                  )}
                  style={{ width: `${Math.min(parseFloat(performanceMetrics?.errorRate || 0) * 5, 100)}%` }}
                />
              </div>
            </div>

            {/* 请求延迟 */}
            <div className="text-center">
              <div className={cn(
                'text-2xl font-bold',
                getResponseTimeColor(performanceMetrics?.averageResponseTime || 0)
              )}>
                {performanceMetrics?.averageResponseTime || 0}ms
              </div>
              <div className="text-sm text-gray-600">平均延迟</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={cn(
                    'h-2 rounded-full',
                    (performanceMetrics?.averageResponseTime || 0) <= 100 ? 'bg-green-600' : 
                    (performanceMetrics?.averageResponseTime || 0) <= 300 ? 'bg-yellow-600' : 'bg-red-600'
                  )}
                  style={{ width: `${Math.min((performanceMetrics?.averageResponseTime || 0) / 5, 100)}%` }}
                />
              </div>
            </div>

            {/* 处理效率 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {performanceMetrics?.successRate || '100'}%
              </div>
              <div className="text-sm text-gray-600">处理效率</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={cn(
                    'h-2 rounded-full',
                    parseFloat(performanceMetrics?.successRate || '100') >= 95 ? 'bg-green-600' : 
                    parseFloat(performanceMetrics?.successRate || '100') >= 85 ? 'bg-yellow-600' : 'bg-red-600'
                  )}
                  style={{ width: `${parseFloat(performanceMetrics?.successRate || '100') || 100}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 辅助函数：格式化时间
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes > 0 ? ` ${minutes}分` : ''}`;
  }
}

// 辅助函数：获取在线时间
function getOnlineTime(): number {
  // 简化实现，返回固定的在线时间
  return 24;
}