// 访问控制配置
// 多用户R2访问控制的配置选项

/**
 * 访问控制配置接口
 */
export interface AccessControlConfig {
  // R2存储配置
  r2: {
    bucket: string;
    region: string;
    endpoint: string;
    publicEndpoint?: string;
  };

  // 用户配置
  user: {
    defaultQuota: {
      storageBytes: number;
      fileCount: number;
    };
    defaultPermissions: {
      actions: ('read' | 'write' | 'delete' | 'list' | 'head')[];
      resourcePattern: string;
    }[];
    pathPrefixTemplate: string; // 如 'user-{userId}/'
    defaultExpirySeconds: number; // 默认过期时间
  };

  // 安全配置
  security: {
    maxLoginAttempts: number;
    lockoutDurationSeconds: number;
    sessionTimeoutSeconds: number;
    tokenRefreshThresholdSeconds: number;
    allowedOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
      burstLimit: number;
    };
  };

  // 访问控制代理配置
  proxy: {
    enabled: boolean;
    workerUrl?: string;
    requestTimeoutMs: number;
    maxResponseBodySize: number;
    enableRequestLogging: boolean;
    enableResponseLogging: boolean;
  };

  // 监控和日志配置
  monitoring: {
    enableAccessLogging: boolean;
    enablePerformanceMonitoring: boolean;
    logRetentionDays: number;
    alertThresholds: {
      highErrorRate: number; // 百分比
      slowResponseTime: number; // 毫秒
      unusualActivityThreshold: number;
    };
  };

  // 文件验证配置
  fileValidation: {
    maxFileSize: number;
    allowedExtensions: string[];
    blockedExtensions: string[];
    scanForMalware: boolean;
    contentValidation: {
      enabled: boolean;
      maxContentLength: number;
      allowedContentTypes: string[];
    };
  };
}

/**
 * 默认配置
 */
export const defaultAccessControlConfig: AccessControlConfig = {
  r2: {
    bucket: 'news-storage',
    region: 'auto',
    endpoint: 'https://your-account.r2.cloudflarestorage.com',
    publicEndpoint: 'https://pub-your-account.r2.dev'
  },

  user: {
    defaultQuota: {
      storageBytes: 104857600, // 100MB
      fileCount: 1000
    },
    defaultPermissions: [
      {
        actions: ['read', 'list', 'head'],
        resourcePattern: 'user-{userId}/*'
      }
    ],
    pathPrefixTemplate: 'user-{userId}/',
    defaultExpirySeconds: 31536000 // 1年
  },

  security: {
    maxLoginAttempts: 5,
    lockoutDurationSeconds: 900, // 15分钟
    sessionTimeoutSeconds: 86400, // 24小时
    tokenRefreshThresholdSeconds: 3600, // 1小时
    allowedOrigins: ['http://localhost:3000', 'https://your-domain.com'],
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 60,
      burstLimit: 10
    }
  },

  proxy: {
    enabled: true,
    requestTimeoutMs: 30000, // 30秒
    maxResponseBodySize: 104857600, // 100MB
    enableRequestLogging: true,
    enableResponseLogging: true
  },

  monitoring: {
    enableAccessLogging: true,
    enablePerformanceMonitoring: true,
    logRetentionDays: 90,
    alertThresholds: {
      highErrorRate: 5, // 5%
      slowResponseTime: 5000, // 5秒
      unusualActivityThreshold: 100 // 异常活动阈值
    }
  },

  fileValidation: {
    maxFileSize: 52428800, // 50MB
    allowedExtensions: [
      'txt', 'md', 'markdown', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp3', 'mp4', 'wav', 'avi'
    ],
    blockedExtensions: [
      'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'jar', 'app', 'deb', 'rpm',
      'dmg', 'pkg', 'msi', 'iso', 'bin', 'sh', 'py', 'php', 'asp', 'jsp'
    ],
    scanForMalware: false, // 需要集成恶意软件扫描服务
    contentValidation: {
      enabled: true,
      maxContentLength: 10485760, // 10MB
      allowedContentTypes: [
        'text/plain', 'text/markdown', 'text/html', 'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.*',
        'image/*', 'audio/*', 'video/*'
      ]
    }
  }
};

/**
 * 环境变量映射
 */
export const environmentVariableMapping = {
  'R2_BUCKET_NAME': 'r2.bucket',
  'R2_REGION': 'r2.region',
  'R2_ENDPOINT': 'r2.endpoint',
  'R2_PUBLIC_ENDPOINT': 'r2.publicEndpoint',
  'USER_DEFAULT_STORAGE_BYTES': 'user.defaultQuota.storageBytes',
  'USER_DEFAULT_FILE_COUNT': 'user.defaultQuota.fileCount',
  'USER_DEFAULT_EXPIRY_SECONDS': 'user.defaultExpirySeconds',
  'SECURITY_MAX_LOGIN_ATTEMPTS': 'security.maxLoginAttempts',
  'SECURITY_SESSION_TIMEOUT_SECONDS': 'security.sessionTimeoutSeconds',
  'PROXY_REQUEST_TIMEOUT_MS': 'proxy.requestTimeoutMs',
  'MONITORING_LOG_RETENTION_DAYS': 'monitoring.logRetentionDays',
  'FILE_MAX_SIZE_BYTES': 'fileValidation.maxFileSize'
};

/**
 * 从环境变量加载配置
 */
