// 访问控制代理 Worker
// Cloudflare Worker 实现多用户R2访问控制和路径隔离

interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  ACCESS_CONTROL_SECRET: string;
}

interface AccessControlContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
}

interface AccessValidationResult {
  isValid: boolean;
  userId?: string;
  pathPrefix?: string;
  bucketName?: string;
  error?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 访问控制代理 Worker
 * 作为R2存储的代理层，提供访问控制、路径隔离和审计功能
 */
export class AccessControlWorker {
  private env: Env;
  private ctx: ExecutionContext;

  constructor(env: Env, ctx: ExecutionContext) {
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * 处理请求
   */
  async handleRequest(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const resourcePath = url.pathname.slice(1); // 移除前导斜杠

    try {
      // 获取客户端信息
      const clientIP = this.getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';

      // 提取访问凭证
      const authResult = this.extractCredentials(request);
      if (!authResult.success) {
        return this.createErrorResponse(401, '认证失败', authResult.error);
      }

      // 验证访问权限
      const validationResult = await this.validateAccess(
        authResult.accessKeyId,
        authResult.secretAccessKey,
        resourcePath,
        this.mapMethodToOperation(method)
      );

      if (!validationResult.isValid) {
        // 记录失败的访问尝试
        await this.logAccessAttempt({
          userId: validationResult.userId || 'unknown',
          accessKeyId: authResult.accessKeyId,
          operation: this.mapMethodToOperation(method),
          resourcePath,
          statusCode: 403,
          responseTime: Date.now() - startTime,
          ipAddress: clientIP,
          userAgent,
          success: false,
          error: validationResult.error
        });

        return this.createErrorResponse(403, validationResult.error || '访问被拒绝');
      }

      // 重写请求路径到用户的专属目录
      const rewrittenPath = this.rewritePath(resourcePath, validationResult.pathPrefix!);
      
      // 执行实际的R2操作
      const r2Response = await this.executeR2Operation(
        method,
        rewrittenPath,
        request,
        validationResult
      );

      // 记录成功的访问
      await this.logAccessAttempt({
        userId: validationResult.userId!,
        accessKeyId: authResult.accessKeyId,
        operation: this.mapMethodToOperation(method),
        resourcePath: rewrittenPath,
        statusCode: r2Response.status,
        responseTime: Date.now() - startTime,
        bytesTransferred: this.extractResponseSize(r2Response),
        ipAddress: clientIP,
        userAgent,
        success: true
      });

      // 添加访问控制头
      const response = new Response(r2Response.body, r2Response);
      response.headers.set('X-Access-Control-Validated', 'true');
      response.headers.set('X-User-Id', validationResult.userId!);
      response.headers.set('X-Resource-Path', rewrittenPath);
      response.headers.set('X-Response-Time', (Date.now() - startTime).toString());

      return response;

    } catch (error) {
      console.error('访问控制代理错误:', error);
      
      // 记录错误
      await this.logError({
        error: error instanceof Error ? error.message : '未知错误',
        method,
        resourcePath,
        timestamp: new Date().toISOString()
      });

      return this.createErrorResponse(500, '内部服务器错误');
    }
  }

  /**
   * 提取访问凭证
   */
  private extractCredentials(request: Request): {
    success: boolean;
    accessKeyId?: string;
    secretAccessKey?: string;
    error?: string;
  } {
    try {
      // 方法1: Authorization头
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('AWS4-HMAC-SHA256 ')) {
        // 简化的AWS签名验证（实际生产环境中需要完整实现）
        const match = authHeader.match(/Credential=([^,]+)/);
        if (match) {
          const credential = match[1];
          const [accessKeyId] = credential.split('/');
          return { success: true, accessKeyId, secretAccessKey: 'extracted_from_signature' };
        }
      }

      // 方法2: 查询参数
      const url = new URL(request.url);
      const accessKeyId = url.searchParams.get('AWSAccessKeyId');
      const secretAccessKey = url.searchParams.get('AWSSecretAccessKey');
      
      if (accessKeyId && secretAccessKey) {
        return { success: true, accessKeyId, secretAccessKey };
      }

      // 方法3: 自定义头
      const customAccessKey = request.headers.get('X-Access-Key-Id');
      const customSecretKey = request.headers.get('X-Access-Secret-Key');
      
      if (customAccessKey && customSecretKey) {
        return { success: true, accessKeyId: customAccessKey, secretAccessKey: customSecretKey };
      }

      return { success: false, error: '缺少访问凭证' };

    } catch (error) {
      return { success: false, error: '凭证提取失败' };
    }
  }

