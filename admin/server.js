const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 从.env文件加载环境变量
require('dotenv').config();

// 从配置文件加载配置
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const backendHost = process.env.BACKEND_HOST || (config.development ? config.development.backendHost : 'localhost');
const backendPort = process.env.BACKEND_PORT || (config.development ? config.development.backendPort : 8787);
const backendUrl = `http://${backendHost}:${backendPort}`;

console.log(`后端服务URL: ${backendUrl}`);

// 简单的Web服务器，为管理后台提供静态文件服务
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // 设置CORS头，允许跨域请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 处理API和Admin代理请求 - 只处理特定的API路径
  const apiPaths = ['/api/', '/admin/', '/auth/', '/sources/', '/system/', '/llm-extractor/', '/llm-content-extractor/', '/topics/', '/web-content/'];
  const isApiRequest = apiPaths.some(apiPath => pathname.startsWith(apiPath)) && 
                       (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH');
  
  // 排除一些可能的前端路由路径
  const frontendRoutes = ['/users/list', '/users/statistics', '/content/sources', '/content/articles', '/content/categories', '/system/statistics', '/system/logs', '/system/config'];
  const isFrontendRoute = frontendRoutes.some(route => pathname.startsWith(route));
  
  if (isApiRequest && !isFrontendRoute) {
    // 构造后端API的路径 - 对于/api/前缀的请求，去掉/api前缀
    let backendPath = pathname;
    if (pathname.startsWith('/api/')) {
      backendPath = pathname.substring(4); // 去掉'/api'前缀
    }
    
    // 处理查询参数
    const query = parsedUrl.query;
    let queryString = '';
    if (query && Object.keys(query).length > 0) {
      queryString = '?' + Object.keys(query).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`).join('&');
    }
    
    // 构造完整的后端API路径（包含查询参数）
    const fullBackendPath = backendPath + queryString;
    
    console.log(`代理请求: ${req.method} ${pathname}${queryString ? '?' + Object.keys(query).map(key => `${key}=${query[key]}`).join('&') : ''} -> ${backendUrl}${fullBackendPath}`);
    console.log(`请求headers:`, req.headers);
    
    // 构造转发请求的headers
    const proxyHeaders = {
      'Content-Type': 'application/json',
    };
    
    // 如果请求中有认证头，转发它
    if (req.headers.authorization) {
      proxyHeaders['Authorization'] = req.headers.authorization;
      console.log(`转发Authorization头: ${req.headers.authorization}`);
    }
    
    // 如果请求中有其他cookie，转发它们
    if (req.headers.cookie) {
      proxyHeaders['Cookie'] = req.headers.cookie;
      console.log(`转发Cookie头: ${req.headers.cookie}`);
    }
    
    console.log(`最终转发的headers:`, proxyHeaders);
    
    const backendReq = http.request(`${backendUrl}${fullBackendPath}`, {
      method: req.method,
      headers: proxyHeaders
    }, (backendRes) => {
      let data = '';
      backendRes.on('data', (chunk) => {
        data += chunk;
      });
      backendRes.on('end', () => {
        console.log(`后端响应状态码: ${backendRes.statusCode}`);
        console.log(`后端响应数据: ${data}`);
        res.writeHead(backendRes.statusCode || 200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });
    
    // 如果是POST/PUT/PATCH/DELETE请求，转发请求体
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        console.log(`请求体: ${body}`);
        backendReq.write(body);
        backendReq.end();
      });
    } else {
      backendReq.end();
    }
    
    backendReq.on('error', (error) => {
      console.error('转发请求错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 1, 
        msg: '服务器内部错误'
      }));
    });
    
    return;
  }
  
  // 静态文件服务 - 支持前端单页应用路由
  let filePath = '.' + pathname;
  
  // 如果是根路径或者没有扩展名的路径（前端路由），返回index.html
  if (filePath === './' || !path.extname(filePath)) {
    filePath = './index.html';
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 从环境变量或默认值获取端口
const PORT = process.env.PORT || 8101;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`管理后台Web服务器运行在 http://0.0.0.0:${PORT}`);
});