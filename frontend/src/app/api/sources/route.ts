import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// 获取所有RSS源
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: '未认证' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(`${process.env.BACKEND_URL}/sources/my`, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: '后端服务错误' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sources = await response.json();
    return new Response(JSON.stringify(sources), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取RSS源失败:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 创建新的RSS源
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: '未认证' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const response = await fetch(`${process.env.BACKEND_URL}/sources`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: '后端服务错误' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const source = await response.json();
    return new Response(JSON.stringify(source), {
      headers: { 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    console.error('创建RSS源失败:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
