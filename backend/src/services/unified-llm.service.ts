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
  apiKey: string;
}

export class UnifiedLLMService {
  
  static async analyzeContent(params: LLMProcessingParams, env?: any): Promise<LLMAnalysisResult> {
    const { title, content, link, isHtml = false, apiKey } = params;
    const startTime = Date.now();

    console.log('=== Starting unified LLM analysis, title: ' + title + ' ===');
    console.log('[INFO] Content length: ' + content.length + ' chars');
    console.log('[PROCESS] Content type: ' + (isHtml ? 'HTML format' : 'Text format'));
    console.log('[LINK] Source link: ' + (link || 'None'));
    console.log('[ENV] Cloudflare AI available: ' + (env ? 'Yes' : 'No'));

    try {
      console.log('[AI] First attempt using GLM...');
      const glmResult = await this.analyzeWithGLM(params);
      console.log('[SUCCESS] GLM analysis successful');
      return glmResult;
    } catch (glmError) {
      console.error('[ERROR] GLM analysis failed:', glmError);
      console.error('[ERROR] GLM error details:', JSON.stringify(glmError, null, 2));
      
      if (env) {
        console.log('[PROCESS] Trying Cloudflare AI as fallback...');
        try {
          const cfResult = await CloudflareLLMService.analyzeContent(params, env);
          console.log('[SUCCESS] Cloudflare AI analysis successful');
          return cfResult;
        } catch (cfError) {
          console.error('[ERROR] Cloudflare AI also failed:', cfError);
          console.error('[ERROR] Cloudflare AI error details:', JSON.stringify(cfError, null, 2));
          throw glmError;
        }
      } else {
        console.log('[ERROR] No Cloudflare AI env available, throwing GLM error');
        throw glmError;
      }
    }
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
    
    return `Please analyze the following news content and return results in JSON format.

News Title: ${title}
${isHtml ? 'News Content (HTML format):' : 'News Content (RSS summary):'}
${content}

${isHtml ? `
Important Notes:
1. The above content is raw HTML, please ignore HTML tags, ads, navigation
2. Focus on extracting the main news content, especially complete Q&A content
3. If it's reporter Q&A format, ensure both questions and complete answers are included
` : ''}

Please return results in the following JSON format:
{"topics": ["topic1", "topic2", "topic3"], "keywords": ["keyword1", "keyword2", "keyword3"], "sentiment": "positive|negative|neutral", "analysis": "Deep analysis content...", "educationalValue": "Educational value assessment...", "extractedContent": "Extracted complete news content if available"}

Requirements:
1. topics: 3-5 core topics, 2-6 chars each
2. keywords: 8-15 important keywords (including names, places, organizations, technical terms)
3. sentiment: only positive, negative, or neutral
4. analysis: 200-300 chars deep analysis
5. educationalValue: 100-200 chars educational value assessment
6. extractedContent: If more complete content extracted from HTML, provide cleaned text

Important:
1. JSON format must be 100% valid
2. Properly escape quotes in content fields
3. Keep single-line format
4. No comments or extra text
5. ${isHtml ? 'Carefully parse HTML, extract complete content, especially long articles or Q&A format' : 'Analyze based on provided text content'}
6. Support long article analysis
7. Ensure 100% correct JSON format`;
  }

  private static cleanJsonString(jsonStr: string): string {
    console.log('[CLEAN] Cleaning JSON string, original length: ' + jsonStr.length);
    
    let cleaned = jsonStr;
    
    // Remove control characters
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Fix quote issues
    cleaned = cleaned.replace(/(['"])(?=(?:[^"\\]|\\.)*["])/g, '"');
    
    // Fix Chinese quotes
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/[""]/g, '"');
    
    // Fix escape characters
    cleaned = cleaned.replace(/\\n/g, '\\\\n')
                   .replace(/\\r/g, '\\\\r')
                   .replace(/\\t/g, '\\\\t');
    
    // Fix JSON format issues
    cleaned = cleaned.replace(/,\s*}/g, '}')
                   .replace(/,\s*]/g, ']');
    
    // Remove BOM
    cleaned = cleaned.replace(/^\uFEFF/, '').trim();
    
    console.log('[CLEAN] JSON cleaning completed, cleaned length: ' + cleaned.length);
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
    const finalMarkdownContent = result.extractedContent || result.analysis;

    console.log('[CONTENT] Final content length: ' + finalMarkdownContent.length + ' chars');

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

  static generateMarkdownSummary(result: LLMAnalysisResult, title: string, html?: string): any {
    return {
      title,
      content: result.extractedContent || html,
      summary: result.analysis.substring(0, 200),
      extractedContent: result.extractedContent
    };
  }
}