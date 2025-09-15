// 权限检查工具
// 提供细粒度权限验证功能

import type { R2Permission } from '../services/access-control.service';

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  matchedPermission?: R2Permission;
}

/**
 * 权限验证器
 */
export class PermissionChecker {
  /**
   * 检查用户是否有权访问指定资源
   */
  static checkAccess(
    permissions: R2Permission[],
    resourcePath: string,
    operation: 'read' | 'write' | 'delete' | 'list' | 'head',
    context?: {
      userId?: number;
      ipAddress?: string;
      userAgent?: string;
      fileSize?: number;
      resourceType?: string;
    }
  ): PermissionCheckResult {
    try {
      // 如果没有权限配置，默认拒绝访问
      if (!permissions || permissions.length === 0) {
        return {
          hasPermission: false,
          reason: '没有配置访问权限'
        };
      }

      // 查找匹配的权限
      for (const permission of permissions) {
        const matchResult = this.checkPermissionMatch(
          permission,
          resourcePath,
          operation,
          context
        );

        if (matchResult.hasPermission) {
          return matchResult;
        }
      }

      return {
        hasPermission: false,
        reason: '没有匹配的访问权限'
      };

    } catch (error) {
      return {
        hasPermission: false,
        reason: '权限检查失败'
      };
    }
  }

  /**
   * 检查单个权限是否匹配
   */
  private static checkPermissionMatch(
    permission: R2Permission,
    resourcePath: string,
    operation: string,
    context?: any
  ): PermissionCheckResult {
    // 检查操作权限
    if (!permission.actions.includes(operation as any)) {
      return {
        hasPermission: false,
        reason: `操作 ${operation} 不被允许`
      };
    }

    // 检查资源路径匹配
    if (!this.isResourceMatch(resourcePath, permission.resource)) {
      return {
        hasPermission: false,
        reason: '资源路径不匹配'
      };
    }

    // 检查额外条件
    if (permission.conditions) {
      const conditionResult = this.checkConditions(
        permission.conditions,
        resourcePath,
        context
      );
      
      if (!conditionResult.passed) {
        return {
          hasPermission: false,
          reason: conditionResult.reason
        };
      }
    }

    return {
      hasPermission: true,
      matchedPermission: permission
    };
  }

