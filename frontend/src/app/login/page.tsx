'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login({ email, password });

      // 后端返回 { message, token, user }
      if (response.token) {
        // 保存 token 到 localStorage
        localStorage.setItem('auth_token', response.token);
        // 直接跳转到 dashboard
        router.push('/dashboard');
      } else {
        setError('登录失败，请重试');
      }
    } catch (err: any) {
      // 显示后端返回的具体错误信息
      const errorMessage = err?.message || '登录失败，请检查邮箱和密码';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '480px', paddingTop: '80px' }}>
      <div className="card">
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
          登录
        </h1>
        <p style={{ color: '#666', textAlign: 'center', marginBottom: '32px' }}>
          登录到墨香蒸馏平台
        </p>

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              邮箱
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              密码
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '16px' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
            还没有账号？{' '}
            <a href="/register" style={{ color: '#0070f3', fontWeight: '500' }}>
              立即注册
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
