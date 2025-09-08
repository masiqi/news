'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InterestsPageProps, UseInterestsReturn } from '@/types/onboarding';
import InterestSelector from '@/components/onboarding/InterestSelector';
import ProgressIndicator from '@/components/onboarding/ProgressIndicator';

export default function InterestsPage({ onComplete, onBack }: InterestsPageProps) {
  const router = useRouter();
  const [interests, setInterests] = useState<Array<{ categoryId: string; level: 'low' | 'medium' | 'high' }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mock data - 在实际实现中应该从API获取
  const mockCategories = [
    { id: 'tech', name: '科技', description: '最新科技新闻和趋势', icon: '💻', color: '#3B82F6' },
    { id: 'ai', name: '人工智能', description: 'AI发展和应用', icon: '🤖', color: '#8B5CF6' },
    { id: 'finance', name: '财经', description: '金融市场和投资', icon: '💰', color: '#10B981' },
    { id: 'business', name: '商业', description: '商业新闻和分析', icon: '💼', color: '#F59E0B' },
    { id: 'sports', name: '体育', description: '体育赛事和新闻', icon: '⚽', color: '#EF4444' },
    { id: 'entertainment', name: '娱乐', description: '娱乐新闻和八卦', icon: '🎬', color: '#F97316' },
    { id: 'health', name: '健康', description: '健康生活和医疗', icon: '🏥', color: '#10B981' },
    { id: 'education', name: '教育', description: '教育资源和资讯', icon: '📚', color: '#6366F1' },
    { id: 'science', name: '科学', description: '科学发现和突破', icon: '🔬', color: '#059669' },
  ];

  useEffect(() => {
    // 这里应该从API获取用户的当前兴趣
    // const userInterests = await api.getUserInterests();
    // setInterests(userInterests);
  }, []);

  const handleSelectionChange = (newInterests: Array<{ categoryId: string; level: 'low' | 'medium' | 'high' }>) => {
    setInterests(newInterests);
    setError('');
  };

  const handleContinue = async () => {
    if (interests.length === 0) {
      setError('请至少选择一个兴趣领域');
      return;
    }

    setLoading(true);
    try {
      // 这里应该调用API保存用户兴趣
      // await api.saveUserInterests(interests);
      onComplete(interests);
      router.push('/onboarding/recommendations');
    } catch (error) {
      console.error('保存用户兴趣失败:', error);
      setError('保存失败，请重试');
      setLoading(false);
    }
  };

  const selectedCount = interests.length;
  const maxSelections = 10; // 可以动态获取

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 进度指示器 */}
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          progress={Math.round(((2 - 1) / (4 - 1)) * 100)}
        />

        {/* 兴趣选择器 */}
        <InterestSelector
          categories={mockCategories}
          selectedInterests={interests.map(i => i.categoryId)}
          onSelectionChange={handleSelectionChange}
          onContinue={handleContinue}
          onBack={onBack}
        />

        {/* 错误提示 */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 0h.01M12 15h.01" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* 底部统计 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            已选择 {selectedCount} / {maxSelections} 个兴趣 • 
            {selectedCount === 0 && '至少需要选择 1 个'}
            {selectedCount >= maxSelections && `最多选择 ${maxSelections} 个`}
          </p>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-gray-600">正在保存您的兴趣偏好...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}