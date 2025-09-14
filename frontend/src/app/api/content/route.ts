import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数（内容列表）
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sourceId = searchParams.get('sourceId');
    const hasWebContent = searchParams.get('hasWebContent');
    const hasTopics = searchParams.get('hasTopics');
    const searchQuery = searchParams.get('searchQuery');

    // 构建查询参数
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    });

    if (sourceId) params.append('sourceId', sourceId);
    if (hasWebContent) params.append('hasWebContent', hasWebContent);
    if (hasTopics) params.append('hasTopics', hasTopics);
    if (searchQuery) params.append('searchQuery', searchQuery);

    // 从后端API获取数据
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/api/content?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    
    // 转换数据格式以匹配前端期望的格式
    const transformedContents = data.contents?.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content || item.description || '',
      link: item.link,
      sourceId: item.sourceId,
      sourceName: item.sourceName || `源 ${item.sourceId}`,
      publishedAt: item.publishedAt || item.createdAt,
      processedAt: item.processedAt || item.updatedAt,
      webContent: (typeof item.webContent === 'string' ? item.webContent : undefined),
      topics: item.topics ? (Array.isArray(item.topics) ? item.topics : []) : [],
      keywords: item.keywords ? (Array.isArray(item.keywords) ? item.keywords : []) : [],
      sentiment: item.sentiment,
      analysis: item.analysis,
      educationalValue: item.educationalValue,
      wordCount: item.wordCount || 0
    })) || [];

    return NextResponse.json({
      success: true,
      contents: transformedContents,
      pagination: data.pagination || {
        page,
        pageSize,
        total: 0,
        totalPages: 0
      }
    });

  } catch (error) {
    console.error('Error fetching contents:', error);
    return NextResponse.json(
      { 
        error: '获取内容失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}