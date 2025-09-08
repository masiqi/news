// src/app/api/sources/my/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 从Authorization头或cookie中获取JWT令牌
    let token: string | undefined;
    
    // 首先检查Authorization头
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // 移除 "Bearer " 前缀
    } 
    
    // 如果Authorization头中没有令牌，则检查cookie
    if (!token) {
      token = request.cookies.get('token')?.value;
    }
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: '未提供认证令牌' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 转发请求到后端服务
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/sources/my`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('获取用户RSS源API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}