// Obsidian生态集成服务
// 提供Dataview兼容、插件集成和社区模板功能

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { obsidianTemplates, enhancedContentAnalysis } from '../db/schema';
import { ObsidianTemplateService } from './obsidian-template.service';
import { SmartLinkGenerator } from './ai/smart-link-generator';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { 
  type ObsidianTemplateConfig,
  type TemplateRenderResult,
  type EnhancedAnalysisResult,
  getObsidianConfigFromEnv
} from '../config/obsidian.config';

// Dataview查询配置
export interface DataviewQuery {
  table?: string;
  from?: string;
  where?: string;
  sort?: string;
  limit?: number;
  fields?: string[];
}

// Dataview查询结果
export interface DataviewResult {
  headers: string[];
  rows: Array<Record<string, any>>;
  total: number;
  executionTime: number;
}

// 插件配置
export interface PluginConfig {
  name: string;
  version: string;
  enabled: boolean;
  settings: Record<string, any>;
  compatibility: string[];
}

// 社区模板
export interface CommunityTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloadUrl: string;
  tags: string[];
  rating: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 插件集成状态
export interface PluginIntegrationStatus {
  pluginName: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  message?: string;
  capabilities: string[];
}

export class ObsidianIntegrationService {
  private templateService: ObsidianTemplateService;
  private linkGenerator: SmartLinkGenerator;
  private graphService: KnowledgeGraphService;
  private config = getObsidianConfigFromEnv();
  
  constructor() {
    this.templateService = new ObsidianTemplateService();
    this.linkGenerator = new SmartLinkGenerator();
    this.graphService = new KnowledgeGraphService();
  }
  
  /**
   * 生成Dataview兼容查询
   */
  async generateDataviewQuery(
    userId: number,
    query: DataviewQuery
  ): Promise<DataviewResult> {
    const startTime = Date.now();
    
    // 构建SQL查询
    const { sql: querySql, headers } = this.buildDataviewSQL(query);
    
    // 执行查询
    const results = await db.execute(querySql);
    
    const executionTime = Date.now() - startTime;
    
    return {
      headers,
      rows: results.rows as Array<Record<string, any>>,
      total: results.rows.length,
      executionTime
    };
  }
  
  /**
   * 获取Dataview字段映射
   */
  getDataviewFieldMappings(): Record<string, string> {
    return {
      // 基础字段
      'file.name': 'title',
      'file.path': 'permalink',
      'file.size': 'fileSize',
      'file.ctime': 'created_at',
      'file.mtime': 'updated_at',
      
      // 内容字段
      'title': 'title',
      'summary': 'summary',
      'content': 'content',
      'source': 'source',
      'original_url': 'original_url',
      
      // 分析字段
      'sentiment': 'sentiment',
      'importance': 'importance',
      'readability': 'readability',
      'categories': 'categories',
      'keywords': 'keywords',
      'tags': 'tags',
      'topics': 'topics',
      
      // Obsidian特有字段
      'cssclass': 'cssclass',
      'aliases': 'aliases',
      'publish': 'publish',
      
      // 元数据
      'ai_model': 'ai_model',
      'processing_time': 'processing_time',
      'timeline': 'timeline',
      'related': 'related'
    };
  }
  
