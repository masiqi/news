// 路径验证工具
// 提供路径验证和安全性检查功能

/**
 * 验证路径是否安全
 */
export function validatePath(path: string): {
  isValid: boolean;
  error?: string;
  normalizedPath?: string;
} {
  try {
    // 检查路径是否为空
    if (!path || path.trim() === '') {
      return {
        isValid: false,
        error: '路径不能为空'
      };
    }

    // 移除前导和尾随斜杠
    let normalizedPath = path.trim();
    
    // 标准化路径分隔符
    normalizedPath = normalizedPath.replace(/\\/g, '/');
    
    // 移除重复的斜杠
    normalizedPath = normalizedPath.replace(/\/+/g, '/');
    
    // 检查路径遍历攻击
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      return {
        isValid: false,
        error: '路径包含非法字符: 路径遍历攻击'
      };
    }

    // 检查绝对路径（不应该以/开头）
    if (normalizedPath.startsWith('/')) {
      return {
        isValid: false,
        error: '路径不应该以斜杠开头'
      };
    }

    // 检查是否包含特殊字符
    const invalidChars = /[\0-\x1F\x7F<>:"|?*;&]/;
    if (invalidChars.test(normalizedPath)) {
      return {
        isValid: false,
        error: '路径包含非法字符'
      };
    }

    // 检查路径长度
    if (normalizedPath.length > 1024) {
      return {
        isValid: false,
        error: '路径过长'
      };
    }

    // 检查文件扩展名安全性
    const ext = normalizedPath.split('.').pop()?.toLowerCase();
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'jar', 'app', 'deb', 'rpm',
      'dmg', 'pkg', 'msi', 'iso', 'bin', 'sh', 'py', 'php', 'asp', 'jsp'
    ];
    
    if (ext && dangerousExtensions.includes(ext)) {
      return {
        isValid: false,
        error: '不允许的文件类型'
      };
    }

    return {
      isValid: true,
      normalizedPath
    };

  } catch (error) {
    return {
      isValid: false,
      error: '路径验证失败'
    };
  }
}

/**
 * 验证用户路径前缀
 */
export function validateUserPathPrefix(pathPrefix: string): {
  isValid: boolean;
  error?: string;
  normalizedPrefix?: string;
} {
  try {
    // 基本路径验证
    const pathValidation = validatePath(pathPrefix);
    if (!pathValidation.isValid) {
      return {
        isValid: false,
        error: pathValidation.error
      };
    }

    let normalizedPrefix = pathValidation.normalizedPath!;

    // 确保路径前缀以斜杠结尾
    if (!normalizedPrefix.endsWith('/')) {
      normalizedPrefix += '/';
    }

    // 检查用户路径格式（应该符合 user-{id}/ 格式）
    const userPrefixPattern = /^user-\d+\/$/;
    if (!userPrefixPattern.test(normalizedPrefix)) {
      return {
        isValid: false,
        error: '用户路径前缀格式错误，应该符合 user-{id}/ 格式'
      };
    }

    // 验证用户ID
    const userIdMatch = normalizedPrefix.match(/^user-(\d+)\//);
    if (!userIdMatch) {
      return {
        isValid: false,
        error: '无法从路径前缀中提取用户ID'
      };
    }

    const userId = parseInt(userIdMatch[1]);
    if (isNaN(userId) || userId < 0) {
      return {
        isValid: false,
        error: '无效的用户ID'
      };
    }

    return {
      isValid: true,
      normalizedPrefix
    };

  } catch (error) {
    return {
      isValid: false,
      error: '用户路径前缀验证失败'
    };
  }
}

/**
 * 检查路径是否在允许的范围内
 */
export function isPathAllowed(resourcePath: string, allowedPrefix: string): boolean {
  try {
    // 验证两个路径
    const resourceValidation = validatePath(resourcePath);
    const prefixValidation = validatePath(allowedPrefix);
    
    if (!resourceValidation.isValid || !prefixValidation.isValid) {
      return false;
    }

    const normalizedResource = resourceValidation.normalizedPath!;
    const normalizedPrefix = prefixValidation.normalizedPath!;

    // 确保前缀以斜杠结尾
    const finalPrefix = normalizedPrefix.endsWith('/') 
      ? normalizedPrefix 
      : normalizedPrefix + '/';

    // 检查资源路径是否以前缀开头
    return normalizedResource.startsWith(finalPrefix);
  } catch (error) {
    return false;
  }
}

/**
 * 生成安全的文件名
 */
export function generateSafeFilename(originalName: string): string {
  try {
    // 移除路径信息
    let filename = originalName.split('/').pop() || originalName;
    filename = filename.split('\\').pop() || filename;

    // 移除或替换危险字符
    filename = filename
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^\.+/, '') // 移除开头的点
      .replace(/\.+$/, '') // 移除结尾的点
      .substring(0, 255); // 限制长度

    // 确保文件名不为空
    if (filename.trim() === '') {
      filename = `file_${Date.now()}`;
    }

    // 添加时间戳确保唯一性
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const baseName = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename;
    
    return `${baseName}_${timestamp}_${random}${ext ? '.' + ext : ''}`;
  } catch (error) {
    return `safe_file_${Date.now()}`;
  }
}

