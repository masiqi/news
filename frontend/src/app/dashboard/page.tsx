'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 检查用户是否已登录
    const checkLoginStatus = async () => {
      try {
        // 这里应该检查JWT令牌有效性
        // 暂时简化处理
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1];

        if (!token) {
          // 没有令牌，跳转到登录页面
          router.push('/login');
          return;
        }

        // 验证令牌有效性（简化处理）
        // 实际应用中应该调用后端API验证令牌
        setUser({ email: 'user@example.com' }); // 示例用户数据
      } catch (error) {
        console.error('检查登录状态失败:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkLoginStatus();
  }, [router]);

  const handleLogout = () => {
    // 清除令牌Cookie
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    // 跳转到登录页面
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">仪表板</h1>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            登出
          </button>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-4">
              <h2 className="text-xl font-semibold mb-4">欢迎来到您的仪表板</h2>
              <p>您已成功登录系统。</p>
              {user && <p>当前用户: {user.email}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}