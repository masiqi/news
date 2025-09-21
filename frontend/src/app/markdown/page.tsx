'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';

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

// Markdown文件类型定义
interface MarkdownFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
  fileUrl?: string;
}

// 存储设置类型定义
interface StorageSettings {
  enabled: boolean;
  storagePath: string;
  filenamePattern: string;
  maxFileSize: number;
  maxFilesPerDay: number;
  includeMetadata: boolean;
  fileFormat: string;
}

// 存储统计类型定义
interface StorageStats {
  totalFiles: number;
  totalSize: number;
  todayFiles: number;
  todaySize: number;
}

export default function MarkdownFilesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const router = useRouter();

  console.log('Markdown文件页面组件渲染, loading:', loading, 'user:', user);

  useEffect(() => {
    console.log('Markdown文件页面加载开始');
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
      loadSettings();
      loadStats();
      loadFiles();
    }
  }, [user]);

  // 加载自动存储设置
  const loadSettings = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      const response = await fetch('/api/user/auto-storage/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('加载存储设置失败:', error);
    }
  };

  // 加载存储统计
  const loadStats = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      const response = await fetch('/api/user/auto-storage/statistics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.statistics);
        }
      }
    } catch (error) {
      console.error('加载存储统计失败:', error);
    }
  };

  // 加载Markdown文件列表
  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      const response = await fetch('/api/user/auto-storage/files', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('加载文件列表响应:', data);
        if (data.success) {
          setFiles(data.files || []);
        }
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  // 下载文件
  const downloadFile = async (file: MarkdownFile) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      const downloadTarget = file.fileUrl
        ? file.fileUrl
        : `/api/user/auto-storage/download?path=${encodeURIComponent(file.filePath)}`;

      const response = await fetch(downloadTarget, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('下载文件失败');
      }
    } catch (error) {
      console.error('下载文件失败:', error);
      alert('下载文件失败');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  if (loading) {
    console.log('显示加载状态');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  console.log('显示Markdown文件页面');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <NavigationMenu />
      
      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">我的Markdown文件</h1>
            <p className="mt-2 text-gray-600">查看和管理AI生成的Markdown笔记文件</p>
          </div>

          {/* 设置状态卡片 */}
          {settings && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">自动存储状态</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    settings.enabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {settings.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">存储路径:</span>
                  <span className="ml-2 text-sm font-medium">{settings.storagePath}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">文件格式:</span>
                  <span className="ml-2 text-sm font-medium">{settings.fileFormat}</span>
                </div>
              </div>
            </div>
          )}

          {/* 统计信息卡片 */}
          {stats && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">存储统计</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{stats.totalFiles}</div>
                  <div className="text-sm text-gray-500">总文件数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatFileSize(stats.totalSize)}</div>
                  <div className="text-sm text-gray-500">总存储大小</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.todayFiles}</div>
                  <div className="text-sm text-gray-500">今日新增</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{formatFileSize(stats.todaySize)}</div>
                  <div className="text-sm text-gray-500">今日大小</div>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">文件列表</h2>
              <p className="text-sm text-gray-500">点击文件名下载或预览</p>
            </div>
            <button
              onClick={loadFiles}
              disabled={filesLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {filesLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  刷新中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  刷新列表
                </>
              )}
            </button>
          </div>

          {/* 文件列表 */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {filesLoading ? (
              <div className="text-center py-12">
                <svg className="animate-spin mx-auto h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-gray-500">加载文件列表中...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无Markdown文件</h3>
                <p className="text-gray-500">
                  {settings?.enabled 
                    ? '您的RSS内容处理完成后会自动生成Markdown文件，请稍后再来查看'
                    : '自动存储功能未启用，请在设置中启用此功能'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {files.map((file, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 hover:text-indigo-600 cursor-pointer">
                              <button 
                                onClick={() => downloadFile(file)}
                                className="text-left hover:text-indigo-600 transition-colors"
                              >
                                {file.fileName}
                              </button>
                            </h3>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                              <span>{formatFileSize(file.fileSize)}</span>
                              <span>{formatDate(file.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadFile(file)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          下载
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 使用说明 */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">使用说明</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• 系统会自动将您订阅的RSS内容转换为Markdown文件</p>
              <p>• 文件按照您设置的命名规则自动保存</p>
              <p>• 点击文件名或下载按钮可以获取文件</p>
              <p>• 您可以将这些文件导入到Obsidian等笔记软件中管理</p>
              <p>• 文件包含完整的元数据、主题标签和AI分析结果</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
