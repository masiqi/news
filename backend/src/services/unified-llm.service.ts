// src/services/unified-llm.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { CloudflareLLMService } from './cloudflare-llm.service';
import { OpenRouterService } from './openrouter.service';
import { CerebrasService } from './cerebras.service';

export interface LLMAnalysisResult {
  topics: string[];
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  analysis: string;
  educationalValue: string;
  extractedContent: string;
  images: string[];
  processingTime: number;
  modelUsed: string;
  wordCounts?: {
    analysis: number;
    educationalValue: number;
    extractedContent: number;
  };
}

export interface LLMProcessingParams {
  title: string;
  content: string;
  link?: string;
  isHtml?: boolean;
  apiKey?: string;
  provider?: 'glm' | 'openrouter' | 'cloudflare' | 'cerebras' | 'auto';
  openRouterKey?: string;
  cerebrasKey?: string;
  enableFallback?: boolean;
}

export class UnifiedLLMService {
  
  static async analyzeContent(params: LLMProcessingParams, env?: any): Promise<LLMAnalysisResult> {
    const { 
      title, 
      content, 
      link, 
      isHtml = false, 
      apiKey, 
      provider = 'auto', 
      openRouterKey,
      enableFallback = true 
    } = params;
    const startTime = Date.now();

    console.log('=== Starting unified LLM analysis, title: ' + title + ' ===');
    console.log('[INFO] Content length: ' + content.length + ' chars');
    console.log('[PROCESS] Content type: ' + (isHtml ? 'HTML format' : 'Text format'));
    console.log('[LINK] Source link: ' + (link || 'None'));
    console.log('[PROVIDER] LLM provider strategy: ' + provider);
    console.log('[FALLBACK] Fallback enabled: ' + enableFallback);

    // 定义三级处理策略
    const strategies = this.getProcessingStrategies(provider, enableFallback);
    
    let lastError: Error | null = null;
    
    // 按顺序尝试每个策略
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      console.log(`[STRATEGY ${i + 1}/${strategies.length}] Trying ${strategy.name}...`);
      
      try {
        const result = await this.executeStrategy(strategy, params, env);
        console.log(`[SUCCESS] ${strategy.name} analysis completed successfully`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[ERROR] ${strategy.name} failed:`, error instanceof Error ? error.message : error);
        
        if (i < strategies.length - 1) {
          console.log(`[FALLBACK] Moving to next strategy...`);
        } else {
          console.log(`[ERROR] All strategies failed`);
        }
      }
    }
    
    // 所有策略都失败了
    throw lastError || new Error('All LLM processing strategies failed');
  }

  private static getProcessingStrategies(provider: string, enableFallback: boolean): Array<{
    name: string;
    execute: (params: LLMProcessingParams, env?: any) => Promise<LLMAnalysisResult>;
  }> {
    const strategies: Array<{
      name: string;
      execute: (params: LLMProcessingParams, env?: any) => Promise<LLMAnalysisResult>;
    }> = [];

    // 根据provider策略决定执行顺序
    switch (provider) {
      case 'cerebras':
        strategies.push({
          name: 'Cerebras Qwen 3 235B',
          execute: (params, env) => {
            const cerebrasKey = env?.CEREBRAS_API_KEY || params.cerebrasKey;
            if (!cerebrasKey) throw new Error('Cerebras API key required');
            return CerebrasService.analyzeContent({
              title: params.title,
              content: params.content,
              link: params.link,
              isHtml: params.isHtml,
              apiKey: cerebrasKey
            }, env);
          }
        });
        break;

      case 'glm':
        strategies.push({
          name: 'GLM (智谱AI)',
          execute: (params) => this.analyzeWithGLM(params)
        });
        break;

      case 'openrouter':
        strategies.push({
          name: 'OpenRouter GLM',
          execute: (params, env) => {
            const openRouterKey = env?.OPENROUTER_API_KEY || params.openRouterKey;
            if (!openRouterKey) throw new Error('OpenRouter API key required');
            return OpenRouterService.analyzeContent({
              ...params,
              apiKey: openRouterKey
            }, 'z-ai/glm-4.5-air:free');
          }
        });
        break;

      case 'cloudflare':
        strategies.push({
          name: 'Cloudflare AI',
          execute: (params, env) => {
            if (!env) throw new Error('Cloudflare environment required');
            return CloudflareLLMService.analyzeContent(params, env);
          }
        });
        break;

      case 'auto':
      default:
        // 四级处理：Cerebras → 智谱 → OpenRouter → Cloudflare
        strategies.push({
          name: 'Cerebras Qwen 3 235B',
          execute: (params, env) => {
            const cerebrasKey = env?.CEREBRAS_API_KEY;
            if (!cerebrasKey) throw new Error('Cerebras API key required');
            return CerebrasService.analyzeContent({
              title: params.title,
              content: params.content,
              link: params.link,
              isHtml: params.isHtml,
              apiKey: cerebrasKey
            }, env);
          }
        });

        if (enableFallback) {
          strategies.push({
            name: 'GLM (智谱AI - 备用)',
            execute: (params) => this.analyzeWithGLM(params)
          });

          strategies.push({
            name: 'OpenRouter GLM (备用)',
            execute: (params, env) => {
              const openRouterKey = env?.OPENROUTER_API_KEY;
              if (!openRouterKey) throw new Error('OpenRouter API key required');
              return OpenRouterService.analyzeContent({
                ...params,
                apiKey: openRouterKey
              }, 'z-ai/glm-4.5-air:free');
            }
          });

          strategies.push({
            name: 'Cloudflare AI (最终备用)',
            execute: (params, env) => {
              if (!env) throw new Error('Cloudflare environment required');
              return CloudflareLLMService.analyzeContent(params, env);
            }
          });
        }
        break;
    }

    return strategies;
  }

  private static async executeStrategy(
    strategy: { 
      name: string; 
      execute: (params: LLMProcessingParams, env?: any) => Promise<LLMAnalysisResult>; 
    },
    params: LLMProcessingParams,
    env?: any
  ): Promise<LLMAnalysisResult> {
    console.log(`[EXECUTE] Starting ${strategy.name} analysis...`);
    
    // 调试：输出环境变量信息
    if (strategy.name.includes('OpenRouter')) {
      console.log(`[DEBUG] OpenRouter environment check:`);
      console.log(`  - env.OPENROUTER_API_KEY: ${env?.OPENROUTER_API_KEY ? 'Set (' + env.OPENROUTER_API_KEY.substring(0, 8) + '...)' : 'Not set'}`);
      console.log(`  - params.openRouterKey: ${params.openRouterKey ? 'Set (' + params.openRouterKey.substring(0, 8) + '...)' : 'Not set'}`);
      console.log(`  - env object keys: ${env ? Object.keys(env).join(', ') : 'No env object'}`);
    }
    
    const result = await strategy.execute(params, env);
    console.log(`[COMPLETE] ${strategy.name} analysis successful`);
    return result;
  }

  private static async analyzeWithGLM(params: LLMProcessingParams): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey } = params;
    const startTime = Date.now();

    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    const aiRequest = {
      model: 'glm-4.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a professional news content analysis expert. Please return results in strict JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 8000,
      stream: false
    };

    console.log('[AI] Sending AI request, model: glm-4.5-flash');
    console.log('[PROMPT] Prompt length: ' + prompt.length + ' chars');

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(aiRequest)
    });

    const processingTime = Date.now() - startTime;
    console.log('[TIME] AI analysis completed, elapsed time: ' + processingTime + 'ms');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ERROR] GLM API call failed: HTTP ' + response.status);
      throw new Error('AI service call failed: HTTP ' + response.status + ' - ' + errorText);
    }

    const responseData = await response.json();
    console.log('[SUCCESS] AI API call successful, status code: ' + response.status);

    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error('[ERROR] GLM response format incorrect: ' + JSON.stringify(responseData));
      throw new Error('AI response format invalid');
    }

    const resultText = responseData.choices[0].message.content;
    console.log('[PROMPT] AI raw response length: ' + resultText.length + ' chars');
    console.log('[DEBUG] ===== AI COMPLETE RESPONSE START =====');
    console.log(resultText);
    console.log('[DEBUG] ===== AI COMPLETE RESPONSE END =====');
    
    console.log('[PARSE] Trying to extract JSON from AI response...');
    
    let jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ERROR] AI returned result format invalid');
      throw new Error('AI analysis result format invalid');
    }

    console.log('[SUCCESS] Found JSON format response, starting parse');
    let parsed;
    try {
      const cleanJson = this.cleanJsonString(jsonMatch[0]);
      console.log('[CLEAN] Cleaned JSON: ' + cleanJson.substring(0, 200) + '...');
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('[ERROR] JSON parsing failed: ' + parseError);
      throw new Error('AI returned JSON format invalid and cannot be auto-fixed: ' + parseError);
    }

    if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.keywords) || !parsed.sentiment) {
      console.error('[ERROR] AI analysis result missing required fields');
      throw new Error('AI analysis result incomplete');
    }

    console.log('[RESULT] AI parsing result:');
    console.log('   - Topics (' + parsed.topics.length + '): ' + parsed.topics.join(', '));
    console.log('   - Keywords (' + parsed.keywords.length + '): ' + parsed.keywords.join(', '));
    console.log('   - Sentiment: ' + parsed.sentiment);

    const result = {
      topics: parsed.topics.slice(0, 5),
      keywords: parsed.keywords.slice(0, 10),
      sentiment: parsed.sentiment,
      analysis: parsed.analysis || '',
      educationalValue: parsed.educationalValue || '',
      extractedContent: parsed.extractedContent || '',
      images: parsed.images || [],
      processingTime,
      modelUsed: 'glm-4.5-flash',
      wordCounts: {
        analysis: (parsed.analysis || '').length,
        educationalValue: (parsed.educationalValue || '').length,
        extractedContent: (parsed.extractedContent || '').length
      }
    };

    return result;
  }

  private static buildAnalysisPrompt(title: string, content: string, isHtml: boolean): string {
    console.log('[PROMPT] Building analysis prompt, HTML mode: ' + isHtml + ', content length: ' + content.length);
    if (isHtml) {
      console.log('[PROMPT] Raw HTML first 500 chars: ' + content.substring(0, 500));
    }
    console.log('[PROMPT] Title: ' + title);
    console.log('[PROMPT] Content length: ' + content.length + ' chars');
    console.log('[PROMPT] Content source: ' + (isHtml ? 'Web scraping' : 'RSS original'));
    
    return `你是一个专业的新闻内容分析专家，擅长从HTML页面中提取和解析新闻内容。请对以下中文新闻内容进行全面分析。

新闻标题：${title}
${isHtml ? '新闻原文（HTML格式）：' : '新闻原文（RSS摘要）：'}
${content}

${isHtml ? `
重要说明：
1. 上述内容是HTML格式的原始网页，请忽略HTML标签、广告、导航等无关内容
2. 重点提取新闻正文部分，特别是完整的问答内容
3. 如果是记者问答形式，请确保包含问题和完整的回答部分
` : ''}

请严格按照以下JSON格式返回分析结果，不要添加任何额外的文本、注释或格式：

{"topics": ["主题1", "主题2", "主题3"], "keywords": ["关键词1", "关键词2", "关键词3"], "sentiment": "positive|negative|neutral", "analysis": "深度分析内容...", "educationalValue": "教育价值评估...", "extractedContent": "提取的完整新闻内容（如果有）", "images": ["图片URL1", "图片URL2"]}

注意：
1. topics: 3-5个核心主题，每个主题2-6个字
2. keywords: 8-15个重要关键词（包括重要人名、地名、机构名、专业术语等）
3. sentiment: 只能是positive、negative或neutral中的一个
4. analysis: 200-300字的深度分析，解读新闻的背景、意义、影响和相关背景
5. educationalValue: 100-200字评估，说明对高中生的教育意义和学习价值，包括相关知识点
6. extractedContent: 如果从HTML中提取到了比文本更完整的新闻内容，请提供清理后的完整文本（保持段落结构）
7. images: 从HTML中提取的所有图片URL数组（包括新闻配图、图表等所有相关图片）

重要要求：
1. **JSON格式必须完全有效**：确保返回的JSON可以被直接解析，不要包含任何语法错误
2. **引号处理**：如果在analysis、educationalValue或extractedContent字段中需要引用原文的引号内容，请正确转义为\\"，例如："原子能法强调\\"和平利用\\"原则"
3. 不要在JSON中包含换行符或制表符，保持单行格式
4. 不要添加注释或说明文字，只返回纯JSON
5. ${isHtml ? '请仔细解析HTML，提取完整的新闻内容，特别是长篇文章、问答形式或系列报道' : '请基于提供的文本内容进行分析'}
6. 支持长篇文章分析，不要因内容长度而丢失重要信息
7. **图片Markdown格式**：${isHtml ? '如果在HTML中发现图片标签（<img src="...">），请在extractedContent中将图片标签转换为Markdown格式![图片描述](图片URL)，确保图片在文章的正确位置显示。同时也要将图片URL收集到images数组中' : '如果原文中有图片信息，请在extractedContent中在相应位置添加Markdown格式图片![图片](图片URL)'}
8. 请确保你返回的JSON格式100%正确，避免任何解析错误`;
  }

  private static cleanJsonString(jsonStr: string): string {
    console.log('[CLEAN] Cleaning JSON string, original length: ' + jsonStr.length);
    
    let cleaned = jsonStr;
    
    // Only remove control characters that could break JSON parsing
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Fix Chinese quotes (only if they're not already properly escaped)
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/[""]/g, '"');
    
    // Fix trailing commas in objects and arrays
    cleaned = cleaned.replace(/,\s*}/g, '}')
                   .replace(/,\s*]/g, ']');
    
    // Remove BOM
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();
    
    console.log('[CLEAN] JSON cleaning completed, cleaned length: ' + cleaned.length);
    console.log('[CLEAN] Cleaned JSON preview: ' + cleaned.substring(0, 200) + '...');
    
    return cleaned;
  }

  static async analyzeAndSave(params: LLMProcessingParams & { db: any, env?: any }): Promise<LLMAnalysisResult> {
    const { entryId, db, env, ...analysisParams } = params;
    
    const result = await this.analyzeContent(analysisParams, env);
    
    if (entryId) {
      await this.saveAnalysisResult(entryId, result, db);
      await this.updateEntryStatus(entryId, db);
    }
    
    return result;
  }

  private static async saveAnalysisResult(entryId: number, result: LLMAnalysisResult, db: any): Promise<void> {
    console.log('[SAVE] Saving analysis result to database, entry ID: ' + entryId);

    const topicsJson = JSON.stringify(result.topics);
    const keywordsString = result.keywords.join(',');
    const imagesJson = result.images && result.images.length > 0 ? JSON.stringify(result.images) : null;
    const finalMarkdownContent = this.generateMarkdownWithImages(result.extractedContent || result.analysis, result.images);

    console.log('[CONTENT] Final content length: ' + finalMarkdownContent.length + ' chars');
    console.log('[IMAGES] Found ' + result.images.length + ' images');

    const existingRecord = await db
      .select()
      .from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .get();

    console.log('[INFO] Database record check - entry ID: ' + entryId + ', ' + (existingRecord ? 'found existing record' : 'need new record'));

    if (existingRecord) {
      console.log('[PROCESS] Updating existing processed_contents record');
      await db.update(processedContents)
        .set({
          markdownContent: finalMarkdownContent,
          topics: topicsJson,
          keywords: keywordsString,
          images: imagesJson,
          sentiment: result.sentiment,
          analysis: result.analysis,
          educationalValue: result.educationalValue,
          processingTime: result.processingTime,
          modelUsed: result.modelUsed,
          updatedAt: new Date()
        })
        .where(eq(processedContents.entryId, entryId));
      
      console.log('[SUCCESS] AI analysis result updated, entry ID: ' + entryId);
    } else {
      console.log('[NEW] Creating new processed_contents record');
      await db.insert(processedContents)
        .values({
          entryId: entryId,
          summary: finalMarkdownContent.substring(0, 500),
          markdownContent: finalMarkdownContent,
          topics: topicsJson,
          keywords: keywordsString,
          images: imagesJson,
          sentiment: result.sentiment,
          analysis: result.analysis,
          educationalValue: result.educationalValue,
          processingTime: result.processingTime,
          modelUsed: result.modelUsed,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      console.log('[SUCCESS] AI analysis result created, entry ID: ' + entryId);
    }
  }

  private static async updateEntryStatus(entryId: number, db: any): Promise<void> {
    console.log('[PROCESS] Updating RSS entry status, entry ID: ' + entryId);
    
    await db.update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date(),
        failureCount: 0,
        errorMessage: null
      })
      .where(eq(rssEntries.id, entryId));
    
    console.log('[SUCCESS] RSS entry status updated, entry ID: ' + entryId);
  }

  static async extractTopics(title: string, content: string, apiKey: string, env?: any): Promise<{ topics: string[]; keywords: string[] }> {
    const result = await this.analyzeContent({
      title,
      content,
      apiKey
    }, env);
    
    return {
      topics: result.topics,
      keywords: result.keywords
    };
  }

  static generateMarkdownWithImages(content: string, images: string[]): string {
    if (!images || images.length === 0) {
      return content;
    }
    
    console.log('[IMAGES] Processing markdown with images, count: ' + images.length);
    
    // 检查内容中是否已经包含Markdown格式图片
    const hasMarkdownImages = content.includes('![');
    
    if (hasMarkdownImages) {
      console.log('[IMAGES] Content already has markdown images, using as-is');
      return content;
    }
    
    // 如果没有Markdown图片，检查是否有需要补充的图片
    let finalContent = content;
    
    // 检查是否有图片占位符需要替换
    const imagePlaceholders = content.match(/\[图片[^\]]*\]/g);
    
    if (imagePlaceholders && imagePlaceholders.length > 0) {
      console.log('[IMAGES] Found image placeholders, replacing with actual images');
      
      // 替换占位符为实际图片
      imagePlaceholders.forEach((placeholder, index) => {
        if (images[index]) {
          finalContent = finalContent.replace(placeholder, `![${placeholder.replace(/[\[\]]/g, '')}](${images[index]})`);
        }
      });
    } else {
      // 如果没有占位符但有图片，在开头添加图片区域
      console.log('[IMAGES] No placeholders found, adding images at top');
      
      let markdown = '';
      
      // 如果有图片，先展示图片
      if (images.length > 0) {
        markdown += '\n## 📷 相关图片\n\n';
        images.forEach((imageUrl, index) => {
          markdown += `![图片${index + 1}](${imageUrl})\n\n`;
        });
      }
      
      // 添加原始内容
      markdown += '\n## 📰 新闻内容\n\n';
      markdown += content;
      
      console.log('[IMAGES] Added images at top, final length: ' + markdown.length);
      return markdown;
    }
    
    console.log('[IMAGES] Markdown processing completed, final length: ' + finalContent.length);
    return finalContent;
  }

  static generateMarkdownSummary(result: LLMAnalysisResult, title: string, html?: string): any {
    return {
      title,
      content: result.extractedContent || html,
      summary: result.analysis.substring(0, 200),
      extractedContent: result.extractedContent
    };
  }
}