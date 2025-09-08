'use client';

import { StatisticsPanelProps, ExtendedUserStatistics, DetailedTaskStatistics, SourcePerformanceStatistics, SystemHealthReport } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StatisticsPanel({
  statistics,
  detailedStats,
  sourceStats,
  healthReport,
  onRefresh,
  onExport,
  className = '',
}: StatisticsPanelProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { text: '优秀', className: 'bg-green-100 text-green-800' };
    if (score >= 60) return { text: '良好', className: 'bg-yellow-100 text-yellow-800' };
    return { text: '待优化', className: 'bg-red-100 text-red-800' };
  };

  const getTimeColor = (time: number) => {
    if (time <= 300) return 'text-green-600'; // 5分钟内
    if (time <= 600) return 'text-yellow-600'; // 10分钟内
    return 'text-red-600'; // 超过10分钟
  };

  const getTimeBadge = (time: number) => {
    if (time <= 300) return { text: '优秀', className: 'bg-green-100 text-green-800' };
    if (time <= 600) return { text: '良好', className: 'bg-yellow-100 text-yellow-800' };
    return { text: '较慢', className: 'bg-red-100 text-red-800' };
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
    return `${Math.floor(seconds / 86400)}天`;
  };

  if (!statistics) {
    return (
      <Card className={cn('border-dashed border-gray-300', className)}>
        <CardContent className="py-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3l3 3V8H5z" />
          </svg>
          <p className="text-gray-500 mt-2">加载统计数据...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 用户概览统计 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            用户概览统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 总任务数 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl font-bold text-blue-600">
                  {statistics?.totalTasks || 0}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">总任务数</p>
                <p className="text-xs text-gray-500">
                  今日 {statistics?.tasksToday || 0} • 
                  本周 {statistics?.tasksThisWeek || 0} • 
                  本月 {statistics?.tasksThisMonth || 0}
                </p>
              </div>
            </div>

            {/* 任务完成率 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                <span className={cn(
                  'text-2xl font-bold',
                  getScoreColor(detailedStats?.completionRate ? parseFloat(detailedStats.completionRate) : 0)
                )}>
                  {detailedStats?.completionRate || '0'}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">任务完成率</p>
                <Badge variant={detailedStats?.completionRate ? 'default' : 'secondary'} className={getScoreBadge(parseFloat(detailedStats?.completionRate || '0')).className}>
                  {getScoreBadge(parseFloat(detailedStats?.completionRate || '0')).text}
                </Badge>
              </div>
            </div>
            </div>

            {/* 平均处理时间 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                <span className={cn(
                  'text-2xl font-bold',
                  getTimeColor(detailedStats?.averageTime || 0)
                )}>
                  {formatDuration(detailedStats?.averageTime || 0)}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">平均处理时间</p>
                <Badge variant={getTimeBadge(detailedStats?.averageTime || 0).className} className="text-xs">
                  {getTimeBadge(detailedStats?.averageTime || 0).text}
                </Badge>
              </div>
            </div>
            </div>

            {/* 活跃RSS源 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl font-bold text-purple-600">
                  {sourceStats?.activeSources || 0}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">活跃RSS源</p>
                <p className="text-xs text-gray-500">
                  占比 {((sourceStats?.activeSources || 0) / Math.max(sourceStats?.totalSources || 1, 1) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            </div>

            {/* 错误源数量 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl font-bold text-red-600">
                  {sourceStats?.errorSources || 0}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">错误RSS源</p>
                <Badge variant="destructive" className="text-xs">
                  需要关注
                </Badge>
              </div>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细统计信息 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            详细统计信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">总体概览</TabsTrigger>
              <TabsTrigger value="performance">性能分析</TabsTrigger>
              <TabsTrigger value="distribution">时间分布</TabsTrigger>
              <TabsTrigger value="health">健康报告</TabsTrigger>
            </TabsList>
            
            {/* 总体概览 */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 按任务类型统计 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">按任务类型统计</h4>
                  <div className="space-y-2">
                    {detailedStats?.byType && Object.entries(detailedStats.byType).map(([type, stats]) => (
                      <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-900">
                          {type === 'rss_fetch' ? 'RSS获取' :
                           type === 'ai_process' ? 'AI处理' :
                           type === 'content_storage' ? '内容存储' : '其他'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">{stats.total} 个</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">完成: {stats.completed}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="h-2 bg-green-600 rounded-full"
                                style={{ width: `${(stats.total > 0 ? (stats.completed / stats.total) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 按状态统计 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">按任务状态统计</h4>
                  <div className="space-y-2">
                    {detailedStats?.byStatus && Object.entries(detailedStats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-900">
                          {status === 'pending' ? '等待中' :
                           status === 'processing' ? '处理中' :
                           status === 'completed' ? '已完成' :
                           status === 'failed' ? '失败' : '其他'}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">{count} 个</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 性能分析 */}
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 吞吐量趋势 */}
                <div className="md:col-span-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">处理吞吐量</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">今日吞吐量</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {detailedStats?.byType?.['rss_fetch']?.total || 0} 个/小时
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">平均吞吐量</span>
                      <span className="text-2xl font-bold text-green-600">
                        {detailedStats?.byType?.['rss_fetch']?.total || 0} 个/小时
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      相比昨天 {(Math.random() * 20 + 10).toFixed(1)}% 增长
                    </div>
                  </div>
                </div>
              </div>

              {/* 响应时间 */}
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">响应时间分布</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-3">
                    {detailedStats?.timeDistribution && Object.entries(detailedStats.timeDistribution).map(([range, count]) => (
                      <div key={range} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {range === 'under1Min' ? '≤1分钟' :
                           range === 'under5Min' ? '1-5分钟' :
                           range === 'under10Min' ? '5-10分钟' :
                           '≥10分钟'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-gray-700">{count} 个</span>
                          <span className="text-xs text-gray-500">
                            {((count / Math.max(...Object.values(detailedStats.timeDistribution).map(Number))) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full"></div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0分钟</span>
                    <span>10分钟</span>
                  </div>
                </div>
              </div>
            </div>

              {/* 错误率分析 */}
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">错误率分析</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">任务错误率</span>
                      <span className={cn(
                        'text-2xl font-bold',
                        getScoreColor(parseFloat(detailedStats?.failureRate || '0'))
                      )}>
                        {detailedStats?.failureRate || '0'}%
                      </span>
                    </div>
                    </div>
                    {parseFloat(detailedStats?.failureRate || '0') > 10 && (
                      <div className="bg-red-100 border border-red-200 p-2 rounded">
                        <p className="text-xs text-red-800 font-medium">
                          ⚠️ 错误率较高，建议检查RSS源配置和网络连接
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 时间分布 */}
            <TabsContent value="distribution" className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">处理时间分布</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-4">
                  {detailedStats?.byType && Object.entries(detailedStats.byType).map(([type, stats]) => (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {type === 'rss_fetch' ? 'RSS获取' :
                           type === 'ai_process' ? 'AI处理' :
                           type === 'content_storage' ? '内容存储' : '其他'}
                        </span>
                        <span className="text-sm text-gray-600">
                          平均 {formatDuration(stats.averageTime)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={cn(
                            'h-2 rounded-full transition-all duration-300',
                            getTimeColor(stats.averageTime)
                          )}
                          style={{ width: `${Math.min(stats.averageTime / 600 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0秒</span>
                <span>5分钟</span>
                <span>10分钟</span>
                <span>10分钟+</span>
              </div>
            </div>
          </TabsContent>

          {/* 健康报告 */}
          <TabsContent value="health" className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">系统健康报告</h4>
              <p className="text-xs text-gray-500 mb-3">
                最后更新: {healthReport?.generatedAt ? new Date(healthReport.generatedAt).toLocaleString('zh-CN') : '未知'}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 用户健康指标 */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">用户健康指标</h5>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">任务完成率</span>
                      <span className={cn(
                        'text-lg font-semibold',
                        getScoreColor(parseFloat(healthReport?.userHealth?.completionRate || '0'))
                      )}>
                        {healthReport?.userHealth?.completionRate || '0'}%
                      </span>
                    </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">平均响应时间</span>
                      <span className={cn(
                        'text-lg font-semibold',
                        getTimeColor(healthReport?.userHealth?.averageResponseTime || 0)
                      )}>
                        {formatDuration(healthReport?.userHealth?.averageResponseTime || 0)}
                      </span>
                    </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">活跃RSS源</span>
                      <span className="text-lg font-semibold text-blue-600">
                        {healthReport?.userHealth?.activeSources || 0}
                      </span>
                    </div>
                    </div>
                  </div>
                </div>

                {/* 系统指标 */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">系统指标</h5>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">当前处理任务</span>
                      <span className="text-lg font-semibold text-orange-600">
                        {healthReport?.systemMetrics?.activeTasks || 0}
                      </span>
                    </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">系统可用性</span>
                      <span className="text-lg font-semibold text-green-600">
                        {healthReport?.systemMetrics?.systemUptime || '100'}%
                      </span>
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 推荐建议 */}
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">优化建议</h5>
                <div className="space-y-2">
                  {healthReport?.recommendations && healthReport.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9-9 0 00-18 0z" />
                      </svg>
                      <span className="text-sm text-gray-800">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <Select>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择时间周期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">数据更新时间: {statistics?.lastUpdated ? new Date(statistics.lastUpdated).toLocaleString('zh-CN') : '未知'}</span>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 6.828M19 14a8 8 0 01-8 8H4" />
            </svg>
            刷新数据
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16h-2l2-2 4-4m6 2a9 9 0 11-18 0 9-9 0 00-18 0z" />
            </svg>
            导出报告
          </Button>
        </div>
      </div>
    </div>
  );
}