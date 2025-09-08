// src/services/news-content-parser.service.ts

/**
 * 专门用于解析新闻网页内容的服务
 * 针对中文新闻网站优化
 */
export class NewsContentParserService {
  
  /**
   * 解析新闻网页内容，专门提取新闻正文
   */
  static parseNewsContent(html: string, baseUrl: string): {
    title: string;
    content: string;
    publishTime?: string;
    author?: string;
    source?: string;
    images: string[];
    relatedLinks: string[];
    wordCount: number;
  } {
    // 清理HTML
    const cleanHtml = this.cleanHtml(html);
    
    // 提取标题
    const title = this.extractNewsTitle(cleanHtml);
    
    // 提取发布时间
    const publishTime = this.extractPublishTime(cleanHtml);
    
    // 提取作者
    const author = this.extractAuthor(cleanHtml);
    
    // 提取新闻来源
    const source = this.extractSource(cleanHtml);
    
    // 提取新闻正文（核心改进点）
    const content = this.extractNewsContent(cleanHtml);
    
    // 提取图片
    const images = this.extractNewsImages(html, baseUrl);
    
    // 提取相关链接
    const relatedLinks = this.extractRelatedLinks(html, baseUrl);
    
    // 计算字数
    const wordCount = this.countChineseWords(content);
    
    return {
      title,
      content,
      publishTime,
      author,
      source,
      images,
      relatedLinks,
      wordCount
    };
  }
  
  /**
   * 清理HTML，移除无用元素
   */
  private static cleanHtml(html: string): string {
    return html
      // 移除脚本、样式、注释
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // 移除广告相关
      .replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*id="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<span[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
      // 移除导航、页眉、页脚
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      // 移除分享、点赞等社交媒体元素
      .replace(/<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*social[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // 移除相关推荐
      .replace(/<div[^>]*class="[^"]*recommend[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // 移除评论区
      .replace(/<div[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<section[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
      // 标准化空白字符
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '');
  }
  
  /**
   * 提取新闻标题（专门针对新闻网站优化）
   */
  private static extractNewsTitle(html: string): string {
    const titlePatterns = [
      // 优先匹配新闻标题专用class
      /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*)<\/h1>/i,
      /<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([^<]*)<\/h1>/i,
      /<h1[^>]*class="[^"]*news-title[^"]*"[^>]*>([^<]*)<\/h1>/i,
      /<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([^<]*)<\/h1>/i,
      // 通用标题标签
      /<h1[^>]*>([^<]*)<\/h1>/i,
      /<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*)<\/h2>/i,
      /<h2[^>]*class="[^"]*article-title[^"]*"[^>]*>([^<]*)<\/h2>/i,
      // 从meta标签提取
      /<meta\s+property="og:title"[^>]*content="([^"]*)"/i,
      /<title[^>]*>([^<]*)<\/title>/i,
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
   * 提取新闻正文内容（核心改进部分）
   */
  private static extractNewsContent(html: string): string {
    // 优先匹配文章主体区域
    const contentPatterns = [
      // 专用新闻内容class
      /<article[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
      /<article[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
      /<article[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
      /<article[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
      // 通用article标签
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      // 新闻内容div专用class
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      // main内容区域
      /<main[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/main>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];
    
    let content = '';
    for (const pattern of contentPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        content = match[1];
        break;
      }
    }
    
    // 如果没有匹配到专用内容区域，尝试通用方法
    if (!content) {
      content = this.extractContentByHeuristics(html);
    }
    
    // 进一步清理内容，移除剩余的导航元素
    content = this.cleanContent(content);
    
    // 提取纯文本
    return this.extractTextFromHtml(content);
  }
  
  /**
   * 使用启发式方法提取内容（备选方案）
   */
  private static extractContentByHeuristics(html: string): string {
    // 寻找包含大段文本的div
    const divMatches = html.match(/<div[^>]*>([\s\S]*?)<\/div>/gi);
    
    let bestContent = '';
    let maxWordCount = 0;
    
    for (const match of divMatches) {
      const divContent = match[1];
      const textContent = this.extractTextFromHtml(divContent);
      const wordCount = this.countChineseWords(textContent);
      
      // 排除过短的内容（可能是导航或其他）
      if (wordCount > 100 && wordCount > maxWordCount) {
        // 检查是否包含大量新闻关键词
        const newsKeywords = ['新闻', '报道', '记者', '获悉', '表示', '指出', '强调'];
        const keywordScore = newsKeywords.reduce((score, keyword) => {
          return score + (textContent.includes(keyword) ? 1 : 0);
        }, 0);
        
        if (keywordScore >= 2) {
          maxWordCount = wordCount;
          bestContent = divContent;
        }
      }
    }
    }
    
    return bestContent;
  }
  
  /**
   * 进一步清理内容，移除剩余的无用元素
   */
  private static cleanContent(content: string): string {
    return content
      // 移除剩余的导航元素
      .replace(/<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<ul[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/ul>/gi, '')
      // 移除分享按钮
      .replace(/<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // 移除相关文章推荐
      .replace(/<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // 移除图片说明（如果是单独的div）
      .replace(/<div[^>]*class="[^"]*caption[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // 移除时间戳
      .replace(/<time[^>]*>[\s\S]*?<\/time>/gi, '')
      .replace(/<span[^>]*class="[^"]*time[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
      // 移除作者信息
      .replace(/<address[^>]*>[\s\S]*?<\/address>/gi, '')
      .replace(/<span[^>]*class="[^"]*author[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  }
  
  /**
   * 从HTML中提取纯文本
   */
  private static extractTextFromHtml(html: string): string {
    return html
      // 替换HTML标签为空格
      .replace(/<[^>]+>/g, ' ')
      // 合并多个空格
      .replace(/\s+/g, ' ')
      // 清理换行
      .replace(/\n\s*\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      // 移除首尾空格
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }
  
  /**
   * 提取发布时间
   */
  private static extractPublishTime(html: string): string | undefined {
    const timePatterns = [
      /<time[^>]*>([^<]*)<\/time>/i,
      /<span[^>]*class="[^"]*time[^"]*"[^>]*>([^<]*)<\/span>/i,
      /<meta\s+property="article:published_time"[^>]*content="([^"]*)"/i,
      /<meta\s+name="publish_date"[^>]*content="([^"]*)"/i,
    ];
    
    for (const pattern of timePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.cleanText(match[1]).trim();
      }
    }
    
    return undefined;
  }
  
  /**
   * 提取作者
   */
  private static extractAuthor(html: string): string | undefined {
    const authorPatterns = [
      /<address[^>]*>([^<]*)<\/address>/i,
      /<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]*)<\/span>/i,
      /<meta\s+name="author"[^>]*content="([^"]*)"/i,
      /<div[^>]*class="[^"]*author[^"]*"[^>]*>([^<]*)<\/div>/i,
    ];
    
    for (const pattern of authorPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.cleanText(match[1]).trim();
      }
    }
    
    return undefined;
  }
  
  /**
   * 提取新闻来源
   */
  private static extractSource(html: string): string | undefined {
    const sourcePatterns = [
      /<span[^>]*class="[^"]*source[^"]*"[^>]*>([^<]*)<\/span>/i,
      /<div[^>]*class="[^"]*source[^"]*"[^>]*>([^<]*)<\/div>/i,
      /<meta\s+name="source"[^>]*content="([^"]*)"/i,
    ];
    
    for (const pattern of sourcePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.cleanText(match[1]).trim();
      }
    }
    
    return undefined;
  }
  
