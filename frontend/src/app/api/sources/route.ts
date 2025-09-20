import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// 后端URL配置
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

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

    console.log(`[API] 获取用户RSS源, 用户ID: ${user.id}, 后端URL: ${BACKEND_URL}`);
    
    const response = await fetch(`${BACKEND_URL}/sources/my`, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[API] 获取RSS源失败, HTTP状态: ${response.status}`);
      return new Response(
        JSON.stringify({ error: '后端服务错误' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sources = await response.json();
    console.log(`[API] 获取RSS源成功, 数量: ${sources.data?.sources?.length || 0}`);
    
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
    console.log(`[API] 创建RSS源, 用户ID: ${user.id}, 源名称: ${body.name}, 后端URL: ${BACKEND_URL}`);
    
    const response = await fetch(`${BACKEND_URL}/sources`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[API] 创建RSS源失败, HTTP状态: ${response.status}`);
      const errorText = await response.text();
      console.error(`[API] 后端错误响应: ${errorText}`);
      
      return new Response(
        JSON.stringify({ error: '后端服务错误' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const source = await response.json();
    console.log(`[API] 创建RSS源成功, 源ID: ${source.data?.source?.id}`);
    
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
