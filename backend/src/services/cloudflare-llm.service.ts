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
   * 构建分析提示词
   */
  private static buildAnalysisPrompt(title: string, content: string, isHtml: boolean): string {
    return `请分析以下新闻内容，返回JSON格式的分析结果。

新闻标题：${title}

新闻内容：
${content}

请按照以下JSON格式返回分析结果：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sentiment": "positive/negative/neutral",
  "analysis": "深度分析内容...",
  "educationalValue": "教育价值说明...",
  "extractedContent": "提取的核心内容..."
}

要求：
1. 分析要深入，不要只做表面描述
2. 识别出真正的主题和关键词，不要重复标题内容
3. 情感分析要准确，考虑内容的实际含义
4. 提供有深度的分析和见解
5. 重点关注教育价值和知识普及
6. 提取内容要准确，避免复制不相关的文本
7. ${isHtml ? '请仔细解析HTML，提取完整的新闻内容，特别是长篇文章、问答形式或系列报道' : '请基于提供的文本内容进行分析'}
8. 支持长篇文章分析，不要因内容长度而丢失重要信息
9. 请确保你返回的JSON格式100%正确，避免任何解析错误`;
  }

  /**
   * 解析AI返回结果，与UnifiedLLMService保持一致
   */
  private static parseAIResult(resultText: string): LLMAnalysisResult {
    console.log(`[PARSE] 开始解析AI响应，原始长度: ${resultText.length}`);

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
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[ERROR] 响应中未找到JSON格式`);
      throw new Error('AI响应中未找到有效的JSON格式');
    }

    console.log(`[INFO] 找到JSON部分，开始解析...`);
    let cleanJson = jsonMatch[0];
    console.log(`[CLEAN] 清理后的JSON: ${cleanJson.substring(0, 200)}...`);
    
    // 3. 清理JSON字符串
    cleanJson = this.cleanJsonString(cleanJson);
    console.log(`[CLEAN] 清理完成，最终JSON长度: ${cleanJson.length}`);

    // 4. 解析清理后的JSON
    try {
      const parsed = JSON.parse(cleanJson);
      console.log(`[SUCCESS] JSON解析成功`);
      return {
        topics: parsed.topics || [],
        keywords: parsed.keywords || [],
        sentiment: parsed.sentiment || 'neutral',
        analysis: parsed.analysis || '',
        educationalValue: parsed.educationalValue || '',
        extractedContent: parsed.extractedContent || '',
        wordCounts: {
          analysis: (parsed.analysis || '').length,
          educationalValue: (parsed.educationalValue || '').length,
          extractedContent: (parsed.extractedContent || '').length
        }
      };
    } catch (parseError) {
      console.error(`[ERROR] JSON解析失败: ${parseError}`);
      console.error(`[ERROR] 尝试解析的JSON: ${cleanJson.substring(0, 500)}...`);
      throw new Error(`JSON解析失败: ${parseError}`);
    }
  }

  /**
   * 清理JSON字符串，移除可能导致解析错误的字符（与UnifiedLLMService保持一致）
   */
  private static cleanJsonString(jsonStr: string): string {
    console.log(`[CLEAN] 开始清理JSON字符串，原始长度: ${jsonStr.length}`);
    
    let cleaned = jsonStr;
    
    // 1. 移除控制字符
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 2. 修复常见的JSON格式问题
    cleaned = cleaned.replace(/，/g, ',');
    cleaned = cleaned.replace(/：/g, ':');
    cleaned = cleaned.replace(/"/g, '"');
    cleaned = cleaned.replace(/"/g, '"');
    
    // 3. 修复引号问题
    cleaned = cleaned.replace(/(['"])(?=(?:[^"\\]|\\.)*["])/g, '"');
    
    // 4. 修复转义字符
    cleaned = cleaned.replace(/\\n/g, '\\\\n')
                   .replace(/\\r/g, '\\\\r')
                   .replace(/\\t/g, '\\\\t');
    
    // 5. 修复JSON格式问题
    cleaned = cleaned.replace(/,\s*}/g, '}')
                   .replace(/,\s*]/g, ']');
    
    // 6. 移除BOM
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();
    
    // 7. 移除可能导致JSON解析错误的字符
    cleaned = cleaned.replace(/[\u2028\u2029]/g, '');
    
    // 8. 确保JSON字符串格式正确
    try {
      JSON.parse(cleaned);
      console.log(`[SUCCESS] JSON格式验证通过`);
    } catch (e) {
      console.log(`[WARN] JSON格式仍有问题，尝试简单修复`);
      // 基本的引号修复
      cleaned = cleaned.replace(/(\w+)\s*:/g, '"$1":');
      cleaned = cleaned.replace(/:\s*'([^']*?)'/g, ': "$1"');
      cleaned = cleaned.replace(/:\s*"([^"]*?)"/g, ': "$1"');
      
      // 尝试再次解析
      try {
        JSON.parse(cleaned);
        console.log(`[SUCCESS] JSON格式修复验证通过`);
      } catch (e2) {
        console.log(`[ERROR] JSON格式修复失败，使用原始清理结果`);
      }
    }
    
    console.log(`[SUCCESS] JSON清理完成，最终长度: ${cleaned.length}`);
    return cleaned;
  }
}