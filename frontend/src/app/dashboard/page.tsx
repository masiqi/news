'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Source {
  id: number;
  url: string;
  title: string;
  description: string | null;
  isActive: boolean;
  fetchInterval: number;
  lastFetchAt: string | null;
}

interface ContentItem {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  summary: string | null;
  tags: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sources' | 'content'>('content');
  const [sources, setSources] = useState<Source[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [activeTab, router]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'sources') {
        const response = await api.getSources();
        if (response.success) {
          // 新的响应格式：{ success: true, data: { sources: [...], total: n } }
          setSources(response.data?.sources || response.data || []);
        }
      } else {
        const response = await api.getContent();
        if (response.success) {
          setContent(response.data || []);
        }
      }
    } catch (err) {
      setError('加载数据失败');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/');
  };

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://moxiang-distill.masiqi.workers.dev'}/api/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ url: newSourceUrl })
      });

      if (response.ok) {
        setNewSourceUrl('');
        setShowAddSource(false);
        loadData();
      } else {
        setError('添加 RSS 源失败');
      }
    } catch (err) {
      setError('添加 RSS 源失败');
      console.error('Add source error:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="header">
        <div className="container">
          <nav className="nav">
            <div className="logo">墨香蒸馏</div>
            <div className="nav-links">
              <a href="/dashboard">仪表板</a>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                退出登录
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '32px' }}>
        <div style={{ marginBottom: '24px', borderBottom: '2px solid #eee' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <button
              onClick={() => setActiveTab('content')}
              style={{
                padding: '12px 0',
                border: 'none',
                background: 'none',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                borderBottom: activeTab === 'content' ? '2px solid #0070f3' : '2px solid transparent',
                color: activeTab === 'content' ? '#0070f3' : '#666',
                marginBottom: '-2px'
              }}
            >
              内容
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              style={{
                padding: '12px 0',
                border: 'none',
                background: 'none',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                borderBottom: activeTab === 'sources' ? '2px solid #0070f3' : '2px solid transparent',
                color: activeTab === 'sources' ? '#0070f3' : '#666',
                marginBottom: '-2px'
              }}
            >
              RSS 源
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#fee',
            color: '#c33',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {activeTab === 'sources' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700' }}>我的 RSS 源</h2>
              <button
                onClick={() => setShowAddSource(!showAddSource)}
                className="btn btn-primary"
              >
                {showAddSource ? '取消' : '添加 RSS 源'}
              </button>
            </div>

            {showAddSource && (
              <div className="card" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>添加新的 RSS 源</h3>
                <input
                  type="url"
                  className="input"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://example.com/rss"
                  style={{ marginBottom: '12px' }}
                />
                <button onClick={handleAddSource} className="btn btn-primary">
                  确认添加
                </button>
              </div>
            )}

            {loading ? (
              <div className="card">加载中...</div>
            ) : sources.length === 0 ? (
              <div className="card">
                <p style={{ color: '#666', textAlign: 'center' }}>还没有添加 RSS 源，点击上方按钮添加第一个吧！</p>
              </div>
            ) : (
              sources.map((source) => (
                <div key={source.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                        {source.title}
                      </h3>
                      {source.description && (
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                          {source.description}
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: '#999' }}>
                        {source.url}
                      </p>
                      {source.lastFetchAt && (
                        <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                          最后抓取: {formatDate(source.lastFetchAt)}
                        </p>
                      )}
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: source.isActive ? '#e8f5e9' : '#f5f5f5',
                      color: source.isActive ? '#2e7d32' : '#666'
                    }}>
                      {source.isActive ? '活跃' : '已暂停'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>最新内容</h2>

            {loading ? (
              <div className="card">加载中...</div>
            ) : content.length === 0 ? (
              <div className="card">
                <p style={{ color: '#666', textAlign: 'center' }}>还没有内容，添加 RSS 源后系统会自动抓取内容。</p>
              </div>
            ) : (
              content.map((item) => (
                <div key={item.id} className="card">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </h3>
                  {item.summary && (
                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px', lineHeight: '1.6' }}>
                      {item.summary}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {item.tags && item.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 8px',
                          background: '#f0f0f0',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#666'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#999' }}>
                    发布于: {formatDate(item.publishedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
