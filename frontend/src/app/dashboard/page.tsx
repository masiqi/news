'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate, translateSentiment } from '@/lib/utils';

interface Source {
  id: number;
  url: string;
  title: string;
  name: string;
  description: string | null;
  isActive: boolean;
  fetchInterval: number;
  lastFetchAt: string | null;
  fetchFailureCount: number;
}

interface ContentItem {
  id: number;
  title: string;
  content: string;
  link: string;
  sourceId: number;
  sourceName: string;
  publishedAt: string;
  processedAt: string | null;
  webContent: string | null;
  topics: string[];
  keywords: string[];
  sentiment: string | null;
  analysis: string | null;
  educationalValue: string | null;
  wordCount: number | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sources' | 'content'>('content');
  const [sources, setSources] = useState<Source[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({
    url: '',
    name: '',
    description: '',
    isPublic: false
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [activeTab, currentPage, router]);

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
        const response = await api.getContent({ page: currentPage, pageSize: 20 });
        if (response.success) {
          // API 返回 { success: true, contents: [...], pagination: {...} }
          setContent(response.contents || []);
          if (response.pagination) {
            setPagination(response.pagination);
          }
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
    // 验证必填字段
    if (!newSource.url.trim()) {
      setError('RSS地址不能为空');
      return;
    }
    if (!newSource.name.trim()) {
      setError('RSS名称不能为空');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://moxiang-distill-api.masiqi.workers.dev'}/api/v1/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          url: newSource.url,
          name: newSource.name,
          description: newSource.description,
          isPublic: newSource.isPublic
        })
      });