  /**
   * 提取新闻相关图片
   */
  private static extractNewsImages(html: string, baseUrl: string): string[] {
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
        try {
          src = new URL(src, baseUrl).href;
        } catch {
          continue;
        }
      }
      
      // 过滤掉明显的非新闻图片（广告、图标等）
      const isAdImage = /\/(ad|banner|logo|icon|avatar|advertisement)/i.test(src);
      const isValidImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(src);
      
      if (!isAdImage && isValidImage) {
        images.push(src);
      }
    }
    
    // 去重，只保留前10张图片（通常是文章配图）
    return [...new Set(images)].slice(0, 10);
  }
  
  /**
   * 提取相关链接（过滤掉站内导航链接）
   */
  private static extractRelatedLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    
    const currentDomain = new URL(baseUrl).hostname;
    
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      let href = match[1];
      const linkText = match[2].trim();
      
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
          continue;
        }
      }
      
      // 过滤链接
      const linkUrl = new URL(href);
      const isExternalLink = linkUrl.hostname !== currentDomain;
      const isValidText = linkText.length >= 2 && 
                        !/首页|导航|登录|注册|联系|关于|广告|评论|分享/i.test(linkText);
      
      // 只保留外部链接和有效的文本链接
      if (isExternalLink && isValidText) {
        links.push(href);
      }
    }
    
    // 去重，只保留前10个相关链接
    return [...new Set(links)].slice(0, 10);
  }
  
  /**
   * 清理文本内容
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }
  
  /**
   * 计算中文字数
   */
  private static countChineseWords(text: string): number {
    // 移除HTML标签（如果还有）
    const plainText = text.replace(/<[^>]+>/g, '');
    
    // 匹配中文字符
    const chineseChars = plainText.match(/[\u4e00-\u9fff\uff00-\uffff]/g) || [];
    
    // 匹配英文单词
    const englishWords = plainText.match(/[a-zA-Z]+/g) || [];
    
    // 匹配数字
    const numbers = plainText.match(/\d+/g) || [];
    
    // 中文字符按1:1计算，英文单词按1:1计算，数字按1:1计算
    return chineseChars.length + englishWords.length + numbers.length;
  }
}