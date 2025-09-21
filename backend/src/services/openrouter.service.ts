// src/services/openrouter.service.ts
import { LLMAnalysisResult, LLMProcessingParams } from './unified-llm.service';

export class OpenRouterService {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';
  
  static async analyzeContent(params: LLMProcessingParams, model: string = 'z-ai/glm-4.5-air:free'): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey } = params;
    const startTime = Date.now();

    console.log(`[OpenRouter] Starting analysis with model: ${model}...`);
    
    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    const request = {
      model: model,
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

    try {
      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/your-repo/news-platform',
          'X-Title': 'AI News Platform'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenRouter] API call failed:', response.status, errorText);
        throw new Error(`OpenRouter API failed: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      const resultText = responseData.choices[0].message.content;
      
      console.log('[OpenRouter] Raw response length:', resultText.length);
      
      // 提取JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from OpenRouter');
      }

      const cleanedJson = this.cleanJsonString(jsonMatch[0]);
      const parsed = JSON.parse(cleanedJson);

      const processingTime = Date.now() - startTime;

      return {
        topics: parsed.topics?.slice(0, 5) || [],
        keywords: parsed.keywords?.slice(0, 10) || [],
        sentiment: parsed.sentiment || 'neutral',
        analysis: parsed.analysis || '',
        educationalValue: parsed.educationalValue || '',
        extractedContent: parsed.extractedContent || '',
        images: parsed.images || [],
        processingTime,
        modelUsed: model,
        wordCounts: {
          analysis: (parsed.analysis || '').length,
          educationalValue: (parsed.educationalValue || '').length,
          extractedContent: (parsed.extractedContent || '').length
        }
      };

    } catch (error) {
      console.error('[OpenRouter] Analysis failed:', error);
      throw error;
    }
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
    let cleaned = jsonStr;
    
    // 移除控制字符
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // 修复引号
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/[""]/g, '"');
    
    // 修复逗号
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    // 移除BOM
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();
    
    return cleaned;
  }

  static async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}