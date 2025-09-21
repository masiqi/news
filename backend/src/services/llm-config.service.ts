// src/services/llm-config.service.ts
export interface LLMProvider {
  name: string;
  provider: 'glm' | 'openrouter' | 'cloudflare';
  model: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  maxConcurrency: number;
  dailyLimit: number;
  costPer1kTokens: number;
  strengths: string[];
  weaknesses: string[];
}

export class LLMConfigService {
  private static providers: Map<string, LLMProvider> = new Map();

  static initializeProviders() {
    // GLM (智谱AI) - 主力配置
    this.providers.set('glm', {
      name: 'GLM-4.5-Flash (智谱AI)',
      provider: 'glm',
      model: 'glm-4.5-flash',
      apiKey: process.env.ZHIPUAI_API_KEY || '',
      enabled: !!process.env.ZHIPUAI_API_KEY,
      priority: 1, // 第一优先级
      maxConcurrency: 5,
      dailyLimit: 1000,
      costPer1kTokens: 0.001,
      strengths: ['中文理解优秀', '价格便宜', '响应速度快', '与智谱官方API一致'],
      weaknesses: ['可能有敏感词限制', '配额可能耗尽']
    });

    // OpenRouter GLM - 备用配置 (同样模型，不同提供商)
    this.providers.set('openrouter-glm', {
      name: 'GLM-4.5-Air (OpenRouter)',
      provider: 'openrouter',
      model: 'z-ai/glm-4.5-air:free',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      enabled: !!process.env.OPENROUTER_API_KEY,
      priority: 2, // 第二优先级
      maxConcurrency: 20,
      dailyLimit: 1000,
      costPer1kTokens: 0, // 免费额度内
      strengths: ['免费额度', '高并发支持', '相对宽松的内容审查', '与智谱相同的模型'],
      weaknesses: ['可能有网络延迟', '免费额度有限']
    });

    // OpenRouter Mixtral - 可选配置
    this.providers.set('openrouter-mixtral', {
      name: 'Mixtral 8x22B (OpenRouter)',
      provider: 'openrouter',
      model: 'mistral/mixtral-8x22b-instruct-v0.1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      enabled: !!process.env.OPENROUTER_API_KEY,
      priority: 3,
      maxConcurrency: 20,
      dailyLimit: 1000,
      costPer1kTokens: 0.00065,
      strengths: ['强大的多语言能力', '宽松的内容审查', '长上下文支持', '高并发支持'],
      weaknesses: ['成本略高', '中文理解略逊于GLM']
    });

    // OpenRouter Qwen - 中文特化备选
    this.providers.set('openrouter-qwen', {
      name: 'Qwen 72B (OpenRouter)',
      provider: 'openrouter',
      model: 'qwen/qwen-72b-chat',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      enabled: !!process.env.OPENROUTER_API_KEY,
      priority: 4,
      maxConcurrency: 10,
      dailyLimit: 800,
      costPer1kTokens: 0.0009,
      strengths: ['中文理解极佳', '专门针对中文优化', '内容审查较宽松'],
      weaknesses: ['成本较高', '响应速度中等']
    });

    // Cloudflare AI - 最终备用
    this.providers.set('cloudflare', {
      name: 'Cloudflare AI (最终备用)',
      provider: 'cloudflare',
      model: '@cf/meta/llama-3.1-8b-instruct',
      apiKey: '',
      enabled: false, // 需要环境变量支持
      priority: 5,
      maxConcurrency: 10,
      dailyLimit: 1000,
      costPer1kTokens: 0,
      strengths: ['免费使用', '低延迟', 'Cloudflare集成'],
      weaknesses: ['模型能力有限', '中文支持一般', '可能会有内容限制']
    });
  }

  static getBestProvider(): LLMProvider | null {
    // 按优先级排序，返回第一个启用的提供商
    const enabledProviders = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    return enabledProviders[0] || null;
  }

  static getProvider(name: string): LLMProvider | null {
    return this.providers.get(name) || null;
  }

  static getAllProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority);
  }

  static updateProvider(name: string, updates: Partial<LLMProvider>): boolean {
    const provider = this.providers.get(name);
    if (!provider) return false;

    Object.assign(provider, updates);
    return true;
  }

  static getProviderStats(): {
    totalProviders: number;
    enabledProviders: number;
    totalConcurrency: number;
    totalDailyLimit: number;
    recommendations: string[];
  } {
    const providers = Array.from(this.providers.values());
    const enabledProviders = providers.filter(p => p.enabled);

    return {
      totalProviders: providers.length,
      enabledProviders: enabledProviders.length,
      totalConcurrency: enabledProviders.reduce((sum, p) => sum + p.maxConcurrency, 0),
      totalDailyLimit: enabledProviders.reduce((sum, p) => sum + p.dailyLimit, 0),
      recommendations: this.generateRecommendations()
    };
  }

  private static generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const enabledProviders = Array.from(this.providers.values()).filter(p => p.enabled);

    if (enabledProviders.length === 0) {
      recommendations.push('建议配置至少一个LLM提供商');
    } else if (enabledProviders.length === 1) {
      recommendations.push('建议配置备用LLM提供商以提高系统稳定性');
    }

    const glmEnabled = enabledProviders.some(p => p.provider === 'glm');
    const openRouterEnabled = enabledProviders.some(p => p.provider === 'openrouter');
    const cloudflareEnabled = enabledProviders.some(p => p.provider === 'cloudflare');

    if (!glmEnabled) {
      recommendations.push('建议配置智谱AI作为主要LLM提供商');
    }

    if (!openRouterEnabled && process.env.OPENROUTER_API_KEY) {
      recommendations.push('检测到OpenRouter API密钥，建议启用OpenRouter作为备用');
    }

    if (glmEnabled && !openRouterEnabled) {
      recommendations.push('建议配置OpenRouter GLM作为智谱AI的备用，使用相同的模型但不同的提供商');
    }

    if (glmEnabled && openRouterEnabled && !cloudflareEnabled) {
      recommendations.push('建议配置Cloudflare AI作为最终备用方案');
    }

    // 检查优先级配置
    const primaryProvider = enabledProviders.find(p => p.priority === 1);
    if (primaryProvider && primaryProvider.provider !== 'glm') {
      recommendations.push('建议将智谱AI设为最高优先级，以获得最佳的中文新闻分析效果');
    }

    return recommendations;
  }

  static testAllProviders(): Promise<{ name: string; success: boolean; error?: string }[]> {
    const testPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        let success = false;
        
        switch (provider.provider) {
          case 'glm':
            // 简单的API key验证
            success = !!provider.apiKey && provider.apiKey.length > 10;
            break;
          case 'openrouter':
            // 测试OpenRouter连接
            const response = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { 'Authorization': `Bearer ${provider.apiKey}` }
            });
            success = response.ok;
            break;
          case 'cloudflare':
            success = true; // Cloudflare AI总是可用（如果配置了环境）
            break;
        }

        return {
          name: provider.name,
          success
        };
      } catch (error) {
        return {
          name: provider.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(testPromises);
  }
}

// 初始化配置
LLMConfigService.initializeProviders();