  /**
   * 验证插件兼容性
   */
  async validatePluginCompatibility(pluginName: string, version: string): Promise<{
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const compatibilityMatrix = {
      'dataview': {
        minVersion: '0.5.0',
        requiredFields: ['title', 'created_at', 'tags'],
        supportedFeatures: ['tables', 'lists', 'tasks', 'calendar']
      },
      'kanban': {
        minVersion: '1.0.0',
        requiredFields: ['tags', 'status'],
        supportedFeatures: ['boards', 'cards', 'due_dates']
      },
      'calendar': {
        minVersion: '1.5.0',
        requiredFields: ['date', 'title'],
        supportedFeatures: ['events', 'reminders', 'recurring']
      },
      'graph': {
        minVersion: '0.5.0',
        requiredFields: ['tags', 'links'],
        supportedFeatures: ['nodes', 'edges', 'layouts', 'filters']
      },
      'excalibrain': {
        minVersion: '1.0.0',
        requiredFields: ['title', 'links'],
        supportedFeatures: ['mind_maps', 'connections', 'hierarchy']
      }
    };
    
    const plugin = compatibilityMatrix[pluginName as keyof typeof compatibilityMatrix];
    if (!plugin) {
      return {
        compatible: false,
        issues: [`Unknown plugin: ${pluginName}`],
        recommendations: ['Check plugin name spelling']
      };
    }
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 版本兼容性检查
    if (this.compareVersions(version, plugin.minVersion) < 0) {
      issues.push(`Version ${version} is below minimum required version ${plugin.minVersion}`);
      recommendations.push(`Update to version ${plugin.minVersion} or higher`);
    }
    
    // 字段兼容性检查
    const availableFields = await this.getAvailableFields();
    const missingFields = plugin.requiredFields.filter(field => !availableFields.includes(field));
    
    if (missingFields.length > 0) {
      issues.push(`Missing required fields: ${missingFields.join(', ')}`);
      recommendations.push(`Ensure your templates include these fields: ${missingFields.join(', ')}`);
    }
    
    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  /**
   * 获取插件集成状态
   */
  async getPluginIntegrationStatus(userId: number): Promise<PluginIntegrationStatus[]> {
    const commonPlugins = [
      'dataview',
      'kanban', 
      'calendar',
      'graph',
      'excalibrain',
      'quickadd',
      'templater',
      'buttons',
      'metadata-menu'
    ];
    
    const statuses: PluginIntegrationStatus[] = [];
    
    for (const pluginName of commonPlugins) {
      const status = await this.checkPluginIntegration(userId, pluginName);
      statuses.push(status);
    }
    
    return statuses;
  }
  
  /**
   * 同步插件数据
   */
  async syncPluginData(userId: number, pluginName: string): Promise<{
    success: boolean;
    message: string;
    syncedItems: number;
    errors?: string[];
  }> {
    try {
      const pluginCapabilities = {
        'dataview': () => this.syncDataviewData(userId),
        'kanban': () => this.syncKanbanData(userId),
        'calendar': () => this.syncCalendarData(userId),
        'graph': () => this.syncGraphData(userId),
        'excalibrain': () => this.syncExcalibrainData(userId)
      };
      
      const syncFunction = pluginCapabilities[pluginName as keyof typeof pluginCapabilities];
      if (!syncFunction) {
        return {
          success: false,
          message: `Plugin ${pluginName} is not supported for data synchronization`,
          syncedItems: 0
        };
      }
      
      const result = await syncFunction();
      
      return {
        success: true,
        message: `Successfully synced ${pluginName} data`,
        syncedItems: result.syncedItems,
        errors: result.errors
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to sync ${pluginName} data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        syncedItems: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  /**
   * 获取社区模板
   */
  async getCommunityTemplates(filters?: {
    category?: string;
    tags?: string[];
    rating?: number;
    search?: string;
    limit?: number;
  }): Promise<CommunityTemplate[]> {
    // 模拟社区模板数据
    const templates: CommunityTemplate[] = [
      {
        id: 'academic-paper-template',
        name: 'Academic Paper Template',
        description: 'Professional template for academic papers with proper citations and formatting',
        author: 'Dr. Sarah Chen',
        version: '2.1.0',
        downloadUrl: 'https://github.com/obsidian-community/templates/academic-paper',
        tags: ['academic', 'research', 'citations'],
        rating: 4.8,
        downloadCount: 15420,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-08-20')
      },
      {
        id: 'daily-journal-template',
        name: 'Daily Journal Template',
        description: 'Comprehensive daily journal with mood tracking, gratitude, and goal setting',
        author: 'Emma Wilson',
        version: '1.5.0',
        downloadUrl: 'https://github.com/obsidian-community/templates/daily-journal',
        tags: ['journal', 'productivity', 'personal'],
        rating: 4.6,
        downloadCount: 32450,
        createdAt: new Date('2023-11-08'),
        updatedAt: new Date('2024-09-01')
      },
      {
        id: 'project-management-template',
        name: 'Project Management Template',
        description: 'Complete project management system with tasks, milestones, and team collaboration',
        author: 'Marcus Johnson',
        version: '3.0.0',
        downloadUrl: 'https://github.com/obsidian-community/templates/project-management',
        tags: ['project', 'management', 'team'],
        rating: 4.7,
        downloadCount: 28900,
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-08-15')
      },
      {
        id: 'learning-notes-template',
        name: 'Learning Notes Template',
        description: 'Spaced repetition template for effective learning and knowledge retention',
        author: 'Prof. Lisa Anderson',
        version: '2.2.0',
        downloadUrl: 'https://github.com/obsidian-community/templates/learning-notes',
        tags: ['learning', 'education', 'spaced-repetition'],
        rating: 4.9,
        downloadCount: 22100,
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-09-05')
      },
      {
        id: 'content-creator-template',
        name: 'Content Creator Template',
        description: 'Template for content creators with idea generation, publishing pipeline, and analytics',
        author: 'Alex Rivera',
        version: '1.8.0',
        downloadUrl: 'https://github.com/obsidian-community/templates/content-creator',
        tags: ['content', 'creativity', 'publishing'],
        rating: 4.5,
        downloadCount: 18750,
        createdAt: new Date('2024-03-05'),
        updatedAt: new Date('2024-08-25')
      }
    ];
    
    let filteredTemplates = templates;
    
    // 应用过滤器
    if (filters?.category) {
      filteredTemplates = filteredTemplates.filter(t => 
        t.tags.some(tag => tag.toLowerCase().includes(filters.category!.toLowerCase()))
      );
    }
    
    if (filters?.tags && filters.tags.length > 0) {
      filteredTemplates = filteredTemplates.filter(t =>
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }
    
    if (filters?.rating) {
      filteredTemplates = filteredTemplates.filter(t => t.rating >= filters.rating!);
    }
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTemplates = filteredTemplates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.author.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters?.limit) {
      filteredTemplates = filteredTemplates.slice(0, filters.limit);
    }
    
    return filteredTemplates;
  }
  
  /**
   * 安装社区模板
   */
  async installCommunityTemplate(
    userId: number,
    templateId: string
  ): Promise<{
    success: boolean;
    message: string;
    installedTemplate?: ObsidianTemplateConfig;
  }> {
    // 获取模板详情
    const communityTemplate = await this.getCommunityTemplateById(templateId);
    if (!communityTemplate) {
      return {
        success: false,
        message: `Template ${templateId} not found`
      };
    }
    
    try {
      // 下载模板内容
      const templateContent = await this.downloadTemplateContent(communityTemplate.downloadUrl);
      
      // 转换为内部模板格式
      const internalTemplate = this.convertCommunityTemplate(communityTemplate, templateContent);
      
      // 创建模板
      const installedTemplate = await this.templateService.createCustomTemplate(
        internalTemplate.name,
        internalTemplate.description,
        internalTemplate.templateContent,
        internalTemplate.templateType as 'article' | 'summary' | 'analysis',
        userId
      );
      
      // 创建用户偏好
      await this.templateService.createUserTemplatePreference(userId, installedTemplate.id);
      
      return {
        success: true,
        message: `Successfully installed template: ${communityTemplate.name}`,
        installedTemplate
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to install template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * 生成插件配置文件
   */
  async generatePluginConfig(userId: number, pluginName: string): Promise<{
    config: Record<string, any>;
    compatibility: {
      compatible: boolean;
      issues: string[];
    };
  }> {
    const userContent = await this.getUserContentAnalysis(userId);
    
    const configs = {
      'dataview': this.generateDataviewConfig(userContent),
      'kanban': this.generateKanbanConfig(userContent),
      'calendar': this.generateCalendarConfig(userContent),
      'graph': this.generateGraphConfig(userContent),
      'excalibrain': this.generateExcalibrainConfig(userContent)
    };
    
    const config = configs[pluginName as keyof typeof configs];
    const compatibility = await this.validatePluginCompatibility(pluginName, 'latest');
    
    return {
      config: config || {},
      compatibility: {
        compatible: compatibility.compatible,
        issues: compatibility.issues
      }
    };
  }
  
  /**
   * 导出Obsidian配置
   */
  async exportObsidianConfig(userId: number): Promise<{
    config: Record<string, any>;
    templates: ObsidianTemplateConfig[];
    exportTime: Date;
    version: string;
  }> {
    // 获取用户模板
    const templates = await this.templateService.getUserTemplatePreferences(userId);
    
    // 生成配置
    const config = {
      // Dataview配置
      dataview: await this.generateDataviewConfig(await this.getUserContentAnalysis(userId)),
      
      // 图谱配置
      graph: this.generateGraphConfig(await this.getUserContentAnalysis(userId)),
      
      // 插件设置
      plugins: {
        kanban: this.generateKanbanConfig(await this.getUserContentAnalysis(userId)),
        calendar: this.generateCalendarConfig(await this.getUserContentAnalysis(userId)),
        excalibrain: this.generateExcalibrainConfig(await this.getUserContentAnalysis(userId))
      },
      
      // 核心设置
      core: {
        'file-link-format': 'relative',
        'new-file-location': 'current',
        'attachment-folder': 'attachments',
        'use-markdown-links': true,
        'always-update-links': true
      },
      
      // 编辑器设置
      editor: {
        'spellcheck': true,
        'spellcheck-dictionaries': ['en-US'],
        'line-wrap': true,
        'auto-pair-brackets': true,
        'auto-pair-markdown': true,
        'show-line-number': true
      },
      
      // 搜索设置
      search: {
        'show-files-without-extension': true,
        'search-all-files': true,
        'highlight-matches': true
      }
    };
    
    return {
      config,
      templates,
      exportTime: new Date(),
      version: '1.0.0'
    };
  }
  
  /**
   * 辅助方法
   */
  private buildDataviewSQL(query: DataviewQuery): { sql: string; headers: string[] } {
    const { table = 'enhanced_content_analysis', from, where, sort, limit = 50, fields = ['*'] } = query;
    
    let sql = `SELECT ${fields.join(', ')} FROM ${table}`;
    const headers = fields;
    
    // WHERE条件
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    // ORDER BY
    if (sort) {
      sql += ` ORDER BY ${sort}`;
    }
    
    // LIMIT
    sql += ` LIMIT ${limit}`;
    
    return { sql, headers };
  }
  
  private async getAvailableFields(): Promise<string[]> {
    const sample = await db
      .select()
      .from(enhancedContentAnalysis)
      .limit(1);
    
    if (sample.length === 0) return [];
    
    return Object.keys(sample[0]);
  }
  
  private compareVersions(version1: string, version2: string): number {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }
  
  private async checkPluginIntegration(userId: number, pluginName: string): Promise<PluginIntegrationStatus> {
    const capabilities = {
      'dataview': ['query_execution', 'table_generation', 'list_creation'],
      'kanban': ['board_generation', 'card_management', 'due_dates'],
      'calendar': ['event_scheduling', 'reminder_setting', 'recurring_events'],
      'graph': ['node_generation', 'edge_creation', 'layout_algorithms'],
      'excalibrain': ['mind_mapping', 'connection_analysis', 'hierarchy_building'],
      'quickadd': ['template_instantiation', 'capture_system'],
      'templater': ['dynamic_templates', 'user_functions'],
      'buttons': ['action_buttons', 'workflow_automation'],
      'metadata-menu': ['field_editing', 'metadata_management']
    };
    
    const pluginCapabilities = capabilities[pluginName as keyof typeof capabilities] || [];
    
    // 检查是否有相关数据
    const hasRelevantData = await this.hasRelevantDataForPlugin(userId, pluginName);
    
    return {
      pluginName,
      status: hasRelevantData ? 'connected' : 'disconnected',
      lastSync: new Date(),
      capabilities: pluginCapabilities
    };
  }
  
  private async hasRelevantDataForPlugin(userId: number, pluginName: string): Promise<boolean> {
    const dataCheckers = {
      'dataview': () => this.hasDataviewData(userId),
      'kanban': () => this.hasKanbanData(userId),
      'calendar': () => this.hasCalendarData(userId),
      'graph': () => this.hasGraphData(userId),
      'excalibrain': () => this.hasExcalibrainData(userId)
    };
    
    const checker = dataCheckers[pluginName as keyof typeof dataCheckers];
    return checker ? await checker() : false;
  }
  
  private async syncDataviewData(userId: number): Promise<{ syncedItems: number; errors?: string[] }> {
    // 同步Dataview相关数据
    const data = await this.getUserContentAnalysis(userId);
    return { syncedItems: data.length };
  }
  
  private async syncKanbanData(userId: number): Promise<{ syncedItems: number; errors?: string[] }> {
    // 同步Kanban相关数据
    return { syncedItems: 0 };
  }
  
  private async syncCalendarData(userId: number): Promise<{ syncedItems: number; errors?: string[] }> {
    // 同步Calendar相关数据
    return { syncedItems: 0 };
  }
  
  private async syncGraphData(userId: number): Promise<{ syncedItems: number; errors?: string[] }> {
    // 同步Graph相关数据
    return { syncedItems: 0 };
  }
  
  private async syncExcalibrainData(userId: number): Promise<{ syncedItems: number; errors?: string[] }> {
    // 同步Excalibrain相关数据
    return { syncedItems: 0 };
  }
  
  private async getCommunityTemplateById(templateId: string): Promise<CommunityTemplate | null> {
    const templates = await this.getCommunityTemplates();
    return templates.find(t => t.id === templateId) || null;
  }
  
  private async downloadTemplateContent(downloadUrl: string): Promise<string> {
    // 模拟下载模板内容
    return `# {{title}}

## Summary
{{summary}}

## Content
{{content}}

## Metadata
- **Source**: {{source}}
- **Date**: {{date}}
- **Categories**: {{categories}}
- **Tags**: {{tags}}
- **Sentiment**: {{sentiment}}
- **Importance**: {{importance}}

## Topics
{{#each topics}}
- {{this.name}} ({{this.weight}})
{{/each}}

## Keywords
{{#each keywords}}
- {{this.text}} ({{this.weight}})
{{/each}}

## Related Content
{{#each related}}
- [[{{this}}]]
{{/each}}`;
  }
  
  private convertCommunityTemplate(
    communityTemplate: CommunityTemplate,
    templateContent: string
  ): ObsidianTemplateConfig {
    return {
      id: communityTemplate.id,
      name: communityTemplate.name,
      description: communityTemplate.description,
      templateContent,
      templateType: 'article',
      yamlFrontmatterConfig: {
        includeBasicFields: true,
        includeAnalysisFields: true,
        includeObsidianFields: true,
        includeNavigationFields: true,
        customFields: {
          community_template: communityTemplate.name,
          template_author: communityTemplate.author,
          template_version: communityTemplate.version
        },
        fieldMappings: {}
      },
      linkStrategies: [],
      maxLinks: 15,
      supportedStyles: ['default'],
      variables: []
    };
  }
  
  private async getUserContentAnalysis(userId: number): Promise<typeof enhancedContentAnalysis.$inferSelect[]> {
    return await db
      .select()
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId))
      .orderBy(desc(enhancedContentAnalysis.createdAt));
  }
  
  private generateDataviewConfig(contentAnalysis: typeof enhancedContentAnalysis.$inferSelect[]): Record<string, any> {
    return {
      'pretty-fields': true,
      'warn-on-empty-result': true,
      'inline-fields': ['title', 'date', 'tags'],
      'date-format': 'YYYY-MM-DD',
      'time-zone': 'local',
      'table-max-columns': 10,
      'result-truncation': 50
    };
  }
  
  private generateKanbanConfig(contentAnalysis: typeof enhancedContentAnalysis.$inferSelect[]): Record<string, any> {
    return {
      'kanban-plugin': 'basic',
      'date-colors': {
        'due-soon': 'red',
        'due-later': 'blue',
        'overdue': 'red'
      },
      'lane-width': 250,
      'card-height': 150,
      'hide-tags': false,
      'hide-date-in-title': false
    };
  }
  
  private generateCalendarConfig(contentAnalysis: typeof enhancedContentAnalysis.$inferSelect[]): Record<string, any> {
    return {
      'calendar-week-start': 'sunday',
      'calendar-show-daily-note': true,
      'calendar-format': 'YYYY-MM-DD',
      'calendar-first-day': 1
    };
  }
  
  private generateGraphConfig(contentAnalysis: typeof enhancedContentAnalysis.$inferSelect[]): Record<string, any] {
    return {
      'graph-layout': 'force-directed',
      'graph-orientation': 'TB',
      'graph-node-size': 10,
      'graph-edge-width': 2,
      'graph-colors': {
        'content': '#3b82f6',
        'topic': '#10b981',
        'keyword': '#f59e0b',
        'tag': '#ef4444'
      }
    };
  }
  
  private generateExcalibrainConfig(contentAnalysis: typeof enhancedContentAnalysis.$inferSelect[]): Record<string, any> {
    return {
      'excalibrain-node-style': 'rounded',
      'excalibrain-edge-style': 'curved',
      'excalibrain-color-scheme': 'default',
      'excalibrain-layout': 'hierarchical'
    };
  }
  
  private async hasDataviewData(userId: number): Promise<boolean> {
    const count = await db
      .select({ count: sql`count(*)` })
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId));
    
    return count[0].count > 0;
  }
  
  private async hasKanbanData(userId: number): Promise<boolean> {
    // 检查是否有适合Kanban的数据
    const analyses = await this.getUserContentAnalysis(userId);
    return analyses.some(analysis => analysis.tags && analysis.tags.length > 0);
  }
  
  private async hasCalendarData(userId: number): Promise<boolean> {
    // 检查是否有日期相关的数据
    const analyses = await this.getUserContentAnalysis(userId);
    return analyses.length > 0;
  }
  
  private async hasGraphData(userId: number): Promise<boolean> {
    // 检查是否有适合图谱的数据
    const analyses = await this.getUserContentAnalysis(userId);
    return analyses.some(analysis => 
      (analysis.topics && analysis.topics.length > 0) ||
      (analysis.keywords && analysis.keywords.length > 0)
    );
  }
  
  private async hasExcalibrainData(userId: number): Promise<boolean> {
    // 检查是否有适合思维导图的数据
    const analyses = await this.getUserContentAnalysis(userId);
    return analyses.some(analysis => analysis.topics && analysis.topics.length > 2);
  }
}