// src/services/ai/markdown-generator.ts
import { ProcessingResult, AIProcessingConfig, MarkdownTemplate } from './types';
import { TemplateService } from '../templates/template.service';

/**
 * Markdown文档生成器
 * 将AI处理结果转换为结构化的Markdown文档
 */
export class MarkdownGenerator {
  private templateService: TemplateService;

  constructor(templateService?: TemplateService) {
    this.templateService = templateService || new TemplateService();
  }

  /**
   * 生成完整的Markdown文档
   */
  async generateDocument(params: {
    result: ProcessingResult;
    config: AIProcessingConfig;
    templateId?: string;
    customTemplate?: string;
  }): Promise<string> {
    const { result, config, templateId, customTemplate } = params;
    
    console.log(`开始生成Markdown文档: ${result.title}, 模板: ${templateId || 'default'}`);

    try {
      // 选择模板
      let template = '';
      if (customTemplate) {
        template = customTemplate;
      } else if (templateId) {
        const templateObj = await this.templateService.getTemplateById(templateId);
        template = templateObj?.template || this.getDefaultTemplate();
      } else {
        // 简化实现，使用默认模板
        template = this.getDefaultTemplate();
      }

      // 构建文档内容
      const markdown = await this.buildMarkdownDocument(result, config, template);
      
      console.log(`Markdown文档生成完成，长度: ${markdown.length} 字符`);
      return markdown;
      
    } catch (error) {
      console.error('Markdown文档生成失败:', error);
      throw new Error(`Markdown文档生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量生成Markdown文档
   */
  async generateBatch(params: {
    results: ProcessingResult[];
    config: AIProcessingConfig;
    templateId?: string;
  }): Promise<Array<{
    result: ProcessingResult;
    markdown: string;
    processingTime: number;
    error?: string;
  }>> {
    const { results, config, templateId } = params;
    const startTime = Date.now();
    
    console.log(`开始批量生成Markdown文档，数量: ${results.length}`);

    const batchResults = [];
    
    // 并行生成以提高性能
    const promises = results.map(async (result) => {
      try {
        const markdown = await this.generateDocument({
          result,
          config,
          templateId
        });
        
        return {
          result,
          markdown,
          processingTime: Date.now() - startTime,
          error: undefined
        };
        
      } catch (error) {
        console.error(`批量生成失败: ${result.title}`, error);
        
        return {
          result,
          markdown: '',
          processingTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : '未知错误'
        };
      }
    });

    const resolvedResults = await Promise.allSettled(promises);
    const successfulResults = resolvedResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    const failedCount = results.length - successfulResults.length;
    const totalProcessingTime = Date.now() - startTime;
    
    console.log(`批量Markdown生成完成，成功: ${successfulResults.length}, 失败: ${failedCount}, 总耗时: ${totalProcessingTime}ms`);

    return successfulResults;
  }

  /**
   * 构建Markdown文档
   */
  private async buildMarkdownDocument(
    result: ProcessingResult, 
    config: AIProcessingConfig, 
    template: string
  ): Promise<string> {
    console.log('构建Markdown文档...');

    // 构建frontmatter
    const frontmatter = this.buildFrontmatter(result, config);
    
    // 构建正文内容
    const content = this.buildContent(result, config);
    
    // 构建元数据部分
    const metadata = this.buildMetadata(result, config);
    
    // 构建尾部信息
    const footer = this.buildFooter(result, config);
    
    // 应用模板
    const templateVariables = {
      TITLE: result.title,
      DATE: new Date().toISOString().split('T')[0],
      SUMMARY: result.summary,
      CONTENT: content,
      KEYWORDS: result.keywords.join(', '),
      CATEGORIES: result.categories.join(', '),
      SENTIMENT: result.sentiment,
      IMPORTANCE: result.importance,
      READABILITY: result.readability,
      PROCESSING_TIME: result.processingTime,
      AI_TOKENS_USED: result.aiTokensUsed,
      STATUS: result.status,
      FRONTMATTER: frontmatter,
      METADATA: metadata,
      FOOTER: footer,
      AUTHOR: 'AI Assistant',
      MODEL: result.aiModel,
      PROVIDER: result.aiProvider
    };

    let markdown = template;
    
    // 替换模板变量
    for (const [key, value] of Object.entries(templateVariables)) {
      const placeholder = `{{${key}}}`;
      markdown = markdown.replace(new RegExp(placeholder, 'g'), value);
    }
    
    // 如果没有模板变量，则使用默认结构
    if (!markdown.includes('{{TITLE}}')) {
      markdown = this.getDefaultMarkdown(templateVariables);
    }
    
    return markdown;
  }

  /**
   * 构建Frontmatter
   */
  private buildFrontmatter(result: ProcessingResult, config: AIProcessingConfig): string {
    const date = new Date().toISOString().split('T')[0];
    const processedDate = result.completedAt ? result.completedAt.toISOString().split('T')[0] : date;
    
    return `---
title: ${this.escapeYamlString(result.title)}
date: ${processedDate}
summary: ${this.escapeYamlString(result.summary)}
author: AI Assistant
tags: ${JSON.stringify([...result.categories, ...result.keywords])}
categories: ${JSON.stringify(result.categories)}
keywords: ${JSON.stringify(result.keywords)}
sentiment: ${result.sentiment}
importance: ${result.importance}
readability: ${result.readability}/5
processing_time: ${result.processingTime}ms
ai_tokens_used: ${result.aiTokensUsed}
ai_model: ${result.aiModel}
ai_provider: ${result.aiProvider}
processing_status: ${result.status}
language: ${config.language}
style: ${config.style}
max_tokens: ${config.maxTokens}
user_id: ${config.userId}
created_at: ${date}
---`;
  }

  /**
   * 构建文档内容
   */
  private buildContent(result: ProcessingResult, config: AIProcessingConfig): string {
    let content = `# ${result.title}\n\n`;
    
    // 添加摘要
    if (result.summary && result.summary !== '分析失败') {
      content += `## 摘要\n\n${result.summary}\n\n`;
    }
    
    // 添加分类和关键词
    if (result.categories.length > 0) {
      content += `## 分类\n\n`;
      result.categories.forEach(category => {
        content += `- ${category}\n`;
      });
      content += '\n';
    }
    
    if (result.keywords.length > 0) {
      content += `## 关键词\n\n`;
      result.keywords.forEach(keyword => {
        content += `- ${keyword}\n`;
      });
      content += '\n';
    }
    
    // 添加情感和重要性分析
    content += `## 分析评估\n\n`;
    content += `- **情感倾向**: ${result.sentiment}\n`;
    content += `- **重要性评分**: ${result.importance}/5\n`;
    content += `- **可读性评分**: ${result.readability}/5\n\n`;
    
    // 根据配置决定是否添加原文
    if (config.includeAnalysis) {
      content += `## 原文内容\n\n`;
      content += `${result.content}\n\n`;
    }
    
    return content;
  }

  /**
   * 构建元数据部分
   */
  private buildMetadata(result: ProcessingResult, config: AIProcessingConfig): string {
    return `## 处理信息\n\n` +
      `| 项目 | 详情 |\n` +
      `| --- | --- |\n` +
      `| **处理时间** | ${result.processingTime}ms |\n` +
      `| **AI使用量** | ${result.aiTokensUsed} tokens |\n` +
      `| **AI模型** | ${result.aiModel} |\n` +
      `| **AI提供商** | ${result.aiProvider} |\n` +
      `| **处理状态** | ${result.status} |\n` +
      `| **语言设置** | ${config.language} |\n` +
      `| **风格设置** | ${config.style} |\n` +
      `| **最大Token数** | ${config.maxTokens} |\n\n`;
  }

  /**
   * 构建文档尾部
   */
  private buildFooter(result: ProcessingResult, config: AIProcessingConfig): string {
    const generatedDate = new Date().toLocaleString('zh-CN');
    
    return `---\n\n` +
      `### 文档信息\n\n` +
      `- **生成时间**: ${generatedDate}\n` +
      `- **生成方式**: AI自动生成\n` +
      `- **来源**: ${result.originalUrl || '未知'}\n` +
      `- **用户配置**: ${config.language}-${config.style}\n` +
      `- **处理ID**: ${result.id}\n\n` +
      `---\n\n`;
  }

  /**
   * 获取默认模板
   */
  private getDefaultTemplate(): string {
    return `{{TITLE}}

{{SUMMARY}}

{{CONTENT}}

## 处理信息

{{METADATA}}

{{FOOTER}}`;
  }

  /**
   * 获取默认Markdown结构
   */
  private getDefaultMarkdown(variables: any): string {
    return `# ${variables.TITLE}

{{SUMMARY}}

{{CONTENT}}

## 分析评估

- **情感倾向**: {{SENTIMENT}}
- **重要性评分**: {{IMPORTANCE}}/5
- **可读性评分**: {{READABILITY}}/5

## 处理信息

{{METADATA}}

{{FOOTER}}`;
  }

  /**
   * 转义YAML字符串
   */
  private escapeYamlString(str: string): string {
    return str.replace(/["']/g, '\\"');
  }

  /**
   * 生成简单的Markdown
   */
  generateSimpleMarkdown(result: ProcessingResult): string {
    return `# ${result.title}

## 摘要
${result.summary}

## 关键词
${result.keywords.map(k => `- ${k}`).join('\n')}

## 分类
${result.categories.map(c => `- ${c}`).join('\n')}

## 原文内容
${result.content}

---
*AI处理时间: ${result.processingTime}ms*
*AI使用量: ${result.aiTokensUsed} tokens*
*生成时间: ${new Date().toLocaleString('zh-CN')}*`;
  }

  /**
   * 生成学术风格的Markdown
   */
  generateAcademicMarkdown(result: ProcessingResult): string {
    const date = new Date().toLocaleString('zh-CN');
    
    return `# ${result.title}

**摘要**: ${result.summary}

**关键词**: ${result.keywords.join(', ')}

**分类**: ${result.categories.join(', ')}

---

## 内容分析

### 情感分析
经过自然语言处理分析，本文的情感倾向为：**${result.sentiment}**。

### 重要性评估
基于内容深度和广度分析，本文的重要性评分为：**${result.importance}/5**。

### 可读性评估
文章结构清晰，语言表达准确，可读性评分为：**${result.readability}/5**。

## 原文内容

${result.content}

---

### 处理信息
- **处理时间**: ${result.processingTime}毫秒
- **AI使用量**: ${result.aiTokensUsed}个Token
- **AI模型**: ${result.aiModel}
- **AI提供商**: ${result.aiProvider}
- **处理状态**: ${result.status}
- **生成时间**: ${date}`;
  }

  /**
   * 生成简洁风格的Markdown
   */
  generateConciseMarkdown(result: ProcessingResult): string {
    return `# ${result.title}

**摘要**: ${result.summary}

**关键词**: ${result.keywords.slice(0, 5).join(', ')}...

**分类**: ${result.categories.slice(0, 3).join(', ')}

---

## 原文内容
${result.content}

---
*处理: ${result.processingTime}ms | AI: ${result.aiModel}*`;
  }

  /**
   * 自定义模板验证
   */
  validateTemplate(template: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查必要变量
    const requiredVariables = ['{{TITLE}}', '{{SUMMARY}}', '{{CONTENT}}'];
    for (const variable of requiredVariables) {
      if (!template.includes(variable)) {
        errors.push(`缺少必要变量: ${variable}`);
      }
    }
    
    // 检查YAML frontmatter格式
    const frontmatterMatch = template.match(/---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      errors.push('缺少YAML frontmatter');
    }
    
    // 检查Markdown标题格式
    if (!template.includes('# ') && !template.includes('{{TITLE}}')) {
      errors.push('缺少Markdown标题');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 模板变量预览
   */
  previewTemplate(template: string, sampleData: any): string {
    let preview = template;
    
    // 替换变量
    for (const [key, value] of Object.entries(sampleData)) {
      const placeholder = `{{${key}}}`;
      preview = preview.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return preview;
  }

  /**
   * 获取支持的风格类型
   */
  getSupportedStyles(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return [
      {
        id: 'default',
        name: '默认风格',
        description: '平衡的文档结构，适合大多数场景'
      },
      {
        id: 'academic',
        name: '学术风格',
        description: '严谨的学术格式，适合研究和分析报告'
      },
      {
        id: 'concise',
        name: '简洁风格',
        description: '精简的表达方式，突出核心信息'
      },
      {
        id: 'detailed',
        name: '详细风格',
        description: '详尽的描述，适合深入分析'
      },
      {
        id: 'blog',
        name: '博客风格',
        description: '适合个人博客和分享的友好格式'
      }
    ];
  }

  /**
   * 获取文档格式统计
   */
  getDocumentStats(markdown: string): {
    characterCount: number;
    wordCount: number;
    sectionCount: number;
    frontmatterSize: number;
  } {
    const characterCount = markdown.length;
    const wordCount = markdown.split(/\s+/).length;
    
    // 计算section数量（以 # 开头的行）
    const sectionCount = (markdown.match(/^#/gm) || []).length;
    
    // 计算frontmatter大小
    const frontmatterMatch = markdown.match(/---\s*\n([\s\S]*?)\n---/);
    const frontmatterSize = frontmatterMatch ? frontmatterMatch[1].length : 0;
    
    return {
      characterCount,
      wordCount,
      sectionCount,
      frontmatterSize
    };
  }

  }