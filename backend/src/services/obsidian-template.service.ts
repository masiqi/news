// Obsidian模板服务
// 提供可配置的Markdown模板生成和YAML frontmatter管理

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection';
import { obsidianTemplates, userTemplatePreferences, enhancedContentAnalysis } from '../db/schema';
import { getObsidianConfigFromEnv, defaultObsidianConfig } from '../config/obsidian.config';
import { 
  type EnhancedAnalysisResult, 
  type ObsidianFields, 
  type YAMLFrontmatterConfig,
  defaultYAMLConfig 
} from '../config/obsidian.config';

// 模板变量接口
export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'array' | 'object' | 'boolean';
  required: boolean;
  defaultValue?: any;
}

// 模板渲染上下文
export interface TemplateContext {
  analysis: EnhancedAnalysisResult;
  metadata: {
    contentId: string;
    userId: number;
    generatedAt: Date;
    templateId: string;
  };
  customData?: Record<string, any>;
}

// 模板渲染结果
export interface TemplateRenderResult {
  markdown: string;
  frontmatter: ObsidianFields;
  metadata: {
    templateId: string;
    renderedAt: Date;
    renderingTime: number;
    variablesUsed: string[];
  };
}

// Obsidian模板配置
export interface ObsidianTemplateConfig {
  id: string;
  name: string;
  description: string;
  templateContent: string;
  templateType: 'article' | 'summary' | 'analysis';
  yamlFrontmatterConfig: YAMLFrontmatterConfig;
  linkStrategies: any[];
  maxLinks: number;
  supportedStyles: string[];
  variables: TemplateVariable[];
}

export class ObsidianTemplateService {
  private config = getObsidianConfigFromEnv();
  
  /**
   * 获取所有可用模板
   */
  async getAllTemplates(): Promise<ObsidianTemplateConfig[]> {
    const templates = await db
      .select()
      .from(obsidianTemplates)
      .where(eq(obsidianTemplates.isActive, true));
    
    return templates.map(template => this.transformDbTemplate(template));
  }
  
  /**
   * 获取用户模板偏好
   */
  async getUserTemplatePreferences(userId: number): Promise<ObsidianTemplateConfig[]> {
    const preferences = await db
      .select({
        template: obsidianTemplates,
        preferenceOrder: userTemplatePreferences.preferenceOrder,
        usageCount: userTemplatePreferences.usageCount,
      })
      .from(userTemplatePreferences)
      .innerJoin(
        obsidianTemplates,
        eq(userTemplatePreferences.templateId, obsidianTemplates.id)
      )
      .where(
        and(
          eq(userTemplatePreferences.userId, userId),
          eq(obsidianTemplates.isActive, true)
        )
      )
      .orderBy(userTemplatePreferences.preferenceOrder);
    
    return preferences.map(pref => this.transformDbTemplate(pref.template));
  }
  
  /**
   * 获取默认模板
   */
  async getDefaultTemplate(): Promise<ObsidianTemplateConfig | null> {
    const [template] = await db
      .select()
      .from(obsidianTemplates)
      .where(eq(obsidianTemplates.isDefault, true))
      .limit(1);
    
    return template ? this.transformDbTemplate(template) : null;
  }
  
  /**
   * 根据ID获取模板
   */
  async getTemplateById(templateId: string): Promise<ObsidianTemplateConfig | null> {
    const [template] = await db
      .select()
      .from(obsidianTemplates)
      .where(eq(obsidianTemplates.id, parseInt(templateId)));
    
    return template ? this.transformDbTemplate(template) : null;
  }
  
  /**
   * 创建用户模板偏好
   */
  async createUserTemplatePreference(
    userId: number, 
    templateId: string, 
    preferenceOrder?: number
  ): Promise<void> {
    await db.insert(userTemplatePreferences).values({
      userId,
      templateId: parseInt(templateId),
      preferenceOrder: preferenceOrder ?? 0,
      createdAt: new Date(),
    });
  }
  
