'use client';

import { TaskProgressProps, ProcessingTask } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function TaskProgress({
  tasks,
  className = '',
}: TaskProgressProps) {
  const getStatusColor = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'retrying': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3l3-3V8H5z" />
        </svg>;
      case 'processing':
        return (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
        );
      case 'completed':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>;
      case 'failed':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>;
      case 'retrying':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 6.828M19 14a8 8 0 01-8 8H4" />
          </svg>
        );
      default:
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4m-1-4h-1m14 4h-1m-1-4h-1m-1 4H9" />
        </svg>;
    }
  };

  const getStatusText = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending': return '等待中';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'retrying': return '重试中';
      default: return '未知';
    }
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

  return (
    <div className={cn('space-y-6', className)}>
      {/* 任务标题和过滤器 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          任务进度监控
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">筛选状态:</span>
          <select 
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            onChange={(e) => console.log('Filter:', e.target.value)}
          >
            <option value="all">全部</option>
            <option value="processing">进行中</option>
            <option value="pending">等待中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <Card className="border-dashed border-gray-300">
            <CardContent className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7m2 5h9" />
              </svg>
              <p className="text-gray-500">
                暂无任务
              </p>
              <p className="text-sm text-gray-400 mt-2">
                系统会自动检测并处理RSS源，任务信息将在此显示
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card 
              key={task.id}
              className={cn(
                'transition-all duration-200 hover:shadow-lg',
                task.status === 'processing' ? 'ring-2 ring-blue-200' : ''
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 任务头部信息 */}
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl">{getTypeIcon(task.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                            {task.title}
                          </h3>
                          <Badge 
                            variant="outline"
                            className={cn(
                              'text-xs px-2 py-1',
                              getStatusColor(task.status)
                            )}
                          >
                            {getStatusText(task.status)}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {getTimeAgo(task.createdAt)}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        进度: {task.progress}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {task.retryCount > 0 ? `重试次数: ${task.retryCount}/${task.maxRetries}` : ''}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={cn(
                          'h-2 transition-all duration-300',
                          task.status === 'completed' ? 'bg-green-600' :
                          task.status === 'failed' ? 'bg-red-600' :
                          task.status === 'processing' ? 'bg-blue-600' :
                          'bg-blue-400'
                        )}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* 任务详情 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">类型</span>
                      <span className="font-medium">{getTypeText(task.type)}</span>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">状态</span>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(task.status)}
                        <span className="font-medium">{getStatusText(task.status)}</span>
                      </span>
                    </div>

                    {task.startedAt && (
                      <div>
                        <span className="text-gray-500">开始时间</span>
                        <span className="font-medium">
                          {new Date(task.startedAt).toLocaleTimeString('zh-CN', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    )}

                    {task.estimatedDuration && (
                      <div>
                        <span className="text-gray-500">预计用时</span>
                        <span className="font-medium">
                          {task.estimatedDuration > 60 
                            ? `${Math.floor(task.estimatedDuration / 60)} 分钟`
                            : `${task.estimatedDuration} 秒`
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 错误信息 */}
                  {task.errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9-9 0 00-18 0z" />
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-red-800 mb-1">
                            任务失败
                          </h4>
                          <p className="text-xs text-red-600">
                            {task.errorMessage}
                          </p>
                        </div>
                      </div>
                      {task.retryCount < task.maxRetries && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="mt-2 border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => console.log('Retry task:', task.id)}
                        >
                          重试任务
                        </Button>
                      )}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-2 mt-4">
                    {task.status === 'pending' && (
                      <Button 
                        size="sm"
                        onClick={() => console.log('Start task:', task.id)}
                      >
                        开始处理
                      </Button>
                    )}
                    
                    {task.status === 'processing' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => console.log('Pause task:', task.id)}
                      >
                        暂停
                      </Button>
                    )}

                    {task.status === 'completed' && task.resultData && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => console.log('View result:', task.id)}
                      >
                        查看结果
                      </Button>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => console.log('View history:', task.id)}
                    >
                      查看历史
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
}