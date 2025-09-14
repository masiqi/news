'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';
import ContentCard from '@/components/content/ContentCard';
import LoadingSpinner from '@/components/content/LoadingSpinner';

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
  webContent?: string;
  topics?: string[];
  keywords?: string[];
  sentiment?: string;
  analysis?: string;
  educationalValue?: string;
  wordCount?: number;
}

// 分页类型定义
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function TopicDetailPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const topicName = decodeURIComponent(params.topic as string || '');
  console.log('主题名称:', topicName);

  // 解析JWT令牌的函数
  const parseJwt = (token: string) => {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }
      
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const base64Url = parts[1];
      if (!base64Url) {
        return null;
      }
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  };

  // 验证JWT令牌是否过期
  const isTokenExpired = (token: string) => {
    try {
      if (!token || typeof token !== 'string') {
        return true;
      }
      
      const parsed = parseJwt(token);
      if (!parsed || !parsed.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime > parsed.exp;
    } catch (error) {
      return true;
    }
  };

  useEffect(() => {
    // 检查用户是否已登录
    const checkLoginStatus = async () => {
      try {
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1];

        if (!token) {
          router.push('/login');
          return;
        }

        if (isTokenExpired(token)) {
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          router.push('/login');
          return;
        }

        const userData = parseJwt(token);
        if (userData && userData.email) {
          setUser({ email: userData.email, id: userData.id });
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkLoginStatus();
  }, [router]);

  useEffect(() => {
    if (user && topicName) {
      loadContents();
    }
  }, [user, topicName, pagination.page]);

  // 加载内容列表
  const loadContents = async () => {
    if (!topicName) return;
    
    setIsContentLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.pageSize.toString()
      });

      const response = await fetch(`/api/tags/topics/${topicName}/entries?${params}`, {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]}`
        }
      });

      if (!response.ok) {
        throw new Error('获取内容失败');
      }

      const data = await response.json();
      if (data.success) {
        setContents(data.data || []);
        setPagination({
          ...pagination,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || Math.ceil((data.pagination?.total || 0) / pagination.pageSize)
        });
      } else {
        setError(data.error || '获取内容失败');
      }
    } catch (error) {
      console.error('加载内容失败:', error);
      setError('加载内容失败，请稍后重试');
    } finally {
      setIsContentLoading(false);
    }
  };

  // 处理页面变化
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (!topicName) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationMenu />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">无效的主题</h3>
              <p className="text-gray-500">请提供有效的主题名称</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <NavigationMenu />
      
      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">主题: {topicName}</h1>
            <p className="mt-2 text-gray-600">查看与该主题相关的所有内容</p>
            <button
              onClick={() => router.push('/content')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              ← 返回内容浏览
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800">错误</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}

          {/* 内容列表 */}
          <div className="grid gap-6">
            {isContentLoading ? (
              <LoadingSpinner />
            ) : contents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无相关内容</h3>
                <p className="text-gray-500">
                  没有找到与主题 "{topicName}" 相关的内容
                </p>
              </div>
            ) : (
              contents.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                />
              ))
            )}
          </div>

          {/* 分页控件 */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    pagination.page <= 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  上一页
                </button>

                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pagination.page === page
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    pagination.page >= pagination.totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  下一页
                </button>
              </nav>
            </div>
          )}

          {/* 统计信息 */}
          {contents.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">统计信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{pagination.total}</div>
                  <div className="text-sm text-gray-500">相关内容数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {contents.filter(c => c.webContent).length}
                  </div>
                  <div className="text-sm text-gray-500">有网页内容</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {contents.filter(c => c.sentiment).length}
                  </div>
                  <div className="text-sm text-gray-500">已分析情感</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}