  /**
   * 更新模板使用统计
   */
  async updateTemplateUsage(userId: number, templateId: string): Promise<void> {
    await db
      .update(userTemplatePreferences)
      .set({
        usageCount: sql`${userTemplatePreferences.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(userTemplatePreferences.userId, userId),
          eq(userTemplatePreferences.templateId, parseInt(templateId))
        )
      );
  }
  
  /**
   * 渲染模板
   */
  async renderTemplate(
    templateId: string,
    context: TemplateContext,
    customConfig?: Partial<YAMLFrontmatterConfig>
  ): Promise<TemplateRenderResult> {
    const startTime = Date.now();
    
    // 获取模板
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }
    
    // 合并配置
    const yamlConfig = {
      ...template.yamlFrontmatterConfig,
      ...customConfig,
    };
    
    try {
      // 准备模板变量
      const variables = this.prepareTemplateVariables(context, yamlConfig);
      
      // 渲染YAML frontmatter
      const frontmatter = this.renderYAMLFrontmatter(variables, yamlConfig);
      
      // 渲染模板内容
      const content = this.renderTemplateContent(template.templateContent, variables);
      
      // 组合最终Markdown
      const markdown = this.combineMarkdown(frontmatter, content);
      
      const renderingTime = Date.now() - startTime;
      
      return {
        markdown,
        frontmatter,
        metadata: {
          templateId,
          renderedAt: new Date(),
          renderingTime,
          variablesUsed: Object.keys(variables),
        },
      };
      
    } catch (error) {
      console.error('Template rendering failed:', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 预览模板
   */
  async previewTemplate(
    templateId: string, 
    sampleAnalysis: EnhancedAnalysisResult
  ): Promise<TemplateRenderResult> {
    const context: TemplateContext = {
      analysis: sampleAnalysis,
      metadata: {
        contentId: sampleAnalysis.id,
        userId: sampleAnalysis.userId,
        generatedAt: new Date(),
        templateId,
      },
    };
    
    return this.renderTemplate(templateId, context);
  }
  
  /**
   * 为用户推荐模板
   */
  async recommendTemplates(userId: number, analysis: EnhancedAnalysisResult): Promise<ObsidianTemplateConfig[]> {
    // 获取用户偏好
    const userPreferences = await this.getUserTemplatePreferences(userId);
    
    // 基于内容特征推荐模板
    const recommendations = this.generateTemplateRecommendations(analysis);
    
    // 合并用户偏好和推荐
    const allTemplates = await this.getAllTemplates();
    const scoredTemplates = allTemplates.map(template => {
      let score = 0;
      
      // 用户偏好加分
      const userPrefIndex = userPreferences.findIndex(pref => pref.id === template.id);
      if (userPrefIndex !== -1) {
        score += (userPreferences.length - userPrefIndex) * 10;
      }
      
      // 内容特征加分
      const recommendationScore = recommendations.get(template.id) || 0;
      score += recommendationScore;
      
      // 默认模板加分
      if (template.name === this.config.templates.defaultTemplate) {
        score += 5;
      }
      
      return { template, score };
    });
    
    // 排序并返回前5个
    return scoredTemplates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.template);
  }
  
  /**
   * 创建自定义模板
   */
  async createCustomTemplate(
    name: string,
    description: string,
    templateContent: string,
    templateType: 'article' | 'summary' | 'analysis',
    userId?: number
  ): Promise<ObsidianTemplateConfig> {
    // 验证模板内容
    this.validateTemplateContent(templateContent);
    
    // 提取模板变量
    const variables = this.extractTemplateVariables(templateContent);
    
    const [template] = await db
      .insert(obsidianTemplates)
      .values({
        name,
        description,
        templateContent,
        templateType,
        yamlFrontmatterConfig: JSON.stringify(defaultYAMLConfig),
        linkStrategies: JSON.stringify([]),
        maxLinks: 10,
        supportedStyles: JSON.stringify(['default']),
        isActive: true,
        version: '1.0',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return this.transformDbTemplate(template);
  }
  
  /**
   * 准备模板变量
   */
  private prepareTemplateVariables(
    context: TemplateContext, 
    yamlConfig: YAMLFrontmatterConfig
  ): Record<string, any> {
    const { analysis, metadata, customData } = context;
    
    // 基础变量
    const variables: Record<string, any> = {
      // 基础信息
      title: analysis.title,
      date: new Date().toISOString().split('T')[0],
      source: analysis.sourceId,
      original_url: `https://example.com/news/${analysis.contentId}`,
      
      // 分类和标签
      categories: analysis.categories.map(cat => cat.name),
      keywords: analysis.keywords.slice(0, 10).map(kw => kw.text),
      tags: analysis.tags,
      
      // 分析结果
      sentiment: analysis.sentiment.label,
      importance: Math.round(analysis.importance * 10) / 10,
      readability: Math.round(analysis.readability * 10) / 10,
      
      // Obsidian特有字段
      cssclass: this.generateCSSClasses(analysis),
      aliases: this.generateAliases(analysis),
      publish: false,
      permalink: `news/${analysis.contentId}`,
      
      // 关联和导航
      related: this.generateRelatedLinks(analysis),
      topics: analysis.topics.map(topic => topic.name),
      timeline: this.generateTimeline(analysis),
      
      // 元数据
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ai_model: analysis.aiModel,
      processing_time: `${analysis.processingTime}ms`,
      
      // 内容
      summary: analysis.summary,
      content: analysis.content,
      content_id: metadata.contentId,
      user_id: metadata.userId,
      generated_at: metadata.generatedAt.toISOString(),
      
      // 自定义数据
      ...customData,
    };
    
    // 添加智能生成的字段
    variables.primary_category = this.getPrimaryCategory(analysis);
    variables.key_points = this.generateKeyPoints(analysis);
    variables.sentiment_emoji = this.getSentimentEmoji(analysis.sentiment);
    variables.importance_stars = this.generateImportanceStars(analysis.importance);
    variables.readability_score = this.generateReadabilityScore(analysis.readability);
    
    return variables;
  }
  
  /**
   * 渲染YAML frontmatter
   */
  private renderYAMLFrontmatter(variables: Record<string, any>, config: YAMLFrontmatterConfig): string {
    const frontmatter: Record<string, any> = {};
    
    // 基础字段
    if (config.includeBasicFields) {
      frontmatter.title = variables.title;
      frontmatter.date = variables.date;
      frontmatter.source = variables.source;
      frontmatter.original_url = variables.original_url;
    }
    
    // 分析字段
    if (config.includeAnalysisFields) {
      frontmatter.categories = variables.categories;
      frontmatter.keywords = variables.keywords;
      frontmatter.tags = variables.tags;
      frontmatter.sentiment = variables.sentiment;
      frontmatter.importance = variables.importance;
      frontmatter.readability = variables.readability;
    }
    
    // Obsidian特有字段
    if (config.includeObsidianFields) {
      frontmatter.cssclass = variables.cssclass;
      frontmatter.aliases = variables.aliases;
      frontmatter.publish = variables.publish;
      frontmatter.permalink = variables.permalink;
    }
    
    // 导航字段
    if (config.includeNavigationFields) {
      frontmatter.related = variables.related;
      frontmatter.topics = variables.topics;
      frontmatter.timeline = variables.timeline;
    }
    
    // 元数据
    frontmatter.created_at = variables.created_at;
    frontmatter.updated_at = variables.updated_at;
    frontmatter.ai_model = variables.ai_model;
    frontmatter.processing_time = variables.processing_time;
    
    // 应用字段映射
    const mappedFrontmatter: Record<string, any> = {};
    Object.entries(frontmatter).forEach(([key, value]) => {
      const mappedKey = config.fieldMappings[key] || key;
      mappedFrontmatter[mappedKey] = value;
    });
    
    // 添加自定义字段
    Object.assign(mappedFrontmatter, config.customFields);
    
    // 生成YAML字符串
    const yamlString = this.objectToYAML(mappedFrontmatter);
    
    return `---\n${yamlString}---\n\n`;
  }
  
  /**
   * 渲染模板内容
   */
  private renderTemplateContent(template: string, variables: Record<string, any>): string {
    let content = template;
    
    // 简单的变量替换 {{variable}}
    content = content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(variables, trimmedKey);
      return value !== undefined ? String(value) : match;
    });
    
