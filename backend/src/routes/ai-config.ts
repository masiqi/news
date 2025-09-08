// src/routes/ai-config.ts
import { Hono } from "hono";
import { AIProcessingConfig, AIModelSelection } from "../services/ai/types";
import { AIConfigService } from "../services/config/ai-config.service";
import { TemplateService } from "../services/templates/template.service";
import { ContentAnalyzerService } from "../services/ai/content-analyzer";
import { MarkdownGenerator } from "../services/ai/markdown-generator";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

const aiConfigRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

/**
 * 获取用户AI配置
 */
aiConfigRoutes.get("/config", async (c) => {
  try {
    const userId = c.req.query("userId");
    
    if (!userId) {
      return c.json({ error: "请提供userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    const config = await configService.getUserConfig(userId);
    
    return c.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error("获取用户AI配置失败:", error);
    return c.json({ 
      error: "获取用户AI配置失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 更新用户AI配置
 */
aiConfigRoutes.put("/config", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, config } = body;
    
    if (!userId || !config) {
      return c.json({ error: "请提供userId和config" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    await configService.updateUserConfig(userId, config);
    
    return c.json({
      success: true,
      message: "用户AI配置更新成功"
    });
    
  } catch (error) {
    console.error("更新用户AI配置失败:", error);
    return c.json({ 
      error: "更新用户AI配置失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 获取用户模型选择
 */
aiConfigRoutes.get("/model-selection", async (c) => {
  try {
    const userId = c.req.query("userId");
    
    if (!userId) {
      return c.json({ error: "请提供userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    const modelSelection = await configService.getUserModelSelection(userId);
    
    return c.json({
      success: true,
      data: modelSelection
    });
    
  } catch (error) {
    console.error("获取用户模型选择失败:", error);
    return c.json({ 
      error: "获取用户模型选择失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 更新用户模型选择
 */
aiConfigRoutes.put("/model-selection", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, modelSelection } = body;
    
    if (!userId || !modelSelection) {
      return c.json({ error: "请提供userId和modelSelection" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    await configService.updateUserModelSelection(userId, modelSelection);
    
    return c.json({
      success: true,
      message: "用户模型选择更新成功"
    });
    
  } catch (error) {
    console.error("更新用户模型选择失败:", error);
    return c.json({ 
      error: "更新用户模型选择失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 获取可用模型列表
 */
aiConfigRoutes.get("/available-models", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    const models = await configService.getAvailableModels();
    
    return c.json({
      success: true,
      data: models
    });
    
  } catch (error) {
    console.error("获取可用模型列表失败:", error);
    return c.json({ 
      error: "获取可用模型列表失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 重置用户配置为默认值
 */
aiConfigRoutes.post("/reset-config", async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;
    
    if (!userId) {
      return c.json({ error: "请提供userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    await configService.resetToDefault(userId);
    
    return c.json({
      success: true,
      message: "用户配置已重置为默认值"
    });
    
  } catch (error) {
    console.error("重置用户配置失败:", error);
    return c.json({ 
      error: "重置用户配置失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 模板相关路由
 */

/**
 * 获取用户可用模板
 */
aiConfigRoutes.get("/templates", async (c) => {
  try {
    const userId = c.req.query("userId");
    
    if (!userId) {
      return c.json({ error: "请提供userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    
    const templates = await templateService.getAvailableTemplates(userId);
    
    return c.json({
      success: true,
      data: templates
    });
    
  } catch (error) {
    console.error("获取用户模板失败:", error);
    return c.json({ 
      error: "获取用户模板失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 创建自定义模板
 */
aiConfigRoutes.post("/templates", async (c) => {
  try {
    const body = await c.req.json();
    const { template } = body;
    
    if (!template) {
      return c.json({ error: "请提供template" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    
    const newTemplate = await templateService.createCustomTemplate(template);
    
    return c.json({
      success: true,
      message: "自定义模板创建成功",
      data: newTemplate
    });
    
  } catch (error) {
    console.error("创建自定义模板失败:", error);
    return c.json({ 
      error: "创建自定义模板失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 更新模板
 */
aiConfigRoutes.put("/templates/:templateId", async (c) => {
  try {
    const templateId = c.req.param("templateId");
    const body = await c.req.json();
    const { updates } = body;
    
    if (!templateId || !updates) {
      return c.json({ error: "请提供templateId和updates" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    
    await templateService.updateTemplate(templateId, updates);
    
    return c.json({
      success: true,
      message: "模板更新成功"
    });
    
  } catch (error) {
    console.error("更新模板失败:", error);
    return c.json({ 
      error: "更新模板失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 删除模板
 */
aiConfigRoutes.delete("/templates/:templateId", async (c) => {
  try {
    const templateId = c.req.param("templateId");
    
    if (!templateId) {
      return c.json({ error: "请提供templateId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    
    await templateService.deleteTemplate(templateId);
    
    return c.json({
      success: true,
      message: "模板删除成功"
    });
    
  } catch (error) {
    console.error("删除模板失败:", error);
    return c.json({ 
      error: "删除模板失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 设置用户默认模板
 */
aiConfigRoutes.post("/templates/default", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, templateId } = body;
    
    if (!userId || !templateId) {
      return c.json({ error: "请提供userId和templateId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    
    await templateService.setDefaultTemplate(userId, templateId);
    
    return c.json({
      success: true,
      message: "用户默认模板设置成功"
    });
    
  } catch (error) {
    console.error("设置用户默认模板失败:", error);
    return c.json({ 
      error: "设置用户默认模板失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 内容分析测试端点
 */
aiConfigRoutes.post("/analyze-test", async (c) => {
  try {
    const body = await c.req.json();
    const { content, title, userId, config } = body;
    
    if (!content || !title || !userId) {
      return c.json({ error: "请提供content, title和userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    const analyzerService = new ContentAnalyzerService();
    
    // 使用提供的配置或获取默认配置
    let aiConfig: AIProcessingConfig;
    if (config) {
      aiConfig = config;
    } else {
      aiConfig = await configService.getUserConfig(userId);
    }
    
    console.log(`开始内容分析测试: ${title}`);
    const startTime = Date.now();
    
    const result = await analyzerService.analyzeContent({
      content,
      title,
      config: aiConfig
    });
    
    const processingTime = Date.now() - startTime;
    
    return c.json({
      success: true,
      message: "内容分析测试成功",
      data: {
        ...result,
        processingTime,
        testDuration: processingTime
      }
    });
    
  } catch (error) {
    console.error("内容分析测试失败:", error);
    return c.json({ 
      error: "内容分析测试失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * Markdown生成测试端点
 */
aiConfigRoutes.post("/markdown-test", async (c) => {
  try {
    const body = await c.req.json();
    const { result, config, templateId } = body;
    
    if (!result || !config) {
      return c.json({ error: "请提供result和config" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    const markdownGenerator = new MarkdownGenerator(templateService);
    
    console.log(`开始Markdown生成测试: ${result.title}`);
    const startTime = Date.now();
    
    const markdown = await markdownGenerator.generateDocument({
      result,
      config,
      templateId
    });
    
    const processingTime = Date.now() - startTime;
    
    return c.json({
      success: true,
      message: "Markdown生成测试成功",
      data: {
        markdown,
        markdownLength: markdown.length,
        processingTime,
        testDuration: processingTime
      }
    });
    
  } catch (error) {
    console.error("Markdown生成测试失败:", error);
    return c.json({ 
      error: "Markdown生成测试失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 验证配置有效性
 */
aiConfigRoutes.post("/validate-config", async (c) => {
  try {
    const body = await c.req.json();
    const { config } = body;
    
    if (!config) {
      return c.json({ error: "请提供config" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    const isValid = await configService.validateConfig(config);
    
    return c.json({
      success: true,
      data: {
        isValid,
        config
      }
    });
    
  } catch (error) {
    console.error("验证配置失败:", error);
    return c.json({ 
      error: "验证配置失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 获取推荐配置
 */
aiConfigRoutes.get("/recommended-config", async (c) => {
  try {
    const userId = c.req.query("userId");
    
    if (!userId) {
      return c.json({ error: "请提供userId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const configService = new AIConfigService(db);
    
    const recommendedConfig = await configService.getRecommendedConfig(userId);
    
    return c.json({
      success: true,
      data: recommendedConfig
    });
    
  } catch (error) {
    console.error("获取推荐配置失败:", error);
    return c.json({ 
      error: "获取推荐配置失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

/**
 * 模板预览端点
 */
aiConfigRoutes.post("/template-preview", async (c) => {
  try {
    const body = await c.req.json();
    const { templateId, sampleData } = body;
    
    if (!templateId) {
      return c.json({ error: "请提供templateId" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const templateService = new TemplateService(db);
    const markdownGenerator = new MarkdownGenerator(templateService);
    
    const template = await templateService.getTemplateById(templateId);
    if (!template) {
      return c.json({ error: "模板不存在" }, 404);
    }
    
    const preview = markdownGenerator.previewTemplate(
      template.template,
      sampleData || {
        TITLE: "示例标题",
        SUMMARY: "这是一个示例摘要",
        CONTENT: "这是示例内容，用于展示模板的渲染效果。",
        KEYWORDS: "示例,关键词",
        CATEGORIES: "示例,分类",
        SENTIMENT: "中性",
        IMPORTANCE: 3,
        READABILITY: 4,
        PROCESSING_TIME: "1500ms",
        AI_TOKENS_USED: "1200",
        STATUS: "completed",
        AI_MODEL: "glm-4.5-flash",
        AI_PROVIDER: "zhipu",
        DATE: new Date().toISOString().split('T')[0]
      }
    );
    
    return c.json({
      success: true,
      message: "模板预览生成成功",
      data: {
        templateId,
        templateName: template.name,
        preview,
        previewLength: preview.length
      }
    });
    
  } catch (error) {
    console.error("生成模板预览失败:", error);
    return c.json({ 
      error: "生成模板预览失败", 
      details: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

export default aiConfigRoutes;