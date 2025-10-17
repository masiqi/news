const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://moxiang-distill-api.masiqi.workers.dev';

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // 尝试解析后端返回的错误信息
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || `API错误: ${response.statusText}`);
    } catch (parseError) {
      // 如果无法解析JSON，使用HTTP状态文本
      throw new Error(`API错误: ${response.statusText}`);
    }
  }

  return response.json();
}

export const api = {
  // 认证
  register: (data: { email: string; password: string; username: string }) =>
    apiCall('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiCall('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  // RSS源
  getSources: () => apiCall('/api/v1/sources'),

  getPublicSources: () => apiCall('/api/v1/sources/public'),

  // 内容
  getContent: (params?: { page?: number; pageSize?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    const query = queryParams.toString();
    return apiCall(`/api/v1/content${query ? `?${query}` : ''}`);
  },
};