    // 条件渲染 {{#if condition}}...{{/if}}
    content = content.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const conditionValue = this.getNestedValue(variables, condition.trim());
      return conditionValue ? content : '';
    });
    
    // 循环渲染 {{#each array}}...{{/each}}
    content = content.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, template) => {
      const arrayValue = this.getNestedValue(variables, arrayKey.trim());
      if (!Array.isArray(arrayValue)) return '';
      
      return arrayValue.map((item, index) => {
        return template
          .replace(/\{\{this\}\}/g, String(item))
          .replace(/\{\{@index\}\}/g, String(index))
          .replace(/\{\{(@[^}]+)\}\}/g, (_, prop) => {
            return String(this.getNestedValue(item, prop.substring(1)) || '');
          });
      }).join('\n');
    });
    
    return content.trim();
  }
  
  /**
   * 组合Markdown
   */
  private combineMarkdown(frontmatter: string, content: string): string {
    return frontmatter + content;
  }
  
  /**
   * 生成CSS类
   */
  private generateCSSClasses(analysis: EnhancedAnalysisResult): string[] {
    const classes = ['news-article'];
    
    // 添加主要分类
    if (analysis.categories.length > 0) {
      classes.push(analysis.categories[0].name.toLowerCase());
    }
    
    // 添加情感类型
    classes.push(`sentiment-${analysis.sentiment.label}`);
    
    // 添加重要性等级
    if (analysis.importance > 0.7) {
      classes.push('importance-high');
    } else if (analysis.importance > 0.4) {
      classes.push('importance-medium');
    } else {
      classes.push('importance-low');
    }
    
    return classes;
  }
  
  /**
   * 生成别名
   */
  private generateAliases(analysis: EnhancedAnalysisResult): string[] {
    const aliases = [];
    
    // 添加标题的简短版本
    if (analysis.title.length > 50) {
      aliases.push(analysis.title.substring(0, 47) + '...');
    }
    
    // 添加主要主题作为别名
    if (analysis.topics.length > 0) {
      aliases.push(`${analysis.topics[0].name}: ${analysis.title}`);
    }
    
    return aliases;
  }
  
  /**
   * 生成相关链接
   */
  private generateRelatedLinks(analysis: EnhancedAnalysisResult): string[] {
    // 这里可以从数据库查询相关内容
    // 现在返回占位符
    return [];
  }
  
  /**
   * 生成时间线
   */
  private generateTimeline(analysis: EnhancedAnalysisResult): string[] {
    return [analysis.timelinePosition];
  }
  
  /**
   * 获取主要分类
   */
  private getPrimaryCategory(analysis: EnhancedAnalysisResult): string {
    return analysis.categories.length > 0 ? analysis.categories[0].name : 'general';
  }
  
  /**
   * 生成要点
   */
  private generateKeyPoints(analysis: EnhancedAnalysisResult): string[] {
    // 从摘要中提取要点
    const sentences = analysis.summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).map(s => s.trim());
  }
  
  /**
   * 获取情感表情符号
   */
  private getSentimentEmoji(sentiment: any): string {
    switch (sentiment.label) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      default: return '😐';
    }
  }
  
  /**
   * 生成重要性星级
   */
  private generateImportanceStars(importance: number): string {
    const stars = Math.round(importance * 5);
    return '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
  }
  
  /**
   * 生成可读性分数
   */
  private generateReadabilityScore(readability: number): string {
    const score = Math.round(readability * 100);
    if (score >= 80) return `${score}% (非常易读)`;
    if (score >= 60) return `${score}% (易读)`;
    if (score >= 40) return `${score}% (一般)`;
    return `${score}% (较难)`;
  }
  
  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * 对象转YAML
   */
  private objectToYAML(obj: any): string {
    const lines: string[] = [];
    
    Object.entries(obj).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
        } else {
          lines.push(`${key}:`);
          value.forEach(item => {
            lines.push(`  - ${item}`);
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${key}:`);
        Object.entries(value).forEach(([subKey, subValue]) => {
          lines.push(`  ${subKey}: ${subValue}`);
        });
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value ? 'true' : 'false'}`);
      } else if (value === null || value === undefined) {
        lines.push(`${key}: null`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * 验证模板内容
   */
  private validateTemplateContent(content: string): void {
    // 检查必需的变量
    const requiredVariables = ['title', 'content', 'summary'];
    const missingVariables = requiredVariables.filter(variable => 
      !content.includes(`{{${variable}}}`)
    );
    
    if (missingVariables.length > 0) {
      throw new Error(`Template is missing required variables: ${missingVariables.join(', ')}`);
    }
  }
  
  /**
   * 提取模板变量
   */
  private extractTemplateVariables(content: string): TemplateVariable[] {
    const variableSet = new Set<string>();
    
    // 提取简单变量 {{variable}}
    const simpleVarMatches = content.match(/\{\{([^}]+)\}\}/g);
    if (simpleVarMatches) {
      simpleVarMatches.forEach(match => {
        const variable = match.replace(/[{}]/g, '').trim();
        variableSet.add(variable);
      });
    }
    
    // 转换为TemplateVariable数组
    return Array.from(variableSet).map(variable => ({
      name: variable,
      description: `Variable: ${variable}`,
      type: 'string',
      required: ['title', 'content', 'summary'].includes(variable),
    }));
  }
  
  /**
   * 生成模板推荐
   */
  private generateTemplateRecommendations(analysis: EnhancedAnalysisResult): Map<string, number> {
    const scores = new Map<string, number>();
    
    // 基于内容长度推荐
    if (analysis.content.length > 2000) {
      scores.set('detailed-analysis', 10);
      scores.set('standard-news-article', 8);
    } else {
      scores.set('summary', 10);
      scores.set('standard-news-article', 8);
    }
    
    // 基于重要性推荐
    if (analysis.importance > 0.7) {
      scores.set('detailed-analysis', 8);
    }
    
    // 基于主题数量推荐
    if (analysis.topics.length > 3) {
      scores.set('detailed-analysis', 7);
    }
    
    return scores;
  }
  
  /**
   * 转换数据库模板
   */
  private transformDbTemplate(template: any): ObsidianTemplateConfig {
    return {
      id: template.id.toString(),
      name: template.name,
      description: template.description,
      templateContent: template.templateContent,
      templateType: template.templateType,
      yamlFrontmatterConfig: JSON.parse(template.yamlFrontmatterConfig || '{}'),
      linkStrategies: JSON.parse(template.linkStrategies || '[]'),
      maxLinks: template.maxLinks,
      supportedStyles: JSON.parse(template.supportedStyles || '["default"]'),
      variables: this.extractTemplateVariables(template.templateContent),
    };
  }
}