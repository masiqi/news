// webdav-formatter.ts
// WebDAV响应格式化器，将数据转换为WebDAV标准XML格式

export interface WebDAVItem {
  path: string;
  isDirectory: boolean;
  lastModified: Date;
  size: number;
  contentType?: string;
  etag?: string;
}

export class WebDAVResponseFormatter {
  /**
   * 格式化PROPFIND响应
   */
  formatPropFindResponse(items: WebDAVItem[], requestPath: string): string {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
${items.map(item => this.formatPropFindItem(item, requestPath)).join('')}
</D:multistatus>`;
    
    return xml;
  }

  /**
   * 格式化单个PROPFIND项目
   */
  private formatPropFindItem(item: WebDAVItem, requestPath: string): string {
    const href = this.encodeHref(item.path);
    const isCollection = item.isDirectory;
    const lastModified = this.formatDate(item.lastModified);
    const contentType = item.contentType || (isCollection ? 'httpd/unix-directory' : 'application/octet-stream');
    const displayName = this.getDisplayName(item.path);
    
    return `  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${displayName}</D:displayname>
        <D:getlastmodified>${lastModified}</D:getlastmodified>
        <D:getcontentlength>${item.size}</D:getcontentlength>
        <D:getcontenttype>${contentType}</D:getcontenttype>
        <D:resourcetype>
          ${isCollection ? '<D:collection/>' : ''}
        </D:resourcetype>
        ${item.etag ? `<D:getetag>"${item.etag}"</D:getetag>` : ''}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  /**
   * 格式化错误响应
   */
  formatErrorResponse(path: string, statusCode: number, message: string): string {
    const href = this.encodeHref(path);
    const statusText = this.getStatusText(statusCode);
    
    return `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 ${statusCode} ${statusText}</D:status>
      <D:error><D:${message}/></D:error>
    </D:propstat>
  </D:response>
</D:multistatus>`;
  }

  /**
   * 编码URL
   */
  private encodeHref(path: string): string {
    // 确保路径以/开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    // 编码特殊字符
    return normalizedPath.split('/').map(segment => 
      encodeURIComponent(segment).replace(/%2F/g, '/')
    ).join('/');
  }

  /**
   * 格式化日期为RFC 1123格式
   */
  private formatDate(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[date.getUTCDay()];
    const dateNum = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    
    return `${day}, ${dateNum} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
  }

  /**
   * 获取显示名称
   */
  private getDisplayName(path: string): string {
    // 移除开头和结尾的斜杠
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    
    if (!normalizedPath) {
      return '/';
    }
    
    // 获取最后一部分
    const parts = normalizedPath.split('/');
    return parts[parts.length - 1] || '';
  }

  /**
   * 获取状态文本
   */
  private getStatusText(statusCode: number): string {
    const statusMap: { [key: number]: string } = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      207: 'Multi-Status',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      423: 'Locked',
      500: 'Internal Server Error',
      507: 'Insufficient Storage'
    };
    
    return statusMap[statusCode] || 'Unknown';
  }

  /**
   * 格式化文件属性
   */
  formatFileProperties(item: WebDAVItem): string {
    return `<D:prop>
  <D:displayname>${this.getDisplayName(item.path)}</D:displayname>
  <D:getlastmodified>${this.formatDate(item.lastModified)}</D:getlastmodified>
  <D:getcontentlength>${item.size}</D:getcontentlength>
  <D:getcontenttype>${item.contentType || 'application/octet-stream'}</D:getcontenttype>
  <D:resourcetype>
    ${item.isDirectory ? '<D:collection/>' : ''}
  </D:resourcetype>
  ${item.etag ? `<D:getetag>"${item.etag}"</D:getetag>` : ''}
</D:prop>`;
  }

  /**
   * 创建基本的多状态响应
   */
  createMultiStatusResponse(): string {
    return `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
</D:multistatus>`;
  }

  /**
   * 添加响应项到多状态响应
   */
  addResponseToMultiStatus(xml: string, item: WebDAVItem, requestPath: string, statusCode: number = 200): string {
    const itemXml = this.formatPropFindItem(item, requestPath);
    const statusText = this.getStatusText(statusCode);
    
    // 替换状态码
    const modifiedItemXml = itemXml.replace(
      '<D:status>HTTP/1.1 200 OK</D:status>',
      `<D:status>HTTP/1.1 ${statusCode} ${statusText}</D:status>`
    );
    
    // 插入到multistatus标签内
    return xml.replace('</D:multistatus>', `${modifiedItemXml}</D:multistatus>`);
  }

  /**
   * 格式化锁定信息（如果需要支持锁定）
   */
  formatLockInfo(lockToken: string, timeout: number, owner?: string): string {
    return `<D:activelock>
  <D:locktype><D:write/></D:locktype>
  <D:lockscope><D:exclusive/></D:lockscope>
  <D:depth>infinity</D:depth>
  ${owner ? `<D:owner>${owner}</D:owner>` : ''}
  <D:timeout>Second-${timeout}</D:timeout>
  <D:locktoken><D:href>urn:uuid:${lockToken}</D:href></D:locktoken>
</D:activelock>`;
  }

  /**
   * 格式化支持的WebDAV方法
   */
  formatAllowHeader(methods: string[]): string {
    return methods.join(', ');
  }

  /**
   * 格式化DAV头
   */
  formatDavHeader(classes: ('1' | '2' | '3')[] = ['1', '2']): string {
    return classes.join(',');
  }
}