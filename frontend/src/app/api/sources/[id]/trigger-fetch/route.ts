import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`前端API: 开始处理RSS源 ${params.id} 触发获取请求`);
    
    const user = await getAuthUser(request);
    if (!user) {
      console.log(`前端API: 用户未认证`);
      return new Response(
        JSON.stringify({ error: '未认证' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sourceId = params.id;
    console.log(`前端API: 用户 ${user.email} 请求触发RSS源 ${sourceId} 获取`);

    const response = await fetch(`${process.env.BACKEND_URL}/sources/${sourceId}/trigger-fetch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log(`前端API: 后端响应状态: ${response.status}`, data);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error || '后端服务错误' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('前端API: 触发RSS源获取失败:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}