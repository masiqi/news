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

    // 调用后端服务进行登录
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // 登录成功，设置Cookie存储JWT令牌（非HttpOnly，以便前端JavaScript可以访问）
      const cookieHeader = `token=${data.token}; Path=/; Max-Age=86400; SameSite=Strict`;
      
      return new Response(
        JSON.stringify({ 
          message: '登录成功', 
          user: data.user,
          token: data.token
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': cookieHeader
          } 
        }
      );
    } else {
      // 登录失败
      return new Response(
        JSON.stringify({ error: data.error || '登录失败' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('登录API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}