'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 检查用户是否已登录
    const checkLoginStatus = () => {
      try {
        // 检查JWT令牌是否存在
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1];

        if (token) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    };

    checkLoginStatus();
  }, []);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 导航栏 */}
      <NavigationMenu />

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            智能化您的资讯阅读体验
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-xl text-gray-500">
            利用AI技术自动处理和分析RSS资讯，为您生成个性化的Markdown笔记，助您高效获取知识。
          </p>
          <div className="mt-10">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isLoggedIn ? '进入仪表板' : '立即开始'}
            </button>
          </div>
        </div>

        {/* 特性介绍 */}
        <div className="mt-24">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">AI智能处理</h3>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-base text-gray-500">
                    利用先进的AI模型自动分析和总结RSS资讯内容，生成高质量的Markdown笔记。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">个性化定制</h3>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-base text-gray-500">
                    根据您的兴趣定制RSS源，获得专属的资讯内容推荐和处理。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">无缝集成</h3>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-base text-gray-500">
                    自动生成只读同步凭证，轻松与Obsidian等笔记工具集成。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 工作原理 */}
        <div className="mt-24">
          <div className="lg:text-center">
            <h2 className="text-base font-semibold text-indigo-600 tracking-wide uppercase">工作原理</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              简单三步，智能化您的资讯处理
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-gradient-to-br from-blue-50 to-indigo-100 text-lg font-bold text-indigo-600 rounded-full">
                    1
                  </span>
                </div>
                <div className="mt-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900">配置RSS源</h3>
                  <p className="mt-2 text-base text-gray-500">
                    添加您感兴趣的RSS源，或选择系统推荐的优质内容源。
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-gradient-to-br from-blue-50 to-indigo-100 text-lg font-bold text-indigo-600 rounded-full">
                    2
                  </span>
                </div>
                <div className="mt-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900">AI自动处理</h3>
                  <p className="mt-2 text-base text-gray-500">
                    系统自动抓取新内容，利用AI模型进行分析和总结。
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-gradient-to-br from-blue-50 to-indigo-100 text-lg font-bold text-indigo-600 rounded-full">
                    3
                  </span>
                </div>
                <div className="mt-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900">获取笔记</h3>
                  <p className="mt-2 text-base text-gray-500">
                    在个人云存储中获取结构化的Markdown笔记，随时同步到您的知识库。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white mt-24">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mt-8 border-t border-gray-200 pt-8 md:flex md:items-center md:justify-between">
            <div className="flex space-x-6 md:order-2">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
            <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-1">
              &copy; 2025 墨香蒸馏. 保留所有权利.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}