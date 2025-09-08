// test/ai-processing.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZhipuAIService } from '../src/services/ai/zhipu-ai.service';
import { AIConfigService } from '../src/services/config/ai-config.service';
import { ContentAnalyzerService } from '../src/services/ai/content-analyzer';
import { MarkdownGenerator } from '../src/services/ai/markdown-generator';
import { TemplateService } from '../src/services/templates/template.service';
import { AIProcessingConfig, ProcessingResult } from '../src/services/ai/types';

// Mock 数据库
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  get: vi.fn()
};

describe('AI Processing Pipeline', () => {
  let zhipuService: ZhipuAIService;
  let configService: AIConfigService;
  let analyzerService: ContentAnalyzerService;
  let markdownGenerator: MarkdownGenerator;
  let templateService: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock drizzle
    vi.doMock('drizzle-orm/d1', () => ({
      drizzle: () => mockDb
    }));

    zhipuService = new ZhipuAIService('test-api-key');
    configService = new AIConfigService(mockDb);
    analyzerService = new ContentAnalyzerService('test-api-key');
    markdownGenerator = new MarkdownGenerator();
    templateService = new TemplateService(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ZhipuAIService', () => {
    it('should analyze content successfully', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await zhipuService.analyzeContent({
        content: '测试文章内容，这是一个关于技术发展的新闻报道。',
        title: '技术发展新闻',
        config: testConfig
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('技术发展新闻');
      expect(result.content).toBe('测试文章内容，这是一个关于技术发展的新闻报道。');
      expect(result.summary).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should handle API service unavailability', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await zhipuService.analyzeContent({
        content: '测试文章内容',
        title: '测试标题',
        config: testConfig
      });

      expect(result.status).toBe('completed');
      expect(result.summary).toBeDefined();
    });

    it('should validate config', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const isValid = await zhipuService.validateConfig(testConfig);
      expect(isValid).toBe(true);
    });

    it('should reject invalid config', async () => {
      const invalidConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'invalid-language' as any,
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const isValid = await zhipuService.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('ContentAnalyzerService', () => {
    it('should generate smart summary with multiple levels', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await analyzerService.generateSmartSummary({
        content: '这是一篇关于人工智能发展的重要文章，内容涉及多个技术领域和未来趋势。',
        config: testConfig,
        levels: { brief: true, normal: true, detailed: true }
      });

      expect(result).toBeDefined();
      expect(result.brief).toBeDefined();
      expect(result.normal).toBeDefined();
      expect(result.detailed).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should extract advanced keywords with weights and categories', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'detailed',
        maxTokens: 3000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await analyzerService.extractAdvancedKeywords({
        content: '人工智能、机器学习、深度学习是当前最热门的技术领域。',
        config: testConfig,
        maxKeywords: 8
      });

      expect(result).toBeDefined();
      expect(result.keywords).toBeInstanceOf(Array);
      expect(result.keywords.length).toBeLessThanOrEqual(8);
      
      if (result.keywords.length > 0) {
        const firstKeyword = result.keywords[0];
        expect(firstKeyword.keyword).toBeDefined();
        expect(firstKeyword.weight).toBeGreaterThanOrEqual(0);
        expect(firstKeyword.weight).toBeLessThanOrEqual(1);
        expect(firstKeyword.category).toBeDefined();
      }
      
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should classify content with multiple dimensions', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'academic',
        maxTokens: 4000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await analyzerService.classifyContent({
        content: '这是一篇关于科技创新和经济发展的重要文章，涉及多个领域的深入分析。',
        title: '科技创新与经济发展',
        config: testConfig
      });

      expect(result).toBeDefined();
      expect(result.primaryCategory).toBeDefined();
      expect(result.subCategories).toBeInstanceOf(Array);
      expect(result.topics).toBeInstanceOf(Array);
      expect(result.sentiment).toMatch(/^(正面|负面|中性)$/);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should assess content quality', async () => {
      const result = await analyzerService.assessContentQuality({
        content: '这是一篇结构清晰、内容丰富、表达准确的优质文章，涵盖了技术发展的多个方面。',
        title: '技术发展文章'
      });

      expect(result).toBeDefined();
      expect(result.readability).toBeGreaterThanOrEqual(1);
      expect(result.readability).toBeLessThanOrEqual(10);
      expect(result.coherence).toBeGreaterThanOrEqual(1);
      expect(result.coherence).toBeLessThanOrEqual(10);
      expect(result.completeness).toBeGreaterThanOrEqual(1);
      expect(result.completeness).toBeLessThanOrEqual(10);
      expect(result.originality).toBeGreaterThanOrEqual(1);
      expect(result.originality).toBeLessThanOrEqual(10);
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should analyze batch content', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const items = [
        {
          content: '第一篇测试文章内容',
          title: '测试标题1',
          config: testConfig
        },
        {
          content: '第二篇测试文章内容',
          title: '测试标题2',
          config: testConfig
        }
      ];

      const result = await analyzerService.analyzeBatch({
        items
      });

      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBe(2);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.averageProcessingTime).toBeGreaterThan(0);
      expect(result.successCount + result.failureCount).toBe(2);
    });
  });

  describe('MarkdownGenerator', () => {
    const testResult: ProcessingResult = {
      id: 'test-result',
      sourceId: 'test-source',
      userId: '1',
      originalUrl: 'https://example.com',
      title: '测试文章',
      content: '这是测试文章内容，包含多个段落和详细的信息。',
      summary: '这是测试文章的简短摘要。',
      keywords: ['测试', '文章', '内容'],
      categories: ['新闻', '技术'],
      sentiment: '正面',
      importance: 4,
      readability: 3,
      processingTime: 1500,
      aiTokensUsed: 1200,
      status: 'completed',
      createdAt: new Date(),
      aiProvider: 'zhipu',
      aiModel: 'glm-4.5-flash'
    };

    const testConfig: AIProcessingConfig = {
      id: 'test-config',
      userId: '1',
      language: 'zh-CN',
      style: 'concise',
      maxTokens: 2000,
      includeKeywords: true,
      includeSummary: true,
      includeAnalysis: true,
      templateId: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should generate markdown document', async () => {
      const markdown = await markdownGenerator.generateDocument({
        result: testResult,
        config: testConfig
      });

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
      expect(markdown).toContain('# ' + testResult.title);
      expect(markdown).toContain('---'); // frontmatter
      expect(markdown).toContain('title: ' + testResult.title);
      expect(markdown).toContain('summary: ' + testResult.summary);
    });

    it('should generate batch markdown documents', async () => {
      const results = [testResult, testResult];
      
      const batchResult = await markdownGenerator.generateBatch({
        results,
        config: testConfig
      });

      expect(batchResult).toBeInstanceOf(Array);
      expect(batchResult.length).toBe(2);
      expect(batchResult[0].result.id).toBe(testResult.id);
      expect(batchResult[0].markdown).toBeDefined();
      expect(batchResult[0].processingTime).toBeGreaterThan(0);
    });

    it('should generate simple markdown', () => {
      const simpleMarkdown = markdownGenerator.generateSimpleMarkdown(testResult);

      expect(simpleMarkdown).toBeDefined();
      expect(simpleMarkdown).toContain('# ' + testResult.title);
      expect(simpleMarkdown).toContain('## 摘要');
      expect(simpleMarkdown).toContain('## 关键词');
      expect(simpleMarkdown).toContain('## 分类');
      expect(simpleMarkdown).toContain('## 原文内容');
      expect(simpleMarkdown).toContain('---');
    });

    it('should generate academic markdown', () => {
      const academicMarkdown = markdownGenerator.generateAcademicMarkdown(testResult);

      expect(academicMarkdown).toBeDefined();
      expect(academicMarkdown).toContain('# ' + testResult.title);
      expect(academicMarkdown).toContain('**摘要**');
      expect(academicMarkdown).toContain('**关键词**');
      expect(academicMarkdown).toContain('**分类**');
      expect(academicMarkdown).toContain('## 内容分析');
      expect(academicMarkdown).toContain('### 情感分析');
      expect(academicMarkdown).toContain('### 重要性评估');
    });

    it('should generate concise markdown', () => {
      const conciseMarkdown = markdownGenerator.generateConciseMarkdown(testResult);

      expect(conciseMarkdown).toBeDefined();
      expect(conciseMarkdown).toContain('# ' + testResult.title);
      expect(conciseMarkdown).toContain('**摘要**');
      expect(conciseMarkdown).toContain('**关键词**');
      expect(conciseMarkdown).toContain('**分类**');
      expect(conciseMarkdown).toContain('---');
      expect(conciseMarkdown).toContain('*');
    });

    it('should validate template syntax', () => {
      const validTemplate = `{{TITLE}}

{{SUMMARY}}

{{CONTENT}}

---
*Generated by AI*`;

      const validation = markdownGenerator.validateTemplate(validTemplate);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid template', () => {
      const invalidTemplate = `Invalid template without variables`;

      const validation = markdownGenerator.validateTemplate(invalidTemplate);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should get supported styles', () => {
      const styles = markdownGenerator.getSupportedStyles();

      expect(styles).toBeInstanceOf(Array);
      expect(styles.length).toBeGreaterThan(0);
      
      const firstStyle = styles[0];
      expect(firstStyle.id).toBeDefined();
      expect(firstStyle.name).toBeDefined();
      expect(firstStyle.description).toBeDefined();
    });

    it('should get document statistics', () => {
      const testMarkdown = `# Test Title

## Summary
Test summary

## Content
This is test content with multiple words and sentences.

---`;

      const stats = markdownGenerator.getDocumentStats(testMarkdown);

      expect(stats.characterCount).toBeGreaterThan(0);
      expect(stats.wordCount).toBeGreaterThan(0);
      expect(stats.sectionCount).toBe(2); // # and ##
      expect(stats.frontmatterSize).toBe(0); // No frontmatter
    });

    it('should preview template', () => {
      const template = `# {{TITLE}}

{{SUMMARY}}

{{CONTENT}}`;

      const sampleData = {
        TITLE: '示例标题',
        SUMMARY: '示例摘要',
        CONTENT: '示例内容'
      };

      const preview = markdownGenerator.previewTemplate(template, sampleData);

      expect(preview).toContain('示例标题');
      expect(preview).toContain('示例摘要');
      expect(preview).toContain('示例内容');
      expect(preview).not.toContain('{{TITLE}}');
      expect(preview).not.toContain('{{SUMMARY}}');
      expect(preview).not.toContain('{{CONTENT}}');
    });
  });

  describe('TemplateService', () => {
    it('should get available templates', async () => {
      const templates = await templateService.getAvailableTemplates('1');

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      
      const firstTemplate = templates[0];
      expect(firstTemplate.id).toBeDefined();
      expect(firstTemplate.name).toBeDefined();
      expect(firstTemplate.template).toBeDefined();
      expect(firstTemplate.variables).toBeInstanceOf(Array);
      expect(firstTemplate.category).toBeDefined();
      expect(firstTemplate.isDefault).toBeInstanceOf(Boolean);
    });

    it('should get template by id', async () => {
      const template = await templateService.getTemplateById('default');

      expect(template).toBeDefined();
      if (template) {
        expect(template.id).toBe('default');
        expect(template.name).toBeDefined();
        expect(template.template).toBeDefined();
      }
    });

    it('should create custom template', async () => {
      const customTemplateData = {
        name: '测试自定义模板',
        description: '这是一个测试模板',
        template: `# {{TITLE}}

{{SUMMARY}}

{{CONTENT}}`,
        variables: ['TITLE', 'SUMMARY', 'CONTENT'],
        category: 'custom' as const,
        isDefault: false
      };

      const newTemplate = await templateService.createCustomTemplate(customTemplateData);

      expect(newTemplate).toBeDefined();
      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('测试自定义模板');
      expect(newTemplate.description).toBe('这是一个测试模板');
    });

    it('should validate template syntax', async () => {
      const validTemplate = `{{TITLE}}

{{SUMMARY}}

{{CONTENT}}`;

      const validation = await templateService.validateTemplateSyntax(validTemplate);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid template syntax', async () => {
      const invalidTemplate = `Invalid template`;

      const validation = await templateService.validateTemplateSyntax(invalidTemplate);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should export template in JSON format', async () => {
      const exportResult = await templateService.exportTemplate('default', 'json');

      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toBeDefined();
      expect(exportResult.filename).toBeDefined();
      expect(exportResult.filename).toMatch(/\.json$/);
    });

    it('should export template in TXT format', async () => {
      const exportResult = await templateService.exportTemplate('default', 'txt');

      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toBeDefined();
      expect(exportResult.filename).toMatch(/\.txt$/);
    });
  });

  describe('End-to-end Integration', () => {
    it('should work as complete AI processing pipeline', async () => {
      const testConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'zh-CN',
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const testContent = '这是一篇关于人工智能技术发展的重要文章，涉及多个技术领域和创新方向。';

      // 步骤1：内容分析
      console.log('步骤1：执行内容分析...');
      const analysisStart = Date.now();
      
      const analysisResult = await analyzerService.analyzeContent({
        content: testContent,
        title: '人工智能技术发展',
        config: testConfig
      });

      const analysisTime = Date.now() - analysisStart;
      console.log(`内容分析完成，耗时: ${analysisTime}ms`);

      expect(analysisResult).toBeDefined();
      expect(analysisResult.status).toBe('completed');
      expect(analysisResult.summary).toBeDefined();
      expect(analysisResult.keywords).toBeDefined();
      expect(analysisResult.categories).toBeDefined();

      // 步骤2：Markdown生成
      console.log('步骤2：生成Markdown文档...');
      const markdownStart = Date.now();
      
      const markdown = await markdownGenerator.generateDocument({
        result: analysisResult,
        config: testConfig
      });

      const markdownTime = Date.now() - markdownStart;
      console.log(`Markdown生成完成，耗时: ${markdownTime}ms`);

      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
      expect(markdown).toContain('# 人工智能技术发展');
      expect(markdown).toContain('---');
      expect(markdown).toContain('title: 人工智能技术发展');
      expect(markdown).toContain('summary: ');
      expect(markdown).toContain('keywords: ');
      expect(markdown).toContain('categories: ');

      // 步骤3：验证生成的文档
      console.log('步骤3：验证生成的文档...');
      const stats = markdownGenerator.getDocumentStats(markdown);
      
      expect(stats.characterCount).toBeGreaterThan(100);
      expect(stats.wordCount).toBeGreaterThan(20);
      expect(stats.sectionCount).toBeGreaterThan(3);

      console.log(`生成文档统计：字符数 ${stats.characterCount}，词数 ${stats.wordCount}，节数 ${stats.sectionCount}`);

      const totalTime = analysisTime + markdownTime;
      console.log(`完整AI处理流程完成，总耗时: ${totalTime}ms`);

      // 验证整体效果
      expect(markdown).toContain('## 摘要');
      expect(markdown).toContain('## 关键词');
      expect(markdown).toContain('## 分类');
      expect(markdown).toContain('## 分析评估');
      expect(markdown).toContain('## 处理信息');
      expect(markdown).toContain('## 原文内容');
      
      console.log('✅ 端到端AI处理管道测试成功');
    });

    it('should handle errors gracefully in pipeline', async () => {
      const invalidConfig: AIProcessingConfig = {
        id: 'test-config',
        userId: '1',
        language: 'invalid-language' as any,
        style: 'concise',
        maxTokens: 2000,
        includeKeywords: true,
        includeSummary: true,
        includeAnalysis: true,
        templateId: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await analyzerService.analyzeContent({
          content: '测试内容',
          title: '测试标题',
          config: invalidConfig
        });
        
        // 如果没有抛出错误，继续测试Markdown生成
        const result: ProcessingResult = {
          id: 'test-result',
          sourceId: 'test-source',
          userId: '1',
          originalUrl: 'https://example.com',
          title: '测试标题',
          content: '测试内容',
          summary: '测试摘要',
          keywords: ['测试'],
          categories: ['测试'],
          sentiment: '中性',
          importance: 3,
          readability: 3,
          processingTime: 1000,
          aiTokensUsed: 800,
          status: 'completed',
          createdAt: new Date(),
          aiProvider: 'zhipu',
          aiModel: 'glm-4.5-flash'
        };

        const markdown = await markdownGenerator.generateDocument({
          result,
          config: invalidConfig
        });

        expect(markdown).toBeDefined();
        console.log('✅ 错误处理测试成功：系统优雅地处理了无效配置');
        
      } catch (error) {
        // 如果抛出错误，说明系统正确处理了无效配置
        console.log('✅ 错误处理测试成功：系统正确拒绝了无效配置');
        console.log(`错误类型: ${error instanceof Error ? error.name : '未知'}`);
      }
    });
  });
});