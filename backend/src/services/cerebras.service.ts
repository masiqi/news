// src/services/cerebras.service.ts
// Cerebras API 集成服务 - 提供超快速的 LLM 推理能力

export interface CerebrasAnalysisResult {
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

export interface CerebrasRequestParams {
  title: string;
  content: string;
  link?: string;
  isHtml?: boolean;
  apiKey: string;
  model?: string;
}

export class CerebrasService {
  private static readonly API_ENDPOINT = 'https://api.cerebras.ai/v1/chat/completions';
  private static readonly DEFAULT_MODEL = 'qwen-3-235b-a22b-instruct-2507';
  private static readonly AVAILABLE_MODELS = ['qwen-3-235b-a22b-instruct-2507', 'gpt-oss-120b'];

  /**
   * 获取 API 端点（支持环境变量配置）
   */
  private static getApiEndpoint(env?: any): string {
    const baseUrl = env?.CEREBRAS_API_URL || this.API_ENDPOINT.replace('/chat/completions', '');
    return `${baseUrl}/chat/completions`;
  }

  /**
   * 获取默认模型（支持环境变量配置）
   */
  private static getDefaultModel(env?: any): string {
    return env?.CEREBRAS_DEFAULT_MODEL || this.DEFAULT_MODEL;
  }

  /**
   * 使用 Cerebras API 分析内容
   */
  static async analyzeContent(params: CerebrasRequestParams, env?: any): Promise<CerebrasAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey, model } = params;
    const selectedModel = model || this.getDefaultModel(env);
    const startTime = Date.now();

    console.log('=== Cerebras API 分析开始 ===');
    console.log('[API端点] ' + this.getApiEndpoint(env));
    console.log('[模型] ' + selectedModel);
    console.log('[标题] ' + title);
    console.log('[内容长度] ' + content.length + ' 字符');
    console.log('[格式] ' + (isHtml ? 'HTML' : '文本'));

    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    const requestBody = {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: 'You are a professional Chinese news content analysis expert. Always return results in strict JSON format without any markdown formatting or code blocks.'
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

    console.log('[请求] 发送到 Cerebras API...');
    console.log('[提示词长度] ' + prompt.length + ' 字符');

    const apiEndpoint = this.getApiEndpoint(env);
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[错误] Cerebras API 调用失败: HTTP ' + response.status);
      console.error('[错误详情] ' + errorText);
      throw new Error(`Cerebras API 调用失败: HTTP ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('[成功] Cerebras API 响应成功');
    console.log('[耗时] ' + processingTime + 'ms');

    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error('[错误] Cerebras 响应格式不正确');
      throw new Error('Cerebras API 响应格式无效');
    }

    const resultText = responseData.choices[0].message.content;
    console.log('[响应长度] ' + resultText.length + ' 字符');
    console.log('[调试] ===== Cerebras 完整响应 =====');
    console.log(resultText);
    console.log('[调试] ===== 响应结束 =====');

    // 解析 JSON 响应
    const parsed = this.parseJsonResponse(resultText);

    // 验证必需字段
    if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.keywords) || !parsed.sentiment) {
      console.error('[错误] 分析结果缺少必需字段');
      throw new Error('Cerebras 分析结果不完整');
    }

    console.log('[结果] 解析成功:');
    console.log('   - 主题 (' + parsed.topics.length + '): ' + parsed.topics.join(', '));
    console.log('   - 关键词 (' + parsed.keywords.length + '): ' + parsed.keywords.join(', '));
    console.log('   - 情感: ' + parsed.sentiment);

    const result: CerebrasAnalysisResult = {
      topics: parsed.topics.slice(0, 5),
      keywords: parsed.keywords.slice(0, 10),
      sentiment: parsed.sentiment,
      analysis: parsed.analysis || '',
      educationalValue: parsed.educationalValue || '',
      extractedContent: parsed.extractedContent || '',
      images: parsed.images || [],
      processingTime,
      modelUsed: selectedModel,
      wordCounts: {
        analysis: (parsed.analysis || '').length,
        educationalValue: (parsed.educationalValue || '').length,
        extractedContent: (parsed.extractedContent || '').length
      }
    };

    console.log('[完成] Cerebras 分析成功完成');
    return result;
  }

  /**
   * 构建分析提示词
   */
  private static buildAnalysisPrompt(title: string, content: string, isHtml: boolean): string {
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

请严格按照以下JSON格式返回分析结果，不要添加任何markdown代码块标记（如\`\`\`json），不要添加任何额外的文本、注释或格式：

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
2. **不要使用markdown代码块**：直接返回纯JSON，不要使用\`\`\`json或\`\`\`包裹
3. **引号处理**：如果在analysis、educationalValue或extractedContent字段中需要引用原文的引号内容，请正确转义为\\"
4. 不要在JSON中包含换行符或制表符，保持单行格式
5. 不要添加注释或说明文字，只返回纯JSON
6. ${isHtml ? '请仔细解析HTML，提取完整的新闻内容，特别是长篇文章、问答形式或系列报道' : '请基于提供的文本内容进行分析'}
7. **图片Markdown格式**：${isHtml ? '如果在HTML中发现图片标签（<img src="...">），请在extractedContent中将图片标签转换为Markdown格式![图片描述](图片URL)' : '如果原文中有图片信息，请在extractedContent中添加Markdown格式图片'}`;
  }

  /**
   * 解析 JSON 响应
   */
  private static parseJsonResponse(responseText: string): any {
    console.log('[解析] 开始解析 JSON 响应...');

    // 移除可能的 markdown 代码块标记
    let cleaned = responseText.trim();

    // 移除 ```json 和 ``` 标记
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }

    cleaned = cleaned.trim();

    // 查找 JSON 对象
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[错误] 未找到有效的 JSON 格式');
      throw new Error('Cerebras 返回的结果格式无效');
    }

    console.log('[清理] 清理后的 JSON: ' + jsonMatch[0].substring(0, 200) + '...');

    try {
      const cleanJson = this.cleanJsonString(jsonMatch[0]);
      const parsed = JSON.parse(cleanJson);
      console.log('[成功] JSON 解析成功');
      return parsed;
    } catch (parseError) {
      console.error('[错误] JSON 解析失败: ' + parseError);
      throw new Error('Cerebras 返回的 JSON 格式无效: ' + parseError);
    }
  }

  /**
   * 清理 JSON 字符串
   */
  private static cleanJsonString(jsonStr: string): string {
    let cleaned = jsonStr;

    // 移除控制字符
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 修复中文引号
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");

    // 移除尾部逗号
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // 移除 BOM
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();

    return cleaned;
  }

  /**
   * 测试 API 连接
   */
  static async testConnection(apiKey: string, env?: any): Promise<boolean> {
    try {
      const apiEndpoint = this.getApiEndpoint(env);
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.getDefaultModel(env),
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      return response.ok;
    } catch (error) {
      console.error('[错误] Cerebras 连接测试失败:', error);
      return false;
    }
  }
}
