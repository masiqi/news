'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';
import LoadingSpinner from '@/components/content/LoadingSpinner';

// 解析JWT令牌的函数
const parseJwt = (token: string) => {
  try {
    console.log('开始解析JWT令牌');
    if (!token || typeof token !== 'string') {
      console.error('令牌无效: 令牌不存在或不是字符串');
      return null;
    }
    
    const parts = token.split('.');
    console.log('令牌部分:', parts);
    console.log('部分数量:', parts.length);
    
    if (parts.length !== 3) {
      console.error('令牌无效: JWT令牌应该有3个部分，实际有', parts.length);
      return null;
    }
    
    const base64Url = parts[1];
    console.log('载荷部分:', base64Url);
    
    if (!base64Url) {
      console.error('令牌无效: 无法获取载荷部分');
      return null;
    }
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    console.log('Base64编码:', base64);
    
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    console.log('解析后的载荷:', jsonPayload);
    
    const parsed = JSON.parse(jsonPayload);
    console.log('解析后的对象:', parsed);
    return parsed;
  } catch (error) {
    console.error('解析JWT令牌失败:', error);
    return null;
  }
};

// 验证JWT令牌是否过期
const isTokenExpired = (token: string) => {
  try {
    console.log('开始检查令牌是否过期');
    if (!token || typeof token !== 'string') {
      console.error('令牌无效: 令牌不存在或不是字符串');
      return true;
    }
    
    const parsed = parseJwt(token);
    console.log('解析结果:', parsed);
    
    if (!parsed) {
      console.error('令牌无效: 无法解析令牌');
      return true;
    }
    
    if (!parsed.exp) {
      console.error('令牌无效: 令牌中没有过期时间');
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime > parsed.exp;
    console.log('当前时间:', currentTime, '过期时间:', parsed.exp, '是否过期:', isExpired);
    return isExpired;
  } catch (error) {
    console.error('验证令牌过期时间失败:', error);
    return true;
  }
};

// 内容详情类型定义
interface ContentDetail {
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
  modelUsed?: string;
  processingTime?: number;
}

export default function ContentDetailPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('内容详情页面组件渲染, loading:', loading, 'user:', user);

  useEffect(() => {
    console.log('内容详情页面加载开始');
    // 检查用户是否已登录
    const checkLoginStatus = async () => {
      try {
        console.log('开始检查登录状态');
        const allCookies = document.cookie;
        console.log('所有cookies:', allCookies);
        
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1];

        console.log('检查令牌:', token);

        if (!token) {
          console.log('没有找到令牌，跳转到登录页面');
          router.push('/login');
          return;
        }

        if (isTokenExpired(token)) {
          console.log('令牌已过期，清除令牌并跳转到登录页面');
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          router.push('/login');
          return;
        }

        const userData = parseJwt(token);
        console.log('解析用户数据结果:', userData);
        
        if (userData && userData.email) {
          console.log('设置用户数据:', { email: userData.email, id: userData.id });
          setUser({ email: userData.email, id: userData.id });
        } else {
          console.log('令牌无效，跳转到登录页面');
          router.push('/login');
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        router.push('/login');
      } finally {
        console.log('设置loading为false');
        setLoading(false);
      }
    };

    checkLoginStatus();
  }, [router]);

  useEffect(() => {
    if (user) {
      const contentId = searchParams.get('id');
      if (contentId) {
        loadContent(parseInt(contentId));
      } else {
        router.push('/content');
      }
    }
  }, [user, searchParams, router]);

  // 加载内容详情
  const loadContent = async (contentId: number) => {
    setIsContentLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
      const response = await fetch(`${backendUrl}/api/content/${contentId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContent(data.content);
      } else if (response.status === 404) {
        setContent(null);
      } else {
        console.error('获取内容详情失败:', response.status);
      }
    } catch (error) {
      console.error('加载内容详情失败:', error);
    } finally {
      setIsContentLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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

  if (loading) {
    console.log('显示加载状态');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (isContentLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationMenu />
        <div className="max-w-4xl mx-auto py-8 px-4">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationMenu />
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">内容不存在</h1>
            <p className="text-gray-600 mb-6">抱歉，您要查看的内容可能已被删除或不存在。</p>
            <button
              onClick={() => router.push('/content')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              返回内容列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('显示内容详情');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <NavigationMenu />
      
      {/* 主要内容 */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        {/* 返回按钮 */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/content')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回内容列表
          </button>
        </div>

        {/* 内容详情 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* 头部信息 */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-4 hover:text-indigo-600 cursor-pointer">
                  <a href={content.link} target="_blank" rel="noopener noreferrer">
                    {content.title}
                  </a>
                </h1>
                
                {/* 来源和时间信息 */}
                <div className="flex items-center text-sm text-gray-500 space-x-6">
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

            {/* 操作按钮 */}
            <div className="flex items-center space-x-4">
              <a
                href={content.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                查看原文
              </a>
            </div>
          </div>

          {/* 原始内容 */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">原始内容</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {content.content}
              </p>
            </div>
          </div>

          {/* 网页内容 */}
          {typeof content.webContent === 'string' && content.webContent && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">网页内容</h2>
                <div className="text-sm text-gray-500">
                  <span>字数: {content.wordCount || 0}</span>
                </div>
              </div>
              <div className="prose prose-gray max-w-none">
                <div 
                  className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                >
                  {typeof content.webContent === 'string' ? content.webContent : '网页内容加载中...'}
                </div>
              </div>
            </div>
          )}

          {/* 主题和关键词 */}
          {(content.topics && content.topics.length > 0) || (content.keywords && content.keywords.length > 0) ? (
            <div className="p-6 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.topics && content.topics.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">主题</h3>
                    <div className="flex flex-wrap gap-2">
                      {content.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {content.keywords && content.keywords.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">关键词</h3>
                    <div className="flex flex-wrap gap-2">
                      {content.keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 分析解读 */}
          {content.analysis && (
            <div className="p-6 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">分析解读</h3>
              <div className="prose prose-blue max-w-none">
                <p className="text-gray-700 leading-relaxed">
                  {content.analysis}
                </p>
              </div>
            </div>
          )}

          {/* 教育价值 */}
          {content.educationalValue && (
            <div className="p-6 border-b border-gray-200 bg-green-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">教育价值</h3>
              <div className="prose prose-green max-w-none">
                <p className="text-gray-700 leading-relaxed">
                  {content.educationalValue}
                </p>
              </div>
            </div>
          )}

          {/* 处理信息 */}
          <div className="p-6 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">处理信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">处理时间:</span>
                <div className="text-gray-900">{formatDate(content.processedAt)}</div>
              </div>
              <div>
                <span className="text-gray-500">字数统计:</span>
                <div className="text-gray-900">{content.wordCount || 0}</div>
              </div>
              {content.modelUsed && (
                <div>
                  <span className="text-gray-500">分析模型:</span>
                  <div className="text-gray-900">{content.modelUsed}</div>
                </div>
              )}
              {content.processingTime && (
                <div>
                  <span className="text-gray-500">处理耗时:</span>
                  <div className="text-gray-900">{content.processingTime}ms</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}