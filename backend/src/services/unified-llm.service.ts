// src/services/unified-llm.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { CloudflareLLMService } from './cloudflare-llm.service';

export interface LLMAnalysisResult {
  topics: string[];
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  analysis: string;
  educationalValue: string;
  extractedContent: string;
  processingTime: number;
  modelUsed: string;
  // 新增字数统计
  wordCounts?: {
    analysis: number;
    educationalValue: number;
    extractedContent: number;
    totalContent: number;
  };
}

export interface LLMProcessingParams {
  entryId?: number;
  title: string;
  content: string;
  link?: string;
  isHtml?: boolean;
  apiKey: string;
}

/**
 * 统一的LLM处理服务
 * 基于reprocess.ts中的完整实现，提供一次性的完整内容分析
 */
export class UnifiedLLMService {
  
  /**
   * 主要的内容分析函数 - 一次性完成所有LLM处理任务
   * 首先尝试使用智谱GLM，如果失败则自动切换到Cloudflare AI
   */
  static async analyzeContent(params: LLMProcessingParams, env?: any): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey } = params;
    const startTime = Date.now();

    console.log(`=== 开始统一LLM分析，标题: ${title} ===`);
    console.log(`📋 内容长度: ${content.length} 字符`);
    console.log(`🔄 内容类型: ${isHtml ? 'HTML格式' : '文本格式'}`);
    console.log(`🔗 来源链接: ${link || '无'}`);

    try {
      // 首先尝试使用智谱GLM
      console.log(`🤖 首次尝试使用智谱GLM进行分析...`);
      const glmResult = await this.analyzeWithGLM(params);
      console.log(`✅ 智谱GLM分析成功`);
      return glmResult;
    } catch (glmError) {
      console.error(`❌ 智谱GLM分析失败:`, glmError);
      
      // 如果提供了env参数，尝试使用Cloudflare AI作为备用方案
      if (env) {
        console.log(`🔄 尝试使用Cloudflare AI作为备用方案...`);
        try {
          const cfResult = await CloudflareLLMService.analyzeContent(params, env);
          console.log(`✅ Cloudflare AI分析成功`);
          return cfResult;
        } catch (cfError) {
          console.error(`❌ Cloudflare AI分析也失败:`, cfError);
          // 如果Cloudflare AI也失败，抛出原始的GLM错误
          throw glmError;
        }
      } else {
        // 没有提供env参数，无法使用备用方案，直接抛出错误
        throw glmError;
      }
    }
  }

  /**
   * 使用智谱GLM进行内容分析
   */
  private static async analyzeWithGLM(params: LLMProcessingParams): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey } = params;
    const startTime = Date.now();

    // 构建专门的分析提示，包含主题、关键词、情感分析、内容解读和教育价值
    const prompt = this.buildAnalysisPrompt(title, content, isHtml);

    // 调用GLM模型进行分析
    const aiRequest = {
      model: 'glm-4.5-flash',
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
      max_tokens: 8000,
      stream: false
    };

    console.log(`🤖 发送AI请求，模型: glm-4.5-flash`);
    console.log(`📊 AI请求参数: temperature=0.3, max_tokens=8000`);
    console.log(`📝 Prompt长度: ${prompt.length} 字符`);

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(aiRequest)
    });

    const processingTime = Date.now() - startTime;
    console.log(`🕐 AI分析完成，耗时: ${processingTime}ms`);

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GLM API调用失败: HTTP ${response.status}`);
      console.error(`❌ 错误详情: ${errorText}`);
      throw new Error(`AI服务调用失败: HTTP ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`✅ AI API调用成功，状态码: ${response.status}`);
    console.log(`📈 AI使用统计: ${responseData.usage ? JSON.stringify(responseData.usage) : '无使用统计'}`);
    
    // 解析AI返回结果
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error(`❌ GLM响应格式不正确: ${JSON.stringify(responseData)}`);
      throw new Error('AI响应格式无效');
    }

    const resultText = responseData.choices[0].message.content;
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
      // 清理JSON字符串，更全面的清理
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
      modelUsed: 'glm-4.5-flash',
      wordCounts: {
        analysis: analysisCount,
        educationalValue: educationalValueCount,
        extractedContent: extractedContentCount,
        totalContent: totalCount
      }
    };
  }

  /**
   * 分析内容并保存到数据库（完整流程）
   */
  static async analyzeAndSave(params: LLMProcessingParams & { db: any, env?: any }): Promise<LLMAnalysisResult> {
    const { entryId, db, env, ...analysisParams } = params;
    
    // 执行AI分析
    const result = await this.analyzeContent(analysisParams, env);
    
    if (entryId) {
      // 保存结果到数据库
      await this.saveAnalysisResult(entryId, result, db);
      
      // 更新RSS条目的处理状态
      await this.updateEntryStatus(entryId, db);
    }
    
    return result;
  }

  /**
   * 构建分析提示
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
7. 请确保你返回的JSON格式100%正确，避免任何解析错误`;
  }

  /**
   * 保存分析结果到数据库
   */
  private static async saveAnalysisResult(entryId: number, result: LLMAnalysisResult, db: any): Promise<void> {
    console.log(`💾 开始保存AI分析结果到数据库，条目ID: ${entryId}`);

    // 序列化数据
    const topicsJson = JSON.stringify(result.topics);
    const keywordsString = result.keywords.join(',');
    const finalMarkdownContent = result.extractedContent || result.analysis;

    console.log(`📄 最终保存的内容长度: ${finalMarkdownContent.length} 字符`);

    // 检查是否已存在processed_contents记录
    const existingRecord = await db
      .select()
      .from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .get();

    console.log(`📋 数据库记录检查 - 条目ID: ${entryId}, ${existingRecord ? '找到现有记录' : '需要创建新记录'}`);

    if (existingRecord) {
      // 更新现有记录
      console.log(`🔄 更新现有processed_contents记录`);
      await db.update(processedContents)
        .set({
          markdownContent: finalMarkdownContent,
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: result.sentiment,
          analysis: result.analysis,
          educationalValue: result.educationalValue,
          processingTime: result.processingTime,
          modelUsed: result.modelUsed,
          updatedAt: new Date()
        })
        .where(eq(processedContents.entryId, entryId));
      
      console.log(`✅ AI分析结果已更新，条目ID: ${entryId}`);
    } else {
      // 创建新记录
      console.log(`🆕 创建新的processed_contents记录`);
      await db.insert(processedContents)
        .values({
          entryId: entryId,
          summary: finalMarkdownContent.substring(0, 500),
          markdownContent: finalMarkdownContent,
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: result.sentiment,
          analysis: result.analysis,
          educationalValue: result.educationalValue,
          processingTime: result.processingTime,
          modelUsed: result.modelUsed,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      console.log(`✅ AI分析结果已创建，条目ID: ${entryId}`);
    }
  }

  /**
   * 更新RSS条目状态
   */
  private static async updateEntryStatus(entryId: number, db: any): Promise<void> {
    console.log(`🔄 更新RSS条目状态，条目ID: ${entryId}`);
    
    await db.update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date(),
        failureCount: 0,
        errorMessage: null
      })
      .where(eq(rssEntries.id, entryId));
    
    console.log(`✅ RSS条目状态已更新，条目ID: ${entryId}`);
  }

  /**
   * 简化的主题提取函数（用于兼容旧代码）
   */
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

  /**
   * 简化的内容提取函数（用于兼容旧代码）
   */
  static async extractContent(html: string, url: string, title: string, apiKey: string, env?: any): Promise<{
    title: string;
    content: string;
    summary: string;
    extractedContent: string;
  }> {
    const result = await this.analyzeContent({
      title,
      content: html,
      link: url,
      isHtml: true,
      apiKey
    }, env);

    return {
      title,
      content: result.extractedContent || html,
      summary: result.analysis.substring(0, 200),
      extractedContent: result.extractedContent
    };
  }

  /**
   * 清理JSON字符串，移除可能导致解析错误的字符
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
    cleaned = cleaned.replace(/\\n/g, '\\\\n')
                   .replace(/\\r/g, '\\\\r')
                   .replace(/\\t/g, '\\\\t');
    
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
   * 修复常见的JSON格式问题
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
      fixed = fixed.replace(/[""]/g, '"');
      fixed = fixed.replace(/[""]/g, '"');
      
      // 3. 修复未闭合的字符串
      fixed = fixed.replace(/"([^"]*?)(?=[,}\]:])/g, '"$1"');
      
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
   * 精确的JSON修复方法 - 逐个字符分析并正确转义
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
