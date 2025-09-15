// 简化的配置测试 - 验证基本功能
import { describe, it, expect } from 'vitest';

describe('Story 2.6: 基本配置测试', () => {
  
  it('1.1 应该能够加载Obsidian配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    
    expect(obsidianModule).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.ai).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.analysis).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.links).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.templates).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.knowledgeGraph).toBeDefined();
    expect(obsidianModule.defaultObsidianConfig.performance).toBeDefined();
  });

  it('1.2 配置应该有正确的默认值', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultObsidianConfig } = obsidianModule;
    
    expect(defaultObsidianConfig.ai.model).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(defaultObsidianConfig.analysis.maxTopics).toBe(10);
    expect(defaultObsidianConfig.links.maxLinks).toBe(15);
    expect(defaultObsidianConfig.templates.defaultTemplate).toBe('standard-news-article');
    expect(defaultObsidianConfig.knowledgeGraph.maxNodes).toBe(1000);
    expect(defaultObsidianConfig.performance.batchProcessingSize).toBe(10);
  });

  it('1.3 应该有链接策略配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultLinkStrategies } = obsidianModule;
    
    expect(Array.isArray(defaultLinkStrategies)).toBe(true);
    expect(defaultLinkStrategies.length).toBeGreaterThan(0);
    
    const tagStrategy = defaultLinkStrategies.find(s => s.type === 'tag');
    expect(tagStrategy).toBeDefined();
    expect(tagStrategy.template).toBe('#{{tag}}');
  });

  it('1.4 应该有YAML frontmatter配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultYAMLConfig } = obsidianModule;
    
    expect(defaultYAMLConfig).toBeDefined();
    expect(defaultYAMLConfig.includeBasicFields).toBe(true);
    expect(defaultYAMLConfig.includeAnalysisFields).toBe(true);
    expect(defaultYAMLConfig.includeObsidianFields).toBe(true);
    expect(defaultYAMLConfig.includeNavigationFields).toBe(true);
  });

  it('1.5 应该有可视化配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultGraphConfig } = obsidianModule;
    
    expect(defaultGraphConfig).toBeDefined();
    expect(defaultGraphConfig.nodes).toBeDefined();
    expect(defaultGraphConfig.edges).toBeDefined();
    expect(defaultGraphConfig.layout).toBeDefined();
    expect(defaultGraphConfig.interaction).toBeDefined();
  });

  it('1.6 应该能够验证配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { validateObsidianConfig, defaultObsidianConfig } = obsidianModule;
    
    // 测试有效配置
    const validConfig = {
      ai: { temperature: 0.7, confidenceThreshold: 0.6 },
      links: { maxLinks: 15, similarityThreshold: 0.3 },
      performance: { batchProcessingSize: 10, maxConcurrentAnalysis: 5 }
    };
    
    expect(() => validateObsidianConfig(validConfig)).not.toThrow();
    
    // 测试无效配置
    const invalidConfig = {
      ai: { temperature: 3.0, confidenceThreshold: 1.5 }, // 超出范围
      links: { maxLinks: -1, similarityThreshold: 2.0 }, // 超出范围
      performance: { batchProcessingSize: 0, maxConcurrentAnalysis: 0 } // 超出范围
    };
    
    expect(() => validateObsidianConfig(invalidConfig)).toThrow();
  });

  it('1.7 应该能够从环境变量获取配置', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { getObsidianConfigFromEnv } = obsidianModule;
    
    const config = getObsidianConfigFromEnv();
    
    expect(config).toBeDefined();
    expect(config.ai).toBeDefined();
    expect(config.analysis).toBeDefined();
    expect(config.links).toBeDefined();
  });

  it('1.8 配置值应该在合理范围内', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultObsidianConfig } = obsidianModule;
    
    // 验证所有数值都在合理范围内
    expect(defaultObsidianConfig.ai.temperature).toBeGreaterThan(0);
    expect(defaultObsidianConfig.ai.temperature).toBeLessThan(2);
    expect(defaultObsidianConfig.ai.confidenceThreshold).toBeGreaterThan(0);
    expect(defaultObsidianConfig.ai.confidenceThreshold).toBeLessThan(1);
    expect(defaultObsidianConfig.links.similarityThreshold).toBeGreaterThan(0);
    expect(defaultObsidianConfig.links.similarityThreshold).toBeLessThan(1);
  });

  it('1.9 应该有完整的链接策略', async () => {
    const obsidianModule = await import('../src/config/obsidian.config');
    const { defaultLinkStrategies } = obsidianModule;
    
    const strategyTypes = defaultLinkStrategies.map(s => s.type);
    expect(strategyTypes).toContain('tag');
    expect(strategyTypes).toContain('topic');
    expect(strategyTypes).toContain('keyword');
    expect(strategyTypes).toContain('similarity');
    expect(strategyTypes).toContain('temporal');
  });

  it('1.10 配置加载应该快速完成', async () => {
    const startTime = performance.now();
    
    const obsidianModule = await import('../src/config/obsidian.config');
    const config = obsidianModule.defaultObsidianConfig;
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    expect(loadTime).toBeLessThan(50); // 应该在50ms内完成
    expect(config).toBeDefined();
  });

});