/**
 * 验证文件扩展名
 */
export function validateFileExtension(filename: string, allowedExtensions?: string[]): {
  isValid: boolean;
  error?: string;
  extension?: string;
} {
  try {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (!ext) {
      return {
        isValid: false,
        error: '文件没有扩展名'
      };
    }

    // 危险扩展名检查
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'jar', 'app', 'deb', 'rpm',
      'dmg', 'pkg', 'msi', 'iso', 'bin', 'sh', 'py', 'php', 'asp', 'jsp'
    ];

    if (dangerousExtensions.includes(ext)) {
      return {
        isValid: false,
        error: '不允许的文件类型',
        extension: ext
      };
    }

    // 如果指定了允许的扩展名，则进行检查
    if (allowedExtensions && allowedExtensions.length > 0) {
      if (!allowedExtensions.includes(ext)) {
        return {
          isValid: false,
          error: `文件类型 ${ext} 不被允许`,
          extension: ext
        };
      }
    }

    return {
      isValid: true,
      extension: ext
    };

  } catch (error) {
    return {
      isValid: false,
      error: '文件扩展名验证失败'
    };
  }
}

/**
 * 构建用户专属路径
 */
export function buildUserPath(userId: number, subPath?: string): string {
  const userPrefix = `user-${userId}/`;
  
  if (!subPath || subPath.trim() === '') {
    return userPrefix;
  }

  // 验证子路径
  const subPathValidation = validatePath(subPath);
  if (!subPathValidation.isValid) {
    throw new Error(`无效的子路径: ${subPathValidation.error}`);
  }

  const normalizedSubPath = subPathValidation.normalizedPath!;
  
  // 移除开头的斜杠
  const cleanSubPath = normalizedSubPath.startsWith('/') 
    ? normalizedSubPath.substring(1) 
    : normalizedSubPath;

  return `${userPrefix}${cleanSubPath}`;
}

/**
 * 解析路径获取用户ID
 */
export function extractUserIdFromPath(resourcePath: string): number | null {
  try {
    // 验证路径
    const pathValidation = validatePath(resourcePath);
    if (!pathValidation.isValid) {
      return null;
    }

    const normalizedPath = pathValidation.normalizedPath!;

    // 检查路径格式
    const userPrefixMatch = normalizedPath.match(/^user-(\d+)\//);
    if (!userPrefixMatch) {
      return null;
    }

    const userId = parseInt(userPrefixMatch[1]);
    if (isNaN(userId) || userId < 0) {
      return null;
    }

    return userId;
  } catch (error) {
    return null;
  }
}

/**
 * 路径安全性检查
 */
export function performPathSecurityCheck(resourcePath: string, userId: number): {
  isSecure: boolean;
  error?: string;
  normalizedPath?: string;
} {
  try {
    // 验证资源路径
    const resourceValidation = validatePath(resourcePath);
    if (!resourceValidation.isValid) {
      return {
        isSecure: false,
        error: resourceValidation.error
      };
    }

    const normalizedPath = resourceValidation.normalizedPath!;

    // 检查路径是否属于指定用户
    const extractedUserId = extractUserIdFromPath(normalizedPath);
    if (extractedUserId !== userId) {
      return {
        isSecure: false,
        error: '路径不属于指定用户'
      };
    }

    // 检查路径遍历攻击
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      return {
        isSecure: false,
        error: '检测到路径遍历攻击'
      };
    }

    // 检查敏感文件
    const sensitivePatterns = [
      /\.ht(access|passwd)/i,
      /\.env/i,
      /config\.php/i,
      /wp-config\.php/i,
      /\.git/i,
      /\.svn/i,
      /node_modules/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(normalizedPath)) {
        return {
          isSecure: false,
          error: '访问敏感文件被拒绝'
        };
      }
    }

    return {
      isSecure: true,
      normalizedPath
    };

  } catch (error) {
    return {
      isSecure: false,
      error: '路径安全检查失败'
    };
  }
}