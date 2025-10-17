'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token')
      setIsLoggedIn(!!token)
    }
  }, [])

  return (
    <div>
      <header className="header">
        <div className="container">
          <nav className="nav">
            <div className="logo">墨香蒸馏</div>
            <div className="nav-links">
              {isLoggedIn ? (
                <>
                  <a href="/dashboard/">控制台</a>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      localStorage.removeItem('auth_token')
                      setIsLoggedIn(false)
                    }}
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <a href="/login/">登录</a>
                  <a href="/register/">注册</a>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="container" style={{ padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '700', marginBottom: '24px' }}>
            墨香蒸馏
          </h1>
          <p style={{ fontSize: '20px', color: '#666', marginBottom: '40px' }}>
            基于 AI 的个性化新闻聚合与推送平台
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}>
            {isLoggedIn ? (
              <button 
                className="btn btn-primary" 
                style={{ fontSize: '16px', padding: '14px 32px' }}
                onClick={() => router.push('/dashboard/')}
              >
                进入控制台
              </button>
            ) : (
              <>
                <button 
                  className="btn btn-primary" 
                  style={{ fontSize: '16px', padding: '14px 32px' }}
                  onClick={() => router.push('/register/')}
                >
                  立即开始
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '16px', padding: '14px 32px' }}
                  onClick={() => router.push('/login/')}
                >
                  登录
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginTop: '60px' }}>
            <div className="card" style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>📰 RSS 聚合</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                订阅您喜欢的 RSS 源，一站式管理所有新闻来源
              </p>
            </div>
            <div className="card" style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>🤖 AI 分析</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                使用 Cloudflare Workers AI 智能提取新闻摘要和关键信息
              </p>
            </div>
            <div className="card" style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>☁️ 云端存储</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                自动保存到 Cloudflare R2，支持 Obsidian 同步
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
        <p>墨香蒸馏 © 2025 | 基于 Cloudflare Workers 构建</p>
        <p style={{ marginTop: '8px' }}>
          <a href="https://moxiang-distill-admin.pages.dev" target="_blank" style={{ color: '#0070f3' }}>
            管理后台
          </a>
          {' | '}
          <a href="https://moxiang-distill.masiqi.workers.dev/api/health" target="_blank" style={{ color: '#0070f3' }}>
            API 状态
          </a>
        </p>
      </footer>
    </div>
  )
}
