// src/services/cloudflare-llm.service.ts
import { LLMAnalysisResult, LLMProcessingParams } from './unified-llm.service';

// Cloudflare AI响应类型
interface CloudflareAIResponse {
  response: string;
}

/**
 * Cloudflare AI处理服务
 * 作为智谱GLM的备用方案
 */
export class CloudflareLLMService {
  
  /**
   * 使用Cloudflare的gpt-oss-20b模型进行内容分析
   */
  static async analyzeContent(params: LLMProcessingParams, env: any): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false } = params;
    const startTime = Date.now();

    console.log(`=== 开始Cloudflare AI分析，标题: ${title} ===`);
    console.log(`[INFO] 内容长度: ${content.length} 字符`);
    console.log(`[INFO] 内容类型: ${isHtml ? 'HTML格式' : '文本格式'}`);
    console.log(`[LINK] 来源链接: ${link || '无'}`);

    // 构建分析提示，与UnifiedLLMService保持一致
    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    console.log(`[LLM] 发送AI请求，模型: @cf/openai/gpt-oss-20b`);
    console.log(`[PROMPT] Prompt长度: ${prompt.length} 字符`);

    try {
      // 调用Cloudflare AI - 使用适合gpt-oss-20b的API格式
      const response = await env.AI.run('@cf/openai/gpt-oss-20b', {
        input: prompt,
        temperature: 0.3,
        max_tokens: 8000
      });

      const processingTime = Date.now() - startTime;
      console.log(`[TIME] AI分析完成，耗时: ${processingTime}ms`);

      // 检查响应状态
      if (!response) {
        console.error(`[ERROR] Cloudflare AI API调用失败: 无响应`);
        throw new Error('Cloudflare AI API调用失败: 无响应');
      }

      console.log(`[SUCCESS] AI API调用成功`);
      
      // 从Cloudflare AI响应结构中提取JSON文本
      let resultText = null;
      
      // 检查响应结构并提取JSON
      if (response.output && response.output.length > 1) {
        // output[1] 包含assistant的回复
        const assistantMessage = response.output[1];
        if (assistantMessage.content && assistantMessage.content.length > 0) {
          resultText = assistantMessage.content[0].text;
        }
      }
      
      console.log(`[RESPONSE] AI原始响应长度: ${resultText ? resultText.length : 'undefined'} 字符`);
      
      if (!resultText) {
        console.error(`[ERROR] Cloudflare AI响应格式异常，无法获取结果文本`);
        console.error(`[ERROR] 响应对象:`, JSON.stringify(response, null, 2));
        throw new Error('Cloudflare AI响应格式异常');
      }

      // 解析AI返回结果
      console.log(`[PARSE] 尝试从AI响应中提取JSON...`);
      const result = this.parseAIResult(resultText);

      console.log(`[SUCCESS] JSON解析成功，返回结果`);
      return {
        ...result,
        processingTime,
        modelUsed: 'gpt-oss-20b'
      };
    } catch (error) {
      console.error(`[ERROR] Cloudflare AI处理失败: ${error}`);
      throw error;
    }
  }

  /**
   * 构建分析提示词 - 与GLM保持一致
   */
  private static buildAnalysisPrompt(title: string, content: string, isHtml: boolean): string {
    console.log('[PROMPT] Building Cloudflare analysis prompt, HTML mode: ' + isHtml + ', content length: ' + content.length);
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

  /**
   * 解析AI返回结果，与UnifiedLLMService保持一致
   */
  private static parseAIResult(resultText: string): LLMAnalysisResult {
    console.log(`[PARSE] 开始解析Cloudflare AI响应，原始长度: ${resultText.length}`);
    console.log('[DEBUG] ===== CLOUDFLARE AI COMPLETE RESPONSE START =====');
    console.log(resultText);
    console.log('[DEBUG] ===== CLOUDFLARE AI COMPLETE RESPONSE END =====');

    // 1. 尝试直接解析JSON
    try {
      const parsed = JSON.parse(resultText);
      console.log(`[SUCCESS] 直接JSON解析成功`);
      return {
        topics: parsed.topics || [],
        keywords: parsed.keywords || [],
        sentiment: parsed.sentiment || 'neutral',
        analysis: parsed.analysis || '',
        educationalValue: parsed.educationalValue || '',
        extractedContent: parsed.extractedContent || '',
        images: parsed.images || [],
        wordCounts: {
          analysis: (parsed.analysis || '').length,
          educationalValue: (parsed.educationalValue || '').length,
          extractedContent: (parsed.extractedContent || '').length
        }
      };
    } catch (directParseError) {
      console.log(`[INFO] 直接JSON解析失败，尝试提取JSON部分`);
    }

    // 2. 尝试从响应中提取JSON部分
    let jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[ERROR] 响应中未找到JSON格式`);
      throw new Error('AI响应中未找到有效的JSON格式');
    }

    console.log(`[SUCCESS] 找到JSON格式响应，开始解析`);
    let cleanJson = jsonMatch[0];
    console.log('[CLEAN] Cleaned JSON: ' + cleanJson.substring(0, 200) + '...');
    
    // 3. 清理JSON字符串 - 使用与GLM相同的清理逻辑
    cleanJson = this.cleanJsonString(cleanJson);
    console.log('[CLEAN] JSON cleaning completed, cleaned length: ' + cleanJson.length);
    
    // 4. 解析清理后的JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('[ERROR] JSON parsing failed: ' + parseError);
      throw new Error('AI returned JSON format invalid and cannot be auto-fixed: ' + parseError);
    }

    if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.keywords) || !parsed.sentiment) {
      console.error('[ERROR] AI analysis result missing required fields');
      throw new Error('AI analysis result incomplete');
    }

    console.log('[RESULT] Cloudflare AI parsing result:');
    console.log('   - Topics (' + parsed.topics.length + '): ' + parsed.topics.join(', '));
    console.log('   - Keywords (' + parsed.keywords.length + '): ' + parsed.keywords.join(', '));
    console.log('   - Sentiment: ' + parsed.sentiment);

    return {
      topics: parsed.topics.slice(0, 5),
      keywords: parsed.keywords.slice(0, 10),
      sentiment: parsed.sentiment,
      analysis: parsed.analysis || '',
      educationalValue: parsed.educationalValue || '',
      extractedContent: parsed.extractedContent || '',
      images: parsed.images || [],
      wordCounts: {
        analysis: (parsed.analysis || '').length,
        educationalValue: (parsed.educationalValue || '').length,
        extractedContent: (parsed.extractedContent || '').length
      }
    };
  }

  /**
   * 清理JSON字符串 - 与GLM服务完全一致
   */
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
}