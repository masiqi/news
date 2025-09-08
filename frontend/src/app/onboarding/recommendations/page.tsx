'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RecommendationsPageProps, UseRecommendationsReturn } from '@/types/onboarding';
import SourcePreview from '@/components/onboarding/SourcePreview';
import ProgressIndicator from '@/components/onboarding/ProgressIndicator';

export default function RecommendationsPage({ interests, onComplete, onBack }: RecommendationsPageProps) {
  const router = useRouter();
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, [interests]);

  const fetchRecommendations = async () => {
    if (interests.length === 0) {
      setSources([]);
      setLoading(false);
      return;
    }

    try {
      // 这里应该调用API获取推荐源
      // Mock data - 在实际实现中应该从API获取
      const mockSources = [
        {
          id: '1',
          name: 'TechCrunch',
          url: 'https://feeds.feedburner.com/techcrunch',
          description: '最新的科技新闻、产品评测和行业趋势',
          icon: '💻',
          recommendationLevel: 'featured',
          qualityAvailability: 95,
          qualityContentQuality: 88,
          qualityUpdateFrequency: 92,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'tech', name: '科技', icon: '💻', color: '#3B82F6' }
          ],
          matchScore: 85,
          relevanceScore: 78,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'AI News',
          url: 'https://artificialintelligence-news.com/feed',
          description: '人工智能领域的最新突破、应用和讨论',
          icon: '🤖',
          recommendationLevel: 'premium',
          qualityAvailability: 87,
          qualityContentQuality: 91,
          qualityUpdateFrequency: 85,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'ai', name: '人工智能', icon: '🤖', color: '#8B5CF6' }
          ],
          matchScore: 82,
          relevanceScore: 90,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Financial Times',
          url: 'https://www.ft.com/rss/homepage',
          description: '全球金融市场、投资策略和经济新闻',
          icon: '💰',
          recommendationLevel: 'featured',
          qualityAvailability: 93,
          qualityContentQuality: 89,
          qualityUpdateFrequency: 90,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'finance', name: '财经', icon: '💰', color: '#10B981' }
          ],
          matchScore: 88,
          relevanceScore: 75,
          createdAt: new Date().toISOString(),
        },
        {
          id: '4',
          name: 'Sports Illustrated',
          url: 'https://rss.si.com/si_articles.rss',
          description: '体育新闻、赛事分析 and 运动员故事',
          icon: '⚽',
          recommendationLevel: 'basic',
          qualityAvailability: 78,
          qualityContentQuality: 76,
          qualityUpdateFrequency: 82,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'sports', name: '体育', icon: '⚽', color: '#EF4444' }
          ],
          matchScore: 72,
          relevanceScore: 80,
          createdAt: new Date().toISOString(),
        },
        {
          id: '5',
          name: 'Healthline',
          url: 'https://www.health.com/syndication/news',
          description: '健康生活、医疗突破和保健知识',
          icon: '🏥',
          recommendationLevel: 'premium',
          qualityAvailability: 90,
          qualityContentQuality: 85,
          qualityUpdateFrequency: 88,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'health', name: '健康', icon: '🏥', color: '#10B981' }
          ],
          matchScore: 79,
          relevanceScore: 73,
          createdAt: new Date().toISOString(),
        },
        {
          id: '6',
          name: 'MIT Technology Review',
          url: 'https://feeds.feedburner.com/mit-technology',
          description: 'MIT科技新闻、研究和创新成果',
          icon: '🎓',
          recommendationLevel: 'featured',
          qualityAvailability: 91,
          qualityContentQuality: 87,
          qualityUpdateFrequency: 89,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'education', name: '教育', icon: '🎓', color: '#6366F1' },
            { id: 'science', name: '科学', icon: '🔬', color: '#059669' }
          ],
          matchScore: 84,
          relevanceScore: 76,
          createdAt: new Date().toISOString(),
        },
        {
          id: '7',
          name: 'Entertainment Weekly',
          url: 'https://www.entertainmentweekly.com/rss',
          description: '娱乐新闻、明星八卦和文化动态',
          icon: '🎬',
          recommendationLevel: 'basic',
          qualityAvailability: 72,
          qualityContentQuality: 71,
          qualityUpdateFrequency: 75,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'entertainment', name: '娱乐', icon: '🎬', color: '#F97316' }
          ],
          matchScore: 68,
          relevanceScore: 82,
          createdAt: new Date().toISOString(),
        },
        {
          id: '8',
          name: 'Business Insider',
          url: 'https://feeds.feedburner.com/businessinsider',
          description: '商业新闻、市场分析和投资建议',
          icon: '💼',
          recommendationLevel: 'premium',
          qualityAvailability: 86,
          qualityContentQuality: 83,
          qualityUpdateFrequency: 87,
          qualityValidationStatus: 'approved',
          isRecommended: true,
          categories: [
            { id: 'business', name: '商业', icon: '💼', color: '#F59E0B' }
          ],
          matchScore: 81,
          relevanceScore: 78,
          createdAt: new Date().toISOString(),
        },
      ];

      // 根据用户兴趣过滤推荐源
      const userCategoryIds = interests.map(i => i.categoryId);
      const filteredSources = mockSources.filter(source => 
        source.categories.some(cat => userCategoryIds.includes(cat.id))
      );

      setSources(filteredSources);
      setLoading(false);
    } catch (error) {
      console.error('获取推荐源失败:', error);
      setError('获取推荐源失败');
      setLoading(false);
    }
  };

  const handleSelectionChange = (newSelectedSources: string[]) => {
    setSelectedSources(newSelectedSources);
    setError('');
  };

  const handleConfirm = async () => {
    if (selectedSources.length === 0) {
      setError('请至少选择一个推荐源');
      return;
    }

    try {
      // 这里应该调用API确认用户选择的源
      const mockResult = {
        success: true,
        importedCount: selectedSources.length,
      };

      // await api.confirmSources(selectedSources);
      
      if (mockResult.success) {
        onComplete(selectedSources);
        router.push('/dashboard'); // 或其他目标页面
      }
    } catch (error) {
      console.error('确认推荐源失败:', error);
      setError('确认失败，请重试');
    }
  };

  const selectedCount = selectedSources.length;
  const maxSelections = 10; // 可以动态获取限制

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">正在为您推荐RSS源...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 进度指示器 */}
        <ProgressIndicator
          currentStep={3}
          totalSteps={4}
          progress={Math.round(((3 - 1) / (4 - 1)) * 100)}
        />

        {/* 推荐源预览 */}
        <SourcePreview
          sources={sources}
          selectedSources={selectedSources}
          onSelectionChange={handleSelectionChange}
          onConfirm={handleConfirm}
          onBack={onBack}
          maxSelections={maxSelections}
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
            基于您的 {interests.length} 个兴趣 • 
            {sources.length} 个推荐源 • 
            已选择 {selectedCount} / {maxSelections} 个
          </p>
        </div>
      </div>
    </div>
  );
}