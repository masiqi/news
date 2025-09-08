'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseNotificationsReturn, NotificationRecord, NotificationSettings } from '@/types/dashboard';

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications');
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
        setError(null);
      } else {
        setError(data.error || '获取通知失败');
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('获取通知失败:', err);
      setError('获取通知失败');
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, isRead: true } 
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('标记通知已读失败:', data.error);
      }
    } catch (err) {
      console.error('标记通知已读失败:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
      } else {
        console.error('批量标记已读失败:', data.error);
      }
    } catch (err) {
      console.error('批量标记已读失败:', err);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        const deletedNotification = notifications.find(n => n.id === notificationId);
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        console.error('删除通知失败:', data.error);
      }
    } catch (err) {
      console.error('删除通知失败:', err);
    }
  }, [notifications]);

  // 初始化时获取通知
  useEffect(() => {
    refresh();
    
    // 每30秒刷新一次通知列表
    const interval = setInterval(refresh, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // 设置WebSocket连接用于实时通知
  useEffect(() => {
    const setupWebSocket = () => {
      try {
        // 这里简化实现，实际中应该使用WebSocket
        // const ws = new WebSocket('ws://localhost:3000/ws/notifications');
        // ws.onmessage = (event) => {
        //   const eventData = JSON.parse(event.data);
        //   if (eventData.type === 'notification_created') {
        //     setNotifications(prev => [eventData.data.notification, ...prev]);
        //     setUnreadCount(prev => prev + 1);
        //   }
        // };
        // ws.onclose = () => {
        //   setTimeout(setupWebSocket, 5000); // 5秒后重连
        // };
      } catch (err) {
        console.warn('WebSocket连接失败，使用轮询方式:', err);
      }
    };

    setupWebSocket();

    return () => {
      // if (ws) ws.close();
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}