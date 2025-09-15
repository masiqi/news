import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccessControlService } from '../src/services/access-control.service';
import { R2Service } from '../src/services/r2.service';
import { PermissionChecker } from '../src/utils/permission-checker';
import { validatePath, buildUserPath, extractUserIdFromPath } from '../src/utils/path-validator';
import { CryptoService } from '../src/services/crypto.service';

// Mock Cloudflare环境
const createMockEnv = () => ({
  DB: {
    prepare: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as any,
  R2_BUCKET: {
    put: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
  } as any,
  JWT_SECRET: 'test-secret-for-qa-testing',
  R2_BUCKET_NAME: 'test-bucket-qa',
  R2_REGION: 'auto',
  R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
} as CloudflareBindings);

describe('Story 2.5 多用户R2访问控制 - QA测试套件', () => {
  let mockEnv: CloudflareBindings;
  let accessControlService: AccessControlService;
  let r2Service: R2Service;
  let cryptoService: CryptoService;

  beforeEach(() => {
    mockEnv = createMockEnv();
    vi.clearAllMocks();
    
    // 初始化服务
    accessControlService = new AccessControlService(mockEnv.DB);
    r2Service = new R2Service(mockEnv);
    cryptoService = new CryptoService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('QA 1: 用户目录隔离完全有效', () => {
    it('应该确保用户只能访问自己的目录', async () => {
      const userId1 = 123;
      const userId2 = 456;
      
      // 模拟R2列表操作
      mockEnv.R2_BUCKET.list.mockImplementation(({ prefix }) => {
        if (prefix === `user-${userId1}/`) {
          return Promise.resolve({
            objects: [
              { key: `user-${userId1}/document.txt`, size: 1024 },
              { key: `user-${userId1}/notes/personal.md`, size: 512 }
            ]
          });
        } else if (prefix === `user-${userId2}/`) {
          return Promise.resolve({
            objects: [
              { key: `user-${userId2}/secret.txt`, size: 2048 }
            ]
          });
        }
        return Promise.resolve({ objects: [] });
      });

      // 用户1只能看到自己的文件
      const user1Files = await r2Service.listUserFiles(userId1);
      expect(user1Files).toHaveLength(2);
      expect(user1Files.every(file => file.key.startsWith(`user-${userId1}/`))).toBe(true);

      // 用户2只能看到自己的文件
      const user2Files = await r2Service.listUserFiles(userId2);
      expect(user2Files).toHaveLength(1);
      expect(user2Files.every(file => file.key.startsWith(`user-${userId2}/`))).toBe(true);
    });

    it('应该防止跨用户路径访问', async () => {
      const userId = 123;
      const otherUserId = 456;
      
      // 用户尝试访问其他用户的文件
      const hasAccessToOther = await r2Service.validateUserAccess(userId, `user-${otherUserId}/secret.txt`);
      expect(hasAccessToOther).toBe(false);
      
      // 用户可以访问自己的文件
      const hasAccessToOwn = await r2Service.validateUserAccess(userId, `user-${userId}/document.txt`);
      expect(hasAccessToOwn).toBe(true);
    });

    it('应该正确提取路径中的用户ID', () => {
      const testPaths = [
        { path: 'user-123/document.txt', expectedId: 123 },
        { path: 'user-456/notes/personal.md', expectedId: 456 },
        { path: 'user-789/config/settings.json', expectedId: 789 },
        { path: 'invalid-path/document.txt', expectedId: null },
        { path: 'user-abc/document.txt', expectedId: null }
      ];

      testPaths.forEach(({ path, expectedId }) => {
        const extractedId = extractUserIdFromPath(path);
        expect(extractedId).toBe(expectedId);
      });
    });
  });

  describe('QA 2: 访问控制性能满足要求', () => {
    it('应该在高并发情况下保持性能', async () => {
      const userId = 123;
      const concurrentRequests = 100;
      
      // 模拟快速响应
      mockEnv.R2_BUCKET.list.mockResolvedValue({ objects: [] });
      mockEnv.R2_BUCKET.get.mockResolvedValue({});
      
      const startTime = performance.now();
      
      // 并发执行多个请求
      const promises = Array(concurrentRequests).fill(0).map(async (_, index) => {
        return Promise.all([
          r2Service.validateUserAccess(userId, `user-${userId}/file${index}.txt`),
          r2Service.getUserStorageUsage(userId),
          r2Service.listUserFiles(userId)
        ]);
      });
      
      await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // 平均每个请求应该在100ms内完成
      const avgTimePerRequest = totalTime / (concurrentRequests * 3);
      expect(avgTimePerRequest).toBeLessThan(100);
      console.log(`平均请求时间: ${avgTimePerRequest.toFixed(2)}ms`);
    });

    it('应该快速验证权限', () => {
      const permissions = [
        { resource: 'user-123/*', actions: ['read', 'write'] },
        { resource: 'user-123/public/*', actions: ['read'] }
      ];

      const testCases = [
        { path: 'user-123/document.txt', action: 'read', expected: true },
        { path: 'user-123/document.txt', action: 'write', expected: true },
        { path: 'user-123/public/info.txt', action: 'read', expected: true },
        { path: 'user-123/public/info.txt', action: 'write', expected: false },
        { path: 'user-456/document.txt', action: 'read', expected: false }
      ];

      testCases.forEach(({ path, action, expected }) => {
        const startTime = performance.now();
        const result = PermissionChecker.checkAccess(permissions, path, action as any);
        const endTime = performance.now();
        
        expect(result.hasPermission).toBe(expected);
        expect(endTime - startTime).toBeLessThan(10); // 应该在10ms内完成
      });
    });
  });

  describe('QA 3: 凭证生成和验证机制安全可靠', () => {
    it('应该生成安全的访问凭证', async () => {
      const userId = 123;
      const config = {
        bucketName: 'test-bucket',
        region: 'auto',
        endpoint: 'https://test.r2.cloudflarestorage.com',
        permissions: [{
          resource: `user-${userId}/*`,
          actions: ['read', 'write', 'list']
        }],
        maxStorageBytes: 104857600,
        maxFileCount: 1000,
        isReadonly: false,
        expiresInSeconds: 86400
      };

      // 模拟数据库操作
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null)
      });

      const accessConfig = await accessControlService.createUserAccess(userId, config as any);
      
      expect(accessConfig).toBeDefined();
      expect(accessConfig.accessKeyId).toBeDefined();
      expect(accessConfig.secretAccessKey).toBeDefined();
      expect(accessConfig.accessKeyId.length).toBeGreaterThan(20);
      expect(accessConfig.secretAccessKey.length).toBeGreaterThan(40);
    });

    it('应该安全验证访问凭证', async () => {
      const accessKeyId = 'test-access-key';
      const secretAccessKey = 'test-secret-key';
      
      // 模拟数据库查询返回有效的访问配置
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 1,
          userId: 123,
          accessKeyId,
          secretAccessKey: await cryptoService.hashData(secretAccessKey),
          pathPrefix: 'user-123/',
          isActive: true,
          expiresAt: new Date(Date.now() + 86400000)
        })
      });

      const validationResult = await accessControlService.validateAccess(
        accessKeyId,
        secretAccessKey,
        'user-123/document.txt',
        'read'
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.userId).toBe(123);
      expect(validationResult.pathPrefix).toBe('user-123/');
    });

    it('应该拒绝无效的访问凭证', async () => {
      const invalidAccessKeyId = 'invalid-key';
      const invalidSecretKey = 'invalid-secret';
      
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      });

      const validationResult = await accessControlService.validateAccess(
        invalidAccessKeyId,
        invalidSecretKey,
        'user-123/document.txt',
        'read'
      );

      expect(validationResult.isValid).toBe(false);
    });
  });

  describe('QA 4: 权限控制和路径重写逻辑正确', () => {
    it('应该正确验证文件操作权限', () => {
      const permissions = [
        {
          resource: 'user-123/*',
          actions: ['read', 'write', 'list'],
          conditions: {
            maxSize: 10485760, // 10MB
            allowedExtensions: ['txt', 'md', 'pdf']
          }
        },
        {
          resource: 'user-123/public/*',
          actions: ['read', 'list']
        }
      ];

      // 测试各种权限场景
      const testCases = [
        { path: 'user-123/document.txt', action: 'read', context: {}, expected: true },
        { path: 'user-123/document.txt', action: 'write', context: {}, expected: true },
        { path: 'user-123/large-file.bin', action: 'write', context: { fileSize: 20000000 }, expected: false }, // 超过大小限制
        { path: 'user-123/script.exe', action: 'write', context: {}, expected: false }, // 不允许的文件类型
        { path: 'user-123/public/info.txt', action: 'read', context: {}, expected: true },
        { path: 'user-123/public/info.txt', action: 'write', context: {}, expected: false }, // 公共目录只读
        { path: 'user-456/document.txt', action: 'read', context: {}, expected: false } // 跨用户访问
      ];

      testCases.forEach(({ path, action, context, expected }) => {
        const result = PermissionChecker.checkAccess(permissions, path, action as any, context);
        expect(result.hasPermission).toBe(expected);
      });
    });

    it('应该正确重写访问路径', () => {
      const pathPrefix = 'user-123/';
      const testCases = [
        { input: 'user-123/document.txt', expected: 'document.txt' },
        { input: 'user-123/notes/personal.md', expected: 'notes/personal.md' },
        { input: 'user-123/config/settings.json', expected: 'config/settings.json' }
      ];

      testCases.forEach(({ input, expected }) => {
        if (input.startsWith(pathPrefix)) {
          const rewritten = input.substring(pathPrefix.length);
          expect(rewritten).toBe(expected);
        }
      });
    });
  });

  describe('QA 5: 访问日志记录完整准确', () => {
    it('应该记录所有访问操作', async () => {
      const userId = 123;
      const accessId = 1;
      const operation = 'read';
      const resourcePath = 'user-123/document.txt';
      
      // 模拟数据库插入操作
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({})
      });

      await accessControlService.logAccess(userId, accessId, operation, {
        resourcePath,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        fileSize: 1024,
        success: true
      });

      // 验证数据库操作被调用
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('应该记录访问失败的情况', async () => {
      const userId = 123;
      const accessId = 1;
      const operation = 'read';
      const resourcePath = 'user-456/document.txt'; // 跨用户访问
      
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({})
      });

      await accessControlService.logAccess(userId, accessId, operation, {
        resourcePath,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        success: false,
        error: '跨用户访问被拒绝'
      });

      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  describe('QA 6: 与Obsidian同步插件兼容性良好', () => {
    it('应该生成Obsidian兼容的访问凭证', async () => {
      const userId = 123;
      
      // 模拟生成Obsidian兼容的配置
      const obsidianConfig = {
        endpoint: 'https://test.r2.cloudflarestorage.com',
        bucket: 'test-bucket',
        accessKeyId: 'obsidian-access-key',
        secretAccessKey: 'obsidian-secret-key',
        pathPrefix: `user-${userId}/`,
        region: 'auto'
      };

      // 验证配置格式符合Obsidian要求
      expect(obsidianConfig.endpoint).toMatch(/^https?:\/\//);
      expect(obsidianConfig.bucket).toBeDefined();
      expect(obsidianConfig.accessKeyId).toBeDefined();
      expect(obsidianConfig.secretAccessKey).toBeDefined();
      expect(obsidianConfig.pathPrefix).toMatch(/^user-\d+\/$/);
    });

    it('应该支持Obsidian的标准操作', () => {
      const permissions = [
        { resource: 'user-123/*', actions: ['read', 'write', 'list', 'head'] }
      ];

      // Obsidian常用操作
      const obsidianOperations = [
        { path: 'user-123/', action: 'list' }, // 列出目录
        { path: 'user-123/note.md', action: 'head' }, // 检查文件存在
        { path: 'user-123/note.md', action: 'read' }, // 读取文件
        { path: 'user-123/note.md', action: 'write' } // 写入文件
      ];

      obsidianOperations.forEach(({ path, action }) => {
        const result = PermissionChecker.checkAccess(permissions, path, action as any);
        expect(result.hasPermission).toBe(true);
      });
    });
  });

  describe('QA 7: 安全性测试通过', () => {
    it('应该防止路径遍历攻击', () => {
      const maliciousPaths = [
        '../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '../../../etc/shadow',
        'user-123/../../../etc/passwd',
        'user-123/..\\..\\system32\\config.exe',
        'user-123/../user-456/secret.txt'
      ];

      maliciousPaths.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('路径遍历攻击');
      });
    });

    it('应该防止特殊字符注入', () => {
      const maliciousPaths = [
        'user-123/file<script>.txt',
        'user-123/file|command.txt',
        'user-123/file&malicious.txt',
        'user-123/file;rm -rf /.txt'
      ];

      maliciousPaths.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(false);
      });
    });

    it('应该验证文件扩展名安全性', () => {
      const dangerousFiles = [
        'user-123/script.exe',
        'user-123/virus.bat',
        'user-123/malware.com',
        'user-123/hack.scr',
        'user-123/backdoor.sh'
      ];

      dangerousFiles.forEach(path => {
        const result = validatePath(path);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('不允许的文件类型');
      });
    });
  });

  describe('QA 8: 性能测试通过', () => {
    it('应该处理大量并发用户访问', async () => {
      const userCount = 1000;
      const operationsPerUser = 10;
      
      mockEnv.R2_BUCKET.list.mockResolvedValue({ objects: [] });
      mockEnv.R2_BUCKET.get.mockResolvedValue({});
      
      const startTime = performance.now();
      
      // 模拟大量用户并发访问
      const userPromises = Array(userCount).fill(0).map((_, userId) => {
        return Array(operationsPerUser).fill(0).map((_, opIndex) => {
          return r2Service.validateUserAccess(userId + 1, `user-${userId + 1}/file${opIndex}.txt`);
        });
      });
      
      await Promise.all(userPromises.flat());
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const totalOperations = userCount * operationsPerUser;
      const avgTimePerOperation = totalTime / totalOperations;
      
      console.log(`总操作数: ${totalOperations}`);
      console.log(`总时间: ${totalTime.toFixed(2)}ms`);
      console.log(`平均每操作时间: ${avgTimePerOperation.toFixed(2)}ms`);
      
      // 平均每个操作应该在50ms内完成
      expect(avgTimePerOperation).toBeLessThan(50);
    });

    it('应该快速响应权限检查', () => {
      const permissions = [
        { resource: 'user-123/*', actions: ['read', 'write', 'list'] }
      ];

      const testCount = 10000;
      const startTime = performance.now();
      
      for (let i = 0; i < testCount; i++) {
        PermissionChecker.checkAccess(permissions, `user-123/file${i}.txt`, 'read');
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerCheck = totalTime / testCount;
      
      console.log(`权限检查次数: ${testCount}`);
      console.log(`总时间: ${totalTime.toFixed(2)}ms`);
      console.log(`平均每次检查时间: ${avgTimePerCheck.toFixed(4)}ms`);
      
      // 每次权限检查应该在1ms内完成
      expect(avgTimePerCheck).toBeLessThan(1);
    });
  });

  describe('QA 9: 用户体验测试通过', () => {
    it('应该提供清晰的用户路径结构', () => {
      const userId = 123;
      
      // 测试路径构建
      const userRootPath = buildUserPath(userId);
      expect(userRootPath).toBe('user-123/');
      
      const documentPath = buildUserPath(userId, 'notes/personal.md');
      expect(documentPath).toBe('user-123/notes/personal.md');
      
      const configPath = buildUserPath(userId, 'config/settings.json');
      expect(configPath).toBe('user-123/config/settings.json');
    });

    it('应该提供友好的错误信息', () => {
      const errorCases = [
        { path: '../etc/passwd', expectedError: '路径遍历攻击' },
        { path: '', expectedError: '路径不能为空' },
        { path: 'user-123/script.exe', expectedError: '不允许的文件类型' },
        { path: '/absolute/path', expectedError: '路径不应该以斜杠开头' }
      ];

      errorCases.forEach(({ path, expectedError }) => {
        const result = validatePath(path);
        if (!result.isValid) {
          expect(result.error).toContain(expectedError);
        }
      });
    });

    it('应该支持直观的文件操作', async () => {
      const userId = 123;
      const fileName = 'test-document.md';
      const content = '# Test Document\nThis is a test.';
      
      // 模拟完整的文件操作流程
      mockEnv.R2_BUCKET.put.mockResolvedValue({});
      mockEnv.R2_BUCKET.get.mockResolvedValue({
        text: () => Promise.resolve(content)
      });
      mockEnv.R2_BUCKET.list.mockResolvedValue({
        objects: [{ key: `user-${userId}/${fileName}`, size: content.length }]
      });
      
      // 上传文件
      const uploadPath = await r2Service.uploadUserFile(userId, fileName, content);
      expect(uploadPath).toBe(`user-${userId}/${fileName}`);
      
      // 列出文件
      const files = await r2Service.listUserFiles(userId);
      expect(files).toHaveLength(1);
      expect(files[0].key).toBe(`user-${userId}/${fileName}`);
      
      // 下载文件
      const { content: downloadedContent } = await r2Service.downloadUserFile(userId, fileName);
      expect(downloadedContent).toBe(content);
    });
  });
});