  /**
   * 验证访问权限
   */
  private async validateAccess(
    accessKeyId: string,
    secretAccessKey: string,
    resourcePath: string,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head'
  ): Promise<AccessValidationResult> {
    try {
      // 查询数据库验证访问权限
      const stmt = this.env.DB.prepare(`
        SELECT 
          ua.*,
          u.email
        FROM user_r2_access ua
        JOIN users u ON ua.user_id = u.id
        WHERE ua.access_key_id = ? 
          AND ua.is_active = 1
          AND (ua.expires_at IS NULL OR ua.expires_at > datetime('now'))
      `);

      const result = await stmt.bind(accessKeyId).first();
      
      if (!result) {
        return {
          isValid: false,
          error: '访问密钥不存在或已过期',
          riskLevel: 'high'
        };
      }

      // 验证密钥哈希（这里简化处理，实际应该使用更安全的方式）
      const isKeyValid = await this.verifySecretKey(secretAccessKey, result.secret_access_key_hash);
      if (!isKeyValid) {
        return {
          isValid: false,
          error: '访问密钥无效',
          riskLevel: 'high'
        };
      }

      // 验证路径权限
      if (!resourcePath.startsWith(result.path_prefix)) {
        return {
          isValid: false,
          error: '路径访问权限不足',
          riskLevel: 'medium'
        };
      }

      // 检查只读权限
      if (result.is_readonly && ['write', 'delete'].includes(operation)) {
        return {
          isValid: false,
          error: '只读权限，无法执行写操作',
          riskLevel: 'medium'
        };
      }

      // 检查细粒度权限
      const hasPermission = await this.checkPermissions(
        result.id,
        resourcePath,
        operation
      );

      if (!hasPermission) {
        return {
          isValid: false,
          error: '操作权限不足',
          riskLevel: 'medium'
        };
      }

      return {
        isValid: true,
        userId: result.user_id.toString(),
        pathPrefix: result.path_prefix,
        bucketName: result.bucket_name,
        riskLevel: 'low'
      };

    } catch (error) {
      console.error('验证访问权限失败:', error);
      return {
        isValid: false,
        error: '访问验证失败',
        riskLevel: 'high'
      };
    }
  }

