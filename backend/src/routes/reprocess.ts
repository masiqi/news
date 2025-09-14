import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ZhipuAIService } from '../services/ai/zhipu-ai.service';
import { tagAggregationService } from '../services/tag-aggregation.service';

const reprocessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// AI重新处理内容
reprocessRoutes.post("/", async (c) => {
  const entryId = parseInt(c.req.query('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    console.log(`开始AI重新处理内容，条目ID: ${entryId}`);

    // 获取RSS条目信息
    const rssEntry = await db
      .select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!rssEntry) {
      return c.json({ error: "内容条目不存在" }, 404);
    }

    console.log(`找到RSS条目: ${rssEntry.title}`);

    let contentForAnalysis = rssEntry.content;
    let webContentFetched = false;

    // 如果有链接，先尝试抓取完整的网页内容
    if (rssEntry.link) {
      try {
        console.log(`🌐 尝试抓取完整网页内容: ${rssEntry.link}`);
        
        // 使用简单的网页抓取逻辑，避免数据库操作冲突
        const response = await fetch(rssEntry.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`✅ 网页抓取成功，HTML长度: ${html.length} 字符`);
        console.log(`📄 原始HTML前500字符: ${html.substring(0, 500)}`);
        
        // 直接使用原始HTML，让LLM来解析内容
        contentForAnalysis = html;
        webContentFetched = true;
        
        console.log(`✅ 直接使用原始HTML进行AI分析，长度: ${contentForAnalysis.length} 字符`);
        
      } catch (webError) {
        console.error(`❌ 网页内容抓取失败，将使用RSS原始内容:`, webError);
        console.log(`📄 将使用RSS原始内容，长度: ${rssEntry.content.length} 字符`);
      }
    } else {
      console.log(`⚠️  RSS条目没有链接，将使用RSS原始内容`);
    }

    const startTime = Date.now();

    // 使用GLM模型进行分析
    console.log(`=== 开始GLM AI分析，条目ID: ${entryId} ===`);
    console.log(`📋 标题: ${rssEntry.title}`);
    console.log(`📄 分析内容长度: ${contentForAnalysis.length} 字符`);
    console.log(`🔄 内容来源: ${webContentFetched ? '网页抓取' : 'RSS原始'}`);

    // 构建专门的分析提示，包含主题、关键词、情感分析、内容解读和教育价值
    const prompt = `你是一个专业的新闻内容分析专家，擅长从HTML页面中提取和解析新闻内容。请对以下中文新闻内容进行全面分析。

新闻标题：${rssEntry.title}
${webContentFetched ? '新闻原文（HTML格式）：' : '新闻原文（RSS摘要）：'}
${contentForAnalysis}

${webContentFetched ? `
重要说明：
1. 上述内容是HTML格式的原始网页，请忽略HTML标签、广告、导航等无关内容
2. 重点提取新闻正文部分，特别是完整的问答内容
3. 如果是记者问答形式，请确保包含问题和完整的回答部分
` : ''}

请提供以下分析结果，并以JSON格式返回：

1. **主题提取**: 3-5个核心主题，每个主题2-6个字
2. **关键词识别**: 8-15个重要关键词（包括重要人名、地名、机构名、专业术语等）
3. **情感分析**: 判断情感倾向（positive/negative/neutral）
4. **内容解读**: 200-300字的深度分析，解读新闻的背景、意义、影响和相关背景
5. **教育价值**: 100-200字评估，说明对高中生的教育意义和学习价值，包括相关知识点
6. **提取的完整内容**: 如果从HTML中提取到了比RSS更完整的新闻内容，请提供清理后的完整文本（保持段落结构）

返回格式：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sentiment": "positive|negative|neutral",
  "analysis": "深度分析内容...",
  "educationalValue": "教育价值评估...",
  "extractedContent": "提取的完整新闻内容（如果有）"
}

要求：
1. 主题要准确反映新闻核心内容
2. 关键词应全面覆盖重要名词、人名、地名、机构、术语和概念
3. 情感分析要客观准确
4. 分析解读要有深度和见解，包含背景信息和影响分析
5. 教育价值要详细说明对学生的启发意义和相关知识点
6. ${webContentFetched ? '请仔细解析HTML，提取完整的新闻内容，特别是长篇文章、问答形式或系列报道' : '请基于提供的RSS内容进行分析'}
7. 支持长篇文章分析，不要因内容长度而丢失重要信息
8. 只返回JSON，不要包含其他解释`;

    // 检查API Key
    const apiKey = process.env.ZHIPUAI_API_KEY || 'bcf6e4bffd884f189a367a079d32cf18.IZyzJGFB6f66qjK9';
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }

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
      max_tokens: 8000, // 增加max_tokens以支持更长的分析结果和完整内容提取
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

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log(`🕐 AI分析完成，条目ID: ${entryId}，耗时: ${processingTime}ms`);

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GLM API调用失败: HTTP ${response.status}`);
      console.error(`❌ 错误详情: ${errorText}`);
      return c.json({ 
        error: "AI服务调用失败", 
        details: `HTTP ${response.status}: ${errorText}`
      }, 500);
    }

    const responseData = await response.json();
    console.log(`✅ AI API调用成功，状态码: ${response.status}`);
    console.log(`📈 AI使用统计: ${responseData.usage ? JSON.stringify(responseData.usage) : '无使用统计'}`);
    console.log(`📊 AI响应元数据: ${JSON.stringify({
      id: responseData.id,
      object: responseData.object,
      created: responseData.created,
      model: responseData.model,
      system_fingerprint: responseData.system_fingerprint
    })}`);
    
    // 解析AI返回结果
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error(`❌ GLM响应格式不正确: ${JSON.stringify(responseData)}`);
      return c.json({ error: "AI响应格式无效" }, 500);
    }

    const resultText = responseData.choices[0].message.content;
    console.log(`📝 AI原始响应长度: ${resultText.length} 字符`);
    console.log(`📝 AI原始响应前500字符: ${resultText.substring(0, 500)}`);
    console.log(`📝 AI原始响应500-1000字符: ${resultText.substring(500, 1000)}`);
    
    // 尝试提取JSON
    console.log(`🔍 尝试从AI响应中提取JSON...`);
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error(`❌ AI返回结果格式无效，条目ID: ${entryId}`);
      console.error(`❌ 完整响应内容: ${resultText}`);
      return c.json({ error: "AI分析结果格式无效" }, 500);
    }

    console.log(`✅ 找到JSON格式响应，开始解析`);
    console.log(`📋 JSON匹配内容前200字符: ${jsonMatch[0].substring(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 验证必要字段
    if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.keywords) || !parsed.sentiment) {
      console.error(`❌ AI分析结果缺少必要字段，条目ID: ${entryId}`);
      console.error(`❌ 解析结果: ${JSON.stringify(parsed)}`);
      return c.json({ error: "AI分析结果不完整" }, 500);
    }

    // 序列化数据
    const topicsJson = JSON.stringify(parsed.topics.slice(0, 5));
    const keywordsString = parsed.keywords.slice(0, 10).join(',');
    const analysis = parsed.analysis || '';
    const educationalValue = parsed.educationalValue || '';
    const extractedContent = parsed.extractedContent || '';

    console.log(`🎯 AI解析结果:`);
    console.log(`   - 主题 (${parsed.topics.length}个): ${parsed.topics.join(', ')}`);
    console.log(`   - 关键词 (${parsed.keywords.length}个): ${parsed.keywords.join(', ')}`);
    console.log(`   - 情感倾向: ${parsed.sentiment}`);
    console.log(`   - 分析内容长度: ${analysis.length} 字符`);
    console.log(`   - 教育价值长度: ${educationalValue.length} 字符`);
    console.log(`   - 提取的完整内容长度: ${extractedContent.length} 字符`);
    
    // 如果AI提取了完整内容，使用提取的内容作为markdownContent
    const finalMarkdownContent = extractedContent || contentForAnalysis;
    console.log(`📄 最终保存的内容长度: ${finalMarkdownContent.length} 字符`);

    console.log(`💾 开始保存AI分析结果到数据库，条目ID: ${entryId}`);

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
          sentiment: parsed.sentiment,
          analysis: analysis,
          educationalValue: educationalValue,
          processingTime: processingTime,
          modelUsed: "glm-4.5-flash",
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
          summary: finalMarkdownContent.substring(0, 500), // 使用完整内容生成摘要
          markdownContent: finalMarkdownContent, // 使用完整内容作为Markdown
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: parsed.sentiment,
          analysis: analysis,
          educationalValue: educationalValue,
          processingTime: processingTime,
          modelUsed: "glm-4.5-flash",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      console.log(`✅ AI分析结果已创建，条目ID: ${entryId}`);
    }

    console.log(`🎉 AI重新处理完成，条目ID: ${entryId}`);
    console.log(`=== AI处理流程结束，条目ID: ${entryId} ===`);

    // 更新RSS条目的处理状态
    await db.update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date(),
        failureCount: 0,
        errorMessage: null
      })
      .where(eq(rssEntries.id, entryId));

    console.log(`AI重新处理完成，条目ID: ${entryId}`);

    // 触发标签聚合处理
    try {
      console.log(`🏷️ 开始标签聚合处理，processedContentId: ${existingRecord ? existingRecord.id : 'new'}`);
      
      if (existingRecord) {
        // 如果是更新记录，使用现有ID
        await tagAggregationService.processContentTags(existingRecord.id, db);
      } else {
        // 如果是新记录，需要先获取刚创建的记录ID
        const [newRecord] = await db
          .select({ id: processedContents.id })
          .from(processedContents)
          .where(eq(processedContents.entryId, entryId))
          .limit(1);
        
        if (newRecord) {
          await tagAggregationService.processContentTags(newRecord.id, db);
        }
      }
      
      console.log(`✅ 标签聚合处理完成`);
    } catch (tagError) {
      console.error('❌ 标签聚合处理失败:', tagError);
      // 标签聚合失败不影响主要功能，只记录错误
    }

    return c.json({
      success: true,
      message: "AI重新分析成功",
      data: {
        entryId,
        topics: parsed.topics,
        keywords: parsed.keywords,
        sentiment: parsed.sentiment,
        analysis: analysis,
        educationalValue: educationalValue,
        processingTime: processingTime
      }
    });

  } catch (error) {
    console.error('AI重新处理失败，条目ID:', entryId, '错误:', error);
    
    // 更新失败状态
    try {
      await db.update(rssEntries)
        .set({
          failureCount: db.sql`failureCount + 1`,
          errorMessage: error instanceof Error ? error.message : 'AI重新处理失败',
          processedAt: new Date()
        })
        .where(eq(rssEntries.id, entryId));
    } catch (updateError) {
      console.error('更新失败状态也失败:', updateError);
    }
    
    return c.json({ 
      error: "AI重新处理失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default reprocessRoutes;