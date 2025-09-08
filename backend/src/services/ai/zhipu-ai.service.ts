// src/services/ai/zhipu-ai.service.ts
import { AIProcessingConfig, ProcessingResult } from './types';
import { ModelConfigService } from '../model-config.service';

/**
 * 智谱AI服务封装类
 * 集成智谱GLM-4.5-Flash模型进行内容分析
 */
export class ZhipuAIService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://open.bigmodel.cn/api/paas/v4';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ZHIPUAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('智谱AI API Key未配置，部分功能可能无法使用');
    }
  }

  /**
   * 分析内容并生成处理结果
   */
  async analyzeContent(params: {
    content: string;
    title: string;
    config: AIProcessingConfig;
  }): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { content, title, config } = params;

    try {
      console.log(`开始智谱AI内容分析: ${title}, 配置: ${config.language}-${config.style}`);

      // 根据配置选择模型和参数
      const modelConfig = ModelConfigService.getRecommendedModelConfig('summarization');
      
      // 构建分析提示
      const analysisPrompt = this.buildAnalysisPrompt(content, title, config);
      
      // 调用智谱AI API
      const response = await this.callZhipuAI(analysisPrompt, modelConfig);
      
      // 解析析响应
      const analysisResult = this.parseAnalysisResponse(response, title, config);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`智谱AI内容分析完成，耗时: ${processingTime}ms`);
      
      return {
        id: this.generateId(),
        sourceId: '', // 将在调用时设置
        userId: config.userId,
        originalUrl: '',
        title,
        content,
        summary: analysisResult.summary,
        keywords: analysisResult.keywords,
        categories: analysisResult.categories,
        markdownContent: '', // 将由Markdown生成器处理
        processingTime,
        aiTokensUsed: this.estimateTokensUsed(analysisPrompt),
        status: 'completed',
        createdAt: new Date()
      };
      
    } catch (error) {
      console.error('智谱AI内容分析失败:', error);
      
      return {
        id: this.generateId(),
        sourceId: '',
        userId: config.userId,
        originalUrl: '',
        title,
        content,
        summary: '分析失败',
        keywords: [],
        categories: [],
        markdownContent: '',
        processingTime: Date.now() - startTime,
        aiTokensUsed: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        createdAt: new Date()
      };
    }
  }

  /**
   * 生成Markdown内容（基于分析结果）
   */
  async generateMarkdown(result: ProcessingResult): Promise<string> {
    try {
      console.log('开始生成Markdown内容...');
      
      const markdownContent = this.buildMarkdownDocument(result);
      
      console.log('Markdown内容生成完成');
      return markdownContent;
      
    } catch (error) {
      console.error('Markdown生成失败:', error);
      throw new Error(`Markdown生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
      
      return true;
      
    } catch (error) {
      console.error('配置验证失败:', error);
      return false;
    }
  }

  /**
   * 构建分析提示
   */
  private buildAnalysisPrompt(content: string, title: string, config: AIProcessingConfig): string {
    const languageInstruction = this.getLanguageInstruction(config.language);
    const styleInstruction = this.getStyleInstruction(config.style);
    
    return `你是一个专业的新闻内容分析师。请对以下文章进行分析：

标题：${title}

文章内容：
${content}

要求：
${languageInstruction}

${styleInstruction}

请以JSON格式返回分析结果，包含以下字段：
{
  "summary": "文章的核心摘要（2-3句话）",
  "keywords": ["5-8个关键词或短语"],
  "categories": ["2-4个分类标签，如：政治、经济、科技、文化、体育等"],
  "sentiment": "情感倾向（正面、负面、中性）",
  "importance": "重要性评分（1-5分，5为最重要）",
  "readability": "可读性评分（1-5分，5为最易读）"
}

注意：
1. 摘要简洁明了，抓住文章核心
2. 关键词要具有代表性和实用性
3. 分类要准确反映文章主题领域
4. 情感分析要客观准确
5. 只返回JSON格式，不要包含其他解释`;
  }

  /**
   * 获取语言指令
   */
  private getLanguageInstruction(language: string): string {
    switch (language) {
      case 'zh-CN':
        return '使用中文进行分析和输出结果';
      case 'en-US':
        return 'Use English for analysis and output';
      case 'auto':
      default:
        return '自动检测语言并使用相应语言进行分析';
    }
  }

  /**
   * 获取风格指令
   */
  private getStyleInstruction(style: string): string {
    switch (style) {
      case 'concise':
        return '分析风格要简洁明了，突出重点信息';
      case 'detailed':
        return '分析风格要详细深入，涵盖文章的各个方面';
      case 'academic':
        return '分析风格要学术严谨，使用专业术语和客观分析';
      default:
        return '分析风格要平衡简洁与详细程度';
    }
  }

  /**
   * 调用智谱AI API
   */
  private async callZhipuAI(prompt: string, modelConfig: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('智谱AI API Key未配置');
    }

    const request = {
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的新闻内容分析师，擅长分析文章并提供结构化的摘要、关键词和分类。请严格按照JSON格式返回结果。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: modelConfig.temperature || 0.3,
      max_tokens: modelConfig.maxTokens || 2000,
      stream: false
    };

    console.log('调用智谱AI API:', JSON.stringify(request, null, 2));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`智谱AI API调用失败: HTTP ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 解析AI响应
   */
  private parseAnalysisResponse(response: any, title: string, config: AIProcessingConfig): any {
    try {
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('智谱AI响应格式不正确');
      }

      const content = response.choices[0].message.content;
      
      // 尝试解析JSON响应
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '摘要生成失败',
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          sentiment: parsed.sentiment || '中性',
          importance: parsed.importance || 3,
          readability: parsed.readability || 3
        };
      }

      // 如果JSON解析失败，返回默认值
      return {
        summary: content.substring(0, 200) + '...',
        keywords: [title, '新闻', '事件'],
        categories: ['新闻', '时事'],
        sentiment: '中性',
        importance: 3,
        readability: 3
      };
      
    } catch (error) {
      console.error('解析智谱AI响应失败:', error);
      return {
        summary: '分析失败',
        keywords: [],
        categories: [],
        sentiment: '中性',
        importance: 3,
        readability: 3
      };
    }
  }

  /**
   * 构建Markdown文档
   */
  private buildMarkdownDocument(result: ProcessingResult): string {
    const frontmatter = this.buildFrontmatter(result);
    const content = this.buildMarkdownContent(result);
    
    return `${frontmatter}\n\n${content}`;
  }

  /**
   * 构建Frontmatter
   */
  private buildFrontmatter(result: ProcessingResult): string {
    const date = new Date().toISOString().split('T')[0];
    
    return `---
title: ${result.title}
date: ${date}
summary: ${result.summary}
keywords: ${JSON.stringify(result.keywords)}
categories: ${JSON.stringify(result.categories)}
sentiment: ${result.sentiment}
importance: ${result.importance}
readability: ${result.readability}
processing_time: ${result.processingTime}ms
ai_tokens_used: ${result.aiTokensUsed}
status: ${result.status}
---`;
  }

  /**
   * 构建Markdown内容
   */
  private buildMarkdownContent(result: ProcessingResult): string {
    let content = `# ${result.title}\n\n`;
    
    // 添加摘要
    if (result.summary && result.summary !== '分析失败') {
      content += `## 摘要\n\n${result.summary}\n\n`;
    }
    
    // 添加分类和标签
    if (result.categories.length > 0) {
      content += `## 分类\n\n`;
      result.categories.forEach(category => {
        content += `- ${category}\n`;
      });
      content += '\n';
    }
    
    // 添加关键词
    if (result.keywords.length > 0) {
      content += `## 关键词\n\n`;
      result.keywords.forEach(keyword => {
        content += `- ${keyword}\n`;
      });
      content += '\n';
    }
    
    // 添加情感和重要性
    content += `## 评估\n\n`;
    content += `- **情感倾向**: ${result.sentiment}\n`;
    content += `- **重要性评分**: ${result.importance}/5\n`;
    content += `- **可读性评分**: ${result.readability}/5\n\n`;
    
    // 添加处理信息
    content += `## 处理信息\n\n`;
    content += `- **处理时间**: ${result.processingTime}ms\n`;
    content += `- **AI使用量**: ${result.aiTokensUsed} tokens\n`;
    content += `- **处理状态**: ${result.status}\n\n`;
    
    // 添加原文内容
    content += `## 原文内容\n\n`;
    content += result.content;
    
    return content;
  }

  /**
   * 估算Token使用量
   */
  private estimateTokensUsed(prompt: string): number {
    // 简单估算：中文字符约等于1.3-1.5个token
    // 英文字符约等于1.0-1.3个token
    const chineseRatio = /[\u4e00-\u9fa5]/.test(prompt) ? 1.4 : 0;
    const tokenCount = Math.floor(prompt.length * (1.2 + chineseRatio * 0.3));
    
    return Math.max(tokenCount, 100); // 最少100个token
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查服务可用性
   */
  async checkAvailability(): Promise<{ available: boolean; message: string }> {
    if (!this.apiKey) {
      return {
        available: false,
        message: '智谱AI API Key未配置'
      };
    }

    try {
      const testResponse = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'glm-4.5-flash',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      const available = testResponse.ok;
      return {
        available,
        message: available ? '智谱AI服务可用' : `智谱AI服务不可用: HTTP ${testResponse.status}`
      };
      
    } catch (error) {
      return {
        available: false,
        message: `智谱AI服务连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
}