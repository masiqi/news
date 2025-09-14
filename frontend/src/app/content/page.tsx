'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';
import ContentCard from '@/components/content/ContentCard';
import ContentFilters from '@/components/content/ContentFilters';
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

// 内容类型定义
interface ContentItem {
  id: number;
  title: string;
  content: string;
  link: string;
  sourceId: number;
  sourceName: string;
  publishedAt: string;
  processedAt: string;
  webContent?: {
    content: string;
    extractedAt: string;
    wordCount: number;
  };
  topics?: string[];
  keywords?: string[];
  sentiment?: string;
  wordCount?: number;
}

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

// 分页类型定义
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ContentPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [isContentLoading, setIsContentLoading] = useState(false);
  const router = useRouter();

  console.log('内容页面组件渲染, loading:', loading, 'user:', user);

  useEffect(() => {
    console.log('内容页面加载开始');
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
      loadSources();
      loadContents();
    }
  }, [user, filters, pagination.page]);

  // 加载用户的RSS源列表
  const loadSources = async () => {
    try {
      const response = await fetch('/api/sources/my', {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error('加载RSS源失败:', error);
    }
  };

  // 加载内容列表
  const loadContents = async () => {
    setIsContentLoading(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });

      if (filters.sourceId) {
        params.append('sourceId', filters.sourceId.toString());
      }

      if (filters.hasWebContent !== undefined) {
        params.append('hasWebContent', filters.hasWebContent.toString());
      }

      if (filters.hasTopics !== undefined) {
        params.append('hasTopics', filters.hasTopics.toString());
      }

      if (filters.searchQuery) {
        params.append('searchQuery', filters.searchQuery);
      }

      const response = await fetch(`/api/content?${params}`, {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContents(data.contents || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error('加载内容失败:', error);
    } finally {
      setIsContentLoading(false);
    }
  };

  // 处理筛选条件变化
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 处理页面变化
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // 刷新内容
  const handleRefresh = () => {
    loadContents();
  };

  if (loading) {
    console.log('显示加载状态');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  console.log('显示内容页面');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <NavigationMenu />
      
      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">内容浏览</h1>
            <p className="mt-2 text-gray-600">查看和管理您RSS源中抓取的内容</p>
          </div>

          {/* 筛选条件 */}
          <div className="mb-6">
            <ContentFilters
              sources={sources}
              filters={filters}
              onFilterChange={handleFilterChange}
              onRefresh={handleRefresh}
              isLoading={isContentLoading}
            />
          </div>

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
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无内容</h3>
                <p className="text-gray-500">
                  {filters.sourceId || filters.searchQuery || filters.hasWebContent !== undefined || filters.hasTopics !== undefined
                    ? '没有找到符合筛选条件的内容，请尝试调整筛选条件'
                    : '您还没有抓取任何内容，请先配置RSS源并等待内容抓取完成'
                  }
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
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">统计信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{pagination.total}</div>
                <div className="text-sm text-gray-500">总内容数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {contents.filter(c => c.webContent).length}
                </div>
                <div className="text-sm text-gray-500">有网页内容</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {contents.filter(c => c.topics && c.topics.length > 0).length}
                </div>
                <div className="text-sm text-gray-500">已分析主题</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {contents.filter(c => c.wordCount && c.wordCount > 0).length}
                </div>
                <div className="text-sm text-gray-500">有字数统计</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}