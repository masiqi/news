'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseInterestsReturn } from '@/types/onboarding';

export function useInterests() {
  const [interests, setInterests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchInterests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/interests');
      const data = await response.json();
      
      if (data.success) {
        setInterests(data.interests);
      } else {
        setError(data.error || '获取用户兴趣失败');
      }
    } catch (err) {
      console.error('获取用户兴趣失败:', err);
      setError('获取用户兴趣失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveInterests = useCallback(async (newInterests: Array<{ categoryId: string; level: 'low' | 'medium' | 'high' }>) => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interests: newInterests }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setInterests(prev => [
          ...prev.map(interest => ({
            ...interest,
            isActive: false,
          })),
          ...newInterests.map((newInterest, index) => ({
            id: `new-${index}`,
            userId: 'current-user-id', // 应该从context获取
            categoryId: parseInt(newInterest.categoryId),
            level: newInterest.level,
            priority: newInterest.level === 'high' ? 8 : newInterest.level === 'medium' ? 5 : 3,
            selectedAt: new Date().toISOString(),
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        ]);
        setError('');
      } else {
        setError(result.error || '保存用户兴趣失败');
      }
    } catch (err) {
      console.error('保存用户兴趣失败:', err);
      setError('保存用户兴趣失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInterest = useCallback(async (interestId: string, level: 'low' | 'medium' | 'high') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/interests/${interestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ level }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchInterests(); // 重新获取最新数据
        setError('');
      } else {
        setError(result.error || '更新用户兴趣失败');
      }
    } catch (err) {
      console.error('更新用户兴趣失败:', err);
      setError('更新用户兴趣失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteInterest = useCallback(async (interestId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/interests/${interestId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchInterests(); // 重新获取最新数据
        setError('');
      } else {
        setError(result.error || '删除用户兴趣失败');
      }
    } catch (err) {
      console.error('删除用户兴趣失败:', err);
      setError('删除用户兴趣失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, []);

  return {
    interests,
    loading,
    error,
    saveInterests,
    updateInterest,
    deleteInterest,
  };
}