export function loadConfigFromEnvironment(env: Record<string, string>): AccessControlConfig {
  const config = JSON.parse(JSON.stringify(defaultAccessControlConfig));

  for (const [envVar, configPath] of Object.entries(environmentVariableMapping)) {
    const value = env[envVar];
    if (value !== undefined) {
      setNestedValue(config, configPath, convertEnvValue(value));
    }
  }

  // 处理特殊的数组类型环境变量
  if (env.ALLOWED_ORIGINS) {
    config.security.allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  }

  if (env.ALLOWED_EXTENSIONS) {
    config.fileValidation.allowedExtensions = env.ALLOWED_EXTENSIONS.split(',').map(s => s.trim());
  }

  if (env.BLOCKED_EXTENSIONS) {
    config.fileValidation.blockedExtensions = env.BLOCKED_EXTENSIONS.split(',').map(s => s.trim());
  }

  return config;
}

/**
 * 设置嵌套配置值
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * 转换环境变量值
 */
function convertEnvValue(value: string): any {
  // 尝试转换为数字
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  // 尝试转换为浮点数
  if (/^\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // 转换布尔值
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // 返回字符串
  return value;
}

/**
 * 验证配置
 */
export function validateConfig(config: AccessControlConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 验证R2配置
    if (!config.r2.bucket || config.r2.bucket.trim() === '') {
      errors.push('R2桶名称不能为空');
    }

    if (!config.r2.endpoint || config.r2.endpoint.trim() === '') {
      errors.push('R2端点URL不能为空');
    }

    // 验证用户配置
    if (config.user.defaultQuota.storageBytes <= 0) {
      errors.push('默认存储配额必须大于0');
    }

    if (config.user.defaultQuota.fileCount <= 0) {
      errors.push('默认文件数量配额必须大于0');
    }

    if (config.user.defaultExpirySeconds <= 0) {
      errors.push('默认过期时间必须大于0');
    }

    // 验证安全配置
    if (config.security.maxLoginAttempts <= 0) {
      errors.push('最大登录尝试次数必须大于0');
    }

    if (config.security.sessionTimeoutSeconds <= 0) {
      errors.push('会话超时时间必须大于0');
    }

    // 验证代理配置
    if (config.proxy.requestTimeoutMs <= 0) {
      errors.push('代理请求超时时间必须大于0');
    }

    // 验证文件配置
    if (config.fileValidation.maxFileSize <= 0) {
      errors.push('最大文件大小必须大于0');
    }

    if (config.fileValidation.allowedExtensions.length === 0) {
      warnings.push('允许的文件扩展名列表为空，所有文件类型都将被拒绝');
    }

    // 验证监控配置
    if (config.monitoring.logRetentionDays <= 0) {
      errors.push('日志保留天数必须大于0');
    }

    // 检查配额合理性
    if (config.user.defaultQuota.storageBytes > 1073741824) { // 1GB
      warnings.push('默认存储配额较大，可能影响系统性能');
    }

    if (config.user.defaultQuota.fileCount > 10000) {
      warnings.push('默认文件数量配额较大，可能影响系统性能');
    }

    // 检查超时配置
    if (config.proxy.requestTimeoutMs > 300000) { // 5分钟
      warnings.push('代理请求超时时间较长，可能影响用户体验');
    }

    // 检查速率限制
    if (config.security.rateLimiting.enabled && config.security.rateLimiting.requestsPerMinute < 10) {
      warnings.push('速率限制配置较严格，可能影响正常使用');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    errors.push('配置验证失败');
    return { isValid: false, errors, warnings };
  }
}

/**
 * 获取配置建议
 */
export function getConfigRecommendations(config: AccessControlConfig): {
  security: string[];
  performance: string[];
  storage: string[];
  monitoring: string[];
} {
  const recommendations = {
    security: [] as string[],
    performance: [] as string[],
    storage: [] as string[],
    monitoring: [] as string[]
  };

  // 安全建议
  if (config.security.maxLoginAttempts > 10) {
    recommendations.security.push('建议降低最大登录尝试次数以提高安全性');
  }

  if (config.security.sessionTimeoutSeconds > 86400) { // 24小时
    recommendations.security.push('建议缩短会话超时时间以提高安全性');
  }

  if (!config.security.rateLimiting.enabled) {
    recommendations.security.push('建议启用速率限制以防止暴力攻击');
  }

  // 性能建议
  if (config.user.defaultQuota.storageBytes > 524288000) { // 500MB
    recommendations.performance.push('建议降低默认存储配额以提高性能');
  }

  if (config.proxy.requestTimeoutMs > 60000) { // 1分钟
    recommendations.performance.push('建议缩短代理请求超时时间以提高响应速度');
  }

  // 存储建议
  if (config.fileValidation.maxFileSize > 104857600) { // 100MB
    recommendations.storage.push('建议降低最大文件大小限制以优化存储使用');
  }

  if (config.monitoring.logRetentionDays > 365) {
    recommendations.storage.push('建议缩短日志保留时间以减少存储占用');
  }

  // 监控建议
  if (!config.monitoring.enableAccessLogging) {
    recommendations.monitoring.push('建议启用访问日志以便进行安全审计');
  }

  if (!config.monitoring.enablePerformanceMonitoring) {
    recommendations.monitoring.push('建议启用性能监控以便优化系统性能');
  }

  if (config.monitoring.alertThresholds.highErrorRate > 10) {
    recommendations.monitoring.push('建议降低错误率报警阈值以便及时发现问题');
  }

  return recommendations;
}