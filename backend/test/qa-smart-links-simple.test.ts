// 简化的QA测试 - 验证Story 2.6核心功能
import { describe, it, expect } from 'vitest';
import { EnhancedContentAnalyzer } from '../src/services/ai/enhanced-content-analyzer';
import { SmartLinkGenerator } from '../src/services/ai/smart-link-generator';
import { ObsidianTemplateService } from '../src/services/obsidian-template.service';
import { KnowledgeGraphService } from '../src/services/knowledge-graph.service';
import { ObsidianIntegrationService } from '../src/services/obsidian-integration.service';

describe('Story 2.6: Obsidian Smart Links and Content Optimization - Core Tests', () => {
  
  describe('Service Initialization', () => {
    
    it('1.1 应该能够初始化所有服务', () => {
      expect(() => new EnhancedContentAnalyzer()).not.toThrow();
      expect(() => new SmartLinkGenerator()).not.toThrow();
      expect(() => new ObsidianTemplateService()).not.toThrow();
      expect(() => new KnowledgeGraphService()).not.toThrow();
      expect(() => new ObsidianIntegrationService()).not.toThrow();
    });

    it('1.2 服务应该有正确的方法', () => {
      const analyzer = new EnhancedContentAnalyzer();
      const linkGenerator = new SmartLinkGenerator();
      const templateService = new ObsidianTemplateService();
      const graphService = new KnowledgeGraphService();
      const integrationService = new ObsidianIntegrationService();

      // 验证增强分析器方法
      expect(typeof analyzer.analyzeContent).toBe('function');
      expect(typeof analyzer.getUserAnalysis).toBe('function');
      expect(typeof analyzer.getSimilarContent).toBe('function');

      // 验证智能链接生成器方法
      expect(typeof linkGenerator.generateSmartLinks).toBe('function');

      // 验证模板服务方法
      expect(typeof templateService.renderTemplate).toBe('function');
      expect(typeof templateService.getAllTemplates).toBe('function');

      // 验证知识图谱服务方法
      expect(typeof graphService.buildKnowledgeGraph).toBe('function');
      expect(typeof graphService.getRecommendations).toBe('function');

      // 验证集成服务方法
      expect(typeof integrationService.generateDataviewQuery).toBe('function');
      expect(typeof integrationService.getCommunityTemplates).toBe('function');
    });
  });

  describe('Template Service Tests', () => {
    
    it('2.1 应该能够获取默认模板', async () => {
      const templateService = new ObsidianTemplateService();
      const defaultTemplate = await templateService.getDefaultTemplate();
      
      expect(defaultTemplate).toBeDefined();
      if (defaultTemplate) {
        expect(defaultTemplate.name).toBeDefined();
        expect(defaultTemplate.templateContent).toBeDefined();
        expect(defaultTemplate.variables).toBeDefined();
      }
    });

    it('2.2 应该能够获取所有模板', async () => {
      const templateService = new ObsidianTemplateService();
      const templates = await templateService.getAllTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      if (templates.length > 0) {
        const template = templates[0];
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.templateContent).toBeDefined();
      }
    });
  });

  describe('Integration Service Tests', () => {
    
    it('3.1 应该能够获取社区模板', async () => {
      const integrationService = new ObsidianIntegrationService();
      const templates = await integrationService.getCommunityTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // 验证模板结构
      const template = templates[0];
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.author).toBeDefined();
      expect(template.rating).toBeGreaterThanOrEqual(0);
      expect(template.rating).toBeLessThanOrEqual(5);
    });

    it('3.2 应该支持模板搜索', async () => {
      const integrationService = new ObsidianIntegrationService();
      const templates = await integrationService.getCommunityTemplates({
        search: 'journal',
        limit: 5
      });
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeLessThanOrEqual(5);
    });

    it('3.3 应该提供Dataview字段映射', () => {
      const integrationService = new ObsidianIntegrationService();
      const mappings = integrationService.getDataviewFieldMappings();
      
      expect(mappings).toBeDefined();
      expect(typeof mappings).toBe('object');
      expect(mappings['title']).toBe('title');
      expect(mappings['file.name']).toBe('title');
    });

    it('3.4 应该验证插件兼容性', async () => {
      const integrationService = new ObsidianIntegrationService();
      const compatibility = await integrationService.validatePluginCompatibility('dataview', '0.5.5');
      
      expect(compatibility).toBeDefined();
      expect(typeof compatibility.compatible).toBe('boolean');
      expect(Array.isArray(compatibility.issues)).toBe(true);
      expect(Array.isArray(compatibility.recommendations)).toBe(true);
    });
  });

  describe('Configuration Tests', () => {
    
    it('4.1 应该能够加载Obsidian配置', () => {
      const { getObsidianConfigFromEnv } = require('../src/config/obsidian.config');
      const config = getObsidianConfigFromEnv();
      
      expect(config).toBeDefined();
      expect(config.ai).toBeDefined();
      expect(config.analysis).toBeDefined();
      expect(config.links).toBeDefined();
      expect(config.templates).toBeDefined();
      expect(config.knowledgeGraph).toBeDefined();
      expect(config.performance).toBeDefined();
    });

    it('4.2 配置应该有正确的结构', () => {
      const { defaultObsidianConfig } = require('../src/config/obsidian.config');
      
      expect(defaultObsidianConfig.ai.model).toBeDefined();
      expect(defaultObsidianConfig.analysis.maxTopics).toBeGreaterThan(0);
      expect(defaultObsidianConfig.links.maxLinks).toBeGreaterThan(0);
      expect(defaultObsidianConfig.templates.defaultTemplate).toBeDefined();
      expect(defaultObsidianConfig.knowledgeGraph.maxNodes).toBeGreaterThan(0);
      expect(defaultObsidianConfig.performance.batchProcessingSize).toBeGreaterThan(0);
    });
  });

  describe('Type Safety Tests', () => {
    
    it('5.1 应该导出正确的类型', () => {
      const types = require('../src/config/obsidian.config');
      
      // 验证类型定义存在
      expect(types.EnhancedAnalysisResult).toBeDefined();
      expect(types.LinkGenerationResult).toBeDefined();
      expect(types.ContentRecommendation).toBeDefined();
      expect(types.GraphVisualization).toBeDefined();
      expect(types.DataviewQuery).toBeDefined();
      expect(types.DataviewResult).toBeDefined();
      expect(types.RecommendationRequest).toBeDefined();
    });

    it('5.2 服务实例应该有正确的类型', () => {
      const analyzer = new EnhancedContentAnalyzer();
      const linkGenerator = new SmartLinkGenerator();
      const templateService = new ObsidianTemplateService();
      
      // 验证实例方法存在且类型正确
      expect(typeof analyzer.analyzeContent).toBe('function');
      expect(typeof linkGenerator.generateSmartLinks).toBe('function');
      expect(typeof templateService.renderTemplate).toBe('function');
    });
  });

  describe('Error Handling Tests', () => {
    
    it('6.1 应该优雅处理无效输入', async () => {
      const templateService = new ObsidianTemplateService();
      
      // 测试无效模板ID
      await expect(
        templateService.getTemplateById('invalid-id')
      ).resolves.toBeNull();
    });

    it('6.2 应该处理空结果', async () => {
      const integrationService = new ObsidianIntegrationService();
      
      // 测试空搜索结果
      const templates = await integrationService.getCommunityTemplates({
        search: 'nonexistent-template-name-xyz-123',
        limit: 10
      });
      
      expect(Array.isArray(templates)).toBe(true);
    });

    it('6.3 应该验证配置', () => {
      const { validateObsidianConfig } = require('../src/config/obsidian.config');
      
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
  });

  describe('Performance Tests', () => {
    
    it('7.1 服务初始化应该快速完成', () => {
      const startTime = performance.now();
      
      new EnhancedContentAnalyzer();
      new SmartLinkGenerator();
      new ObsidianTemplateService();
      new KnowledgeGraphService();
      new ObsidianIntegrationService();
      
      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      expect(initTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('7.2 配置加载应该快速完成', () => {
      const startTime = performance.now();
      
      const { getObsidianConfigFromEnv } = require('../src/config/obsidian.config');
      const config = getObsidianConfigFromEnv();
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(50); // 应该在50ms内完成
      expect(config).toBeDefined();
    });
  });
});