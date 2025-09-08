'use client';

import { useState } from 'react';
import { RecommendedSource } from '@/types/admin';

interface RecommendedSourceTableProps {
  sources: RecommendedSource[];
  onEdit: (source: RecommendedSource) => void;
  onDelete: (sourceId: number) => void;
  onToggle: (sourceId: number, enabled: boolean) => void;
  onValidate: (sourceId: number) => void;
  selectedSources: number[];
  onSelectionChange: (sourceId: number, selected: boolean) => void;
}

export default function RecommendedSourceTable({
  sources,
  onEdit,
  onDelete,
  onToggle,
  onValidate,
  selectedSources,
  onSelectionChange,
}: RecommendedSourceTableProps) {
  const [sortField, setSortField] = useState<keyof RecommendedSource>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof RecommendedSource) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSources = [...sources].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // 处理字符串比较
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // 处理数字比较
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // 处理日期比较
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortDirection === 'asc' 
        ? aValue.getTime() - bValue.getTime()
        : bValue.getTime() - aValue.getTime();
    }

    return 0;
  });

  const getLevelBadge = (level: string) => {
    const levels = {
      basic: { label: '基础', className: 'bg-gray-100 text-gray-800' },
      premium: { label: '高级', className: 'bg-blue-100 text-blue-800' },
      featured: { label: '精选', className: 'bg-purple-100 text-purple-800' },
    };
    
    const config = levels[level as keyof typeof levels] || levels.basic;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statuses = {
      pending: { label: '待验证', className: 'bg-yellow-100 text-yellow-800' },
      approved: { label: '已批准', className: 'bg-green-100 text-green-800' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
    };
    
    const config = statuses[status as keyof typeof statuses] || statuses.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getQualityScore = (source: RecommendedSource) => {
    const average = Math.round(
      (source.qualityAvailability + source.qualityContentQuality + source.qualityUpdateFrequency) / 3
    );
    return average;
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const SortIcon = ({ field }: { field: keyof RecommendedSource }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (sources.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无推荐源</h3>
          <p className="mt-1 text-sm text-gray-500">开始添加推荐源来为用户提供优质的新闻内容。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedSources.length === sources.length && sources.length > 0}
                  onChange={(e) => {
                    sources.forEach(source => {
                      onSelectionChange(source.id, e.target.checked);
                    });
                  }}
                />
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>推荐源</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('recommendationLevel')}
              >
                <div className="flex items-center space-x-1">
                  <span>级别</span>
                  <SortIcon field="recommendationLevel" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('qualityValidationStatus')}
              >
                <div className="flex items-center space-x-1">
                  <span>状态</span>
                  <SortIcon field="qualityValidationStatus" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('qualityAvailability')}
              >
                <div className="flex items-center space-x-1">
                  <span>质量评分</span>
                  <SortIcon field="qualityAvailability" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('statisticsTotalSubscribers')}
              >
                <div className="flex items-center space-x-1">
                  <span>订阅数</span>
                  <SortIcon field="statisticsTotalSubscribers" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedSources.map((source) => (
              <tr key={source.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedSources.includes(source.id)}
                    onChange={(e) => onSelectionChange(source.id, e.target.checked)}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {source.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {source.name}
                      </div>
                      {source.description && (
                        <div className="text-sm text-gray-500 truncate mt-1">
                          {source.description}
                        </div>
                      )}
                      <div className="text-xs text-blue-600 truncate mt-1">
                        {source.url}
                      </div>
                      {source.recommendedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          推荐于 {new Date(source.recommendedAt).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getLevelBadge(source.recommendationLevel)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(source.qualityValidationStatus)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className={`text-lg font-semibold ${getQualityColor(getQualityScore(source))}`}>
                      {getQualityScore(source)}
                    </div>
                    <div className="text-xs text-gray-500">
                      <div>可用性 {source.qualityAvailability}</div>
                      <div>内容 {source.qualityContentQuality}</div>
                      <div>更新 {source.qualityUpdateFrequency}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {source.statisticsTotalSubscribers.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {source.statisticsActiveSubscribers} 活跃
                  </div>
                  {source.statisticsSatisfaction > 0 && (
                    <div className="text-xs text-yellow-600">
                      满意度 {source.statisticsSatisfaction.toFixed(1)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onValidate(source.id)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      title="验证推荐源"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onToggle(source.id, !source.isRecommended)}
                      className={`p-1 rounded hover:bg-gray-100 ${source.isRecommended ? 'text-green-600 hover:text-green-900' : 'text-gray-400 hover:text-gray-900'}`}
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
                      onClick={() => onEdit(source)}
                      className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
                      title="编辑推荐源"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(source.id)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                      title="删除推荐源"
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
      </div>
    </div>
  );
}