import { describe, it, expect, beforeEach } from 'vitest';
import { AccessControlService } from '../src/services/access-control.service';
import { R2Service } from '../src/services/r2.service';
import { PermissionChecker } from '../src/utils/permission-checker';
import { validatePath, buildUserPath } from '../src/utils/path-validator';

// Mock Cloudflare环境
const mockEnv = {
  DB: {} as any,
  R2_BUCKET: {
    put: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  } as any,
  JWT_SECRET: 'test-secret',
  R2_BUCKET_NAME: 'test-bucket',
  R2_REGION: 'auto',
  R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
} as CloudflareBindings;

describe('多用户R2访问控制测试', () => {
  let accessControlService: AccessControlService;
  let r2Service: R2Service;

  beforeEach(() => {
    // 重置mock
    vi.clearAllMocks();
    
    // 创建服务实例
    accessControlService = new AccessControlService(mockEnv.DB);
    r2Service = new R2Service(mockEnv);
  });

  describe('路径验证', () => {
    it('应该验证用户路径格式', () => {
      const validPath = 'user-123/document.txt';
      const invalidPath = '../document.txt';
      
      const validResult = validatePath(validPath);
      const invalidResult = validatePath(invalidPath);
      
      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('应该构建正确的用户路径', () => {
      const userId = 123;
      const subPath = 'documents/test';
      
      const path = buildUserPath(userId, subPath);
      expect(path).toBe('user-123/documents/test');
    });
  });

  describe('权限检查', () => {
    it('应该正确验证用户权限', () => {
      const permissions = [
        {
          resource: 'user-123/*',
          actions: ['read', 'write', 'list']
        }
      ];

      const result = PermissionChecker.checkAccess(
        permissions,
        'user-123/document.txt',
        'read',
        { userId: 123 }
      );

      expect(result.hasPermission).toBe(true);
    });

    it('应该拒绝跨用户访问', () => {
      const permissions = [
        {
          resource: 'user-123/*',
          actions: ['read', 'write', 'list']
        }
      ];

      const result = PermissionChecker.checkAccess(
        permissions,
        'user-456/document.txt',
        'read',
        { userId: 123 }
      );

      expect(result.hasPermission).toBe(false);
    });
  });

  describe('R2服务集成', () => {
    it('应该创建用户目录', async () => {
      mockEnv.R2_BUCKET.put.mockResolvedValue({});

      const result = await r2Service.createUserDirectory(123);
      expect(result).toBe(true);
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith('user-123/.gitkeep', new Uint8Array());
    });

    it('应该验证用户访问权限', async () => {
      mockEnv.R2_BUCKET.get.mockResolvedValue({});

      const result = await r2Service.validateUserAccess(123, 'user-123/document.txt');
      expect(result).toBe(true);
    });

    it('应该拒绝跨用户访问', async () => {
      const result = await r2Service.validateUserAccess(123, 'user-456/document.txt');
      expect(result).toBe(false);
    });
  });

  describe('安全功能', () => {
    it('应该防止路径遍历攻击', () => {
      const maliciousPaths = [
        '../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '../../../etc/passwd',
        '..\\windows\\system32',
        'user-123/../etc/passwd',
        'user-123\\..\\..\\windows\\system32'
      ];

      maliciousPaths.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(false);
      });
    });

    it('应该防止目录遍历', () => {
      const maliciousPaths = [
        'user-123/../user-456/secret.txt',
        'user-123/../../global/config.txt',
        'user-123/../../../system files/password.txt'
      ];

      maliciousPaths.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('配额管理', () => {
    it('应该检查存储配额', async () => {
      const mockUsage = { totalSize: 1024, fileCount: 10 };
      
      // 模拟R2服务返回使用情况
      mockEnv.R2_BUCKET.list.mockResolvedValue({
        objects: [
          { key: 'user-123/file1.txt', size: 512 },
          { key: 'user-123/file2.txt', size: 512 }
        ]
      });

      const usage = await r2Service.getUserStorageUsage(123);
      expect(usage.totalSize).toBe(1024);
      expect(usage.fileCount).toBe(2);
    });
  });

  describe('路径前缀隔离', () => {
    it('应该确保路径隔离', () => {
      const userId = 123;
      const pathPrefix = `user-${userId}/`;

      // 测试用户只能访问自己的路径
      const userFiles = [
        `${pathPrefix}document.txt`,
        `${pathPrefix}notes/personal.md`,
        `${pathPrefix}config/settings.json`
      ];

      const otherUserFiles = [
        'user-456/document.txt',
        'user-789/notes/personal.md',
        'global/config/settings.json'
      ];

      userFiles.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(true);
      });

      otherUserFiles.forEach(async path => {
        const result = await r2Service.validateUserAccess(userId, path);
        expect(result).toBe(false);
      });
    });
  });
});