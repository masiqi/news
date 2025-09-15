// Obsidian智能链接与内容优化配置
export interface ObsidianConfig {
  // AI分析配置
  ai: {
    model: string;
    embeddingModel: string;
    maxTokens: number;
    temperature: number;
    confidenceThreshold: number;
  };
  
  // 内容分析配置
  analysis: {
    maxTopics: number;
    maxKeywords: number;
    minKeywordWeight: number;
    sentimentAnalysis: boolean;
    importanceScoring: boolean;
    readabilityScoring: boolean;
  };
  
  // 链接生成配置
  links: {
    maxLinks: number;
    similarityThreshold: number;
    timeWindowDays: number;
    enableTagLinks: boolean;
    enableTopicLinks: boolean;
    enableSimilarityLinks: boolean;
    enableTemporalLinks: boolean;
  };
  
  // 模板配置
  templates: {
    defaultTemplate: string;
    customTemplatesEnabled: boolean;
    yamlFrontmatter: boolean;
    smartFields: boolean;
  };
  
  // 知识图谱配置
  knowledgeGraph: {
    maxNodes: number;
    maxEdges: number;
    layoutAlgorithm: string;
    autoUpdate: boolean;
    visualizationEnabled: boolean;
  };
  
  // 性能配置
  performance: {
    batchProcessingSize: number;
    cacheTTL: number;
    maxConcurrentAnalysis: number;
    enableCaching: boolean;
  };
}

// 默认配置
export const defaultObsidianConfig: ObsidianConfig = {
  ai: {
    model: '@cf/meta/llama-3.1-8b-instruct',
    embeddingModel: '@cf/baai/bge-large-en-v1.5',
    maxTokens: 4000,
    temperature: 0.7,
    confidenceThreshold: 0.6,
  },
  
  analysis: {
    maxTopics: 10,
    maxKeywords: 20,
    minKeywordWeight: 0.1,
    sentimentAnalysis: true,
    importanceScoring: true,
    readabilityScoring: true,
  },
  
  links: {
    maxLinks: 15,
    similarityThreshold: 0.3,
    timeWindowDays: 30,
    enableTagLinks: true,
    enableTopicLinks: true,
    enableSimilarityLinks: true,
    enableTemporalLinks: true,
  },
  
  templates: {
    defaultTemplate: 'standard-news-article',
    customTemplatesEnabled: true,
    yamlFrontmatter: true,
    smartFields: true,
  },
  
  knowledgeGraph: {
    maxNodes: 1000,
    maxEdges: 5000,
    layoutAlgorithm: 'force-directed',
    autoUpdate: true,
    visualizationEnabled: true,
  },
  
  performance: {
    batchProcessingSize: 10,
    cacheTTL: 3600, // 1小时
    maxConcurrentAnalysis: 5,
    enableCaching: true,
  },
};

// 链接策略配置
export interface LinkStrategy {
  type: 'tag' | 'topic' | 'keyword' | 'similarity' | 'temporal';
  enabled: boolean;
  threshold: number;
  template: string;
  maxLinks: number;
  weight: number;
}

// 默认链接策略
export const defaultLinkStrategies: LinkStrategy[] = [
  {
    type: 'tag',
    enabled: true,
    threshold: 0.5,
    template: '#{{tag}}',
    maxLinks: 10,
    weight: 1.0,
  },
  {
    type: 'topic',
    enabled: true,
    threshold: 0.6,
    template: '[[{{topic}}]]',
    maxLinks: 8,
    weight: 0.9,
  },
  {
    type: 'keyword',
    enabled: true,
    threshold: 0.7,
    template: '{{keyword}}',
    maxLinks: 5,
    weight: 0.7,
  },
  {
    type: 'similarity',
    enabled: true,
    threshold: 0.4,
    template: '[[{{title}}]] (相似度: {{similarity}}%)',
    maxLinks: 5,
    weight: 0.8,
  },
  {
    type: 'temporal',
    enabled: true,
    threshold: 0.3,
    template: '[[{{title}}]] ({{timeRelation}}: {{timeInterval}})',
    maxLinks: 3,
    weight: 0.6,
  },
];

// Obsidian特有字段配置
export interface ObsidianFields {
  // 基础字段
  title: string;
  date: string;
  source: string;
  original_url: string;
  
  // 分类和标签
  categories: string[];
  keywords: string[];
  tags: string[];
  
  // 分析结果
  sentiment: string;
  importance: number;
  readability: number;
  
  // Obsidian特有字段
  cssclass: string[];
  aliases: string[];
  publish: boolean;
  permalink: string;
  
  // 关联和导航
  related: string[];
  topics: string[];
  timeline: string[];
  
  // 元数据
  created_at: string;
  updated_at: string;
  ai_model: string;
  processing_time: string;
}

// YAML frontmatter配置
export interface YAMLFrontmatterConfig {
  includeBasicFields: boolean;
  includeAnalysisFields: boolean;
  includeObsidianFields: boolean;
  includeNavigationFields: boolean;
  customFields: Record<string, any>;
  
  // 字段映射
  fieldMappings: {
    [key: string]: string;
  };
}

