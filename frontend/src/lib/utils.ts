export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// 情感倾向翻译
export function translateSentiment(sentiment: string | null): string {
  if (!sentiment) return '未知';

  const sentimentMap: Record<string, string> = {
    'positive': '积极',
    'negative': '消极',
    'neutral': '中性',
    'mixed': '复杂',
    // 可能的其他值
    'very_positive': '非常积极',
    'very_negative': '非常消极',
  };

  return sentimentMap[sentiment.toLowerCase()] || sentiment;
}
