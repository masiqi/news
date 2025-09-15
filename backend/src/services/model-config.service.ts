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
  bindingName: string; // 简化为字符串，因为只有一个API密钥绑定
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
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        model: 'glm-4-flash',
        description: '智谱GLM-4 Flash模型，高性能轻量级模型，速度快且成本低',
        category: 'fast',
        maxTokens: 128000,
        contextWindow: 128000,
        unitPrice: 0.0005
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4 Air',
        model: 'glm-4-air',
        description: '智谱GLM-4 Air模型，平衡性能与成本，适用于大多数场景',
        category: 'balanced',
        maxTokens: 128000,
        contextWindow: 128000,
        unitPrice: 0.001
      },
      {
        id: 'glm-4',
        name: 'GLM-4',
        model: 'glm-4',
        description: '智谱GLM-4标准模型，强大的推理能力和多语言支持',
        category: 'accurate',
        maxTokens: 128000,
        contextWindow: 128000,
        unitPrice: 0.002
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
          model: 'glm-4-flash',
          bindingName: 'ZHIPUAI_API_KEY',
          temperature: 0.3,
          maxTokens: 500
        };
        
      case 'summarization':
        // 摘要生成需要中等性能和准确性的模型
        return {
          model: 'glm-4-air',
          bindingName: 'ZHIPUAI_API_KEY',
          temperature: 0.5,
          maxTokens: 800
        };
        
      case 'classification':
        // 分类任务需要高准确性的模型
        return {
          model: 'glm-4',
          bindingName: 'ZHIPUAI_API_KEY',
          temperature: 0.2,
          maxTokens: 300
        };
        
      default:
        // 默认使用平衡的配置
        return {
          model: 'glm-4-flash',
          bindingName: 'ZHIPUAI_API_KEY',
          temperature: 0.3,
          maxTokens: 500
        };
    }
  }
  
  /**
   * 获取最佳绑定名称
   */
  static getOptimalBinding(modelId: string): string {
    // 目前只有一个API密钥绑定，直接返回'ZHIPUAI_API_KEY'
    return 'ZHIPUAI_API_KEY';
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
      // 速度评分：基于模型类型
      const speed = model.id.includes('flash') ? 10 : 
                     model.id.includes('air') ? 8 :
                     model.id.includes('glm-4') ? 6 : 7;
      
      // 准确性评分：基于模型性能
      const accuracy = model.id.includes('glm-4') ? 9 :
                      model.id.includes('air') ? 7 :
                      model.id.includes('flash') ? 6 : 8;
      
      // 成本评分：基于价格，反向计算
      const cost = model.unitPrice <= 0.0005 ? 10 :
                     model.unitPrice <= 0.001 ? 8 :
                     model.unitPrice <= 0.002 ? 6 : 4;
      
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