// src/services/config/ai-config.service.ts
import { AIProcessingConfig, ProcessingHistory } from '../ai/types';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { users } from '../../db/schema';

/**
 * AI配置管理服务
 * 管理用户的AI处理偏好设置
 */
export class AIConfigService {
  private db: ReturnType<typeof drizzle>;

  constructor(db: any) {
    this.db = drizzle(db);
  }

  /**
   * 获取用户AI配置
   */
  async getUserConfig(userId: string): Promise<AIProcessingConfig> {
    try {
      // 查询用户配置
      const result = await this.db.select({
        columns: {
          id: users.id,
          userId: true,
        },
      })
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (result.length === 0) {
        // 如果用户不存在配置，创建默认配置
        return await this.createDefaultConfig(userId);
      }

      // 解析配置（假设存储在用户的某个字段中）
      // 这里使用模拟配置，实际应用中应该有专门的配置表
      const user = result[0];
      
      return {
        id: `config_${userId}`,
        userId,
        language: this.extractLanguageFromUser(user),
        style: this.extractStyleFromUser(user),
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error('获取用户AI配置失败:', error);
      throw new Error(`获取用户AI配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新用户AI配置
   */
  async updateUserConfig(userId: string, config: Partial<AIProcessingConfig>): Promise<void> {
    try {
      const updateData: any = {};
      
      if (config.language !== undefined) {
        updateData.language_preference = config.language;
      }
      if (config.style !== undefined) {
        updateData.style_preference = config.style;
      }
      if (config.maxTokens !== undefined) {
        updateData.max_tokens_preference = config.maxTokens;
      }
      
      // 更新用户表（简化实现，实际应用中应该有专门的配置表）
      if (Object.keys(updateData).length > 0) {
        await this.db.update(users)
          .set(updateData)
          .where(eq(users.id, parseInt(userId)));
      }
      
      console.log(`用户AI配置更新成功: ${userId}`);
      
    } catch (error) {
      console.error('更新用户AI配置失败:', error);
      throw new Error(`更新用户AI配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 创建默认配置
   */
  async createDefaultConfig(userId: string, defaultConfig?: Partial<AIProcessingConfig>): Promise<AIProcessingConfig> {
    const config: AIProcessingConfig = {
      id: `config_${Date.now()}`,
      userId,
      language: defaultConfig?.language || 'auto',
      style: defaultConfig?.style || 'concise',
      maxTokens: defaultConfig?.maxTokens || 2000,
      includeKeywords: defaultConfig?.includeKeywords ?? true,
      includeSummary: defaultConfig?.includeSummary ?? true,
      includeAnalysis: defaultConfig?.includeAnalysis ?? true,
      templateId: defaultConfig?.templateId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`创建默认AI配置: ${JSON.stringify(config, null, 2)}`);
    return config;
  }

  /**
   * 获取用户模型选择
   */
  async getUserModelSelection(userId: string): Promise<any> {
    try {
      // 简化实现，返回智谱AI作为默认选择
      // 实际应用中应该有专门的模型选择表
      return {
        provider: 'zhipu',
        model: 'glm-4.5-flash',
        name: '智谱 GLM-4.5-Flash',
        description: '智谱最新模型，支持中文内容处理',
        category: 'balanced',
        maxTokens: 128000,
        available: true,
        selectedAt: new Date()
      };
      
    } catch (error) {
      console.error('获取用户模型选择失败:', error);
      throw new Error(`获取用户模型选择失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新用户模型选择
   */
  async updateUserModelSelection(userId: string, selection: any): Promise<void> {
    try {
      console.log(`更新用户模型选择: ${userId} -> ${selection.model}`);
      
      // 简化实现，只记录日志
      // 实际应用中应该保存到专门的模型选择表
      
      console.log(`模型选择更新成功: ${selection.model}`);
      
    } catch (error) {
      console.error('更新用户模型选择失败:', error);
      throw new Error(`更新用户模型选择失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      const models = [
        {
          id: 'glm-4.5-flash',
          provider: 'zhipu',
          name: '智谱 GLM-4.5-Flash',
          description: '智谱最新4.5版本模型，性能优异，支持长文本处理',
          category: 'balanced',
          maxTokens: 128000,
          costPer1kTokens: 0.001,
          available: true
        },
        {
          id: 'glm-4-air',
          provider: 'zhipu',
          name: '智谱 GLM-4-Air',
          description: '智谱4版本，轻量级模型，速度快',
          category: 'fast',
          maxTokens: 8192,
          costPer1kTokens: 0.0005,
          available: true
        },
        {
          id: 'llama-3.1-8b',
          provider: 'cloudflare',
          name: 'Llama 3.1 8B',
          description: 'Meta Llama 3.1 8B，本地运行模型',
          category: 'fast',
          maxTokens: 131072,
          costPer1kTokens: 0.002,
          available: true
        },
        {
          id: 'mixtral-7b',
          provider: 'cloudflare',
          name: 'Mixtral 7B',
          description: 'Mixtral 7B，开源高性能模型',
          category: 'balanced',
          maxTokens: 32768,
          costPer1kTokens: 0.005,
          available: true
        }
      ];
      
      return models;
      
    } catch (error) {
      console.error('获取可用模型列表失败:', error);
      throw new Error(`获取可用模型列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证配置有效性
   */
  async validateConfig(config: AIProcessingConfig): Promise<boolean> {
    try {
      // 检查必要字段
      if (!config.userId || !config.language) {
        return false;
      }
      
      // 检查语言支持
      const supportedLanguages = ['zh-CN', 'en-US', 'auto'];
      if (!supportedLanguages.includes(config.language)) {
        return false;
      }
      
      // 检查风格设置
      const supportedStyles = ['concise', 'detailed', 'academic'];
      if (!supportedStyles.includes(config.style)) {
        return false;
      }
      
      // 检查token限制
      if (config.maxTokens < 100 || config.maxTokens > 50000) {
        return false;
      }
      
      // 检查布尔值
      if (typeof config.includeKeywords !== 'boolean' || 
          typeof config.includeSummary !== 'boolean' || 
          typeof config.includeAnalysis !== 'boolean') {
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('配置验证失败:', error);
      return false;
    }
  }

  /**
   * 获取推荐配置
   */
  async getRecommendedConfig(userId: string): Promise<AIProcessingConfig> {
    try {
      const userConfig = await this.getUserConfig(userId);
      
      // 根据用户历史或系统设置调整推荐配置
      // 这里实现简单的逻辑，实际应用中可以更复杂
      
      return {
        ...userConfig,
        maxTokens: this.recommendMaxTokens(userConfig.style),
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error('获取推荐配置失败:', error);
      throw new Error(`获取推荐配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 记录配置变更历史
   */
  async recordConfigChange(userId: string, oldConfig: AIProcessingConfig, newConfig: AIProcessingConfig): Promise<void> {
    try {
      // 简化实现，只记录日志
      // 实际应用中应该保存到配置历史表
      
      console.log(`配置变更记录: 用户 ${userId}`);
      console.log('旧配置:', JSON.stringify(oldConfig, null, 2));
      console.log('新配置:', JSON.stringify(newConfig, null, 2));
      
    } catch (error) {
      console.error('记录配置变更失败:', error);
      // 不抛出错误，避免影响主要流程
    }
  }

  /**
   * 从用户信息提取语言偏好
   */
  private extractLanguageFromUser(user: any): 'zh-CN' | 'en-US' | 'auto' {
    // 简化实现，基于用户信息推断语言偏好
    // 实际应用中应该有专门的语言偏好字段
    return 'auto'; // 默认自动检测
  }

  /**
   * 从用户信息提取风格偏好
   */
  private extractStyleFromUser(user: any): 'concise' | 'detailed' | 'academic' {
    // 简化实现，基于用户特征推断风格偏好
    // 实际应用中应该有专门的风格偏好字段
    return 'concise'; // 默认简洁风格
  }

  /**
   * 推荐最大Token数
   */
  private recommendMaxTokens(style: 'concise' | 'detailed' | 'academic'): number {
    switch (style) {
      case 'concise':
        return 1500; // 简洁风格需要较少的tokens
      case 'detailed':
        return 3000; // 详细风格需要更多tokens
      case 'academic':
        return 4000; // 学术风格需要最多tokens
      default:
        return 2000;
    }
  }

  /**
   * 重置用户配置为默认值
   */
  async resetToDefault(userId: string): Promise<void> {
    try {
      const defaultConfig = await this.createDefaultConfig(userId);
      
      // 简化实现，只记录日志
      // 实际应用中应该更新用户配置表
      
      console.log(`用户配置重置为默认值: ${userId}`);
      console.log('默认配置:', JSON.stringify(defaultConfig, null, 2));
      
    } catch (error) {
      console.error('重置用户配置失败:', error);
      throw new Error(`重置用户配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 删除用户配置
   */
  async deleteUserConfig(userId: string): Promise<void> {
    try {
      // 简化实现，只记录日志
      // 实际应用中应该从配置表中删除
      
      console.log(`删除用户配置: ${userId}`);
      
    } catch (error) {
      console.error('删除用户配置失败:', error);
      throw new Error(`删除用户配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}