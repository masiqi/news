// src/app/dashboard/components/RssSourceStatus.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SourceStatus {
  id: number;
  name: string;
  url: string;
  lastFetchedAt: string | null;
  fetchFailureCount: number;
  fetchErrorMessage: string | null;
  isPublic: boolean;
}

export default function RssSourceStatus() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSourceStatus();
  }, []);

  const fetchSourceStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sources/my');
      const data = await response.json();
      
      if (response.ok) {
        setSources(data.sources || []);
      } else {
        setError(data.error || '获取RSS源状态失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerFetch = async (sourceId: number) => {
    try {
      console.log(`开始手动触发RSS源 ${sourceId} 获取`);
      
      const response = await fetch(`/api/sources/${sourceId}/trigger-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`成功触发RSS源 ${sourceId} 获取:`, data);
        alert(`成功触发RSS源 ${sourceId} 的获取任务`);
        
        // 等待2秒后刷新状态，让获取任务有时间开始处理
        setTimeout(async () => {
          await fetchSourceStatus();
        }, 2000);
      } else {
        console.error(`触发RSS源 ${sourceId} 获取失败:`, data);
        alert(`触发获取失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      console.error(`触发RSS源 ${sourceId} 获取时出错:`, err);
      alert('触发获取任务失败');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '从未获取';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  const getStatusColor = (failureCount: number) => {
    if (failureCount === 0) return 'bg-green-100 text-green-800';
    if (failureCount < 3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">RSS源状态</h3>
        <div className="text-center py-4">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">RSS源状态</h3>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">RSS源状态</h3>
        <button
          onClick={fetchSourceStatus}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          刷新
        </button>
      </div>
      
      {sources.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">暂无RSS源</p>
          <button
            onClick={() => router.push('/sources/my')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            添加RSS源
          </button>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  上次获取
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{source.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{source.url}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(source.fetchFailureCount)}`}>
                      {source.fetchFailureCount === 0 ? '正常' : `失败${source.fetchFailureCount}次`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(source.lastFetchedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleTriggerFetch(source.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      触发获取
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}