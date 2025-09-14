'use client';

import { useState } from 'react';

// 筛选条件类型定义
interface FilterOptions {
  sourceId?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  hasWebContent?: boolean;
  hasTopics?: boolean;
  searchQuery?: string;
}

interface ContentFiltersProps {
  sources: any[];
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function ContentFilters({
  sources,
  filters,
  onFilterChange,
  onRefresh,
  isLoading
}: ContentFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');
  const [isExpanded, setIsExpanded] = useState(false);

  // 处理搜索
  const handleSearch = () => {
    onFilterChange({
      ...filters,
      searchQuery: searchInput.trim() || undefined
    });
  };

  // 处理搜索输入框回车
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 重置筛选条件
  const handleReset = () => {
    setSearchInput('');
    onFilterChange({});
  };

  // 处理源筛选
  const handleSourceChange = (sourceId: string) => {
    const value = sourceId === '' ? undefined : parseInt(sourceId);
    onFilterChange({
      ...filters,
      sourceId: value
    });
  };

  // 处理网页内容筛选
  const handleWebContentChange = (value: string) => {
    let hasWebContent: boolean | undefined;
    if (value === 'true') hasWebContent = true;
    else if (value === 'false') hasWebContent = false;
    else hasWebContent = undefined;

    onFilterChange({
      ...filters,
      hasWebContent
    });
  };

  // 处理主题筛选
  const handleTopicsChange = (value: string) => {
    let hasTopics: boolean | undefined;
    if (value === 'true') hasTopics = true;
    else if (value === 'false') hasTopics = false;
    else hasTopics = undefined;

    onFilterChange({
      ...filters,
      hasTopics
    });
  };

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof FilterOptions];
    return value !== undefined && value !== '';
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">筛选条件</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '收起' : '展开'}
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            刷新
          </button>
        </div>
      </div>

      {/* 基本搜索 */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索标题或内容..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          搜索
        </button>
      </div>

      {/* 高级筛选 */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* RSS源筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RSS源</label>
            <select
              value={filters.sourceId || ''}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部源</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>

          {/* 网页内容筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">网页内容</label>
            <select
              value={filters.hasWebContent === undefined ? '' : filters.hasWebContent}
              onChange={(e) => handleWebContentChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部</option>
              <option value="true">有网页内容</option>
              <option value="false">无网页内容</option>
            </select>
          </div>

          {/* 主题筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">主题分析</label>
            <select
              value={filters.hasTopics === undefined ? '' : filters.hasTopics}
              onChange={(e) => handleTopicsChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部</option>
              <option value="true">已分析主题</option>
              <option value="false">未分析主题</option>
            </select>
          </div>

          {/* 日期范围筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">发布时间</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="选择日期范围"
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {hasActiveFilters ? (
            <span>
              当前有活跃的筛选条件
              <button
                onClick={handleReset}
                className="ml-2 text-indigo-600 hover:text-indigo-800 underline"
              >
                清除所有
              </button>
            </span>
          ) : (
            <span>没有应用筛选条件</span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            重置筛选
          </button>
        )}
      </div>

      {/* 当前筛选条件显示 */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">当前筛选条件:</h3>
          <div className="flex flex-wrap gap-2">
            {filters.sourceId && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                RSS源: {sources.find(s => s.id === filters.sourceId)?.name}
              </span>
            )}
            {filters.hasWebContent !== undefined && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                网页内容: {filters.hasWebContent ? '有' : '无'}
              </span>
            )}
            {filters.hasTopics !== undefined && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                主题分析: {filters.hasTopics ? '已分析' : '未分析'}
              </span>
            )}
            {filters.searchQuery && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                搜索: {filters.searchQuery}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}