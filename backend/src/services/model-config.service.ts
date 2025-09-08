// src/services/model-config.service.ts

export interface ModelConfig {
  id: string;
  name: string;
  model: string;
  description: string;
  category: 'fast' | 'balanced' | 'accurate';
  maxTokens: number;
  contextWindow: number;
  unitPrice: number; // 每1M tokens价格
}

export interface TopicExtractionModelConfig {
  model: string;
  bindingName: string; // 简化为字符串，因为只有一个AI绑定
  temperature: number;
  maxTokens: number;
}

/**
 * 模型配置服务
 * 提供可配置的AI模型选择
 */
export class ModelConfigService {
  
  /**
   * 获取可用的模型配置
   */
  static getAvailableModels(): ModelConfig[] {
    return [
      {
        id: 'llama-3.1-fast',
        name: 'Llama 3.1 Fast',
        model: '@cf/meta/llama-3.1-8b-instruct-fast',
        description: 'Meta最新的3.1B模型，优化为速度和效率',
        category: 'fast',
        maxTokens: 131072,
        contextWindow: 8192,
        unitPrice: 0.002
      },
      {
        id: 'mistral-7b-v0.2',
        name: 'Mistral 7B v0.2',
        model: '@cf/mistral/mistral-7b-instruct-v0.2',
        description: 'Mistral最新的7B模型，Beta版本，性能优异',
        category: 'balanced',
        maxTokens: 32768,
        contextWindow: 32768,
        unitPrice: 0.005
      },
      {
        id: 'mistral-7b-v0.1',
        name: 'Mistral 7B v0.1',
        model: '@cf/mistral/mistral-7b-instruct-v0.1',
        description: 'Mistral稳定的7B模型，生产环境推荐',
        category: 'balanced',
        maxTokens: 32768,
        contextWindow: 32768,
        unitPrice: 0.005
      },
      {
        id: 'gpt-oss-20b',
        name: 'GPT-OSS 20B',
        model: '@cf/gpt-oss-20b',
        description: 'OpenAI开源的20B模型，强大的推理能力',
        category: 'accurate',
        maxTokens: 8192,
        contextWindow: 8192,
        unitPrice: 0.008
      },
      {
        id: 'llama-4-scout',
        name: 'Llama 4 Scout',
        model: '@cf/meta/llama-4-scout-17b-16e-instruct',
        description: 'Meta最新的4 Scout模型，多模态支持',
        category: 'accurate',
        maxTokens: 131072,
        contextWindow: 131072,
        unitPrice: 0.027
      }
    ];
  }
  
  /**
   * 根据用途获取推荐的模型配置
   */
  static getRecommendedModelConfig(useCase: 'topic-extraction' | 'summarization' | 'classification'): TopicExtractionModelConfig {
    
    switch (useCase) {
      case 'topic-extraction':
        // 主题提取需要速度快、成本效益好的模型
        return {
          model: '@cf/meta/llama-3.1-8b-instruct-fast',
          bindingName: 'AI',
          temperature: 0.3,
          maxTokens: 500
        };
        
      case 'summarization':
        // 摘要生成需要中等性能和准确性的模型
        return {
          model: '@cf/meta/llama-3.1-8b-instruct-fast',
          bindingName: 'AI',
          temperature: 0.5,
          maxTokens: 800
        };
        
      case 'classification':
        // 分类任务需要高准确性的模型
        return {
          model: '@cf/meta/llama-3.1-8b-instruct-fast',
          bindingName: 'AI',
          temperature: 0.2,
          maxTokens: 300
        };
        
      default:
        // 默认使用平衡的配置
        return {
          model: '@cf/meta/llama-3.1-8b-instruct-fast',
          bindingName: 'AI',
          temperature: 0.3,
          maxTokens: 500
        };
    }
  }
  
