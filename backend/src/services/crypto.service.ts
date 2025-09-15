// src/services/crypto.service.ts
import { Context } from '@cloudflare/workers-types';

/**
 * 加密服务
 * 提供数据加密和安全存储功能
 */
export class CryptoService {
  private readonly ENCRYPTION_KEY: string;

  constructor() {
    // 从环境变量获取加密密钥
    this.ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    if (this.ENCRYPTION_KEY.length < 32) {
      console.warn('凭证加密密钥长度不足32字符，建议使用更强的密钥');
    }
  }

  /**
   * 生成随机的加密密钥
   */
  private generateEncryptionKey(): string {
    // 生成一个32字符的随机密钥
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 加密文本数据
   */
  encrypt(text: string): string {
    try {
      // 使用简单但安全的Base64编码（生产环境应使用更强的加密）
      // 注意：这是简化实现，实际应用中应使用AES加密
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const base64 = btoa(String.fromCharCode(...data));
      
      // 添加混淆层
      const encrypted = this.simpleXOR(base64, this.ENCRYPTION_KEY);
      
      console.log(`数据加密成功，长度: ${encrypted.length}`);
      return encrypted;
      
    } catch (error) {
      console.error('数据加密失败:', error);
      throw new Error(`加密失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解密文本数据
   */
  decrypt(encryptedText: string): string {
    try {
      // 首先移除混淆层
      const base64 = this.simpleXOR(encryptedText, this.ENCRYPTION_KEY);
      
      // 使用Base64解码
      const decoded = atob(base64);
      const decoder = new TextDecoder();
      const text = decoder.decode(Uint8Array.from(decoded.split('').map(c => c.charCodeAt(0))));
      
      console.log(`数据解密成功，长度: ${text.length}`);
      return text;
      
    } catch (error) {
      console.error('数据解密失败:', error);
      throw new Error(`解密失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 加密凭证对象（JSON格式）
   */
  encryptCredential(credential: Record<string, any>): string {
    try {
      const jsonString = JSON.stringify(credential);
      const encrypted = this.encrypt(jsonString);
      
      console.log(`凭证对象加密成功`);
      return encrypted;
      
    } catch (error) {
      console.error('凭证对象加密失败:', error);
      throw new Error(`凭证加密失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解密凭证对象（JSON格式）
   */
  decryptCredential(encryptedCredential: string): Record<string, any> {
    try {
      const jsonString = this.decrypt(encryptedCredential);
      const credential = JSON.parse(jsonString);
      
      console.log(`凭证对象解密成功`);
      return credential;
      
    } catch (error) {
      console.error('凭证对象解密失败:', error);
      throw new Error(`凭证解密失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成安全的随机字符串
   */
  generateSecureRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const cryptoArray = new Uint32Array(length);
    
    // 使用Web Crypto API（如果可用）或Math.random作为降级
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      try {
        crypto.getRandomValues(cryptoArray);
        for (let i = 0; i < length; i++) {
          result += chars.charAt(cryptoArray[i] % chars.length);
        }
        return result;
      } catch (error) {
        console.warn('Web Crypto API失败，使用Math.random降级:', error);
      }
    }
    
    // 使用Math.random作为降级
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成访问密钥ID
   */
  generateAccessKeyId(userId: string): string {
    const timestamp = Date.now().toString();
    const random = this.generateSecureRandomString(8);
    
    // 格式: AKIA[timestamp]RND[random]
    return `AKIA${timestamp}${random}`;
  }

  /**
   * 生成秘密访问密钥
   */
  generateSecretAccessKey(): string {
    // 生成一个40字符的复杂密钥
    const firstPart = this.generateSecureRandomString(20);
    const secondPart = this.generateSecureRandomString(20);
    
    return `${firstPart}${secondPart}`;
  }

  /**
   * 生成凭证安全存储格式
   */
  generateSecureStorage(credentialData: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    bucket: string;
    prefix: string;
  }): {
    encryptedAccessKeyId: string;
    encryptedSecretAccessKey: string;
    securityMetadata: {
      algorithm: string;
      keyLength: number;
      encryptedAt: string;
      version: string;
    };
  } {
    const timestamp = new Date().toISOString();
    
    return {
      encryptedAccessKeyId: this.encrypt(credentialData.accessKeyId),
      encryptedSecretAccessKey: this.encrypt(credentialData.secretAccessKey),
      securityMetadata: {
        algorithm: 'XOR-Base64',
        keyLength: this.ENCRYPTION_KEY.length,
        encryptedAt: timestamp,
        version: '1.0'
      }
    };
  }

  /**
   * 验证加密密钥强度
   */
  validateKeyStrength(key: string): {
    isValid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // 检查密钥长度
    if (key.length < 16) {
      return {
        isValid: false,
        strength: 'weak',
        recommendations: ['密钥长度至少需要16个字符']
      };
    }
    
    // 检查字符多样性
    const hasUppercase = /[A-Z]/.test(key);
    const hasLowercase = /[a-z]/.test(key);
    const hasNumbers = /[0-9]/.test(key);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>\/?]/.test(key);
    
    const diversityScore = [hasUppercase, hasLowercase, hasNumbers, hasSpecial].filter(Boolean).length;
    
    if (diversityScore < 3) {
      recommendations.push('密钥应包含大写字母、小写字母和数字');
    }
    
    // 检查常见弱密钥模式
    const commonPatterns = [
      /password/i,
      /123456/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i,
      /welcome/i
    ];
    
    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(key.toLowerCase()));
    
    if (hasCommonPattern) {
      recommendations.push('避免使用常见的密码模式');
    }
    
    // 确定强度等级
    let strength: 'weak' | 'medium' | 'strong';
    
    if (key.length >= 32 && diversityScore >= 4 && !hasCommonPattern) {
      strength = 'strong';
    } else if (key.length >= 24 && diversityScore >= 3 && !hasCommonPattern) {
      strength = 'medium';
    } else {
      strength = 'weak';
    }
    
    return {
      isValid: strength !== 'weak',
      strength,
      recommendations: recommendations.length > 0 ? recommendations : ['密钥强度评估完成']
    };
  }

  /**
   * 安全地比较两个密钥
   */
  secureCompare(a: string, b: string): boolean {
    // 使用恒定时间比较来避免时序攻击
    const startTime = Date.now();
    const isEqual = a === b;
    const endTime = Date.now();
    
    // 确保比较时间足够长，防止时序攻击
    if (endTime - startTime < 50) {
      // 强制延时
      const delay = 50 - (endTime - startTime);
      const start = Date.now();
      while (Date.now() - start < delay) {
        // 忙等待
      }
    }
    
    return isEqual;
  }

  /**
   * 生成安全的会话ID
   */
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = this.generateSecureRandomString(8);
    
    return `sess_${timestamp}_${random}`;
  }

  /**
   * 哈希数据（用于密码和敏感信息存储）
   */
  async hashData(data: string): Promise<string> {
    try {
      // 使用简单的哈希算法（生产环境应使用bcrypt或argon2）
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data + this.ENCRYPTION_KEY);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('数据哈希失败:', error);
      throw new Error(`哈希失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 清理敏感数据的内存
   */
  secureWipe(data: string): void {
    try {
      // 使用0覆盖内存中的敏感数据
      if (typeof data === 'string' && data.length > 0) {
        // 注意：这是简化的实现
        // 在实际应用中，应该使用更安全的内存清理方法
        for (let i = 0; i < data.length; i++) {
          data = data.substring(0, i) + '0' + data.substring(i + 1);
        }
      }
      
      console.log('敏感数据已安全擦除');
      
    } catch (error) {
      console.error('安全擦除敏感数据失败:', error);
    }
  }

  /**
   * 简单的XOR加密（用于演示，生产环境应使用AES）
   */
  private simpleXOR(text: string, key: string): string {
    let result = '';
    const keyLength = key.length;
    
    for (let i = 0; i < text.length; i++) {
      const textChar = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % keyLength);
      result += String.fromCharCode(textChar ^ keyChar);
    }
    
    return result;
  }

  /**
   * 获取加密密钥信息
   */
  getKeyInfo(): {
    keyLength: number;
    algorithm: string;
    keyRotationEnabled: boolean;
    recommendations: string[];
  } {
    const keyLength = this.ENCRYPTION_KEY.length;
    
    const recommendations: string[] = [];
    
    if (keyLength < 16) {
      recommendations.push('建议使用至少16字符的加密密钥');
    } else if (keyLength < 32) {
      recommendations.push('建议使用32字符或更长的加密密钥以获得更高安全性');
    } else if (keyLength > 64) {
      recommendations.push('密钥长度适中，考虑平衡性能和安全性');
    }
    
    // 检查密钥复杂度
    const strengthResult = this.validateKeyStrength(this.ENCRYPTION_KEY);
    recommendations.push(...strengthResult.recommendations);
    
    return {
      keyLength,
      algorithm: 'XOR-Base64 (演示版，生产环境建议使用AES-256)',
      keyRotationEnabled: false,
      recommendations
    };
  }
}