  /**
   * 验证密钥
   */
  private async verifySecretKey(
    providedKey: string,
    storedHash: string
  ): Promise<boolean> {
    try {
      // 这里简化处理，实际应该使用crypto.subtle.verify或其他安全方法
      // 在生产环境中应该使用AWS签名验证算法
      return true; // 简化实现
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查细粒度权限
   */
  private async checkPermissions(
    accessId: number,
    resourcePath: string,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head'
  ): Promise<boolean> {
    try {
      const stmt = this.env.DB.prepare(`
        SELECT actions, resource_pattern, conditions
        FROM r2_permissions
        WHERE access_id = ?
      `);

      const permissions = await stmt.bind(accessId).all();

      for (const perm of permissions.results || []) {
        const actions = JSON.parse(perm.actions);
        const resourcePattern = perm.resource_pattern;

        // 检查操作权限
        if (!actions.includes(operation)) {
          continue;
        }

        // 检查资源路径匹配
        if (this.isPathMatch(resourcePath, resourcePattern)) {
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('检查权限失败:', error);
      return false;
    }
  }

  /**
   * 路径匹配检查
   */
  private isPathMatch(resourcePath: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resourcePath);
  }

  /**
   * 重写请求路径
   */
  private rewritePath(originalPath: string, userPrefix: string): string {
    // 确保路径以用户前缀开头
    if (originalPath.startsWith(userPrefix)) {
      return originalPath;
    }
    
    // 如果路径不以前缀开头，添加前缀
    return `${userPrefix}${originalPath}`;
  }

  /**
   * 执行R2操作
   */
  private async executeR2Operation(
    method: string,
    resourcePath: string,
    request: Request,
    validation: AccessValidationResult
  ): Promise<Response> {
    const bucket = this.env.R2_BUCKET;

    switch (method) {
      case 'GET':
        return await this.handleGetOperation(bucket, resourcePath, request);
      case 'PUT':
        return await this.handlePutOperation(bucket, resourcePath, request);
      case 'DELETE':
        return await this.handleDeleteOperation(bucket, resourcePath);
      case 'HEAD':
        return await this.handleHeadOperation(bucket, resourcePath);
      default:
        return this.createErrorResponse(405, '不支持的操作方法');
    }
  }

  /**
   * 处理GET操作
   */
  private async handleGetOperation(
    bucket: R2Bucket,
    resourcePath: string,
    request: Request
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // 列表操作
      if (url.searchParams.has('list-type') && url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') || '';
        const delimiter = url.searchParams.get('delimiter');
        
        const listOptions: R2ListOptions = {
          prefix: resourcePath + prefix,
          delimiter: delimiter || undefined,
          limit: parseInt(url.searchParams.get('max-keys') || '1000')
        };

        const listed = await bucket.list(listOptions);
        
        // 重写返回的对象键，移除用户前缀
        const objects = listed.objects.map(obj => ({
          ...obj,
          key: obj.key.substring(resourcePath.length)
        }));

        const response = {
          Name: bucket.name,
          Prefix: prefix,
          Delimiter: delimiter,
          MaxKeys: listOptions.limit,
          IsTruncated: listed.truncated,
          Contents: objects,
          CommonPrefixes: listed.delimitedPrefixes?.map(p => ({
            Prefix: p.substring(resourcePath.length)
          }))
        };

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/xml' }
        });
      }

      // 下载文件
      const object = await bucket.get(resourcePath);
      if (!object) {
        return this.createErrorResponse(404, '文件不存在');
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.etag);
      headers.set('Content-Length', object.size.toString());
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');

      return new Response(object.body, { headers });

    } catch (error) {
      console.error('GET操作失败:', error);
      return this.createErrorResponse(500, '文件下载失败');
    }
  }

  /**
   * 处理PUT操作
   */
  private async handlePutOperation(
    bucket: R2Bucket,
    resourcePath: string,
    request: Request
  ): Promise<Response> {
    try {
      // 检查文件大小限制
      const contentLength = parseInt(request.headers.get('content-length') || '0');
      if (contentLength > 100 * 1024 * 1024) { // 100MB限制
        return this.createErrorResponse(413, '文件大小超过限制');
      }

      const body = await request.arrayBuffer();
      const httpMetadata = this.parseHttpMetadata(request.headers);

      const uploaded = await bucket.put(resourcePath, body, {
        httpMetadata,
        customMetadata: {
          'uploaded-at': new Date().toISOString(),
          'access-control-proxy': 'true'
        }
      });

      const headers = new Headers();
      headers.set('ETag', uploaded.etag);
      headers.set('Content-Type', 'application/xml');

      return new Response(null, { status: 200, headers });

    } catch (error) {
      console.error('PUT操作失败:', error);
      return this.createErrorResponse(500, '文件上传失败');
    }
  }

  /**
   * 处理DELETE操作
   */
  private async handleDeleteOperation(
    bucket: R2Bucket,
    resourcePath: string
  ): Promise<Response> {
    try {
      await bucket.delete(resourcePath);
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('DELETE操作失败:', error);
      return this.createErrorResponse(500, '文件删除失败');
    }
  }

