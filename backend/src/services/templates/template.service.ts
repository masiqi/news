// src/services/templates/template.service.ts
import { MarkdownTemplate } from '../ai/types';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';

// 模拟模板表，实际应用中应该有专门的数据库表
const mockTemplates: MarkdownTemplate[] = [
  {
    id: 'default',
    name: '默认模板',
    description: '平衡的文档结构，适合大多数场景',
    template: `{{TITLE}}

{{SUMMARY}}

{{CONTENT}}

## 处理信息

| 项目 | 详情 |
| --- | --- |
| **处理时间** | {{PROCESSING_TIME}}ms |
| **AI使用量** | {{AI_TOKENS_USED}} tokens |
| **AI模型** | {{AI_MODEL}} |
| **AI提供商** | {{AI_PROVIDER}} |
| **处理状态** | {{STATUS}} |

---
*生成时间: {{DATE}}*
`,
    variables: ['TITLE', 'SUMMARY', 'CONTENT', 'PROCESSING_TIME', 'AI_TOKENS_USED', 'AI_MODEL', 'AI_PROVIDER', 'STATUS', 'DATE'],
    category: 'news' as const,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'academic',
    name: '学术模板',
    description: '严谨的学术格式，适合研究和分析报告',
    template: `{{TITLE}}

**摘要**: {{SUMMARY}}

**关键词**: {{KEYWORDS}}

**分类**: {{CATEGORIES}}

---

## 内容分析

### 情感分析
本文的情感倾向分析结果为：**{{SENTIMENT}}**。这一分析基于自然语言处理技术，评估文章中表达的情绪色彩。

### 重要性评估
基于内容的深度、广度和时效性分析，本文的重要性评分为：**{{IMPORTANCE}}/5**。此评分反映了文章在当前背景下的相对价值。

### 可读性分析
文章的语言表达和结构组织得分：**{{READABILITY}}/5**。这表明内容的理解难度和流畅程度。

## 原文内容
{{CONTENT}}

---

### 处理元数据

| 分析维度 | 结果 |
| --- | --- |
| **分析模型** | {{AI_MODEL}} |
| **分析提供商** | {{AI_PROVIDER}} |
| **处理时长** | {{PROCESSING_TIME}}ms |
| **Token消耗** | {{AI_TOKENS_USED}} |
| **分析状态** | {{STATUS}} |
| **生成时间** | {{DATE}} |

*本文档由AI自动生成，仅供参考和分析使用。*`,
    variables: ['TITLE', 'SUMMARY', 'KEYWORDS', 'CATEGORIES', 'SENTIMENT', 'IMPORTANCE', 'READABILITY', 'CONTENT', 'AI_MODEL', 'AI_PROVIDER', 'PROCESSING_TIME', 'AI_TOKENS_USED', 'STATUS', 'DATE'],
    category: 'research' as const,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'blog',
    name: '博客模板',
    description: '友好的博客格式，适合个人分享',
    template: `# {{TITLE}}

> {{SUMMARY}}

---

## 快速概览

- **关键词**: {{KEYWORDS}}
- **分类**: {{CATEGORIES}}
- **情感倾向**: {{SENTIMENT}}
- **重要性评分**: {{IMPORTANCE}}/5
- **发布时间**: {{DATE}}

## 详细分析

### 主要观点
{{CONTENT}}

---

### AI分析备注

这篇文章使用 **{{AI_MODEL}}** 模型进行分析，处理耗时约 **{{PROCESSING_TIME}}ms**。分析结果反映了文章的核心内容和情感倾向，适合用于信息整理和知识管理。

*文章分析由AI助手完成，结果仅供参考。*`,
    variables: ['TITLE', 'SUMMARY', 'KEYWORDS', 'CATEGORIES', 'SENTIMENT', 'IMPORTANCE', 'READABILITY', 'CONTENT', 'AI_MODEL', 'AI_PROVIDER', 'PROCESSING_TIME', 'AI_TOKENS_USED', 'STATUS', 'DATE'],
    category: 'blog' as const,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'minimal',
    name: '精简模板',
    description: '最简化的文档格式，适合快速阅读',
    template: `# {{TITLE}}

{{SUMMARY}}

**关键词**: {{KEYWORDS}} | **分类**: {{CATEGORIES}}

---

{{CONTENT}}

---
*处理: {{PROCESSING_TIME}}ms | {{AI_MODEL}}*`,
    variables: ['TITLE', 'SUMMARY', 'KEYWORDS', 'CATEGORIES', 'SENTIMENT', 'IMPORTANCE', 'READABILITY', 'CONTENT', 'AI_MODEL', 'AI_PROVIDER', 'PROCESSING_TIME', 'AI_TOKENS_USED', 'STATUS', 'DATE'],
    category: 'custom' as const,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * 模板服务
 * 管理Markdown文档模板
 */
export class TemplateService {
  private db: any;

  constructor(db: any) {
    this.db = drizzle(db);
  }

  /**
   * 获取可用模板
   */
  async getAvailableTemplates(userId: string): Promise<MarkdownTemplate[]> {
    try {
      // 简化实现，返回预设模板
      // 实际应用中应该从数据库查询用户的模板
      console.log(`获取用户可用模板: ${userId}`);
      
      // 为每个模板添加用户特定信息
      const userTemplates = mockTemplates.map(template => ({
        ...template,
        id: `${template.id}_${userId}`,
        name: `${template.name} (用户版)`,
        description: `${template.description} - 专为用户${userId}定制`
      }));
      
      return [...mockTemplates, ...userTemplates];
      
    } catch (error) {
      console.error('获取可用模板失败:', error);
      return mockTemplates; // 返回默认模板
    }
  }

  /**
   * 根据ID获取模板
   */
  async getTemplateById(templateId: string): Promise<MarkdownTemplate | null> {
    try {
      console.log(`获取模板详情: ${templateId}`);
      
      // 首先尝试从预设模板中查找
      const presetTemplate = mockTemplates.find(t => t.id === templateId);
      if (presetTemplate) {
        return presetTemplate;
      }
      
      // 如果没找到，可能是用户自定义模板
      // 这里简化实现，实际应用中应该查询数据库
      console.log(`未找到预设模板: ${templateId}`);
      return null;
      
    } catch (error) {
      console.error('获取模板详情失败:', error);
      return null;
    }
  }

  /**
   * 创建自定义模板
   */
  async createCustomTemplate(template: Omit<MarkdownTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarkdownTemplate> {
    try {
      console.log(`创建自定义模板: ${template.name}`);
      
      const newTemplate: MarkdownTemplate = {
        id: `custom_${Date.now()}`,
        ...template,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 简化实现，只返回创建的模板
      // 实际应用中应该保存到数据库
      console.log(`自定义模板创建成功: ${newTemplate.id}`);
      
      return newTemplate;
      
    } catch (error) {
      console.error('创建自定义模板失败:', error);
      throw new Error(`创建自定义模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(templateId: string, updates: Partial<MarkdownTemplate>): Promise<void> {
    try {
      console.log(`更新模板: ${templateId}`);
      
      // 检查模板是否存在
      const existingTemplate = await this.getTemplateById(templateId);
      if (!existingTemplate) {
        throw new Error(`模板不存在: ${templateId}`);
      }
      
      // 简化实现，只记录更新
      // 实际应用中应该更新数据库
      console.log(`模板更新成功: ${templateId}`);
      console.log('更新内容:', JSON.stringify(updates, null, 2));
      
    } catch (error) {
      console.error('更新模板失败:', error);
      throw new Error(`更新模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      console.log(`删除模板: ${templateId}`);
      
      // 检查模板是否存在
      const existingTemplate = await this.getTemplateById(templateId);
      if (!existingTemplate) {
        throw new Error(`模板不存在: ${templateId}`);
      }
      
      // 检查是否为默认模板
      if (existingTemplate.isDefault) {
        throw new Error('不能删除默认模板');
      }
      
      // 简化实现，只记录删除
      // 实际应用中应该从数据库删除
      console.log(`模板删除成功: ${templateId}`);
      
    } catch (error) {
      console.error('删除模板失败:', error);
      throw new Error(`删除模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 设置默认模板
   */
  async setDefaultTemplate(userId: string, templateId: string): Promise<void> {
    try {
      console.log(`设置用户默认模板: ${userId} -> ${templateId}`);
      
      // 检查模板是否存在
      const existingTemplate = await this.getTemplateById(templateId);
      if (!existingTemplate) {
        throw new Error(`模板不存在: ${templateId}`);
      }
      
      // 简化实现，只记录设置
      // 实际应用中应该更新用户的偏好设置
      console.log(`默认模板设置成功: ${userId} -> ${templateId}`);
      
    } catch (error) {
      console.error('设置默认模板失败:', error);
      throw new Error(`设置默认模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取用户默认模板
   */
  async getUserDefaultTemplate(userId: string): Promise<MarkdownTemplate> {
    try {
      console.log(`获取用户默认模板: ${userId}`);
      
      // 简化实现，返回默认模板
      // 实际应用中应该查询用户的偏好设置
      const defaultTemplate = mockTemplates.find(t => t.isDefault);
      if (defaultTemplate) {
        console.log(`返回默认模板: ${defaultTemplate.id}`);
        return defaultTemplate;
      }
      
      // 如果没有默认模板，返回第一个模板
      console.log('未找到默认模板，返回第一个可用模板');
      return mockTemplates[0];
      
    } catch (error) {
      console.error('获取用户默认模板失败:', error);
      // 返回第一个模板作为降级
      return mockTemplates[0];
    }
  }

  /**
   * 复制模板
   */
  async duplicateTemplate(templateId: string, newName: string): Promise<MarkdownTemplate> {
    try {
      console.log(`复制模板: ${templateId} -> ${newName}`);
      
      const sourceTemplate = await this.getTemplateById(templateId);
      if (!sourceTemplate) {
        throw new Error(`源模板不存在: ${templateId}`);
      }
      
      const newTemplate: MarkdownTemplate = {
        ...sourceTemplate,
        id: `copy_${Date.now()}`,
        name: newName,
        description: `${sourceTemplate.description} (副本)`,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log(`模板复制成功: ${newTemplate.id}`);
      return newTemplate;
      
    } catch (error) {
      console.error('复制模板失败:', error);
      throw new Error(`复制模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证模板语法
   */
  async validateTemplateSyntax(template: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // 检查必要变量
      const requiredVariables = ['{{TITLE}}', '{{SUMMARY}}'];
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
      
      // 检查模板变量格式
      const variableMatches = template.match(/{{\w+}}/g) || [];
      const malformedVariables = variableMatches.filter(v => !/^{w+}$/.test(v));
      if (malformedVariables.length > 0) {
        errors.push(`存在格式错误的变量: ${malformedVariables.join(', ')}`);
      }
      
      console.log(`模板语法验证完成，发现 ${errors.length} 个错误`);
      
      return {
        isValid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      console.error('模板语法验证失败:', error);
      return {
        isValid: false,
        errors: [`语法验证失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 渲染模板预览
   */
  async renderTemplatePreview(templateId: string, sampleData: Record<string, any>): Promise<string> {
    try {
      console.log(`渲染模板预览: ${templateId}`);
      
      const template = await this.getTemplateById(templateId);
      if (!template) {
        throw new Error(`模板不存在: ${templateId}`);
      }
      
      let rendered = template.template;
      
      // 替换变量
      for (const [key, value] of Object.entries(sampleData)) {
        const placeholder = `{{${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
      }
      
      console.log(`模板预览渲染完成，长度: ${rendered.length} 字符`);
      return rendered;
      
    } catch (error) {
      console.error('渲染模板预览失败:', error);
      throw new Error(`渲染模板预览失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取模板统计信息
   */
  async getTemplateStats(userId: string): Promise<{
    totalTemplates: number;
    customTemplates: number;
    defaultTemplateUsed: string;
    templateUsage: Array<{
      templateId: string;
      templateName: string;
      usageCount: number;
    }>;
  }> {
    try {
      console.log(`获取模板统计信息: ${userId}`);
      
      // 简化实现，返回模拟数据
      // 实际应用中应该从数据库查询统计数据
      return {
        totalTemplates: mockTemplates.length,
        customTemplates: mockTemplates.filter(t => !t.isDefault).length,
        defaultTemplateUsed: 'default',
        templateUsage: mockTemplates.map(template => ({
          templateId: template.id,
          templateName: template.name,
          usageCount: Math.floor(Math.random() * 100) // 模拟使用次数
        }))
      };
      
    } catch (error) {
      console.error('获取模板统计信息失败:', error);
      // 返回空数据
      return {
        totalTemplates: 0,
        customTemplates: 0,
        defaultTemplateUsed: 'default',
        templateUsage: []
      };
    }
  }

  /**
   * 获取按类别分组的模板
   */
  async getTemplatesByCategory(userId: string): Promise<{
    category: string;
    templates: MarkdownTemplate[];
  }[]> {
    try {
      console.log(`获取分类模板: ${userId}`);
      
      const templates = await this.getAvailableTemplates(userId);
      
      // 按类别分组
      const categoryMap = new Map<string, MarkdownTemplate[]>();
      
      templates.forEach(template => {
        if (!categoryMap.has(template.category)) {
          categoryMap.set(template.category, []);
        }
        categoryMap.get(template.category)!.push(template);
      });
      
      const result = Array.from(categoryMap.entries()).map(([category, templates]) => ({
        category,
        templates: templates.sort((a, b) => a.name.localeCompare(b.name))
      }));
      
      console.log(`模板分类完成，发现 ${result.length} 个类别`);
      return result;
      
    } catch (error) {
      console.error('获取分类模板失败:', error);
      // 返回空数据
      return [];
    }
  }

  /**
   * 导出模板
   */
  async exportTemplate(templateId: string, format: 'json' | 'txt' = 'json'): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    filename?: string;
  }> {
    try {
      console.log(`导出模板: ${templateId}, 格式: ${format}`);
      
      const template = await this.getTemplateById(templateId);
      if (!template) {
        return {
          success: false,
          error: `模板不存在: ${templateId}`
        };
      }
      
      let data: string;
      let filename: string;
      
      if (format === 'json') {
        data = JSON.stringify(template, null, 2);
        filename = `${template.name}.json`;
      } else {
        data = `模板名称: ${template.name}\n`;
        data += `模板描述: ${template.description}\n`;
        data += `模板类别: ${template.category}\n`;
        data += `是否默认: ${template.isDefault}\n`;
        data += `创建时间: ${template.createdAt.toLocaleString('zh-CN')}\n`;
        data += `\n---\n`;
        data += `${template.template}`;
        filename = `${template.name}.txt`;
      }
      
      console.log(`模板导出成功: ${filename}`);
      
      return {
        success: true,
        data,
        filename
      };
      
    } catch (error) {
      console.error('导出模板失败:', error);
      return {
        success: false,
        error: `导出模板失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 导入模板
   */
  async importTemplate(templateData: string): Promise<{
    success: boolean;
    template?: MarkdownTemplate;
    error?: string;
  }> {
    try {
      console.log('导入模板...');
      
      let parsedTemplate: any;
      
      // 尝试解析JSON格式
      try {
        parsedTemplate = JSON.parse(templateData);
      } catch {
        // 如果不是JSON，尝试解析文本格式
        parsedTemplate = this.parseTextTemplate(templateData);
      }
      
      // 验证模板数据
      if (!this.validateTemplateData(parsedTemplate)) {
        return {
          success: false,
          error: '模板数据格式无效'
        };
      }
      
      const newTemplate: MarkdownTemplate = {
        id: `imported_${Date.now()}`,
        name: parsedTemplate.name || '导入模板',
        description: parsedTemplate.description || '从外部导入的模板',
        template: parsedTemplate.template,
        variables: Array.isArray(parsedTemplate.variables) ? parsedTemplate.variables : [],
        category: (parsedTemplate.category || 'custom') as any,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log(`模板导入成功: ${newTemplate.id}`);
      
      return {
        success: true,
        template: newTemplate
      };
      
    } catch (error) {
      console.error('导入模板失败:', error);
      return {
        success: false,
        error: `导入模板失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 解析文本格式的模板
   */
  private parseTextTemplate(text: string): any {
    const lines = text.split('\n');
    const result: any = {};
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('模板名称:')) {
        result.name = trimmedLine.substring(5).trim();
      } else if (trimmedLine.startsWith('模板描述:')) {
        result.description = trimmedLine.substring(5).trim();
      } else if (trimmedLine.startsWith('模板类别:')) {
        result.category = trimmedLine.substring(5).trim();
      } else if (trimmedLine.startsWith('是否默认:')) {
        result.isDefault = trimmedLine.substring(5).trim() === '是';
      } else if (trimmedLine.startsWith('创建时间:')) {
        // 忽略时间信息
      } else if (trimmedLine === '---') {
        currentSection = 'template';
      } else if (currentSection === 'template') {
        result.template = (result.template || '') + line + '\n';
      }
    }
    
    return result;
  }

  /**
   * 验证模板数据
   */
  private validateTemplateData(data: any): boolean {
    // 检查必要字段
    if (!data.name || typeof data.name !== 'string') {
      return false;
    }
    
    if (!data.template || typeof data.template !== 'string') {
      return false;
    }
    
    if (!data.category || typeof data.category !== 'string') {
      return false;
    }
    
    if (typeof data.isDefault !== 'boolean') {
      return false;
    }
    
    // 检查变量数组
    if (data.variables && !Array.isArray(data.variables)) {
      return false;
    }
    
    return true;
  }
}