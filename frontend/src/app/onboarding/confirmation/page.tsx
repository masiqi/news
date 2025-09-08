'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationPageProps } from '@/types/onboarding';
import SourcePreview from '@/components/onboarding/SourcePreview';
import ProgressIndicator from '@/components/onboarding/ProgressIndicator';

export default function ConfirmationPage({ 
  sources, 
  selectedSources: initialSelectedSources = [], 
  onSelectionChange,
  onConfirm,
  onBack,
  onSkip 
}: ConfirmationPageProps) {
  const router = useRouter();
  const [selectedSources, setSelectedSources] = useState<string[]>(initialSelectedSources);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedSources(initialSelectedSources);
  }, [initialSelectedSources]);

  const handleConfirm = async () => {
    if (selectedSources.length === 0) {
      setError('请至少选择一个推荐源');
      return;
    }

    setLoading(true);
    try {
      // 这里应该调用API确认用户选择的源
      const mockResult = {
        success: true,
        importedCount: selectedSources.length,
      };

      // const result = await api.confirmSources(selectedSources);
      
      if (mockResult.success) {
        onConfirm(selectedSources);
        router.push('/dashboard'); // 或其他目标页面
      } else {
        setError('确认失败，请重试');
      }
    } catch (error) {
      console.error('确认推荐源失败:', error);
      setError('确认失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      // 这里应该调用API跳过引导流程
      // const result = await api.skipOnboarding();
      
      onSkip();
      router.push('/dashboard'); // 或其他目标页面
    } catch (error) {
      console.error('跳过引导失败:', error);
      setError('跳过失败，请重试');
    }
  };

  const selectedCount = selectedSources.length;
  const maxSelections = 20; // 可以动态获取限制

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 进度指示器 */}
        <ProgressIndicator
          currentStep={4}
          totalSteps={4}
          progress={Math.round(((4 - 1) / (4 - 1)) * 100)}
        />

        {/* 确认页面内容 */}
        <div className="space-y-6">
          {/* 标题和说明 */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              确认您选择的新闻源
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              我们将为您订阅选中的 {selectedCount} 个推荐源，确保您获得最新的新闻内容。
              您也可以稍后在设置中管理您的订阅源。
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v3m0 0h.01M12 21h.01" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    订阅即将开始
                  </p>
                  <p className="text-xs text-blue-600">
                    系统将自动同步您选择的RSS源
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 推荐源预览 */}
          <SourcePreview
            sources={sources}
            selectedSources={selectedSources}
            onSelectionChange={handleSelectionChange}
            maxSelections={maxSelections}
          />

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 0h.01M12 15h.01" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* 统计信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {selectedCount}
              </div>
              <div className="text-sm text-gray-600">
                已选择源
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {sources.filter(s => s.qualityAvailability >= 80 && s.qualityContentQuality >= 80).length}
              </div>
              <div className="text-sm text-gray-600">
                高质量源
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {sources.filter(s => s.recommendationLevel === 'featured').length}
              </div>
              <div className="text-sm text-gray-600">
                精选推荐
              </div>
            </div>
          </div>

          {/* 附加说明 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              接下来会发生什么？
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>系统将在几分钟内开始同步您选择的RSS源</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>我们智能优化内容更新频率，避免重复信息</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>您可以随时在设置中添加更多RSS源或调整兴趣偏好</span>
              </li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                返回修改
              </button>
            )}
            
            <button
              onClick={handleSkip}
              disabled={loading}
              className="flex-1 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              跳过设置
            </button>
            
            <button
              onClick={handleConfirm}
              disabled={loading || selectedSources.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 border-2 border-white border-t-transparent" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  </svg>
                  <span>正在确认...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>确认订阅</span>
                </>
              )}
            </button>
          </div>

          {/* 底部提示 */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">
              确认后，您的个性化新闻体验将立即生效 • 
              <span className="text-blue-600 font-medium">预计耗时 1-2 分钟</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}