// src/app/sources/my/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationMenu from '@/components/NavigationMenu';

interface Source {
  id: number;
  userId: number;
  url: string;
  name: string;
  isPublic: boolean;
  originalSourceId: number | null;
  createdAt: string;
}

export default function MySourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchMySources();
  }, []);

  const fetchMySources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sources/my');
      const data = await response.json();
      
      if (response.ok) {
        setSources(data.sources);
      } else {
        setError(data.error || '获取我的源失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSource) {
        // 编辑模式
        const response = await fetch(`/api/sources/${editingSource.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, url, description, isPublic }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setEditingSource(null);
          setName('');
          setUrl('');
          setDescription('');
          setIsPublic(false);
          setShowForm(false);
          fetchMySources(); // 重新获取源列表
        } else {
          alert(data.error || '更新源失败');
        }
      } else {
        // 创建模式
        const response = await fetch('/api/sources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, url, description, isPublic }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setName('');
          setUrl('');
          setDescription('');
          setIsPublic(false);
          setShowForm(false);
          fetchMySources(); // 重新获取源列表
        } else {
          alert(data.error || '创建源失败');
        }
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  const handleEditSource = (source: Source) => {
    setEditingSource(source);
    setName(source.name);
    setUrl(source.url);
    setDescription(source.description || '');
    setIsPublic(source.isPublic);
    setShowForm(true);
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!confirm('确定要删除这个源吗？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        fetchMySources(); // 重新获取源列表
      } else {
        alert(data.error || '删除源失败');
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
      {/* 导航栏 */}
      <NavigationMenu />
      
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                {error}
              </div>
            )}
            
            {showForm && (
              <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 mb-6">
                <h2 className="text-xl font-semibold mb-4">{editingSource ? '编辑RSS源' : '添加新的RSS源'}</h2>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                        名称
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="url" className="block text-sm font-medium text-gray-900">
                        URL
                      </label>
                      <input
                        type="url"
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-900">
                        描述（可选）
                      </label>
                      <textarea
                        id="description"
                        value={description || ''}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        id="isPublic"
                        name="isPublic"
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                        公开源
                      </label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {editingSource ? '更新源' : '添加源'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
            
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">我的RSS源</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => router.push('/sources/public')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    公共源
                  </button>
                  <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {showForm ? '取消' : '添加源'}
                  </button>
                </div>
              </div>
              
              {sources.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-700 mb-4">暂无RSS源</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    添加第一个RSS源
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sources.map((source) => (
                    <div key={source.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900">{source.name}</h3>
                      {source.description && (
                        <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1 truncate">{source.url}</p>
                      <div className="mt-4 flex justify-between items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          source.isPublic 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {source.isPublic ? '公共' : '私有'}
                        </span>
                        <div className="space-x-2">
                          {source.originalSourceId && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              副本
                            </span>
                          )}
                          <button
                            onClick={() => handleEditSource(source)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteSource(source.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            删除
                          </button>
                        </div>
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