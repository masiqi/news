// 增强内容分析API路由
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection';
import { enhancedContentAnalysis } from '../db/schema';
import { EnhancedContentAnalyzer } from '../services/ai/enhanced-content-analyzer';
import { SmartLinkGenerator } from '../services/ai/smart-link-generator';
import { KnowledgeGraphService } from '../services/knowledge-graph.service';
import { ObsidianTemplateService } from '../services/obsidian-template.service';
import { ObsidianIntegrationService } from '../services/obsidian-integration.service';
import { 
  type EnhancedAnalysisResult,
  type LinkGenerationResult,
  type ContentRecommendation,
  type GraphVisualization,
  type DataviewQuery,
  type DataviewResult,
  type RecommendationRequest
} from '../config/obsidian.config';

const app = new Hono<{ Variables: { userId: string } }>();

// JWT中间件
app.use('*', jwt({ secret: process.env.JWT_SECRET || 'your-secret-key' }));

// 获取用户内容分析
app.get('/content-analysis', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { contentId, limit = 50 } = c.req.query();

    let query = db
      .select()
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId));

    if (contentId) {
      query = query.where(eq(enhancedContentAnalysis.contentId, parseInt(contentId)));
    }

    const analyses = await query
      .orderBy(desc(enhancedContentAnalysis.createdAt))
      .limit(parseInt(limit));

    return c.json({
      success: true,
      data: analyses,
      total: analyses.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 分析新内容
app.post('/analyze-content', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { title, content, sourceUrl, categories, tags } = await c.req.json();

    if (!title || !content) {
      return c.json({
        success: false,
        error: 'Title and content are required'
      }, 400);
    }

    const analyzer = new EnhancedContentAnalyzer();
    const result = await analyzer.analyzeContent(
      userId,
      0, // contentId 将在保存时生成
      title,
      content,
      sourceUrl,
      categories || [],
      tags || []
    );

    // 保存分析结果
    await db.insert(enhancedContentAnalysis).values({
      userId,
      contentId: 0, // 这里需要关联到实际的内容ID
      title,
      content,
      sourceUrl: sourceUrl || '',
      categories: JSON.stringify(result.categories),
      keywords: JSON.stringify(result.keywords),
      topics: JSON.stringify(result.topics),
      tags: JSON.stringify(result.tags),
      summary: result.summary,
      sentiment: JSON.stringify(result.sentiment),
      importance: result.importance,
      readability: result.readability,
      contentVector: JSON.stringify(result.contentVector),
      aiModel: result.aiModel,
      processingTime: result.processingTime,
      timelinePosition: result.timelinePosition,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({
      success: true,
      data: result,
      message: 'Content analyzed successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取相似内容
app.get('/similar-content/:contentId', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const contentId = parseInt(c.req.param('contentId'));
    const { limit = 5 } = c.req.query();

    const analyzer = new EnhancedContentAnalyzer();
    const similarContent = await analyzer.getSimilarContent(userId, contentId, parseInt(limit));

    return c.json({
      success: true,
      data: similarContent,
      total: similarContent.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 生成智能链接
app.post('/generate-links', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { contentId, analysis } = await c.req.json();

    if (!contentId || !analysis) {
      return c.json({
        success: false,
        error: 'ContentId and analysis are required'
      }, 400);
    }

    const linkGenerator = new SmartLinkGenerator();
    const result = await linkGenerator.generateSmartLinks(userId, analysis);

    return c.json({
      success: true,
      data: result,
      message: 'Smart links generated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取推荐内容
app.post('/recommendations', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const request: RecommendationRequest = await c.req.json();

    const graphService = new KnowledgeGraphService();
    const recommendations = await graphService.getRecommendations({
      ...request,
      userId
    });

    return c.json({
      success: true,
      data: recommendations,
      total: recommendations.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 渲染模板
app.post('/render-template', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { templateId, analysis, customConfig } = await c.req.json();

    if (!templateId || !analysis) {
      return c.json({
        success: false,
        error: 'TemplateId and analysis are required'
      }, 400);
    }

    const templateService = new ObsidianTemplateService();
    const context = {
      analysis,
      metadata: {
        contentId: analysis.contentId,
        userId,
        generatedAt: new Date(),
        templateId
      }
    };

    const result = await templateService.renderTemplate(templateId, context, customConfig);

    return c.json({
      success: true,
      data: result,
      message: 'Template rendered successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取用户模板
app.get('/templates', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const templateService = new ObsidianTemplateService();
    
    const templates = await templateService.getUserTemplatePreferences(userId);

    return c.json({
      success: true,
      data: templates,
      total: templates.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取知识图谱可视化
app.get('/knowledge-graph/visualization', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { centerNodeId, maxDepth, nodeTypes, edgeTypes } = c.req.query();

    const graphService = new KnowledgeGraphService();
    const visualization = await graphService.getGraphVisualization({
      userId,
      centerNodeId: centerNodeId as string,
      maxDepth: maxDepth ? parseInt(maxDepth) : undefined,
      nodeTypes: nodeTypes ? (nodeTypes as string).split(',') as any[] : undefined,
      edgeTypes: edgeTypes ? (edgeTypes as string).split(',') as any[] : undefined
    });

    return c.json({
      success: true,
      data: visualization,
      message: 'Graph visualization generated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 构建知识图谱
app.post('/knowledge-graph/build', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));

    const graphService = new KnowledgeGraphService();
    await graphService.buildKnowledgeGraph(userId);

    return c.json({
      success: true,
      message: 'Knowledge graph built successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Dataview查询
app.post('/dataview/query', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const query: DataviewQuery = await c.req.json();

    const integrationService = new ObsidianIntegrationService();
    const result = await integrationService.generateDataviewQuery(userId, query);

    return c.json({
      success: true,
      data: result,
      message: 'Dataview query executed successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取插件状态
app.get('/plugins/status', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));

    const integrationService = new ObsidianIntegrationService();
    const status = await integrationService.getPluginIntegrationStatus(userId);

    return c.json({
      success: true,
      data: status,
      total: status.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 同步插件数据
app.post('/plugins/:pluginName/sync', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const pluginName = c.req.param('pluginName');

    const integrationService = new ObsidianIntegrationService();
    const result = await integrationService.syncPluginData(userId, pluginName);

    return c.json({
      success: result.success,
      message: result.message,
      data: {
        syncedItems: result.syncedItems,
        errors: result.errors
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取社区模板
app.get('/community-templates', async (c) => {
  try {
    const { category, tags, rating, search, limit } = c.req.query();

    const integrationService = new ObsidianIntegrationService();
    const templates = await integrationService.getCommunityTemplates({
      category: category as string,
      tags: tags ? (tags as string).split(',') : undefined,
      rating: rating ? parseFloat(rating as string) : undefined,
      search: search as string,
      limit: limit ? parseInt(limit) : undefined
    });

    return c.json({
      success: true,
      data: templates,
      total: templates.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 安装社区模板
app.post('/community-templates/:templateId/install', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const templateId = c.req.param('templateId');

    const integrationService = new ObsidianIntegrationService();
    const result = await integrationService.installCommunityTemplate(userId, templateId);

    return c.json({
      success: result.success,
      message: result.message,
      data: result.installedTemplate
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 导出Obsidian配置
app.get('/export-config', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));

    const integrationService = new ObsidianIntegrationService();
    const config = await integrationService.exportObsidianConfig(userId);

    return c.json({
      success: true,
      data: config,
      message: 'Configuration exported successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 更新内容关系
app.post('/update-content-relations/:contentId', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const contentId = parseInt(c.req.param('contentId'));

    const graphService = new KnowledgeGraphService();
    await graphService.updateContentRelations(userId, contentId);

    return c.json({
      success: true,
      message: 'Content relations updated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 获取模板推荐
app.get('/templates/recommendations', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { contentId } = c.req.query();

    // 获取用户的分析内容用于推荐
    const [analysis] = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          contentId ? eq(enhancedContentAnalysis.contentId, parseInt(contentId as string)) : undefined
        )
      )
      .orderBy(desc(enhancedContentAnalysis.createdAt))
      .limit(1);

    if (!analysis) {
      return c.json({
        success: false,
        error: 'No content analysis found for recommendations'
      }, 404);
    }

    const templateService = new ObsidianTemplateService();
    const recommendations = await templateService.recommendTemplates(userId, analysis);

    return c.json({
      success: true,
      data: recommendations,
      total: recommendations.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 预览模板
app.post('/templates/:templateId/preview', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const templateId = c.req.param('templateId');
    const { analysis } = await c.req.json();

    if (!analysis) {
      return c.json({
        success: false,
        error: 'Analysis data is required for preview'
      }, 400);
    }

    const templateService = new ObsidianTemplateService();
    const preview = await templateService.previewTemplate(templateId, analysis);

    return c.json({
      success: true,
      data: preview,
      message: 'Template preview generated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 创建自定义模板
app.post('/templates/create', async (c) => {
  try {
    const userId = parseInt(c.get('userId'));
    const { name, description, templateContent, templateType } = await c.req.json();

    if (!name || !description || !templateContent || !templateType) {
      return c.json({
        success: false,
        error: 'All fields are required'
      }, 400);
    }

    const templateService = new ObsidianTemplateService();
    const template = await templateService.createCustomTemplate(
      name,
      description,
      templateContent,
      templateType,
      userId
    );

    return c.json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;