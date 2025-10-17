/**
 * 统一的API响应格式工具
 * 确保所有API返回格式一致
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 成功响应
 */
export function successResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * 错误响应
 */
export function errorResponse(error: string, code?: string, details?: any): ApiErrorResponse {
  return {
    success: false,
    error,
    ...(code && { code }),
    ...(details && { details })
  };
}

/**
 * 认证相关的特殊成功响应（包含token）
 */
export interface AuthSuccessResponse {
  success: true;
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    username?: string;
  };
}

export function authSuccessResponse(
  message: string,
  token: string,
  user: { id: number; email: string; username?: string }
): AuthSuccessResponse {
  return {
    success: true,
    message,
    token,
    user
  };
}
