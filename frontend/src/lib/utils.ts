import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// 用于处理loading状态
export function createLoadingState<T>(data: T, loading: boolean): { data: T | null; loading: boolean } {
  return {
    data: loading ? null : data,
    loading,
  };
}

// 用于处理error状态
export function createErrorState(error: Error | null | undefined): { error: string | null; hasError: boolean } {
  return {
    error: error?.message || null,
    hasError: !!error,
  };
}

// 限制文本长度
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// 格式化日期
export function formatDate(date: string | Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'short' ? 'numeric' : 'long',
    day: 'numeric',
    hour: format === 'short' ? undefined : '2-digit',
    minute: format === 'short' ? undefined : '2-digit',
    second: format === 'short' ? undefined : '2-digit',
  };

  return dateObj.toLocaleDateString('zh-CN', options);
}

// 格式化数字
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  return num.toLocaleString('zh-CN', { ...defaultOptions, ...options });
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 生成随机ID
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

// 深拷贝对象
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// 数组去重
export function removeDuplicates<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

// 排序数组
export function sortByKey<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  const sorted = [...array];
  sorted.sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });
  
  return sorted;
}

// 检查对象是否为空
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string' && obj.trim() === '') return true;
  if (Array.isArray(obj) && obj.length === 0) return true;
  if (typeof obj === 'object' && Object.keys(obj).length === 0) return true;
  return false;
}

// 安全地获取嵌套对象属性
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastResult: ReturnType<T> | null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      inThrottle = true;
      
      try {
        lastResult = func(...args);
      } finally {
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    }
    
    return lastResult;
  };
}

// 本地存储封装
export const storage = {
  get: <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set localStorage item: ${key}`, error);
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove localStorage item: ${key}`, error);
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage', error);
    }
  },
};

// 会话存储封装
export const session = {
  get: <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set sessionStorage item: ${key}`, error);
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove sessionStorage item: ${key}`, error);
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('Failed to clear sessionStorage', error);
    }
  },
};

// API 配置
export const API_CONFIG = {
  // 开发环境使用本地地址，生产环境使用环境变量或默认 Workers 地址
  baseURL: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8787' 
    : (process.env.NEXT_PUBLIC_API_URL || 'https://moxiang-distill.workers.dev'),
  
  // API 超时时间
  timeout: 30000,
  
  // 重试配置
  retry: {
    attempts: 3,
    delay: 1000,
  },
  
  // 获取完整的 API URL
  getFullUrl: (path: string): string => {
    // 如果已经是完整 URL，直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // 确保 path 以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_CONFIG.baseURL}${normalizedPath}`;
  },
  
  // 通用的 API 请求函数
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = API_CONFIG.getFullUrl(endpoint);
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    // 添加认证令牌
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        defaultOptions.headers = {
          ...defaultOptions.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }
    
    const fetchOptions = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  },
  
  // GET 请求
  async get<T>(endpoint: string): Promise<T> {
    return API_CONFIG.request<T>(endpoint, { method: 'GET' });
  },
  
  // POST 请求
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return API_CONFIG.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  // PUT 请求
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return API_CONFIG.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  // DELETE 请求
  async delete<T>(endpoint: string): Promise<T> {
    return API_CONFIG.request<T>(endpoint, { method: 'DELETE' });
  },
};