      if (response.ok) {
        // 重置表单
        setNewSource({ url: '', name: '', description: '', isPublic: false });
        setShowAddSource(false);
        loadData();
      } else {
        const data = await response.json();
        setError(data.error || '添加 RSS 源失败');
      }
    } catch (err: any) {
      setError(err?.message || '添加 RSS 源失败');
      console.error('Add source error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerFetch = async (sourceId: number) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://moxiang-distill-api.masiqi.workers.dev'}/api/v1/sources/${sourceId}/trigger-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setError('');
        alert('抓取任务已提交到队列，请稍后查看结果');
        loadData();
      } else {
        setError(data.error || '触发抓取失败');
      }
    } catch (err: any) {
      setError(err?.message || '触发抓取失败');
      console.error('Trigger fetch error:', err);
    } finally {
      setLoading(false);
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

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    RSS名称 <span style={{ color: '#c33' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    placeholder="例如：阮一峰的网络日志"
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    RSS地址 <span style={{ color: '#c33' }}>*</span>
                  </label>
                  <input
                    type="url"
                    className="input"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    placeholder="https://example.com/rss.xml"
                    required
                  />
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    输入完整的RSS订阅地址
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    描述信息
                  </label>
                  <textarea
                    className="input"
                    value={newSource.description}
                    onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                    placeholder="简要描述这个RSS源的内容（选填）"
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newSource.isPublic}
                      onChange={(e) => setNewSource({ ...newSource, isPublic: e.target.checked })}
                      style={{ marginRight: '8px', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '14px' }}>
                      设为公开源（其他用户也可以订阅）
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleAddSource}
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? '添加中...' : '确认添加'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddSource(false);
                      setNewSource({ url: '', name: '', description: '', isPublic: false });
                      setError('');
                    }}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    取消
                  </button>
                </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                        {source.name || source.title}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: source.fetchFailureCount < 5 ? '#e8f5e9' : '#f5f5f5',
                        color: source.fetchFailureCount < 5 ? '#2e7d32' : '#666'
                      }}>
                        {source.fetchFailureCount < 5 ? '活跃' : '已暂停'}
                      </span>
                      <button
                        onClick={() => handleTriggerFetch(source.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={loading}
                      >
                        立即抓取
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700' }}>最新内容</h2>
              {pagination.total > 0 && (
                <p style={{ color: '#666', fontSize: '14px' }}>
                  共 {pagination.total} 条内容
                </p>
              )}
            </div>

            {loading ? (
              <div className="card">加载中...</div>
            ) : content.length === 0 ? (
              <div className="card">
                <p style={{ color: '#666', textAlign: 'center' }}>还没有内容，添加 RSS 源后系统会自动抓取内容。</p>
              </div>
            ) : (
              <>
                {content.map((item) => (
                  <div
                    key={item.id}
                    className="card"
                    style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                    onClick={() => setSelectedContent(item)}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', flex: 1, marginRight: '16px' }}>
                        {item.title}
                      </h3>
                      <span style={{
                        padding: '4px 8px',
                        background: '#e3f2fd',
                        color: '#1976d2',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.sourceName}
                      </span>
                    </div>

                    {item.analysis && (
                      <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px', lineHeight: '1.6' }}>
                        {item.analysis.length > 200 ? item.analysis.substring(0, 200) + '...' : item.analysis}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {item.topics && item.topics.length > 0 && item.topics.slice(0, 3).map((topic, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            background: '#e8f5e9',
                            color: '#2e7d32',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          📚 {topic}
                        </span>
                      ))}
                      {item.keywords && item.keywords.length > 0 && item.keywords.slice(0, 3).map((keyword, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            background: '#fff3e0',
                            color: '#e65100',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                        >
                          🔑 {keyword}
                        </span>
                      ))}
                      {item.sentiment && (
                        <span
                          style={{
                            padding: '4px 10px',
                            background: '#f3e5f5',
                            color: '#7b1fa2',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                        >
                          😊 {translateSentiment(item.sentiment)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '12px', color: '#999' }}>
                        发布于: {formatDate(item.publishedAt)}
                      </p>
                      <span style={{ fontSize: '12px', color: '#0070f3' }}>
                        点击查看详情 →
                      </span>
                    </div>
                  </div>
                ))}

                {/* 分页控件 */}
                {pagination.totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '32px',
                    padding: '20px 0'
                  }}>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary"
                      style={{
                        padding: '8px 16px',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ← 上一页
                    </button>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              padding: '8px 12px',
                              border: currentPage === pageNum ? '2px solid #0070f3' : '1px solid #ddd',
                              borderRadius: '6px',
                              background: currentPage === pageNum ? '#0070f3' : 'white',
                              color: currentPage === pageNum ? 'white' : '#333',
                              cursor: 'pointer',
                              fontWeight: currentPage === pageNum ? '600' : '400',
                              minWidth: '40px'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="btn btn-secondary"
                      style={{
                        padding: '8px 16px',
                        opacity: currentPage === pagination.totalPages ? 0.5 : 1,
                        cursor: currentPage === pagination.totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      下一页 →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 内容详情弹窗 */}
        {selectedContent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setSelectedContent(null)}
          >
            <div
              className="card"
              style={{
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedContent(null)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: '32px',
                  textAlign: 'center'
                }}
              >
                ×
              </button>

              <div style={{ marginBottom: '16px' }}>
                <span style={{
                  padding: '4px 12px',
                  background: '#e3f2fd',
                  color: '#1976d2',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  {selectedContent.sourceName}
                </span>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', paddingRight: '40px' }}>
                {selectedContent.title}
              </h2>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {selectedContent.topics && selectedContent.topics.map((topic, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '6px 12px',
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      borderRadius: '16px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    📚 {topic}
                  </span>
                ))}
                {selectedContent.keywords && selectedContent.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '6px 12px',
                      background: '#fff3e0',
                      color: '#e65100',
                      borderRadius: '16px',
                      fontSize: '13px'
                    }}
                  >
                    🔑 {keyword}
                  </span>
                ))}
              </div>

              {selectedContent.sentiment && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#f3e5f5', borderRadius: '8px' }}>
                  <strong style={{ color: '#7b1fa2' }}>情感倾向：</strong>
                  <span style={{ marginLeft: '8px' }}>{translateSentiment(selectedContent.sentiment)}</span>
                </div>
              )}

              {selectedContent.analysis && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                    📝 AI 分析
                  </h3>
                  <p style={{ color: '#666', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {selectedContent.analysis}
                  </p>
                </div>
              )}

              {selectedContent.educationalValue && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                    🎓 教育价值
                  </h3>
                  <p style={{ color: '#666', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {selectedContent.educationalValue}
                  </p>
                </div>
              )}

              {selectedContent.content && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                    📄 原文内容
                  </h3>
                  <div
                    style={{
                      color: '#666',
                      lineHeight: '1.8',
                      maxHeight: '400px',
                      overflow: 'auto',
                      padding: '16px',
                      background: '#f9f9f9',
                      borderRadius: '8px'
                    }}
                    dangerouslySetInnerHTML={{ __html: selectedContent.content }}
                  />
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '20px',
                borderTop: '1px solid #eee'
              }}>
                <div style={{ fontSize: '13px', color: '#999' }}>
                  <p>发布时间: {formatDate(selectedContent.publishedAt)}</p>
                  {selectedContent.wordCount && (
                    <p style={{ marginTop: '4px' }}>字数: {selectedContent.wordCount}</p>
                  )}
                </div>
                {selectedContent.link && (
                  <a
                    href={selectedContent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    查看原文 →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
