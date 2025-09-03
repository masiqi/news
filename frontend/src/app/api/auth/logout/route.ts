import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取请求数据
    const body = await request.json();
    const { token } = body;

    // 验证输入
    if (!token) {
      return new Response(
        JSON.stringify({ error: '认证令牌是必填项' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 调用后端服务进行登出
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      // 登出成功，清除HttpOnly Cookie存储的JWT令牌
      const cookieHeader = `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
      
      return new Response(
        JSON.stringify({ message: '登出成功' }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': cookieHeader
          } 
        }
      );
    } else {
      // 登出失败
      return new Response(
        JSON.stringify({ error: data.error || '登出失败' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('登出API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}