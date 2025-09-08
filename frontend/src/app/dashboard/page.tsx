'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';
import RssSourceStatus from './components/RssSourceStatus';

// 解析JWT令牌的函数
const parseJwt = (token: string) => {
  try {
    console.log('开始解析JWT令牌');
    // 检查令牌是否存在且格式正确
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
    // 首先检查令牌格式
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

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  console.log('仪表板页面组件渲染, loading:', loading, 'user:', user);

  useEffect(() => {
    console.log('仪表板页面加载开始');
    // 检查用户是否已登录
    const checkLoginStatus = async () => {
      try {
        console.log('开始检查登录状态');
        // 检查JWT令牌有效性
        const allCookies = document.cookie;
        console.log('所有cookies:', allCookies);
        
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1];

        console.log('检查令牌:', token);

        if (!token) {
          // 没有令牌，跳转到登录页面
          console.log('没有找到令牌，跳转到登录页面');
          router.push('/login');
          return;
        }

        // 检查令牌是否过期
        console.log('开始检查令牌是否过期');
        if (isTokenExpired(token)) {
          console.log('令牌已过期，清除令牌并跳转到登录页面');
          // 清除过期的令牌
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          router.push('/login');
          return;
        }

        // 解析JWT令牌获取用户信息
        console.log('开始解析用户数据');
        const userData = parseJwt(token);
        console.log('解析用户数据结果:', userData);
        
        if (userData && userData.email) {
          console.log('设置用户数据:', { email: userData.email, id: userData.id });
          setUser({ email: userData.email, id: userData.id });
        } else {
          // 令牌无效，跳转到登录页面
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
  }, []);

  if (loading) {
    console.log('显示加载状态');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  console.log('显示仪表板内容');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <NavigationMenu />
      
      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">欢迎来到您的仪表板</h2>
            <p className="text-gray-800">您已成功登录系统。</p>
            {user && <p className="text-gray-800">当前用户: {user.email}</p>}
            
            {/* RSS源状态组件 */}
            <div className="mt-8">
              <RssSourceStatus />
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">我的RSS源</h3>
                <p className="text-gray-700 mb-4">管理您的个人RSS源</p>
                <button
                  onClick={() => router.push('/sources/my')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  查看我的源
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">公共RSS源</h3>
                <p className="text-gray-700 mb-4">浏览和复制公共源</p>
                <button
                  onClick={() => router.push('/sources/public')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  浏览公共源
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">设置</h3>
                <p className="text-gray-700 mb-4">管理您的账户设置</p>
                <button
                  onClick={() => router.push('/settings')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  账户设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}