'use client';

import { useState, useEffect } from 'react';
import { SourcePreviewProps } from '@/types/onboarding';
import { RecommendedSource } from '@/types/onboarding';
import { cn } from '@/lib/utils';

export default function SourcePreview({
  sources,
  selectedSources,
  onSelectionChange,
  onConfirm,
  onBack,
  maxSelections = 10,
}: SourcePreviewProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // 从selectedSources字符串数组转换为Set
    const selectedSet = new Set(selectedSources);
    setExpandedSources(new Set([
      ...expandedSources,
      ...selectedSet
    ]));
  }, [selectedSources]);

  const toggleSource = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
      onSelectionChange([...newExpanded]);
    } else if (newExpanded.size < maxSelections) {
      newExpanded.add(sourceId);
      onSelectionChange([...newExpanded]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSources.length === sources.length) {
      // 如果已经全选，则取消所有
      onSelectionChange([]);
    } else {
      // 选择所有，但不超过限制
      const selectedAll = sources.slice(0, maxSelections).map(s => s.id);
      onSelectionChange(selectedAll);
    }
  };

  const displayedSources = showAll ? sources : sources.slice(0, 9);
  const hasMore = sources.length > 9;
  const selectedCount = selectedSources.length;

  const getQualityBadge = (score: number) => {
    if (score >= 80) return { text: '优秀', className: 'bg-green-100 text-green-800' };
    if (score >= 60) return { text: '良好', className: 'bg-blue-100 text-blue-800' };
    return { text: '一般', className: 'bg-yellow-100 text-yellow-800' };
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'featured': return { text: '精选', className: 'bg-purple-100 text-purple-800' };
      case 'premium': return { text: '高级', className: 'bg-blue-100 text-blue-800' };
      case 'basic': return { text: '基础', className: 'bg-gray-100 text-gray-800' };
      default: return { text: '基础', className: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题和说明 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          为您推荐的RSS源
        </h2>
        <p className="text-gray-600 mb-6">
          基于您的兴趣，我们为您推荐了 {sources.length} 个相关新闻源。选择您想要订阅的源，系统将为您自动同步更新。
        </p>
      </div>

      {/* 选择统计 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-blue-900 font-medium">
            已选择 {selectedCount} / {maxSelections} 个
          </span>
          <button
            onClick={handleSelectAll}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {selectedCount === sources.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="mt-2 bg-blue-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(selectedCount / maxSelections) * 100}%` }}
          />
        </div>
      </div>

      {/* 推荐源列表 */}
      <div className="space-y-4">
        {displayedSources.map((source) => {
          const isSelected = selectedSources.includes(source.id);
          const isExpanded = expandedSources.has(source.id);
          
          return (
            <div
              key={source.id}
              className={cn(
                "border rounded-lg transition-all duration-200",
                isSelected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:shadow-md"
              )}
            >
              {/* 源头部 */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleSource(source.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* 源图标 */}
                    <div className="flex-shrink-0">
                      {source.icon ? (
                        <span className="text-2xl">{source.icon}</span>
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {source.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 源信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {source.name}
                        </h3>
                        {getLevelBadge(source.recommendationLevel).text && (
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            getLevelBadge(source.recommendationLevel).className
                          )}>
                            {getLevelBadge(source.recommendationLevel).text}
                          </span>
                        )}
                      </div>
                      
                      {source.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {source.description}
                        </p>
                      )}

                      {/* 质量评分 */}
                      <div className="flex items-center space-x-4 mt-3">
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">可用性</span>
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            getQualityBadge(source.qualityAvailability).className
                          )}>
                            {getQualityBadge(source.qualityAvailability).text}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">内容</span>
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            getQualityBadge(source.qualityContentQuality).className
                          )}>
                            {getQualityBadge(source.qualityContentQuality).text}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">更新</span>
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            getQualityBadge(source.qualityUpdateFrequency).className
                          )}>
                            {getQualityBadge(source.qualityUpdateFrequency).text}
                          </span>
                        </div>
                      </div>

                      {/* 分类标签 */}
                      {(source.categories && source.categories.length > 0) && (
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500">分类:</span>
                          <div className="flex flex-wrap gap-1">
                            {source.categories.slice(0, 3).map((category) => (
                              <span
                                key={category.id}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                              >
                                {category.name}
                              </span>
                            ))}
                            {source.categories.length > 3 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                                +{source.categories.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 展开/收起图标 */}
                  <svg
                    className={cn(
                      "w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0",
                      isExpanded && "rotate-180"
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* 展开的详细内容 */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200">
                  {/* 匹配度 */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {source.matchScore}%
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          兴趣匹配度
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {source.relevanceScore}%
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          相关性评分
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 详细描述 */}
                  {source.description && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        详细介绍
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {source.description}
                      </p>
                    </div>
                  )}

                  {/* 所有分类标签 */}
                  {(source.categories && source.categories.length > 0) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        相关分类
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {source.categories.map((category) => (
                          <span
                            key={category.id}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full flex items-center space-x-1"
                          >
                            {category.icon && <span>{category.icon}</span>}
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 查看链接 */}
                  <div className="mt-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      查看源网站
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l4-4m0 0l4 4" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 显示更多按钮 */}
      {hasMore && !showAll && (
        <div className="text-center">
          <button
                onClick={() => setShowAll(true)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                查看更多推荐 ({sources.length - 9}+)
              </button>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        {onBack && (
          <button
                onClick={onBack}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                返回
              </button>
        )}
        
        <div className="flex space-x-3">
          <span className="text-sm text-gray-500">
            最多选择 {maxSelections} 个源
          </span>
          <button
                onClick={onConfirm}
                disabled={selectedSources.length === 0}
                className={cn(
                  "px-6 py-2 rounded-lg transition-colors",
                  selectedSources.length > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                确认选择
              </button>
        </div>
      </div>
    </div>
  );
}