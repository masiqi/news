'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 内容项类型定义
interface ContentItem {
  id: number;
  title: string;
  content: string;
  link: string;
  sourceId: number;
  sourceName: string;
  publishedAt: string;
  processedAt: string;
  webContent?: string; // 网页内容字符串
  topics?: string[];
  keywords?: string[];
  sentiment?: string;
  analysis?: string;
  educationalValue?: string;
  wordCount?: number;
}

interface ContentCardProps {
  content: ContentItem;
}

export default function ContentCard({ content }: ContentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const router = useRouter();

  // 处理主题点击
  const handleTopicClick = (topic: string) => {
    router.push(`/tags/topics/${topic}`);
  };

  // 处理关键词点击
  const handleKeywordClick = (keyword: string) => {
    router.push(`/tags/keywords/${keyword}`);
  };

  // 处理AI重新分析
  const handleReprocess = async (contentId: number) => {
    if (isReprocessing) return;
    
    if (!confirm('确定要让AI重新分析这篇文章吗？这将覆盖当前的分析结果。')) {
      return;
    }

    setIsReprocessing(true);
    try {
      const response = await fetch(`/api/content/reprocess?id=${contentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('重新分析失败');
      }

      const result = await response.json();
      
      if (result.success) {
        alert('AI重新分析成功！页面将刷新以显示新结果。');
        // 刷新页面以显示新数据
        window.location.reload();
      } else {
        alert('重新分析失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('重新分析失败:', error);
      alert('重新分析失败，请稍后重试');
    } finally {
      setIsReprocessing(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 截取内容预览
  const getContentPreview = (content?: string, maxLength: number = 150) => {
    if (!content || content.length <= maxLength) return content || '';
    return content.substring(0, maxLength) + '...';
  };

  // 获取情感颜色
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      case 'neutral': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  // 获取情感文本
  const getSentimentText = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return '正面';
      case 'negative': return '负面';
      case 'neutral': return '中性';
      default: return '未分析';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* 头部信息 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 cursor-pointer">
            <a href={content.link} target="_blank" rel="noopener noreferrer">
              {content.title}
            </a>
          </h3>
          
          {/* 来源和发布时间 */}
          <div className="flex items-center text-sm text-gray-500 space-x-4">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {content.sourceName}
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(content.publishedAt)}
            </span>
          </div>
        </div>

        {/* 状态标签 */}
        <div className="flex flex-col space-y-2 ml-4">
          {typeof content.webContent === 'string' && content.webContent && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              有网页内容
            </span>
          )}
          {content.topics && content.topics.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              已分析
            </span>
          )}
          {content.sentiment && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(content.sentiment)}`}>
              {getSentimentText(content.sentiment)}
            </span>
          )}
        </div>
      </div>

      {/* 内容预览 */}
      <div className="mb-4">
        {(() => {
          const displayContent = typeof content.webContent === 'string' ? content.webContent : content.content;
          if (!displayContent) {
            return <p className="text-gray-500 italic">暂无内容</p>;
          }
          
          return (
            <>
              <p className="text-gray-700 leading-relaxed">
                {isExpanded ? displayContent : getContentPreview(displayContent)}
              </p>
              {displayContent.length > 150 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-2"
                >
                  {isExpanded ? '收起' : '展开'}
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* 网页内容信息 */}
      {typeof content.webContent === 'string' && content.webContent && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">网页内容</h4>
            <span className="text-xs text-gray-500">
              字数: {content.wordCount || 0}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-2">
            {getContentPreview(typeof content.webContent === 'string' ? content.webContent : '', 200)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <Link 
              href={`/content/detail?id=${content.id}`}
              className="text-indigo-600 hover:text-indigo-800"
            >
              查看完整内容 →
            </Link>
          </div>
        </div>
      )}

      {/* 主题和关键词 */}
      {(content.topics && content.topics.length > 0) || (content.keywords && content.keywords.length > 0) ? (
        <div className="space-y-2">
          {content.topics && content.topics.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-700">主题:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {content.topics.slice(0, 5).map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => handleTopicClick(topic)}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors cursor-pointer"
                  >
                    {topic}
                  </button>
                ))}
                {content.topics.length > 5 && (
                  <span className="text-xs text-gray-500">+{content.topics.length - 5}</span>
                )}
              </div>
            </div>
          )}
          
          {content.keywords && content.keywords.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-700">关键词:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {content.keywords.slice(0, 8).map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => handleKeywordClick(keyword)}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors cursor-pointer"
                  >
                    {keyword}
                  </button>
                ))}
                {content.keywords.length > 8 && (
                  <span className="text-xs text-gray-500">+{content.keywords.length - 8}</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 底部操作 */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span>处理时间: {formatDate(content.processedAt)}</span>
          {content.wordCount && (
            <span>字数: {content.wordCount}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <a
            href={content.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            原文链接
          </a>
          <Link
            href={`/content/detail?id=${content.id}`}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
          >
            查看详情
          </Link>
          <button
            onClick={() => handleReprocess(content.id)}
            disabled={isReprocessing}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReprocessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                处理中
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                AI重新分析
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}