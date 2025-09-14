import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取内容ID
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');

    if (!contentId) {
      return NextResponse.json({
        success: false,
        error: '缺少内容ID参数'
      }, { status: 400 });
    }

    if (!/^\d+$/.test(contentId)) {
      return NextResponse.json({
        success: false,
        error: '无效的内容ID格式'
      }, { status: 400 });
    }

    // 调用后端服务进行重新处理
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/api/content/reprocess?id=${contentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        error: errorData.error || `后端服务错误: ${response.status}`
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('AI重新处理失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}