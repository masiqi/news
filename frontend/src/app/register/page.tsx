'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证密码长度
    if (password.length < 8) {
      setError('密码至少需要8位字符');
      return;
    }

    // 验证密码强度
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      setError('密码必须包含字母和数字');
      return;
    }

    // 验证两次密码是否一致
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await api.register({ email, password, username });

      // 后端返回 { message, token, user }
      if (response.token) {
        // 保存 token 到 localStorage
        localStorage.setItem('auth_token', response.token);
        // 直接跳转到 dashboard，不显示成功提示
        router.push('/dashboard');
      } else {
        setError('注册失败，请重试');
      }
    } catch (err: any) {
      // 显示后端返回的具体错误信息
      const errorMessage = err?.message || '注册失败，请检查网络连接';
      setError(errorMessage);
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '480px', paddingTop: '80px' }}>
      <div className="card">
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
          注册
        </h1>
        <p style={{ color: '#666', textAlign: 'center', marginBottom: '32px' }}>
          创建您的墨香蒸馏账号
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
              用户名
            </label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="您的用户名"
              required
            />
          </div>

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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              密码
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位，包含字母和数字"
              required
            />
            <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              密码至少8位，必须包含字母和数字
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              确认密码
            </label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '16px' }}
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
            已有账号？{' '}
            <a href="/login" style={{ color: '#0070f3', fontWeight: '500' }}>
              立即登录
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
