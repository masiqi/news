'use client';

import { ProcessingResultsProps, ProcessingTask } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ProcessingResults({
  tasks,
  onRetry,
  onRefresh,
  className = '',
}: ProcessingResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeColor = (time: number) => {
    if (time <= 300) return 'text-green-600';
    if (time <= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResultIcon = (task: ProcessingTask) => {
    if (task.status === 'failed') {
      return <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>;
    }

    if (task.status === 'completed' && task.resultData) {
      return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9-9 0 00-18 0" />
      </svg>;
    }

    return <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4m-1-4h-1m14 4h-1m-1-4h-1" />
    </svg>;
  };

  const getTypeIcon = (type: ProcessingTask['type']) => {
    switch (type) {
      case 'rss_fetch': return '📰';
      case 'ai_process': return '🤖';
      case 'content_storage': return '💾';
      case 'error_retry': return '🔄';
      default: return '📋';
    }
  };

  const getTypeText = (type: ProcessingTask['type']) => {
    switch (type) {
      case 'rss_fetch': return 'RSS获取';
      case 'ai_process': return 'AI处理';
      case 'content_storage': return '内容存储';
      case 'error_retry': return '错误重试';
      default: return '任务处理';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const failedTasks = tasks.filter(task => task.status === 'failed');
  const processingTasks = tasks.filter(task => task.status === 'processing');

  return (
    <div className={cn('space-y-6', className)}>
      {/* 结果统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 完成统计 */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              完成任务
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold text-green-700">
              {completedTasks.length}
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="flex-1 bg-green-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ 
                    width: `${(completedTasks.length / Math.max(tasks.length, 1)) * 100}%` 
                  }}
                />
              </div>
              <span className="text-xs text-green-600 font-medium">
                {Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100)}% 完成率
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 失败统计 */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800">
              失败任务
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold text-red-700">
              {failedTasks.length}
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="flex-1 bg-red-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full"
                  style={{ 
                    width: `${(failedTasks.length / Math.max(tasks.length, 1)) * 100}%` 
                  }}
                />
              </div>
              <span className="text-xs text-red-600 font-medium">
                {Math.round((failedTasks.length / Math.max(tasks.length, 1)) * 100)}% 失败率
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 处理中统计 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              处理中任务
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold text-blue-700">
              {processingTasks.length}
            </div>
            <div className="mt-2 text-xs text-blue-600">
              平均耗时 {calculateAverageTime(processingTasks)} 秒
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 结果列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            处理结果
          </h2>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onRefresh}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 6.828M19 14a8 8 0 01-8 8H4" />
              </svg>
              刷新结果
            </Button>
            <span className="text-sm text-gray-500">
              总共 {tasks.length} 个任务
            </span>
          </div>
        </div>

        {tasks.length === 0 ? (
          <Card className="border-dashed border-gray-300">
            <CardContent className="py-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7m2 5h9" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无处理结果
              </h3>
              <p className="text-gray-500">
                处理任务完成后，结果将在此显示
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card 
              key={task.id}
              className={cn(
                'transition-all duration-200 hover:shadow-md',
                task.status === 'completed' ? 'border-green-200 bg-green-50' :
                task.status === 'failed' ? 'border-red-200 bg-red-50' :
                task.status === 'processing' ? 'border-blue-200 bg-blue-50' :
                'border-gray-200 bg-gray-50'
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* 任务类型和状态 */}
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getTypeIcon(task.type)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                          {task.title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge 
                            variant={
                              task.status === 'completed' ? 'default' :
                              task.status === 'failed' ? 'destructive' :
                              task.status === 'processing' ? 'default' : 'secondary'
                            }
                            className={cn(
                              'text-xs',
                              task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'failed' ? 'bg-red-100 text-red-800' :
                              task.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            )}
                          >
                            {getTypeText(task.type)}
                          </Badge>
                          <Badge 
                            variant="outline"
                            className={cn(
                              'text-xs',
                              task.status === 'completed' ? 'border-green-300 text-green-700' :
                              task.status === 'failed' ? 'border-red-300 text-red-700' :
                              task.status === 'processing' ? 'border-blue-300 text-blue-700' :
                              'border-gray-300 text-gray-700'
                            )}
                          >
                            {task.status === 'pending' ? '等待中' :
                             task.status === 'processing' ? '处理中' :
                             task.status === 'completed' ? '已完成' :
                             task.status === 'failed' ? '失败' :
                             task.status === 'retrying' ? '重试中' : '未知'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {getResultIcon(task)}
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {getTimeAgo(task.createdAt)}
                  </span>
                </div>

                {/* 处理详情 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* 执行时间 */}
                  {task.startedAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">开始时间</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {new Date(task.startedAt).toLocaleTimeString('zh-CN')}
                      </span>
                    </div>
                  )}

                  {/* 完成时间 */}
                  {task.completedAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">完成时间</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {new Date(task.completedAt).toLocaleTimeString('zh-CN')}
                      </span>
                    </div>
                  )}

                  {/* 用时 */}
                  {task.startedAt && task.completedAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">总耗时</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {calculateDuration(task.startedAt, task.completedAt)}
                      </span>
                    </div>
                  )}

                  {/* 重试次数 */}
                  {task.retryCount > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500">重试次数</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {task.retryCount} / {task.maxRetries}
                      </span>
                    </div>
                  )}
                </div>

                {/* 处理结果 */}
                {task.status === 'completed' && task.resultData && (
                  <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-2">
                      处理成功
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(task.resultData).map(([key, value]) => (
                        <div key={key} className="flex items-start space-x-3">
                          <span className="text-xs font-medium text-green-700 min-w-0">
                            {key}:
                          </span>
                          <span className="text-sm text-green-900 flex-1 break-words">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 错误信息 */}
                {task.errorMessage && (
                  <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-800 mb-2">
                      处理失败
                    </h4>
                    <p className="text-sm text-red-900">
                      {task.errorMessage}
                    </p>
                    {task.retryCount < task.maxRetries && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-3 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => onRetry && onRetry(task.id)}
                      >
                        重试任务
                      </Button>
                    )}
                  </div>
                )}

                {/* 进度信息 */}
                {task.status === 'processing' && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-blue-700">
                        当前进度: {task.progress}%
                      </span>
                      <div className="flex-1 bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center space-x-2">
                  {task.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => console.log('View details:', task.id)}
                    >
                      查看详情
                    </Button>
                  )}
                  
                  {task.status === 'failed' && task.retryCount < task.maxRetries && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onRetry && onRetry(task.id)}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      重新处理
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => console.log('View history:', task.id)}
                  >
                    历史记录
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// 辅助函数：计算任务平均耗时
function calculateAverageTime(tasks: ProcessingTask[]): string {
  const completedTasks = tasks.filter(task => task.status === 'completed' && task.startedAt && task.completedAt);
  if (completedTasks.length === 0) return '0';
  
  const totalDuration = completedTasks.reduce((sum, task) => {
    const start = new Date(task.startedAt).getTime();
    const end = new Date(task.completedAt).getTime();
    return sum + (end - start);
  }, 0);
  
  return (totalDuration / completedTasks.length / 1000).toFixed(1);
}

// 辅助函数：计算持续时间
function calculateDuration(start: string, end: string): string {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const duration = endTime - startTime;
  
  if (duration < 60000) return `${Math.round(duration / 1000)}秒`;
  if (duration < 3600000) return `${Math.round(duration / 60000)}分`;
  return `${Math.round(duration / 3600000)}小时`;
}