'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseNotificationSettingsReturn, NotificationSettings } from '@/types/dashboard';

export function useNotificationSettings(): UseNotificationSettingsReturn {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setError(null);
      } else {
        setError(data.error || '获取通知设置失败');
        setSettings(null);
      }
    } catch (err) {
      console.error('获取通知设置失败:', err);
      setError('获取通知设置失败');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setError(null);
      } else {
        setError(data.error || '更新通知设置失败');
      }
    } catch (err) {
      console.error('更新通知设置失败:', err);
      setError('更新通知设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取通知设置
  useEffect(() => {
    refresh();
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refresh,
  };
}