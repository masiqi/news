'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseStatusReturn, UserStatus } from '@/types/dashboard';

export function useStatus(): UseStatusReturn {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/status/current');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        setError(null);
      } else {
        setError(data.error || '获取状态失败');
        setStatus(null);
      }
    } catch (err) {
      console.error('获取状态失败:', err);
      setError('获取状态失败');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取状态
  useEffect(() => {
    refresh();
    
    // 设置WebSocket连接用于实时更新
    const setupWebSocket = () => {
      try {
        // 这里简化实现，实际中应该使用WebSocket或Server-Sent Events
        // const ws = new WebSocket('ws://localhost:3000/ws/status');
        // ws.onmessage = (event) => {
        //   const eventData = JSON.parse(event.data);
        //   if (eventData.type === 'status_update') {
        //     setStatus(prev => {
        //       ...prev,
        //       tasks: eventData.tasks || prev?.tasks || [],
        //       statistics: eventData.statistics || prev?.statistics || {},
        //     });
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

    // 每30秒刷新一次状态
    const interval = setInterval(refresh, 30000);
    
    return () => {
      clearInterval(interval);
      // if (ws) ws.close();
    };
  }, []);

  return {
    status,
    loading,
    error,
    refresh,
  };
}