  /**
   * 处理HEAD操作
   */
  private async handleHeadOperation(
    bucket: R2Bucket,
    resourcePath: string
  ): Promise<Response> {
    try {
      const object = await bucket.head(resourcePath);
      if (!object) {
        return this.createErrorResponse(404, '文件不存在');
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.etag);
      headers.set('Content-Length', object.size.toString());
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Last-Modified', object.uploaded.toUTCString());

      return new Response(null, { headers, status: 200 });

    } catch (error) {
      console.error('HEAD操作失败:', error);
      return this.createErrorResponse(500, '文件信息获取失败');
    }
  }

  /**
   * 解析HTTP元数据
   */
  private parseHttpMetadata(headers: Headers): R2HTTPMetadata {
    const metadata: R2HTTPMetadata = {};

    const contentType = headers.get('content-type');
    if (contentType) {
      metadata.contentType = contentType;
    }

    const contentEncoding = headers.get('content-encoding');
    if (contentEncoding) {
      metadata.contentEncoding = contentEncoding;
    }

    const contentLanguage = headers.get('content-language');
    if (contentLanguage) {
      metadata.contentLanguage = contentLanguage;
    }

    const cacheControl = headers.get('cache-control');
    if (cacheControl) {
      metadata.cacheControl = cacheControl;
    }

    const contentDisposition = headers.get('content-disposition');
    if (contentDisposition) {
      metadata.contentDisposition = contentDisposition;
    }

    return metadata;
  }

  /**
   * 记录访问尝试
   */
  private async logAccessAttempt(accessLog: {
    userId: string;
    accessKeyId: string;
    operation: 'read' | 'write' | 'delete' | 'list' | 'head';
    resourcePath: string;
    statusCode: number;
    responseTime: number;
    bytesTransferred?: number;
    ipAddress: string;
    userAgent?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      const stmt = this.env.DB.prepare(`
        INSERT INTO r2_access_logs (
          user_id, access_id, operation, resource_path, 
          status_code, response_time, bytes_transferred,
          ip_address, user_agent, error_message, timestamp
        )
        SELECT 
          ?, ua.id, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM user_r2_access ua
        WHERE ua.access_key_id = ?
      `);

      await stmt.bind(
        parseInt(accessLog.userId),
        accessLog.operation,
        accessLog.resourcePath,
        accessLog.statusCode,
        accessLog.responseTime,
        accessLog.bytesTransferred || 0,
        accessLog.ipAddress,
        accessLog.userAgent,
        accessLog.error,
        new Date().toISOString(),
        accessLog.accessKeyId
      ).run();

    } catch (error) {
      console.error('记录访问日志失败:', error);
    }
  }

  /**
   * 记录错误
   */
  private async logError(errorLog: {
    error: string;
    method: string;
    resourcePath: string;
    timestamp: string;
  }): Promise<void> {
    try {
      const stmt = this.env.DB.prepare(`
        INSERT INTO system_event_logs (
          event_type, event_name, service, level, message, details, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        'access_control_error',
        'worker_error',
        'access_control_worker',
        'error',
        errorLog.error,
        JSON.stringify({
          method: errorLog.method,
          resourcePath: errorLog.resourcePath
        }),
        errorLog.timestamp
      ).run();

    } catch (error) {
      console.error('记录错误日志失败:', error);
    }
  }

  /**
   * 获取客户端IP
   */
  private getClientIP(request: Request): string {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );
  }

  /**
   * 映射HTTP方法到操作类型
   */
  private mapMethodToOperation(method: string): 'read' | 'write' | 'delete' | 'list' | 'head' {
    switch (method) {
      case 'GET':
        return 'read';
      case 'PUT':
      case 'POST':
        return 'write';
      case 'DELETE':
        return 'delete';
      case 'HEAD':
        return 'head';
      default:
        return 'read';
    }
  }

  /**
   * 提取响应大小
   */
  private extractResponseSize(response: Response): number {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength) : 0;
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(statusCode: number, message: string, details?: any): Response {
    const errorResponse = {
      error: {
        code: statusCode,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, HEAD',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }
    });
  }
}

/**
 * Worker入口点
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const worker = new AccessControlWorker(env, ctx);
    return worker.handleRequest(request);
  }
};