  /**
   * 检查资源路径是否匹配权限模式
   */
  private static isResourceMatch(resourcePath: string, pattern: string): boolean {
    try {
      // 标准化路径
      const normalizedPath = resourcePath.replace(/\\/g, '/');
      const normalizedPattern = pattern.replace(/\\/g, '/');

      // 如果模式以 / 开头，确保路径也以 / 开头
      if (normalizedPattern.startsWith('/')) {
        if (!normalizedPath.startsWith('/')) {
          return false;
        }
      }

      // 处理通配符匹配
      const regexPattern = this.convertPatternToRegex(normalizedPattern);
      const regex = new RegExp(`^${regexPattern}$`);
      
      return regex.test(normalizedPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 将权限模式转换为正则表达式
   */
  private static convertPatternToRegex(pattern: string): string {
    return pattern
      .replace(/\./g, '\\.')      // 转义点号
      .replace(/\*\*/g, '.*')    // ** 匹配任意字符（包括路径分隔符）
      .replace(/\*/g, '[^/]*')   // * 匹配非路径分隔符字符
      .replace(/\?/g, '.')       // ? 匹配单个字符
      .replace(/\/\//g, '\\/\\/'); // 处理双斜杠
  }

  /**
   * 检查权限条件
   */
  private static checkConditions(
    conditions: Record<string, any>,
    resourcePath: string,
    context?: any
  ): { passed: boolean; reason?: string } {
    try {
      for (const [key, value] of Object.entries(conditions)) {
        const conditionResult = this.evaluateCondition(
          key,
          value,
          resourcePath,
          context
        );

        if (!conditionResult.passed) {
          return conditionResult;
        }
      }

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        reason: '条件检查失败'
      };
    }
  }

  /**
   * 评估单个条件
   */
  private static evaluateCondition(
    key: string,
    value: any,
    resourcePath: string,
    context?: any
  ): { passed: boolean; reason?: string } {
    try {
      switch (key) {
        case 'maxSize':
          if (context?.fileSize && context.fileSize > value) {
            return {
              passed: false,
              reason: `文件大小 ${context.fileSize} 超过限制 ${value}`
            };
          }
          break;

        case 'allowedExtensions':
          const ext = resourcePath.split('.').pop()?.toLowerCase();
          if (ext && Array.isArray(value) && !value.includes(ext)) {
            return {
              passed: false,
              reason: `文件类型 ${ext} 不被允许`
            };
          }
          break;

        case 'forbiddenExtensions':
          const forbiddenExt = resourcePath.split('.').pop()?.toLowerCase();
          if (forbiddenExt && Array.isArray(value) && value.includes(forbiddenExt)) {
            return {
              passed: false,
              reason: `文件类型 ${forbiddenExt} 被禁止`
            };
          }
          break;

        case 'ipWhitelist':
          if (context?.ipAddress && Array.isArray(value) && !value.includes(context.ipAddress)) {
            return {
              passed: false,
              reason: 'IP地址不在白名单中'
            };
          }
          break;

        case 'ipBlacklist':
          if (context?.ipAddress && Array.isArray(value) && value.includes(context.ipAddress)) {
            return {
              passed: false,
              reason: 'IP地址在黑名单中'
            };
          }
          break;

        case 'timeRange':
          if (Array.isArray(value) && value.length === 2) {
            const now = new Date();
            const startTime = new Date(value[0]);
            const endTime = new Date(value[1]);
            
            if (now < startTime || now > endTime) {
              return {
                passed: false,
                reason: '当前时间不在允许的时间范围内'
              };
            }
          }
          break;

        case 'userAgent':
          if (context?.userAgent && typeof value === 'string') {
            const userAgentRegex = new RegExp(value);
            if (!userAgentRegex.test(context.userAgent)) {
              return {
                passed: false,
                reason: 'User-Agent不匹配'
              };
            }
          }
          break;

        case 'pathDepth':
          const depth = resourcePath.split('/').length - 1;
          if (typeof value === 'number' && depth !== value) {
            return {
              passed: false,
              reason: `路径深度 ${depth} 不匹配要求 ${value}`
            };
          }
          if (Array.isArray(value) && !value.includes(depth)) {
            return {
              passed: false,
              reason: `路径深度 ${depth} 不在允许范围内`
            };
          }
          break;

        case 'fileNamePattern':
          const fileName = resourcePath.split('/').pop() || '';
          const fileNameRegex = new RegExp(value);
          if (!fileNameRegex.test(fileName)) {
            return {
              passed: false,
              reason: '文件名不匹配模式'
            };
          }
          break;

        case 'requiredMetadata':
          if (context?.metadata && typeof value === 'object') {
            for (const [metaKey, metaValue] of Object.entries(value)) {
              if (context.metadata[metaKey] !== metaValue) {
                return {
                  passed: false,
                  reason: `缺少必需的元数据 ${metaKey}`
                };
              }
            }
          }
          break;

        default:
          // 未知条件，默认通过
          break;
      }

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        reason: `条件 ${key} 评估失败`
      };
    }
  }

  /**
   * 验证权限配置的有效性
   */
  static validatePermissionConfig(permissions: R2Permission[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!Array.isArray(permissions)) {
        errors.push('权限配置必须是数组');
        return { isValid: false, errors, warnings };
      }

      for (let i = 0; i < permissions.length; i++) {
        const permission = permissions[i];
        const prefix = `权限 ${i + 1}`;

        // 检查必需字段
        if (!permission.resource) {
          errors.push(`${prefix}: 缺少资源路径`);
        }

        if (!permission.actions || !Array.isArray(permission.actions) || permission.actions.length === 0) {
          errors.push(`${prefix}: 缺少有效的操作列表`);
        }

        // 验证操作类型
        const validActions = ['read', 'write', 'delete', 'list', 'head'];
        const invalidActions = permission.actions?.filter(action => !validActions.includes(action));
        if (invalidActions && invalidActions.length > 0) {
          errors.push(`${prefix}: 包含无效的操作类型: ${invalidActions.join(', ')}`);
        }

        // 验证资源路径模式
        if (permission.resource) {
          try {
            this.convertPatternToRegex(permission.resource);
          } catch (error) {
            errors.push(`${prefix}: 无效的资源路径模式: ${permission.resource}`);
          }
        }

        // 验证条件
        if (permission.conditions) {
          const conditionErrors = this.validateConditions(permission.conditions);
          errors.push(...conditionErrors.map(err => `${prefix}: ${err}`));
        }

        // 检查冲突权限
        for (let j = i + 1; j < permissions.length; j++) {
          const otherPermission = permissions[j];
          if (this.isConflictingPermission(permission, otherPermission)) {
            warnings.push(`权限 ${i + 1} 和权限 ${j + 1} 可能存在冲突`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push('权限配置验证失败');
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 验证条件配置
   */
  private static validateConditions(conditions: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'maxSize':
        case 'pathDepth':
          if (typeof value !== 'number' || value <= 0) {
            errors.push(`${key} 必须是正数`);
          }
          break;

        case 'allowedExtensions':
        case 'forbiddenExtensions':
        case 'ipWhitelist':
        case 'ipBlacklist':
          if (!Array.isArray(value) || value.length === 0) {
            errors.push(`${key} 必须是非空数组`);
          }
          break;

        case 'timeRange':
          if (!Array.isArray(value) || value.length !== 2) {
            errors.push(`${key} 必须是包含2个时间元素的数组`);
          }
          break;

        case 'userAgent':
        case 'fileNamePattern':
          if (typeof value !== 'string') {
            errors.push(`${key} 必须是字符串`);
          } else {
            try {
              new RegExp(value);
            } catch (error) {
              errors.push(`${key} 包含无效的正则表达式`);
            }
          }
          break;

        default:
          // 自定义条件，跳过验证
          break;
      }
    }

    return errors;
  }

  /**
   * 检查权限是否冲突
   */
  private static isConflictingPermission(perm1: R2Permission, perm2: R2Permission): boolean {
    try {
      // 检查资源路径是否重叠
      const pattern1 = this.convertPatternToRegex(perm1.resource);
      const pattern2 = this.convertPatternToRegex(perm2.resource);
      
      // 简化的冲突检测
      if (perm1.resource === perm2.resource) {
        // 检查操作是否有冲突
        const conflictingActions = perm1.actions.filter(action => perm2.actions.includes(action));
        if (conflictingActions.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成权限配置示例
   */
  static generatePermissionExamples(): {
    readonly: R2Permission[];
    readwrite: R2Permission[];
    restricted: R2Permission[];
    custom: R2Permission[];
  } {
    return {
      readonly: [
        {
          resource: 'user-{userId}/*',
          actions: ['read', 'list', 'head']
        }
      ],
      readwrite: [
        {
          resource: 'user-{userId}/*',
          actions: ['read', 'write', 'list', 'head']
        }
      ],
      restricted: [
        {
          resource: 'user-{userId}/documents/*',
          actions: ['read', 'write', 'list', 'head'],
          conditions: {
            maxSize: 10485760, // 10MB
            allowedExtensions: ['txt', 'md', 'pdf', 'doc', 'docx']
          }
        },
        {
          resource: 'user-{userId}/images/*',
          actions: ['read', 'write', 'list', 'head'],
          conditions: {
            maxSize: 5242880, // 5MB
            allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
          }
        }
      ],
      custom: [
        {
          resource: 'user-{userId}/public/*',
          actions: ['read', 'list', 'head']
        },
        {
          resource: 'user-{userId}/private/*',
          actions: ['read', 'write', 'list', 'head', 'delete'],
          conditions: {
            ipWhitelist: ['192.168.1.0/24'],
            timeRange: ['2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z']
          }
        }
      ]
    };
  }
}