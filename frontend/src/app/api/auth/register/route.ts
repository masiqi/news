import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取请求数据
    const body = await request.json();
    const { email, password } = body;

    // 验证输入
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: '邮箱和密码是必填项' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: '请输入有效的邮箱地址' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证密码强度
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: '密码至少需要8位字符' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return new Response(
        JSON.stringify({ error: '密码必须包含字母和数字' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 调用后端服务进行注册
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // 注册成功
      return new Response(
        JSON.stringify({ message: '注册成功', user: data.user }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // 注册失败
      return new Response(
        JSON.stringify({ error: data.error || '注册失败' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('注册API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}