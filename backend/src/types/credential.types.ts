// src/types/credential.types.ts
import { ModelConfigSelection } from './ai.types';

/**
 * 同步凭证类型定义
 */

export interface SyncCredential {
  id: string;
  userId: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  bucket: string;
  prefix: string; // 用户专属前缀，确保数据隔离
  permissions: 'readonly';
  expiresAt?: Date;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialLog {
  id: string;
  credentialId: string;
  userId: string;
  action: 'created' | 'accessed' | 'revoked' | 'regenerated' | 'deleted';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface CredentialAPI {
  // 创建凭证
  POST /api/credentials: {
    body: { name: string };
    response: { credential: SyncCredential };
  }
  
  // 获取用户凭证列表
  GET /api/credentials: {
    response: { credentials: SyncCredential[] };
  }
  
  // 获取凭证详情
  GET /api/credentials/:id: {
    params: { id: string };
    response: { credential: SyncCredential };
  }
  
  // 撤销凭证
  DELETE /api/credentials/:id: {
    params: { id: string };
    response: { success: boolean; message: string };
  }
  
  // 重新生成凭证
  POST /api/credentials/:id/regenerate: {
    params: { id: string };
    response: { credential: SyncCredential };
  }
  
  // 获取凭证统计
  GET /api/credentials/stats: {
    response: {
      totalCredentials: number;
      activeCredentials: number;
      expiredCredentials: number;
      mostRecentlyUsed: SyncCredential | null;
    };
  }
  
  // 验证凭证
  POST /api/credentials/:id/validate: {
    params: { id: string };
    body: { accessKeyId: string; secretAccessKey: string; region: string; bucket: string; };
    response: {
      isValid: boolean;
      credential?: SyncCredential;
      error?: string;
    };
  }
  
  // 记录凭证使用
  POST /api/credentials/:id/usage: {
    params: { id: string };
    body: { details?: Record<string, any> };
    response: { success: boolean; message: string };
  }
  
  // 获取配置说明
  GET /api/credentials/guide/:platform: {
    params: { platform: 'obsidian' | 'logseq' | 'other' };
    response: { guide: ConfigurationGuide };
  }
  
  // 获取审计日志
  GET /api/credentials/logs: {
    query: { limit?: number; offset?: number; action?: string; };
    response: { logs: CredentialLog[]; total: number };
  }
}

export interface ConfigurationGuide {
  platform: 'obsidian' | 'logseq' | 'other';
  title: string;
  description: string;
  sections: GuideSection[];
  setupSteps: SetupStep[];
  screenshots?: string[];
  troubleshootingTips?: string[];
  lastUpdated: Date;
  version: string;
}

export interface GuideSection {
  title: string;
  content: string;
  importance: 'required' | 'recommended' | 'optional';
}

export interface SetupStep {
  step: number;
  title: string;
  description: string;
  instructions: string[];
  expectedOutput?: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface CreateCredentialRequest {
  name: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
}

export interface ValidateCredentialRequest {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

export interface CredentialStats {
  totalCredentials: number;
  activeCredentials: number;
  expiredCredentials: number;
  mostRecentlyUsed: SyncCredential | null;
}

export interface R2TestResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: Date;
  method: string;
}

// 导出类型，方便其他文件使用
export type CredentialAction = 'created' | 'accessed' | 'revoked' | 'regenerated' | 'deleted';
export type PermissionLevel = 'readonly' | 'write' | 'admin';
export type CloudflareRegion = 'auto' | 'us-east-1' | 'us-east-2' | 'us-west-1' | 'us-west-2' | 'eu-west-1' | 'eu-west-2' | 'asia-east-1' | 'asia-east-2';
export type SyncPlatform = 'obsidian' | 'logseq' | 'general' | 'other';