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
    throw new Error(`API错误: ${response.statusText}`);
  }
  
  return response.json();
}

export const api = {
  // 认证
  register: (data: { email: string; password: string; username: string }) =>
    apiCall('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  login: (data: { email: string; password: string }) =>
    apiCall('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  
  // RSS源
  getSources: () => apiCall('/api/sources'),
  
  getPublicSources: () => apiCall('/api/sources/public'),
  
  // 内容
  getContent: () => apiCall('/api/content'),
};
