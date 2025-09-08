'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { RecommendedSource, SourceCategory, SourceTag } from '@/types/admin';

export default function AdminRecommendedSourcesPage() {
  const [sources, setSources] = useState<RecommendedSource[]>([]);
  const [categories, setCategories] = useState<SourceCategory[]>([]);
  const [tags, setTags] = useState<SourceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    recommendationLevel: '',
    validationStatus: '',
    page: 1,
    limit: 20,
  });
  const [total, setTotal] = useState(0);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : '';

  useEffect(() => {
    fetchSources();
    fetchCategories();
    fetchTags();
  }, [filters]);

  const fetchSources = async () => {
    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
      });

      if (filters.search) params.append('searchQuery', filters.search);
      if (filters.recommendationLevel) params.append('recommendationLevel', filters.recommendationLevel);
      if (filters.validationStatus) params.append('validationStatus', filters.validationStatus);

      const response = await fetch(`/admin/recommended-sources?${params}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取推荐源失败');
      }

      const data = await response.json();
      setSources(data.sources);
      setTotal(data.total);
    } catch (error) {
      console.error('获取推荐源失败:', error);
      setError('获取推荐源失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/admin/categories', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/admin/tags', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.error('获取标签失败:', error);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!confirm('确定要删除这个推荐源吗？')) {
      return;
    }

    try {
      const response = await fetch(`/admin/recommended-sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      fetchSources(); // 重新获取列表
    } catch (error) {
      console.error('删除推荐源失败:', error);
      alert('删除失败');
    }
  };

  const handleToggleRecommendation = async (sourceId: number, isRecommended: boolean) => {
    try {
      const response = await fetch(`/admin/recommended-sources/${sourceId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isRecommended }),
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      fetchSources(); // 重新获取列表
    } catch (error) {
      console.error('切换推荐状态失败:', error);
      alert('更新失败');
    }
  };

  const handleValidateSource = async (sourceId: number) => {
    try {
      const response = await fetch(`/admin/recommended-sources/${sourceId}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('验证失败');
      }

      alert('验证完成');
      fetchSources(); // 重新获取列表
    } catch (error) {
      console.error('验证推荐源失败:', error);
      alert('验证失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'featured': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'basic': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.ceil(total / filters.limit);

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
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">推荐源管理</h1>
            <p className="text-gray-600">管理平台的RSS推荐源，进行质量评估和分类标签</p>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            添加推荐源
          </button>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-blue-600">{total}</div>
            <div className="text-sm text-gray-600">总推荐源</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-green-600">
              {sources.filter(s => s.qualityValidationStatus === 'approved').length}
            </div>
            <div className="text-sm text-gray-600">已验证</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-yellow-600">
              {sources.filter(s => s.qualityValidationStatus === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">待验证</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-purple-600">
              {sources.reduce((sum, s) => sum + s.statisticsTotalSubscribers, 0)}
            </div>
            <div className="text-sm text-gray-600">总订阅数</div>
          </div>
        </div>

        {/* 过滤器 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <input
                type="text"
                placeholder="搜索推荐源..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.recommendationLevel}
                onChange={(e) => setFilters({ ...filters, recommendationLevel: e.target.value, page: 1 })}
              >
                <option value="">所有级别</option>
                <option value="basic">基础</option>
                <option value="premium">高级</option>
                <option value="featured">精选</option>
              </select>
            </div>
            <div>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.validationStatus}
                onChange={(e) => setFilters({ ...filters, validationStatus: e.target.value, page: 1 })}
              >
                <option value="">所有状态</option>
                <option value="pending">待验证</option>
                <option value="approved">已批准</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
            <div>
              <button className="w-full bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700">
                批量操作
              </button>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 推荐源列表 */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  推荐源
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  级别
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  质量评分
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  订阅数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedSources.includes(source.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSources([...selectedSources, source.id]);
                        } else {
                          setSelectedSources(selectedSources.filter(id => id !== source.id));
                        }
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{source.name}</div>
                    <div className="text-sm text-gray-500">{source.description}</div>
                    <div className="text-xs text-blue-600 truncate max-w-xs">{source.url}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelColor(source.recommendationLevel)}`}>
                      {source.recommendationLevel === 'basic' && '基础'}
                      {source.recommendationLevel === 'premium' && '高级'}
                      {source.recommendationLevel === 'featured' && '精选'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(source.qualityValidationStatus)}`}>
                      {source.qualityValidationStatus === 'pending' && '待验证'}
                      {source.qualityValidationStatus === 'approved' && '已批准'}
                      {source.qualityValidationStatus === 'rejected' && '已拒绝'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {Math.round((source.qualityAvailability + source.qualityContentQuality + source.qualityUpdateFrequency) / 3)}
                    </div>
                    <div className="text-xs text-gray-500">可用性 {source.qualityAvailability}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{source.statisticsTotalSubscribers}</div>
                    <div className="text-xs text-gray-500">{source.statisticsActiveSubscribers} 活跃</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleValidateSource(source.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="验证"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleRecommendation(source.id, !source.isRecommended)}
                        className={`hover:text-gray-900 ${source.isRecommended ? 'text-green-600' : 'text-gray-400'}`}
                        title={source.isRecommended ? '禁用推荐' : '启用推荐'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {source.isRecommended ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteSource(source.id)}
                        className="text-red-600 hover:text-red-900"
                        title="删除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sources.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">暂无推荐源数据</p>
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              显示 {((filters.page - 1) * filters.limit) + 1} 到 {Math.min(filters.page * filters.limit, total)} 条，共 {total} 条
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}