// src/services/web-content.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface WebContentResult {
  title: string;
  content: string;
  cleanContent: string; // 清理后的纯文本内容
  images: string[]; // 图片URL列表
  links: string[]; // 相关链接
  publishDate?: Date;
  wordCount: number;
  url?: string; // 原始链接
  // AI处理的额外字段
  summary?: string;
  topics?: string[];
  keywords?: string[];
  author?: string;
  source?: string;
  analysis?: string;
  educationalValue?: string;
}

export interface ParsedNewsContent {
  title: string;
  content: string;
  summary?: string;
  topics: string[];
  keywords: string[];
  images: string[];
  wordCount: number;
}

/**
 * 网页内容抓取和解析服务
 */
export class WebContentService {
  private cache: Map<string, WebContentResult> = new Map();
  
  constructor(private db: any) {}
  
  /**
   * 从RSS链接抓取并解析网页内容
   */
  async fetchAndParseWebContent(entryId: number, url: string): Promise<ParsedNewsContent> {
    try {
      console.log(`开始抓取网页内容: ${url}`);
      
      // 1. 抓取网页HTML
      const htmlContent = await this.fetchWebPage(url);
      console.log(`网页抓取完成，内容长度: ${htmlContent.length}`);
      
      // 2. 解析HTML内容
      const parsedContent = this.parseHtmlContent(htmlContent, url);
      console.log(`内容解析完成，提取标题: ${parsedContent.title}`);
      
      // 3. 保存原始网页内容到数据库
      await this.saveWebContent(entryId, parsedContent);
      
      // 4. 返回解析结果
      return parsedContent;
      
    } catch (error) {
      console.error(`抓取和解析网页内容失败:`, error);
      throw new Error(`网页内容抓取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 抓取网页HTML内容
   */
  private async fetchWebPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000, // 30秒超时
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  }
  
  /**
   * 解析HTML内容，提取新闻正文（改进版）
   */
  private parseHtmlContent(html: string, baseUrl: string): ParsedNewsContent {
    // 使用正则表达式移除HTML标签和格式化内容
    const cleanHtml = this.cleanHtml(html);
    
    // 提取标题
    const title = this.extractTitle(cleanHtml);
    
    // 提取正文内容（改进版）
    const content = this.extractMainContentImproved(cleanHtml);
    
    // 提取图片
    const images = this.extractImages(html, baseUrl);
    
    // 提取相关链接
    const links = this.extractLinks(html, baseUrl);
    
    // 计算字数
    const wordCount = this.countWords(content);
    
    return {
      title,
      content,
      topics: [], // WebContentService不提取主题，留空由AI处理
      keywords: [], // WebContentService不提取关键词，留空由AI处理
      images,
      links,
      wordCount
    };
  }
  
  /**
   * 改进版的内容提取
   */
  private extractMainContentImproved(html: string): string {
    // 移除导航、页眉、页脚等非主要内容（增强版）
    let content = html
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*social[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*recommend[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<section[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<ul[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/ul>/gi, '');
    
    // 提取主要内容区域（优先级增强版）
    const mainContentPatterns = [
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    ];
    
    for (const pattern of mainContentPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        content = match[1];
        break;
      }
    }
    
    // 移除剩余的HTML标签，保留纯文本
    return this.extractTextFromHtml(content);
  }
  
  /**
   * 清理HTML内容
   */
  private cleanHtml(html: string): string {
    return html
      // 移除script和style标签
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // 移除HTML注释
      .replace(/<!--[\s\S]*?-->/g, '')
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '');
  }
  
  /**
   * 提取标题
   */
  private extractTitle(html: string): string {
    // 尝试多种标题提取方式
    const titlePatterns = [
      /<h1[^>]*>([^<]*)<\/h1>/i,
      /<h2[^>]*>([^<]*)<\/h2>/i,
      /<h3[^>]*>([^<]*)<\/h3>/i,
      /<title[^>]*>([^<]*)<\/title>/i,
      /<meta\s+property="og:title"[^>]*content="([^"]*)"/i,
    ];
    
    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.cleanText(match[1]).trim();
      }
    }
    
    return '未知标题';
  }
  
  /**
   * 提取主要内容
   */
  private extractMainContent(html: string): string {
    // 移除导航、页眉、页脚等非主要内容
    let content = html
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // 提取主要内容区域
    const mainContentPatterns = [
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    
    for (const pattern of mainContentPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        content = match[1];
        break;
      }
    }
    
    // 移除剩余的HTML标签，保留纯文本
    return this.extractTextFromHtml(content);
  }
  
  /**
   * 从HTML中提取纯文本
   */
  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ') // 替换所有HTML标签为空格
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/\n\s*\n/g, '\n') // 清理换行
      .replace(/^\s+|\s+$/g, '') // 移除首尾空格
      .trim();
  }
  
  /**
   * 提取图片URL
   */
  private extractImages(html: string, baseUrl: string): string[] {
    const images: string[] = [];
    const imgPattern = /<img[^>]+src="([^"]*)"[^>]*>/gi;
    
    let match;
    while ((match = imgPattern.exec(html)) !== null) {
      let src = match[1];
      
      // 处理相对路径
      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        const url = new URL(baseUrl);
        src = url.origin + src;
      } else if (!src.match(/^https?:\/\//i)) {
        src = new URL(src, baseUrl).href;
      }
      
      // 过滤非图片格式
      if (src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
        images.push(src);
      }
    }
    
    return [...new Set(images)]; // 去重
  }
  
  /**
   * 提取相关链接
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      let href = match[1];
      const linkText = match[2];
      
      // 处理相对路径
      if (href.startsWith('//')) {
        href = 'https:' + href;
      } else if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        href = url.origin + href;
      } else if (!href.match(/^https?:\/\//i)) {
        try {
          href = new URL(href, baseUrl).href;
        } catch {
          continue; // 跳过无效URL
        }
      }
      
      // 过滤掉站内链接和无效链接
      if (href.match(/^https?:\/\//i) && 
          !href.includes(baseUrl) &&
          linkText.trim().length > 0) {
        links.push(href);
      }
    }
    
    return [...new Set(links)]; // 去重
  }
  
  /**
   * 清理文本内容
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/\n\s*\n/g, '\n') // 清理换行
      .replace(/^\s+|\s+$/g, '') // 移除首尾空格
      .trim();
  }
  
  /**
   * 计算字数
   */
  private countWords(text: string): number {
    // 简单的中文字数计算（按字符和标点符号估算）
    const chineseChars = text.match(/[\u4e00-\u9fff\uff00-\uffff]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    
    // 中文字符按每个字1个字计算，英文单词按实际数量
    return chineseChars.length + englishWords.length;
  }
  
  /**
   * 保存网页内容到数据库
   */
  private async saveWebContent(entryId: number, content: ParsedNewsContent): Promise<void> {
    try {
      const drizzleDb = drizzle(this.db);
      const topicsJson = JSON.stringify(content.topics || []);
      const keywordsString = content.keywords ? content.keywords.join(',') : '';
      
      // 更新 processed_contents 表
      await drizzleDb.update(processedContents)
        .set({
          markdownContent: content.content,
          wordCount: content.wordCount,
          topics: topicsJson,
          keywords: keywordsString
        })
        .where(eq(processedContents.entryId, entryId));
      
      // 更新 rss_entries 表的处理状态
      await drizzleDb.update(rssEntries)
        .set({
          processed: true,
          processedAt: new Date(),
          failureCount: 0,
          errorMessage: null
        })
        .where(eq(rssEntries.id, entryId));
      
      console.log(`网页内容已保存，条目ID: ${entryId}，字数: ${content.wordCount}，主题: ${content.topics?.join(', ') || '无'}，状态已更新为已处理`);
    } catch (error) {
      console.error('保存网页内容失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取已保存的网页内容
   */
  async getWebContent(entryId: number): Promise<WebContentResult | null> {
    try {
      const drizzleDb = drizzle(this.db);
      
      console.log(`WebContentService: 开始查询条目 ${entryId} 的内容`);
      
      // 首先获取 rssEntries 表中的基本信息
      const rssEntry = await drizzleDb.select({
          title: rssEntries.title,
          link: rssEntries.link,
          publishedAt: rssEntries.publishedAt
        })
        .from(rssEntries)
        .where(eq(rssEntries.id, entryId))
        .get();
      
      if (!rssEntry) {
        console.log(`WebContentService: 条目 ${entryId} 在 rss_entries 表中不存在`);
        return null;
      }
      
      // 检查 processed_contents 表中是否有AI处理的内容
      const processedResult = await drizzleDb.select({
          content: processedContents.markdownContent,
          summary: processedContents.summary,
          keywords: processedContents.keywords,
          topics: processedContents.topics,
          images: processedContents.images,
          links: processedContents.links,
          author: processedContents.author,
          source: processedContents.source,
          publishTime: processedContents.publishTime,
          analysis: processedContents.analysis,
          educationalValue: processedContents.educationalValue,
          wordCount: processedContents.wordCount,
          createdAt: processedContents.createdAt
        })
        .from(processedContents)
        .where(eq(processedContents.entryId, entryId))
        .get();
      
      console.log(`WebContentService: RSS条目信息:`, rssEntry);
      console.log(`WebContentService: 处理内容结果:`, processedResult);
      
      if (!processedResult) {
        console.log(`WebContentService: 条目 ${entryId} 没有找到处理后的内容记录`);
        return null;
      }
      
      if (!processedResult.content) {
        console.log(`WebContentService: 条目 ${entryId} 找到记录但内容为空`);
        return null;
      }
      
      console.log(`WebContentService: 找到条目 ${entryId} 的完整内容，长度: ${processedResult.content.length}`);
      
      // 解析JSON字段（兼容字符串和JSON格式）
      let parsedImages = [];
      let parsedLinks = [];
      let parsedTopics = [];
      
      try {
        if (processedResult.images) {
          if (processedResult.images.startsWith('[') || processedResult.images.startsWith('{')) {
            parsedImages = JSON.parse(processedResult.images);
          } else {
            // 处理字符串格式，但排除占位值
            const imageValue = processedResult.images.trim();
            if (imageValue && imageValue !== 'images' && imageValue !== '[]') {
              parsedImages = [imageValue];
            }
          }
        }
      } catch (e) {
        console.warn(`解析图片JSON失败: ${e}`);
      }
      
      try {
        if (processedResult.links) {
          if (processedResult.links.startsWith('[') || processedResult.links.startsWith('{')) {
            parsedLinks = JSON.parse(processedResult.links);
          } else {
            // 处理字符串格式，但排除占位值
            const linkValue = processedResult.links.trim();
            if (linkValue && linkValue !== 'links' && linkValue !== '[]') {
              parsedLinks = [linkValue];
            }
          }
        }
      } catch (e) {
        console.warn(`解析链接JSON失败: ${e}`);
      }
      
      try {
        if (processedResult.topics) {
          if (processedResult.topics.startsWith('[') || processedResult.topics.startsWith('{')) {
            parsedTopics = JSON.parse(processedResult.topics);
          } else {
            // 处理字符串格式，但排除占位值
            const topicValue = processedResult.topics.trim();
            if (topicValue && topicValue !== 'topics' && topicValue !== '[]') {
              parsedTopics = [topicValue];
            }
          }
        }
      } catch (e) {
        console.warn(`解析主题JSON失败: ${e}`);
      }
      
      // 解析关键词
      const parsedKeywords = processedResult.keywords ? processedResult.keywords.split(',').filter(k => k.trim()) : [];
      
      // 使用处理后的字数，过滤占位值
      let wordCount = this.countWords(processedResult.content);
      if (processedResult.wordCount && processedResult.wordCount !== 'word_count') {
        wordCount = parseInt(processedResult.wordCount) || wordCount;
      }
      
      // 过滤掉占位值
      const filterPlaceholder = (value: string, placeholder: string) => {
        return value && value.trim() !== placeholder ? value : undefined;
      };

      return {
        title: rssEntry.title,
        content: processedResult.content,
        cleanContent: processedResult.content,
        images: parsedImages,
        links: parsedLinks,
        publishDate: processedResult.publishTime ? new Date(processedResult.publishTime) : rssEntry.publishedAt,
        wordCount: wordCount,
        // 添加原始链接信息
        url: rssEntry.link,
        // 添加AI处理的额外信息，过滤占位值
        summary: processedResult.summary,
        topics: parsedTopics,
        keywords: parsedKeywords,
        author: filterPlaceholder(processedResult.author, 'author'),
        source: filterPlaceholder(processedResult.source, 'source'),
        analysis: filterPlaceholder(processedResult.analysis, 'analysis'),
        educationalValue: filterPlaceholder(processedResult.educationalValue, 'educational_value')
      };
    } catch (error) {
      console.error('WebContentService: 获取网页内容失败:', error);
      return null;
    }
  }
  
  /**
   * 缓存管理
   */
  private getFromCache(url: string): WebContentResult | undefined {
    return this.cache.get(url);
  }
  
  private setToCache(url: string, result: WebContentResult): void {
    this.cache.set(url, result);
  }
}