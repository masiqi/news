'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseStatisticsReturn, ExtendedUserStatistics } from '@/types/dashboard';

export function useStatistics(period: 'today' | 'week' | 'month' = 'today'): UseStatisticsReturn {
  const [statistics, setStatistics] = useState<ExtendedUserStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (newPeriod?: 'today' | 'week' | 'month') => {
    const actualPeriod = newPeriod || period;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/statistics/extended?period=${actualPeriod}`);
      const data = await response.json();
      
      if (data.success) {
        setStatistics(data.statistics);
        setError(null);
      } else {
        setError(data.error || '获取统计数据失败');
        setStatistics(null);
      }
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('获取统计数据失败');
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // 初始化时获取统计数据
  useEffect(() => {
    refresh();
    
    // 每5分钟自动刷新统计数据
    const interval = setInterval(refresh, 300000); // 5分钟
    
    return () => {
      clearInterval(interval);
    };
  }, [period, refresh]);

  return {
    statistics,
    loading,
    error,
    refresh,
  };
}