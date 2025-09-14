// src/app/api/sources/public/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 转发请求到后端服务
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/sources/public`);
    
    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('获取公共RSS源API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}