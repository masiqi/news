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
    console.log(`📋 内容长度: ${content.length} 字符`);
    console.log(`🔄 内容类型: ${isHtml ? 'HTML格式' : '文本格式'}`);
    console.log(`🔗 来源链接: ${link || '无'}`);

    // 构建分析提示，与UnifiedLLMService保持一致
    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    console.log(`🤖 发送AI请求，模型: @cf/openai/gpt-oss-20b`);
    console.log(`📝 Prompt长度: ${prompt.length} 字符`);

    try {
      // 调用Cloudflare AI - 使用新的API格式
      const response = await env.AI.run('@cf/openai/gpt-oss-20b', {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的新闻内容分析专家，擅长深度分析新闻内容并提供有价值的教育见解。请严格按照JSON格式返回结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 8000
      });

      const processingTime = Date.now() - startTime;
      console.log(`🕐 AI分析完成，耗时: ${processingTime}ms`);

      // 检查响应状态
      if (!response) {
        console.error(`❌ Cloudflare AI API调用失败: 无响应`);
        throw new Error('Cloudflare AI服务调用失败: 无响应');
      }

      // 获取响应文本 - 新版API返回格式
      const resultText = response.response || (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) || JSON.stringify(response);
      console.log(`✅ AI API调用成功`);
      console.log(`📝 AI原始响应长度: ${resultText.length} 字符`);
      
      // 尝试提取JSON
      console.log(`🔍 尝试从AI响应中提取JSON...`);
      
      // 多种方式尝试提取JSON
      let jsonMatch = resultText.match(/\{[\s\S]*\}/);
      let cleanJson = '';
      
      if (!jsonMatch) {
        console.error(`❌ AI返回结果格式无效`);
        console.error(`❌ 完整响应内容: ${resultText}`);
        throw new Error('AI分析结果格式无效');
      }

      console.log(`✅ 找到JSON格式响应，开始解析`);
      let parsed;
      try {
        // 清理JSON字符串，使用与UnifiedLLMService相同的清理方法
        cleanJson = this.cleanJsonString(jsonMatch[0]);
        console.log(`🔧 清理后的JSON: ${cleanJson.substring(0, 200)}...`);
        
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error(`❌ JSON解析失败: ${parseError}`);
        console.error(`❌ 原始JSON: ${jsonMatch[0]}`);
        console.error(`❌ 清理后的JSON: ${cleanJson}`);
        
        // 尝试修复常见的JSON格式问题
        try {
          console.log(`🔄 尝试修复JSON格式...`);
          const fixedJson = this.fixJsonFormat(cleanJson);
          parsed = JSON.parse(fixedJson);
          console.log(`✅ JSON格式修复成功`);
        } catch (fixError) {
          console.error(`❌ JSON格式修复失败: ${fixError}`);
          throw new Error(`AI返回的JSON格式无效且无法自动修复: ${parseError}`);
        }
      }
      
      // 验证必要字段
      if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.keywords) || !parsed.sentiment) {
        console.error(`❌ AI分析结果缺少必要字段`);
        console.error(`❌ 解析结果: ${JSON.stringify(parsed)}`);
        throw new Error('AI分析结果不完整');
      }

      console.log(`🎯 AI解析结果:`);
      console.log(`   - 主题 (${parsed.topics.length}个): ${parsed.topics.join(', ')}`);
      console.log(`   - 关键词 (${parsed.keywords.length}个): ${parsed.keywords.join(', ')}`);
      console.log(`   - 情感倾向: ${parsed.sentiment}`);
      console.log(`   - 分析内容长度: ${parsed.analysis?.length || 0} 字符`);
      console.log(`   - 教育价值长度: ${parsed.educationalValue?.length || 0} 字符`);
      console.log(`   - 提取的完整内容长度: ${parsed.extractedContent?.length || 0} 字符`);

      // 计算字数统计
      const analysisCount = (parsed.analysis || '').length;
      const educationalValueCount = (parsed.educationalValue || '').length;
      const extractedContentCount = (parsed.extractedContent || '').length;
      const totalCount = analysisCount + educationalValueCount + extractedContentCount;

      console.log(`📊 字数统计:`);
      console.log(`   - 分析内容: ${analysisCount} 字`);
      console.log(`   - 教育价值: ${educationalValueCount} 字`);
      console.log(`   - 提取内容: ${extractedContentCount} 字`);
      console.log(`   - 总计: ${totalCount} 字`);

      return {
        topics: parsed.topics.slice(0, 5),
        keywords: parsed.keywords.slice(0, 10),
        sentiment: parsed.sentiment,
        analysis: parsed.analysis || '',
        educationalValue: parsed.educationalValue || '',
        extractedContent: parsed.extractedContent || '',
        processingTime,
        modelUsed: '@cf/openai/gpt-oss-20b',
        wordCounts: {
          analysis: analysisCount,
          educationalValue: educationalValueCount,
          extractedContent: extractedContentCount,
          totalContent: totalCount
        }
      };
    } catch (error) {
      console.error(`❌ Cloudflare AI处理失败:`, error);
      throw error;
    }
  }

  /**
   * 构建分析提示（与UnifiedLLMService保持一致）
   */
  private static buildAnalysisPrompt(title: string, content: string, isHtml: boolean): string {
    console.log(`📝 构建分析提示，HTML模式: ${isHtml}, 内容长度: ${content.length}`);
    if (isHtml) {
      console.log(`📄 原始HTML前500字符: ${content.substring(0, 500)}`);
    }
    console.log(`📋 标题: ${title}`);
    console.log(`📄 分析内容长度: ${content.length} 字符`);
    console.log(`🔄 内容来源: ${isHtml ? '网页抓取' : 'RSS原始'}`);
    
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

{"topics": ["主题1", "主题2", "主题3"], "keywords": ["关键词1", "关键词2", "关键词3"], "sentiment": "positive|negative|neutral", "analysis": "深度分析内容...", "educationalValue": "教育价值评估...", "extractedContent": "提取的完整新闻内容（如果有）"}

注意：
1. topics: 3-5个核心主题，每个主题2-6个字
2. keywords: 8-15个重要关键词（包括重要人名、地名、机构名、专业术语等）
3. sentiment: 只能是positive、negative或neutral中的一个
4. analysis: 200-300字的深度分析，解读新闻的背景、意义、影响和相关背景
5. educationalValue: 100-200字评估，说明对高中生的教育意义和学习价值，包括相关知识点
6. extractedContent: 如果从HTML中提取到了比文本更完整的新闻内容，请提供清理后的完整文本（保持段落结构）

重要要求：
1. **JSON格式必须完全有效**：确保返回的JSON可以被直接解析，不要包含任何语法错误
2. **引号处理**：如果在analysis、educationalValue或extractedContent字段中需要引用原文的引号内容，请正确转义为\\"，例如："原子能法强调\\"和平利用\\"原则"
3. 不要在JSON中包含换行符或制表符，保持单行格式
4. 不要添加注释或说明文字，只返回纯JSON
5. ${isHtml ? '请仔细解析HTML，提取完整的新闻内容，特别是长篇文章、问答形式或系列报道' : '请基于提供的文本内容进行分析'}
6. 支持长篇文章分析，不要因内容长度而丢失重要信息
7. 请确保你返回的JSON格式100%正确，避免任何解析错误
8. **严格要求**：你的响应必须以JSON格式开头，不要包含任何前缀文本、解释或Markdown格式化
  }

  /**
   * 清理JSON字符串，移除可能导致解析错误的字符（与UnifiedLLMService保持一致）
   */
  private static cleanJsonString(jsonStr: string): string {
    console.log(`🔧 开始清理JSON字符串，原始长度: ${jsonStr.length}`);
    
    let cleaned = jsonStr;
    
    // 1. 移除控制字符
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 2. 修复引号问题 - 这是关键！
    // 首先确保所有JSON键值对的引号都是英文双引号
    cleaned = cleaned.replace(/(['"])(?=(?:[^"\\]|\\.)*["])/g, '"');
    
    // 3. 修复中文字符串中的引号问题
    // 将字符串内容中的中文引号转换为英文引号并正确转义
    cleaned = cleaned.replace(/"([^"]*)"/g, (match, content) => {
      // 转义字符串内的双引号
      const escapedContent = content.replace(/"/g, '\\"');
      return `"${escapedContent}"`;
    });
    
    // 4. 修复转义字符
    cleaned = cleaned.replace(/\\n/g, '\\n')
                   .replace(/\\r/g, '\\r')
                   .replace(/\\t/g, '\\t');
    
    // 5. 修复可能的JSON格式问题
    cleaned = cleaned.replace(/,\s*}/g, '}')
                   .replace(/,\s*]/g, ']');
    
    // 6. 移除可能的BOM标记
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();
    
    console.log(`🔧 JSON清理完成，清理后长度: ${cleaned.length}`);
    console.log(`🔧 清理后的JSON预览: ${cleaned.substring(0, 200)}...`);
    
    return cleaned;
  }

  /**
   * 修复常见的JSON格式问题（与UnifiedLLMService保持一致）
   */
  private static fixJsonFormat(jsonStr: string): string {
    console.log(`🔄 开始修复JSON格式...`);
    
    try {
      // 尝试修复常见问题
      let fixed = jsonStr;
      
      // 1. 修复字符串内未转义的引号 - 这是最关键的问题
      // 匹配JSON字符串值中的引号并转义
      fixed = fixed.replace(/:\s*"([^"]*)"/g, (match, content) => {
        // 转义字符串内容中的双引号
        const escapedContent = content.replace(/(?<!\\)"/g, '\\"');
        return `: "${escapedContent}"`;
      });
      
      // 2. 修复中文引号问题
      fixed = fixed.replace(/[“”]/g, '"');
      fixed = fixed.replace(/[‘’]/g, "'");
      
      // 3. 修复未闭合的字符串
      fixed = fixed.replace(/"([^"]*?)(?=[,}\\]:])/g, '"$1"');
      
      // 4. 修复缺失的逗号
      fixed = fixed.replace(/"([^"]+)"\s*"([^"]+)"/g, '"$1", "$2"');
      
      // 5. 移除JSON中的注释
      fixed = fixed.replace(/\/\/.*$/gm, '');
      fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // 6. 尝试解析验证
      JSON.parse(fixed);
      console.log(`✅ JSON格式修复成功`);
      return fixed;
      
    } catch (error) {
      console.error(`❌ JSON修复失败: ${error}`);
      
      // 尝试精确的修复方法
      try {
        console.log(`🔄 尝试精确修复方法...`);
        const preciseFixed = this.preciseJsonFix(jsonStr);
        JSON.parse(preciseFixed);
        console.log(`✅ 精确修复成功`);
        return preciseFixed;
      } catch (preciseError) {
        console.error(`❌ 精确修复也失败: ${preciseError}`);
        return jsonStr;
      }
    }
  }

  /**
   * 精确的JSON修复方法 - 逐个字符分析并正确转义（与UnifiedLLMService保持一致）
   */
  private static preciseJsonFix(jsonStr: string): string {
    console.log(`🔧 开始精确JSON修复...`);
    
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        if (inString) {
          // 检查这个引号是否是字符串的结束
          // 如果是字符串的结束，就正常处理
          // 如果是字符串内容中的引号，就需要转义
          
          // 简单判断：如果后面跟着 : , } ] 等字符，说明是字符串结束
          const nextChar = jsonStr[i + 1];
          if (nextChar && [':', ',', '}', ']'].includes(nextChar)) {
            // 字符串结束
            result += char;
            inString = false;
          } else {
            // 字符串内容中的引号，需要转义
            result += '\\"';
          }
        } else {
          // 字符串开始
          result += char;
          inString = true;
        }
      } else {
        result += char;
      }
    }
    
    return result;
  }
}