'use client';

import { useState, useEffect } from 'react';
import { InterestSelectorProps, InterestInput } from '@/types/onboarding';
import { InterestCategory } from '@/types/onboarding';
import { cn } from '@/lib/utils';

export default function InterestSelector({
  categories,
  selectedInterests: initialSelectedInterests,
  onSelectionChange,
  onContinue,
  onBack,
}: InterestSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedInterests, setSelectedInterests] = useState<InterestInput[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // 从initialSelectedInterests字符串数组转换为InterestInput数组
    const interests: InterestInput[] = initialSelectedInterests.map(interestId => {
      const category = categories.find(cat => cat.id === interestId);
      return {
        categoryId: interestId,
        level: category ? 'medium' : 'medium', // 默认中等兴趣
      };
    });
    setSelectedInterests(interests);
  }, [initialSelectedInterests, categories]);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleInterestClick = (categoryId: string, level: 'low' | 'medium' | 'high' = 'medium') => {
    const existingInterestIndex = selectedInterests.findIndex(i => i.categoryId === categoryId);
    
    if (existingInterestIndex !== -1) {
      // 如果已存在相同分类，更新级别
      const newInterests = [...selectedInterests];
      newInterests[existingInterestIndex] = {
        categoryId,
        level,
      };
      setSelectedInterests(newInterests);
    } else {
      // 添加新兴趣
      setSelectedInterests([...selectedInterests, { categoryId, level }]);
    }
  };

  const handleRemoveInterest = (categoryId: string) => {
    setSelectedInterests(selectedInterests.filter(i => i.categoryId !== categoryId));
  };

  const handleContinue = () => {
    const selectedIds = selectedInterests.map(i => i.categoryId);
    onSelectionChange(selectedInterests);
    onContinue();
  };

  const displayedCategories = showAll ? categories : categories.slice(0, 9);
  const hasMore = categories.length > 9;

  const getLevelLabel = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return '一般';
      case 'medium': return '喜欢';
      case 'high': return '热爱';
    }
  };

  const getLevelColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'medium': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'high': return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
    }
  };

  const getInterestLevel = (categoryId: string) => {
    const interest = selectedInterests.find(i => i.categoryId === categoryId);
    return interest?.level || null;
  };

  return (
    <div className="space-y-6">
      {/* 标题和说明 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          选择您感兴趣的新闻领域
        </h2>
        <p className="text-gray-600 mb-6">
          选择您感兴趣的领域，我们将为您推荐相关的优质新闻源。您可以随时在设置中调整这些偏好。
        </p>
      </div>

      {/* 已选择的兴趣 */}
      {selectedInterests.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-3">
            已选择 {selectedInterests.length} 个兴趣
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.map((interest) => {
              const category = categories.find(cat => cat.id === interest.categoryId);
              return (
                <span
                  key={interest.categoryId}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {category?.name || interest.categoryId}
                  <button
                    onClick={() => handleRemoveInterest(interest.categoryId)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 兴趣分类网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const selectedLevel = getInterestLevel(category.id);
          
          return (
            <div
              key={category.id}
              className={cn(
                "border rounded-lg transition-all duration-200 hover:shadow-md",
                selectedLevel ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
              )}
            >
              {/* 分类头部 */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {category.icon && (
                      <span className="text-2xl">{category.icon}</span>
                    )}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <svg 
                    className={cn(
                      "w-5 h-5 text-gray-400 transition-transform duration-200",
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

              {/* 兴趣级别选择 */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">
                    请选择您对 {category.name} 的兴趣程度：
                  </p>
                  <div className="space-y-2">
                    {[
                      { level: 'low', label: '一般关注', description: '偶尔浏览相关内容' },
                      { level: 'medium', label: '比较喜欢', description: '定期查看相关内容' },
                      { level: 'high', label: '非常热爱', description: '深度关注所有相关内容' },
                    ].map((levelOption) => (
                      <button
                        key={levelOption.level}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left transition-colors",
                          selectedLevel === levelOption.level
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        )}
                        onClick={() => handleInterestClick(category.id, levelOption.level)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              getLevelColor(levelOption.level)
                            )}>
                              {getLevelLabel(levelOption.level)}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {levelOption.label}
                            </span>
                          </div>
                          {selectedLevel === levelOption.level && (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-left">
                          {levelOption.description}
                        </p>
                      </button>
                    ))}
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
            显示更多领域 ({categories.length - 9}+)
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
            已选择 {selectedInterests.length} 个兴趣
          </span>
          <button
            onClick={handleContinue}
            disabled={selectedInterests.length === 0}
            className={cn(
              "px-6 py-2 rounded-lg transition-colors",
              selectedInterests.length > 0
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            继续
          </button>
        </div>
      </div>
    </div>
  );
}