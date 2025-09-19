// webdav.ts
// WebDAV路由，处理文件存储操作

import { Hono } from "hono";
import { webdavAuthMiddleware, getWebDAVUser } from "../middleware/webdav-auth.middleware";
import { WebDAVService } from "../services/webdav.service";
import { WebDAVResponseFormatter } from "../utils/webdav-formatter";
import type { WebDAVAuthUser } from "../middleware/webdav-auth.middleware";

const webdavRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// WebDAV路径安全中间件 - 确保所有请求都以/webdav开头
webdavRoutes.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  
  // 确保路径以/webdav开头
  if (!pathname.startsWith('/webdav/')) {
    console.log(`[WEBDAV_SECURITY] 拒绝访问非WebDAV路径: ${pathname}`);
    return c.text('Forbidden', 403);
  }
  
  await next();
});

// 应用认证中间件到所有WebDAV路由
webdavRoutes.use("*", webdavAuthMiddleware);

/**
 * PROPFIND - 列出目录内容或获取文件/目录属性
 */
webdavRoutes.on('PROPFIND', '/*', async (c) => {
  console.log(`[WEBDAV] PROPFIND 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const actualPath = webdavPath.replace('/webdav', '') || '/';
    
    console.log(`[WEBDAV] PROPFIND 路径映射: ${webdavPath} -> ${actualPath}`);
    
    const webdavService = new WebDAVService(c.env);
    const formatter = new WebDAVResponseFormatter();

    // 检查请求的深度
    const depth = c.req.header('Depth') || '0';
    console.log(`[WEBDAV] Depth: ${depth}`);

    // 如果路径不存在，创建用户目录结构
    const pathExists = await webdavService.exists(authUser, actualPath);
    if (!pathExists && actualPath === '/') {
      console.log(`[WEBDAV] 用户目录不存在，创建默认目录结构`);
      await webdavService.createDirectory(authUser, '/documents');
      await webdavService.createDirectory(authUser, '/notes');
      await webdavService.createDirectory(authUser, '/exports');
      await webdavService.createDirectory(authUser, '/');
    } else if (!pathExists) {
      console.log(`[WEBDAV] 路径不存在: ${actualPath}`);
      return c.text("Not Found", 404);
    }

    // 如果是文件或Depth为0，返回单个资源属性
    if (depth === '0') {
      const isDirectory = await webdavService.isDirectory(authUser, actualPath);
      const response = formatter.formatPropFindResponse([{
        path: actualPath,
        isDirectory,
        lastModified: new Date(),
        size: 0,
        contentType: isDirectory ? 'httpd/unix-directory' : 'application/octet-stream'
      }], actualPath);
      
      return c.text(response, 207, {
        'Content-Type': 'application/xml; charset=utf-8'
      });
    }

    // 列出目录内容
    const listResult = await webdavService.listDirectory(authUser, actualPath);
    
    // 添加当前目录到响应
    const items = [{
      path: actualPath,
      isDirectory: true,
      lastModified: new Date(),
      size: 0,
      contentType: 'httpd/unix-directory'
    }, ...listResult.items];

    const response = formatter.formatPropFindResponse(items, actualPath);
    
    console.log(`[WEBDAV] PROPFIND 成功，返回${items.length}个项目`);
    
    return c.text(response, 207, {
      'Content-Type': 'application/xml; charset=utf-8'
    });

  } catch (error) {
    console.error(`[WEBDAV] PROPFIND 错误:`, error);
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * GET - 下载文件
 */
webdavRoutes.get("/*", async (c) => {
  console.log(`[WEBDAV] GET 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const actualPath = webdavPath.replace('/webdav', '') || '/';
    
    console.log(`[WEBDAV] 路径映射: ${webdavPath} -> ${actualPath}`);
    
    const webdavService = new WebDAVService(c.env);

    // 检查是否为目录
    const isDirectory = await webdavService.isDirectory(authUser, actualPath);
    if (isDirectory) {
      console.log(`[WEBDAV] GET请求是目录，返回目录浏览: ${actualPath}`);
      // 对于目录GET请求，返回HTML目录浏览界面
      return await handleDirectoryBrowse(c, authUser, actualPath, webdavService);
    }

    // 如果路径不存在，检查是否需要创建用户目录
    const pathExists = await webdavService.exists(authUser, actualPath);
    if (!pathExists && actualPath === '/') {
      console.log(`[WEBDAV] 用户目录不存在，创建默认目录: user-${authUser.id}/`);
      // 创建用户默认目录结构
      await webdavService.createDirectory(authUser, '/documents');
      await webdavService.createDirectory(authUser, '/notes');
      await webdavService.createDirectory(authUser, '/exports');
      // 创建根目录标记
      await webdavService.createDirectory(authUser, '/');
    }

    // 获取文件
    const result = await webdavService.getFile(authUser, actualPath);

    // 设置响应头
    const headers: Record<string, string> = {};
    headers['Content-Type'] = result.metadata.contentType || 'application/octet-stream';
    headers['Content-Length'] = result.metadata.size.toString();
    headers['Last-Modified'] = result.metadata.lastModified.toUTCString();
    if (result.metadata.etag) {
      headers['ETag'] = result.metadata.etag;
    }

    console.log(`[WEBDAV] GET 成功: ${actualPath}, 大小: ${result.metadata.size}字节`);
    
    // 确保正确处理ArrayBuffer
    const content = result.content instanceof ArrayBuffer ? result.content : await result.content;
    
    return new Response(content, {
      status: 200,
      headers
    } as ResponseInit);

  } catch (error) {
    console.error(`[WEBDAV] GET 错误:`, error);
    if (error.message.includes('not found')) {
      return c.text("Not Found", 404);
    }
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * PUT - 上传文件
 */
webdavRoutes.put("/*", async (c) => {
  console.log(`[WEBDAV] PUT 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const actualPath = webdavPath.replace('/webdav', '') || '/';
    
    console.log(`[WEBDAV] PUT 路径映射: ${webdavPath} -> ${actualPath}`);
    
    const webdavService = new WebDAVService(c.env);

    // 获取文件内容
    const content = await c.req.arrayBuffer();
    const contentType = c.req.header('Content-Type');

    // 上传文件
    const metadata = await webdavService.putFile(authUser, actualPath, content, contentType);

    // 设置响应头
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/xml; charset=utf-8';
    if (metadata.etag) {
      headers['ETag'] = metadata.etag;
    }

    console.log(`[WEBDAV] PUT 成功: ${actualPath}, 大小: ${metadata.size}字节`);
    
    return c.text("", 201, headers);

  } catch (error) {
    console.error(`[WEBDAV] PUT 错误:`, error);
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * DELETE - 删除文件或目录
 */
webdavRoutes.delete("/*", async (c) => {
  console.log(`[WEBDAV] DELETE 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const actualPath = webdavPath.replace('/webdav', '') || '/';
    
    console.log(`[WEBDAV] DELETE 路径映射: ${webdavPath} -> ${actualPath}`);
    
    const webdavService = new WebDAVService(c.env);

    // 检查路径是否存在
    const pathExists = await webdavService.exists(authUser, actualPath);
    if (!pathExists) {
      console.log(`[WEBDAV] 路径不存在: ${actualPath}`);
      return c.text("Not Found", 404);
    }

    // 删除文件或目录
    await webdavService.delete(authUser, actualPath);

    console.log(`[WEBDAV] DELETE 成功: ${actualPath}`);
    
    return c.text("", 204, {});

  } catch (error) {
    console.error(`[WEBDAV] DELETE 错误:`, error);
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * MKCOL - 创建目录
 */
webdavRoutes.on('MKCOL', '/*', async (c) => {
  console.log(`[WEBDAV] MKCOL 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const actualPath = webdavPath.replace('/webdav', '') || '/';
    
    console.log(`[WEBDAV] MKCOL 路径映射: ${webdavPath} -> ${actualPath}`);
    
    const webdavService = new WebDAVService(c.env);

    // 检查路径是否已存在
    const pathExists = await webdavService.exists(authUser, actualPath);
    if (pathExists) {
      console.log(`[WEBDAV] 路径已存在: ${actualPath}`);
      return c.text("Conflict", 409);
    }

    // 创建目录
    await webdavService.createDirectory(authUser, actualPath);

    console.log(`[WEBDAV] MKCOL 成功: ${actualPath}`);
    
    return c.text("", 201);

  } catch (error) {
    console.error(`[WEBDAV] MKCOL 错误:`, error);
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * MOVE - 移动文件或目录
 */
webdavRoutes.on('MOVE', '/*', async (c) => {
  console.log(`[WEBDAV] MOVE 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const sourcePath = webdavPath.replace('/webdav', '') || '/';
    
    const destinationHeader = c.req.header('Destination');
    
    if (!destinationHeader) {
      console.log(`[WEBDAV] MOVE 缺少Destination头`);
      return c.text("Destination header required", 400);
    }

    // 解析目标路径
    const destinationUrl = new URL(destinationHeader);
    let destinationPath = destinationUrl.pathname;
    
    // 如果目标路径也包含 /webdav 前缀，移除它
    if (destinationPath.startsWith('/webdav')) {
      destinationPath = destinationPath.replace('/webdav', '') || '/';
    }

    console.log(`[WEBDAV] MOVE 从 ${sourcePath} 到 ${destinationPath}`);

    const webdavService = new WebDAVService(c.env);

    // 验证目标路径
    if (!destinationPath.startsWith('/')) {
      console.log(`[WEBDAV] MOVE 目标路径格式错误: ${destinationPath}`);
      return c.text("Invalid destination path", 400);
    }

    // 执行移动
    await webdavService.move(authUser, sourcePath, destinationPath);

    console.log(`[WEBDAV] MOVE 成功: ${sourcePath} -> ${destinationPath}`);
    
    return c.text("", 201);

  } catch (error) {
    console.error(`[WEBDAV] MOVE 错误:`, error);
    if (error.message.includes('not found')) {
      return c.text("Not Found", 404);
    }
    if (error.message.includes('already exists')) {
      return c.text("Conflict", 409);
    }
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * COPY - 复制文件或目录
 */
webdavRoutes.on('COPY', '/*', async (c) => {
  console.log(`[WEBDAV] COPY 请求: ${c.req.path}`);
  
  try {
    const authUser = getWebDAVUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 获取WebDAV路径，移除 /webdav 前缀
    const webdavPath = c.req.path;
    const sourcePath = webdavPath.replace('/webdav', '') || '/';
    
    const destinationHeader = c.req.header('Destination');
    
    if (!destinationHeader) {
      console.log(`[WEBDAV] COPY 缺少Destination头`);
      return c.text("Destination header required", 400);
    }

    // 解析目标路径
    const destinationUrl = new URL(destinationHeader);
    let destinationPath = destinationUrl.pathname;
    
    // 如果目标路径也包含 /webdav 前缀，移除它
    if (destinationPath.startsWith('/webdav')) {
      destinationPath = destinationPath.replace('/webdav', '') || '/';
    }

    console.log(`[WEBDAV] COPY 从 ${sourcePath} 到 ${destinationPath}`);

    const webdavService = new WebDAVService(c.env);

    // 验证目标路径
    if (!destinationPath.startsWith('/')) {
      console.log(`[WEBDAV] COPY 目标路径格式错误: ${destinationPath}`);
      return c.text("Invalid destination path", 400);
    }

    // 执行复制
    await webdavService.copy(authUser, sourcePath, destinationPath);

    console.log(`[WEBDAV] COPY 成功: ${sourcePath} -> ${destinationPath}`);
    
    return c.text("", 201);

  } catch (error) {
    console.error(`[WEBDAV] COPY 错误:`, error);
    if (error.message.includes('not found')) {
      return c.text("Not Found", 404);
    }
    if (error.message.includes('already exists')) {
      return c.text("Conflict", 409);
    }
    return c.text(`Internal Server Error: ${error}`, 500);
  }
});

/**
 * OPTIONS - WebDAV功能发现
 */
webdavRoutes.options("/*", async (c) => {
  console.log(`[WEBDAV] OPTIONS 请求: ${c.req.path}`);
  
  const headers: Record<string, string> = {
    'DAV': '1,2,3',
    'Allow': 'GET,PUT,DELETE,PROPFIND,MKCOL,COPY,MOVE,OPTIONS',
    'MS-Author-Via': 'DAV',
    'Content-Length': '0'
  };

  return c.text("", 200, headers);
});

/**
 * 处理目录浏览请求（HTML格式）
 */
async function handleDirectoryBrowse(
  c: any,
  authUser: WebDAVAuthUser,
  path: string,
  webdavService: WebDAVService
): Promise<Response> {
  try {
    console.log(`[WEBDAV] 生成目录浏览HTML: ${path}`);
    
    // 获取目录内容
    const listResult = await webdavService.listDirectory(authUser, path);
    
    // 生成HTML
    const html = generateDirectoryHTML(authUser, path, listResult.items);
    
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (error) {
    console.error(`[WEBDAV] 生成目录浏览HTML失败:`, error);
    return new Response(`Error generating directory listing: ${error}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}

/**
 * 生成目录浏览HTML
 */
function generateDirectoryHTML(authUser: WebDAVAuthUser, currentPath: string, items: any[]): string {
  const title = `WebDAV Browser - ${authUser.email}`;
  const parentPath = currentPath === '/' ? null : currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
  
  // 对项目进行排序：目录在前，文件在后
  const sortedItems = items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  
  let itemsHtml = '';
  for (const item of sortedItems) {
    const itemPath = item.path === '/' ? '' : item.path;
    const webdavPath = `/webdav${itemPath}`;
    const isDir = item.isDirectory;
    const size = isDir ? '-' : formatFileSize(item.size);
    const modified = new Date(item.lastModified).toLocaleString('zh-CN');
    const icon = isDir ? '📁' : '📄';
    
    itemsHtml += `
      <tr>
        <td><a href="${webdavPath}" class="item-link">${icon} ${escapeHtml(item.name)}</a></td>
        <td>${size}</td>
        <td>${modified}</td>
      </tr>`;
  }
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .header .user {
            font-size: 14px;
            opacity: 0.8;
            margin-top: 5px;
        }
        .breadcrumb {
            padding: 15px 20px;
            background: #ecf0f1;
            border-bottom: 1px solid #bdc3c7;
        }
        .breadcrumb a {
            color: #3498db;
            text-decoration: none;
        }
        .breadcrumb a:hover {
            text-decoration: underline;
        }
        .breadcrumb .separator {
            color: #7f8c8d;
            margin: 0 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 20px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        .item-link {
            color: #2c3e50;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .item-link:hover {
            color: #3498db;
        }
        .size {
            color: #7f8c8d;
            font-family: monospace;
        }
        .modified {
            color: #7f8c8d;
            font-size: 14px;
        }
        .footer {
            padding: 15px 20px;
            background: #f8f9fa;
            color: #7f8c8d;
            font-size: 12px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 WebDAV 文件浏览器</h1>
            <div class="user">用户: ${escapeHtml(authUser.email)}</div>
        </div>
        
        <div class="breadcrumb">
            <a href="/webdav/">🏠 根目录</a>
            ${generateBreadcrumb(currentPath)}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>名称</th>
                    <th>大小</th>
                    <th>修改时间</th>
                </tr>
            </thead>
            <tbody>
                ${parentPath !== null ? `
                <tr>
                    <td><a href="/webdav${parentPath}" class="item-link">⬆️ ..</a></td>
                    <td>-</td>
                    <td>-</td>
                </tr>` : ''}
                ${itemsHtml}
            </tbody>
        </table>
        
        <div class="footer">
            WebDAV 服务 - AI新闻平台 | 总计: ${items.length} 个项目
        </div>
    </div>
</body>
</html>`;
}

/**
 * 生成面包屑导航
 */
function generateBreadcrumb(path: string): string {
  if (path === '/') return '';
  
  const parts = path.split('/').filter(Boolean);
  let breadcrumb = '';
  let currentPath = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath += `/${part}`;
    
    if (i === parts.length - 1) {
      breadcrumb += `<span class="separator">›</span>${escapeHtml(part)}`;
    } else {
      breadcrumb += `<span class="separator">›</span><a href="/webdav${currentPath}">${escapeHtml(part)}</a>`;
    }
  }
  
  return breadcrumb;
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default webdavRoutes;