  /**
   * 获取最佳绑定名称
   */
  static getOptimalBinding(modelId: string): string {
    // 目前只有一个AI绑定，直接返回'AI'
    return 'AI';
  }
  
  /**
   * 根据模型ID获取完整配置
   */
  static getModelConfig(modelId: string): ModelConfig | undefined {
    return this.getAvailableModels().find(m => m.id === modelId);
  }
  
  /**
   * 获取模型性能对比
   */
  static getModelComparison(): Array<{
    id: string;
    name: string;
    speed: number; // 1-10评分
    accuracy: number; // 1-10评分
    cost: number; // 1-10评分，数值越低越好
    overall: number; // 综合评分
  }> {
    const models = this.getAvailableModels();
    
    return models.map(model => {
      // 速度评分：基于模型大小和架构
      const speed = model.id.includes('fast') ? 9 : 
                     model.id.includes('3.1') ? 8 :
                     model.id.includes('7b') ? 7 :
                     model.id.includes('20b') ? 5 : 6;
      
      // 准确性评分：基于模型大小和训练数据
      const accuracy = model.id.includes('20b') ? 9 :
                      model.id.includes('4-scout') ? 9 :
                      model.id.includes('mistral') ? 8 :
                      model.id.includes('3.1') ? 6 : 7;
      
      // 成本评分：基于价格，反向计算
      const cost = model.unitPrice <= 0.002 ? 9 :
                     model.unitPrice <= 0.005 ? 7 :
                     model.unitPrice <= 0.008 ? 5 :
                     model.unitPrice <= 0.027 ? 3 : 1;
      
      // 综合评分
      const overall = (speed * 0.3) + (accuracy * 0.5) + (cost * 0.2);
      
      return {
        id: model.id,
        name: model.name,
        speed,
        accuracy,
        cost,
        overall
      };
    }).sort((a, b) => b.overall - a.overall);
  }
  
  /**
   * 自动选择最佳模型
   */
  static autoSelectModel(useCase: 'topic-extraction' | 'summarization' | 'classification', 
                    priorities: { speed: number; accuracy: number; cost: number } = {
                      speed: 0.3, accuracy: 0.5, cost: 0.2 
                    }): TopicExtractionModelConfig {
    
    const comparison = this.getModelComparison();
    
    // 根据优先级计算加权分数
    const scoredModels = comparison.map(model => {
      const score = (model.speed * priorities.speed) + 
                   (model.accuracy * priorities.accuracy) + 
                   (model.cost * priorities.cost);
      
      return {
        ...model,
        score
      };
    });
    
    // 选择得分最高的模型
    const bestModel = scoredModels.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    const modelConfig = this.getModelConfig(bestModel.id);
    if (!modelConfig) {
      throw new Error(`无法找到模型配置: ${bestModel.id}`);
    }
    
    return {
      model: modelConfig.model,
      bindingName: this.getOptimalBinding(bestModel.id),
      temperature: this.getOptimalTemperature(useCase),
      maxTokens: this.getOptimalMaxTokens(useCase)
    };
  }
  
  /**
   * 获取最佳温度设置
   */
  private static getOptimalTemperature(useCase: 'topic-extraction' | 'summarization' | 'classification'): number {
    switch (useCase) {
      case 'topic-extraction':
        return 0.3; // 主题提取需要较低的创造性
      case 'summarization':
        return 0.5; // 摘要需要中等创造性
      case 'classification':
        return 0.2; // 分类任务需要低创造性
      default:
        return 0.3;
    }
  }
  
  /**
   * 获取最佳最大token数
   */
  private static getOptimalMaxTokens(useCase: 'topic-extraction' | 'summarization' | 'classification'): number {
    switch (useCase) {
      case 'topic-extraction':
        return 500; // 主题提取不需要太多tokens
      case 'summarization':
        return 800; // 摘要需要更多tokens
      case 'classification':
        return 300; // 分类任务tokens需求较少
      default:
        return 500;
    }
  }
}