// src/app/sources/public/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Source {
  id: number;
  userId: number;
  url: string;
  name: string;
  isPublic: boolean;
  originalSourceId: number | null;
  createdAt: string;
}

export default function PublicSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchPublicSources();
  }, []);

  const fetchPublicSources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sources/public');
      const data = await response.json();
      
      if (response.ok) {
        setSources(data.sources);
      } else {
        setError(data.error || '获取公共源失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySource = async (sourceId: number) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('源复制成功！');
        router.push('/sources/my');
      } else {
        alert(data.error || '复制源失败');
      }
    } catch (err) {
      alert('网络错误');
    }
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
          <h1 className="text-3xl font-bold text-gray-900">公共RSS源</h1>
          <button
            onClick={() => router.push('/sources/my')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            我的源
          </button>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                {error}
              </div>
            )}
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">可用的公共RSS源</h2>
              {sources.length === 0 ? (
                <p>暂无公共RSS源</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sources.map((source) => (
                    <div key={source.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{source.url}</p>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          公共
                        </span>
                        <button
                          onClick={() => handleCopySource(source.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          复制
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}