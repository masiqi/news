'use client';

import { NotificationCenterProps, NotificationRecord } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function NotificationCenter({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onSettings,
  className = '',
}: NotificationCenterProps) {
  const getNotificationIcon = (type: NotificationRecord['type']) => {
    switch (type) {
      case 'task_completed':
        return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9-9 0 00-18 0" />
        </svg>;
      case 'task_failed':
        return <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>;
      case 'error':
        return <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9-9 0 00-18 0z" />
        </svg>;
      default:
        return <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4m-1-4h-1m14 4h-1m-1-4h-1" />
        </svg>;
    }
  };

  const getNotificationColor = (type: NotificationRecord['type']) => {
    switch (type) {
      case 'task_completed': return 'border-green-200 bg-green-50';
      case 'task_failed': return 'border-red-200 bg-red-50';
      case 'error': return 'border-orange-200 bg-orange-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const getTypeText = (type: NotificationRecord['type']) => {
    switch (type) {
      case 'task_completed': return '任务完成';
      case 'task_failed': return '任务失败';
      case 'error': return '系统错误';
      case 'system': return '系统通知';
      default: return '通知';
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

  const todayNotifications = notifications.filter(n => {
    const notificationDate = new Date(n.createdAt);
    const today = new Date();
    return (
      notificationDate.getDate() === today.getDate() &&
      notificationDate.getMonth() === today.getMonth() &&
      notificationDate.getFullYear() === today.getFullYear()
    );
  });

  const earlierNotifications = notifications.filter(n => {
    const notificationDate = new Date(n.createdAt);
    const today = new Date();
    return !(
      notificationDate.getDate() === today.getDate() &&
      notificationDate.getMonth() === today.getMonth() &&
      notificationDate.getFullYear() === today.getFullYear()
    );
  });

  return (
    <div className={cn('space-y-6', className)}>
      {/* 通知中心头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold text-gray-900">
            通知中心
          </h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="bg-red-100 text-red-800 px-3 py-1">
              {unreadCount} 个未读
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSettings}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 2.924.426 2.924 2.924 2.924zM17.25 10h3.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-3.5a.75.75 0 01-.75-.75v-1.5z" />
            </svg>
            通知设置
          </Button>
          
          {unreadCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={onMarkAllRead}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              全部标记已读
            </Button>
          )}
        </div>
      </div>

      {/* 通知分类标签 */}
      <div className="flex space-x-2 mb-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium">
          全部 ({notifications.length})
        </button>
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          今天 ({todayNotifications.length})
        </button>
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          更早 ({earlierNotifications.length})
        </button>
      </div>

      {/* 通知列表 */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="border-dashed border-gray-300">
            <CardContent className="py-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7m2 5h9" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无通知
              </h3>
              <p className="text-gray-500">
                当有新的任务完成或系统状态更新时，通知将在此显示
              </p>
              <div className="mt-4 flex space-x-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 6.828M19 14a8 8 0 01-8 8H4" />
                  </svg>
                  刷新页面
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSettings}
                >
                  检查设置
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'transition-all duration-200 hover:shadow-lg',
                getNotificationColor(notification.type),
                notification.isRead ? 'opacity-60' : ''
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 通知头部 */}
                    <div className="flex items-start space-x-3 mb-2">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                          {notification.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {getTypeText(notification.type)}
                          </Badge>
                          {notification.isRead ? (
                            <Badge variant="secondary" className="text-xs">
                              已读
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              未读
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {getTimeAgo(notification.createdAt)}
                    </span>
                  </div>

                  {/* 操作按钮 */}
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkRead && onMarkRead(notification.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9-9 0 00-18 0" />
                      </svg>
                    </Button>
                  )}
                </div>

                {/* 通知内容 */}
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {notification.message}
                </p>

                {/* 附加数据 */}
                {notification.data && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="space-y-2">
                      {Object.entries(notification.data).map(([key, value]) => (
                        <div key={key} className="flex items-start space-x-3">
                          <span className="text-xs font-medium text-gray-700 min-w-0">
                            {key}:
                          </span>
                          <span className="text-sm text-gray-900 flex-1 break-words">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 底部操作 */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>发送时间: {new Date(notification.createdAt).toLocaleString('zh-CN')}</span>
                    <span>发送方式: {notification.sentVia === 'realtime' ? '实时通知' : '邮件通知'}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete && onDelete(notification.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 01-2.828 0L10 14a2 2 0 01-2.828 0l-5.319-12.142A2 2 0 00-2.828-2z" />
                      </svg>
                      删除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 底部操作 */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            显示 {notifications.length} 条通知，{unreadCount} 条未读
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 6.828M19 14a8 8 0 01-8 8H4" />
            </svg>
            刷新列表
          </Button>
        </div>
      )}
    </div>
  );
}