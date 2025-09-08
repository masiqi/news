'use client';

import { ProgressIndicatorProps } from '@/types/onboarding';
import { cn } from '@/lib/utils';

export default function ProgressIndicator({
  currentStep,
  totalSteps,
  progress,
}: ProgressIndicatorProps) {
  const steps = [
    { id: 'welcome', name: '欢迎', description: '开始个性化新闻体验' },
    { id: 'interests', name: '兴趣选择', description: '选择您感兴趣的新闻领域' },
    { id: 'recommendations', name: '推荐源', description: '查看为您推荐的RSS源' },
    { id: 'confirmation', name: '确认选择', description: '确认您选择的新闻源' },
  ];

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex(step => step.id === stepId) + 1;
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* 总进度条 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            个性化设置
          </h2>
          <span className="text-sm text-gray-600">
            {currentStep} / {totalSteps}
          </span>
        </div>
        
        <div className="relative">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-between px-4">
            <span className="text-xs text-white font-medium">
              {progress}%
            </span>
            <span className="text-xs text-white font-medium">
              完成
            </span>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="grid grid-cols-4 gap-4">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const stepNumber = index + 1;
          
          return (
            <div 
              key={step.id}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-lg border transition-all duration-200",
                status === 'current' && "bg-blue-50 border-blue-200 shadow-sm",
                status === 'completed' && "bg-green-50 border-green-200",
                status === 'upcoming' && "bg-gray-50 border-gray-200"
              )}
            >
              {/* 步骤图标 */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium mb-2",
                status === 'current' && "bg-blue-600 text-white",
                status === 'completed' && "bg-green-600 text-white",
                status === 'upcoming' && "bg-gray-300 text-gray-700"
              )}>
                {status === 'completed' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{stepNumber}</span>
                )}
              </div>

              {/* 步骤状态标记 */}
              {status === 'current' && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                </div>
              )}

              {/* 步骤信息 */}
              <div className="text-center">
                <h3 className={cn(
                  "text-sm font-medium mb-1",
                  status === 'current' && "text-blue-900",
                  status === 'completed' && "text-green-900",
                  status === 'upcoming' && "text-gray-700"
                )}>
                  {step.name}
                </h3>
                <p className={cn(
                  "text-xs",
                  status === 'current' && "text-blue-600",
                  status === 'completed' && "text-green-600",
                  status === 'upcoming' && "text-gray-500"
                )}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}