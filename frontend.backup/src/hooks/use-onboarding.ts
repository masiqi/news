'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseOnboardingReturn } from '@/types/onboarding';

export function useOnboarding() {
  const [status, setStatus] = useState<any>(null);
  const [progress, setProgress] = useState({ currentStep: 0, totalSteps: 4, stepName: 'not_started', progress: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOnboardingStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        if (data.status) {
          setProgress({
            currentStep: data.status.currentStep,
            totalSteps: data.status.totalSteps,
            stepName: getStepName(data.status.step),
            progress: calculateProgress(data.status),
          });
        }
      } else if (data.needsOnboarding) {
        // 如果没有状态记录但需要引导，初始化状态
        const initResponse = await fetch('/api/onboarding/initialize');
        const initData = await initResponse.json();
        setStatus(initData.status);
        setProgress({
          currentStep: initData.status.currentStep,
          totalSteps: initData.status.totalSteps,
          stepName: getStepName(initData.status.step),
          progress: calculateProgress(initData.status),
        });
      }
      setError('');
    } catch (err) {
      console.error('获取引导状态失败:', err);
      setError('获取引导状态失败');
      setProgress({ currentStep: 0, totalSteps: 4, stepName: 'not_started', progress: 0 });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStep = useCallback(async (step: string, data?: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step, data }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
        setProgress({
          currentStep: result.status.currentStep,
          totalSteps: result.status.totalSteps,
          stepName: getStepName(result.status.step),
          progress: calculateProgress(result.status),
        });
      }
      setError('');
    } catch (err) {
      console.error('更新引导状态失败:', err);
      setError('更新引导状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/complete');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
        setProgress({
          currentStep: result.status.currentStep,
          totalSteps: result.status.totalSteps,
          stepName: getStepName(result.status.step),
          progress: calculateProgress(result.status),
        });
      }
      setError('');
    } catch (err) {
      console.error('完成引导流程失败:', err);
      setError('完成引导流程失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const skipOnboarding = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/skip');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
        setProgress({
          currentStep: result.status.currentStep,
          totalSteps: result.status.totalSteps,
          stepName: getStepName(result.status.step),
          progress: calculateProgress(result.status),
        });
      }
      setError('');
    } catch (err) {
      console.error('跳过引导流程失败:', err);
      setError('跳过引导流程失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnboardingStatus();
  }, []);

  return {
    status,
    progress,
    loading,
    error,
    updateStep,
    completeOnboarding,
    skipOnboarding,
  };
}

function getStepName(step: string): string {
  const stepNames: Record<string, string> = {
    'welcome': '欢迎',
    'interests': '兴趣选择',
    'recommendations': '推荐源',
    'confirmation': '确认选择',
    'completed': '已完成',
    'skipped': '已跳过',
  };
  return stepNames[step] || step;
}

function calculateProgress(status: any): number {
  if (['completed', 'skipped'].includes(status.step)) {
    return 100;
  }
  return Math.round(((status.currentStep - 1) / (status.totalSteps - 1)) * 100);
}