// 默认YAML frontmatter配置
export const defaultYAMLConfig: YAMLFrontmatterConfig = {
  includeBasicFields: true,
  includeAnalysisFields: true,
  includeObsidianFields: true,
  includeNavigationFields: true,
  customFields: {},
  
  fieldMappings: {
    title: 'title',
    date: 'date',
    source: 'source',
    original_url: 'original_url',
    categories: 'categories',
    keywords: 'keywords',
    tags: 'tags',
    sentiment: 'sentiment',
    importance: 'importance',
    readability: 'readability',
    cssclass: 'cssclass',
    aliases: 'aliases',
    publish: 'publish',
    permalink: 'permalink',
    related: 'related',
    topics: 'topics',
    timeline: 'timeline',
    created_at: 'created_at',
    updated_at: 'updated_at',
    ai_model: 'ai_model',
    processing_time: 'processing_time',
  },
};

// 知识图谱可视化配置
export interface GraphVisualizationConfig {
  // 节点配置
  nodes: {
    sizeRange: [number, number];
    colorSchemes: {
      content: string;
      topic: string;
      keyword: string;
      tag: string;
    };
    labelMaxLength: number;
    showIcons: boolean;
  };
  
  // 边配置
  edges: {
    widthRange: [number, number];
    opacityRange: [number, number];
    curvedEdges: boolean;
    showLabels: boolean;
  };
  
  // 布局配置
  layout: {
    algorithm: 'force-directed' | 'circular' | 'hierarchical' | 'grid';
    iterations: number;
    gravity: number;
    charge: number;
    linkDistance: number;
  };
  
  // 交互配置
  interaction: {
    draggable: boolean;
    zoomable: boolean;
    selectable: boolean;
    hoverHighlight: boolean;
    clickToFocus: boolean;
  };
  
  // 标签配置
  labels: {
    showLabels: boolean;
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    borderRadius: number;
    padding: number;
  };
}

// 默认可视化配置
export const defaultGraphConfig: GraphVisualizationConfig = {
  nodes: {
    sizeRange: [5, 20],
    colorSchemes: {
      content: '#3b82f6',
      topic: '#10b981',
      keyword: '#f59e0b',
      tag: '#ef4444',
    },
    labelMaxLength: 30,
    showIcons: true,
  },
  
  edges: {
    widthRange: [1, 5],
    opacityRange: [0.3, 1.0],
    curvedEdges: true,
    showLabels: false,
  },
  
  layout: {
    algorithm: 'force-directed',
    iterations: 100,
    gravity: 0.1,
    charge: -300,
    linkDistance: 100,
  },
  
  interaction: {
    draggable: true,
    zoomable: true,
    selectable: true,
    hoverHighlight: true,
    clickToFocus: true,
  },
  
  labels: {
    showLabels: true,
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    backgroundColor: '#1f2937',
    borderRadius: 4,
    padding: 4,
  },
};

// 配置验证函数
export function validateObsidianConfig(config: Partial<ObsidianConfig>): ObsidianConfig {
  const validated = { ...defaultObsidianConfig, ...config };
  
  // 验证AI配置
  if (validated.ai.temperature < 0 || validated.ai.temperature > 2) {
    throw new Error('AI temperature must be between 0 and 2');
  }
  
  if (validated.ai.confidenceThreshold < 0 || validated.ai.confidenceThreshold > 1) {
    throw new Error('AI confidence threshold must be between 0 and 1');
  }
  
  // 验证链接配置
  if (validated.links.maxLinks < 0 || validated.links.maxLinks > 50) {
    throw new Error('Max links must be between 0 and 50');
  }
  
  if (validated.links.similarityThreshold < 0 || validated.links.similarityThreshold > 1) {
    throw new Error('Similarity threshold must be between 0 and 1');
  }
  
  // 验证性能配置
  if (validated.performance.batchProcessingSize < 1 || validated.performance.batchProcessingSize > 100) {
    throw new Error('Batch processing size must be between 1 and 100');
  }
  
  if (validated.performance.maxConcurrentAnalysis < 1 || validated.performance.maxConcurrentAnalysis > 20) {
    throw new Error('Max concurrent analysis must be between 1 and 20');
  }
  
  return validated;
}

// 获取环境变量配置
export function getObsidianConfigFromEnv(): ObsidianConfig {
  const config = { ...defaultObsidianConfig };
  
  // 从环境变量覆盖配置
  if (process.env.OBSIDIAN_AI_MODEL) {
    config.ai.model = process.env.OBSIDIAN_AI_MODEL;
  }
  
  if (process.env.OBSIDIAN_MAX_LINKS) {
    config.links.maxLinks = parseInt(process.env.OBSIDIAN_MAX_LINKS);
  }
  
  if (process.env.OBSIDIAN_SIMILARITY_THRESHOLD) {
    config.links.similarityThreshold = parseFloat(process.env.OBSIDIAN_SIMILARITY_THRESHOLD);
  }
  
  if (process.env.OBSIDIAN_ENABLE_CACHE) {
    config.performance.enableCaching = process.env.OBSIDIAN_ENABLE_CACHE === 'true';
  }
  
  return validateObsidianConfig(config);
}