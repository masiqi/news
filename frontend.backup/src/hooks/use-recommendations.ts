'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseRecommendationsReturn } from '@/types/onboarding';

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getRecommendations = useCallback(async (interests: Array<{ categoryId: string; level: 'low' | 'medium' | 'high' }>) => {
    if (interests.length === 0) {
      setRecommendations([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interests }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        setError('');
      } else {
        setError(data.error || '获取推荐失败');
      }
    } catch (err) {
      console.error('获取推荐失败:', err);
      setError('获取推荐失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmSources = useCallback(async (sourceIds: string[]) => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/confirm-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceIds }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setError('');
        return result;
      } else {
        setError(result.error || '确认推荐源失败');
        return { success: false, importedCount: 0 };
      }
    } catch (err) {
      console.error('确认推荐源失败:', err);
      setError('确认推荐源失败');
      return { success: false, importedCount: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 初始化时可以获取一些热门推荐作为默认值
    getRecommendations([
      { categoryId: '1', level: 'high' }, // 科技
      { categoryId: '2', level: 'medium' }, // AI
    ]);
  }, []);

  return {
    recommendations,
    loading,
    error,
    getRecommendations,
    confirmSources,
  };
}