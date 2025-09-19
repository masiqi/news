// test-webdav.mjs
// WebDAV功能测试脚本

import { WebDAVService } from './src/services/webdav.service.js';
import { R2Service } from './src/services/r2.service.js';

// 模拟Cloudflare环境
const mockEnv = {
  R2_BUCKET: {
    head: async (key) => {
      console.log(`R2.head called with key: ${key}`);
      return null;
    },
    get: async (key) => {
      console.log(`R2.get called with key: ${key}`);
      return null;
    },
    put: async (key, value, options) => {
      console.log(`R2.put called with key: ${key}, size: ${value.byteLength || value.length}`);
      return {
        key,
        uploaded: new Date(),
        etag: `test-etag-${Date.now()}`,
        version: 'test-version'
      };
    },
    delete: async (key) => {
      console.log(`R2.delete called with key: ${key}`);
    },
    list: async (options) => {
      console.log(`R2.list called with options:`, options);
      return {
        objects: [],
        truncated: false,
        delimitedPrefixes: []
      };
    }
  },
  DB: {
    prepare: (query) => ({
      bind: (values) => ({
        first: async () => null,
        all: async () => [],
        run: async () => ({ results: [], success: true })
      })
    })
  }
};

// 模拟认证用户
const mockAuthUser = {
  id: 1,
  email: 'test@example.com',
  userPathPrefix: 'user-1/'
};

async function testWebDAVService() {
  console.log('🧪 开始测试WebDAV服务...\n');

  try {
    const webdavService = new WebDAVService(mockEnv);

    // 测试路径转换
    console.log('📋 测试路径转换:');
    console.log('  / → user-1/');
    console.log('  /documents → user-1/documents');
    console.log('  /documents/file.txt → user-1/documents/file.txt\n');

    // 测试目录创建
    console.log('📁 测试创建目录:');
    try {
      await webdavService.createDirectory(mockAuthUser, '/documents');
      console.log('  ✅ 目录创建成功');
    } catch (error) {
      console.log(`  ❌ 目录创建失败: ${error.message}`);
    }

    // 测试文件上传
    console.log('\n📤 测试文件上传:');
    try {
      const testContent = new TextEncoder().encode('Hello, WebDAV!');
      const metadata = await webdavService.putFile(mockAuthUser, '/test.txt', testContent, 'text/plain');
      console.log(`  ✅ 文件上传成功: ${metadata.name}, 大小: ${metadata.size}字节`);
    } catch (error) {
      console.log(`  ❌ 文件上传失败: ${error.message}`);
    }

    // 测试目录列表
    console.log('\n📂 测试目录列表:');
    try {
      const result = await webdavService.listDirectory(mockAuthUser, '/');
      console.log(`  ✅ 列表成功，找到 ${result.items.length} 个项目`);
    } catch (error) {
      console.log(`  ❌ 列表失败: ${error.message}`);
    }

    // 测试存在性检查
    console.log('\n🔍 测试存在性检查:');
    try {
      const exists = await webdavService.exists(mockAuthUser, '/test.txt');
      console.log(`  ✅ 存在性检查: /test.txt ${exists ? '存在' : '不存在'}`);
    } catch (error) {
      console.log(`  ❌ 存在性检查失败: ${error.message}`);
    }

    console.log('\n🎉 WebDAV服务测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testWebDAVService();