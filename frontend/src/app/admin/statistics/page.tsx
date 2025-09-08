'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface OverviewStatistics {
  sources: {
    total: number;
    recommended: number;
    recentGrowth: number;
  };
  categories: {
    total: number;
    active: any[];
  };
  tags: {
    total: number;
    popular: any[];
  };
  quality: {
    distribution: any[];
    averageScore: number;
    recentValidations: number;
  };
  levels: {
    distribution: any[];
    totalSubscribers: number;
  };
}

export default function AdminStatisticsPage() {
  const [overview, setOverview] = useState<OverviewStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : '';

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      const response = await fetch('/admin/statistics/overview', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const data = await response.json();
      setOverview(data.overview);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setError('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">统计分析</h1>
          <p className="text-gray-600">查看推荐源的使用情况和质量分析数据</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {overview && (
          <>
            {/* 核心统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m14 0v0a0 0 00-2-2H5a0 0 00-2 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.sources.recommended}
                    </div>
                    <div className="text-sm text-gray-600">推荐源</div>
                    <div className="text-xs text-green-600">
                      +{overview.sources.recentGrowth} 本月新增
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.categories.total}
                    </div>
                    <div className="text-sm text-gray-600">分类</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 00-1-2zm2 6a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.tags.total}
                    </div>
                    <div className="text-sm text-gray-600">标签</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.levels.totalSubscribers.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">总订阅数</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 质量分析 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">质量分布</h3>
                <div className="space-y-3">
                  {overview.quality.distribution.map((item: any) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.status === 'passed' ? 'bg-green-100 text-green-800' :
                          item.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status === 'passed' && '通过'}
                          {item.status === 'failed' && '失败'}
                          {item.status === 'warning' && '警告'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {item.status === 'passed' && '质量达标'}
                          {item.status === 'failed' && '质量不达标'}
                          {item.status === 'warning' && '需改进'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">平均质量评分</span>
                    <span className={`text-lg font-bold ${
                      overview.quality.averageScore >= 80 ? 'text-green-600' :
                      overview.quality.averageScore >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {overview.quality.averageScore}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">推荐级别分布</h3>
                <div className="space-y-3">
                  {overview.levels.distribution.map((item: any) => (
                    <div key={item.level} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.level === 'featured' ? 'bg-purple-100 text-purple-800' :
                          item.level === 'premium' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.level === 'featured' && '精选'}
                          {item.level === 'premium' && '高级'}
                          {item.level === 'basic' && '基础'}
                        </span>
                        <span className="text-sm text-gray-600">推荐源</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 热门分类和标签 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">活跃分类</h3>
                <div className="space-y-3">
                  {overview.categories.active.slice(0, 5).map((category: any) => (
                    <div key={category.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {category.icon ? (
                          <span className="text-lg">{category.icon}</span>
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-sm text-gray-600">
                              {category.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {category.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {category.sourceCount} 个源
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">热门标签</h3>
                <div className="space-y-3">
                  {overview.tags.popular.slice(0, 5).map((tag: any) => (
                    <div key={tag.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {tag.color && (
                          <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.color }}
                          ></span>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {tag.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {tag.usageCount} 次使用
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 最近活动 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {overview.quality.recentValidations}
                  </div>
                  <div className="text-sm text-gray-600">最近7天验证</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {overview.sources.recentGrowth}
                  </div>
                  <div className="text-sm text-gray-600">本月新增</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Date().toLocaleDateString('zh-CN')}
                  </div>
                  <div className="text-sm text-gray-600">数据更新</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}