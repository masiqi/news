-- Obsidian智能关联与内容优化功能数据库迁移
-- 创建增强内容分析、知识图谱和智能链接相关表

-- 1. 增强内容分析表
CREATE TABLE IF NOT EXISTS enhanced_content_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content_id INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  
  -- 基础内容信息
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  
  -- 主题和标签分析
  topics TEXT, -- JSON格式存储主题数组
  keywords TEXT, -- JSON格式存储关键词数组
  categories TEXT, -- JSON格式存储分类数组
  tags TEXT, -- JSON格式存储标签数组
  
  -- 情感和重要性分析
  sentiment_score REAL DEFAULT 0, -- 情感分数 (-1到1)
  sentiment_label TEXT, -- 情感标签 (positive, negative, neutral)
  importance_score REAL DEFAULT 0, -- 重要性分数 (0到1)
  readability_score REAL DEFAULT 0, -- 可读性分数 (0到1)
  
  -- 内容向量（用于相似度计算）
  content_vector TEXT, -- JSON格式存储向量数组
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  
  -- 时间上下文
  temporal_context TEXT, -- JSON格式存储时间上下文
  timeline_position TEXT DEFAULT 'established', -- breaking, developing, established
  
  -- 处理信息
  ai_model TEXT NOT NULL,
  processing_time INTEGER DEFAULT 0, -- 处理时间（毫秒）
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (content_id) REFERENCES processed_content(id),
  
  -- 索引
  INDEX idx_enhanced_user_id (user_id),
  INDEX idx_enhanced_content_id (content_id),
  INDEX idx_enhanced_sentiment (sentiment_score),
  INDEX idx_enhanced_importance (importance_score),
  INDEX idx_enhanced_processed_at (processed_at)
);

-- 2. 主题表（用于知识图谱）
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general', -- technology, business, science, etc.
  parent_topic_id INTEGER, -- 父主题ID，支持层级结构
  is_trending BOOLEAN DEFAULT FALSE,
  trend_score REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (parent_topic_id) REFERENCES topics(id),
  
  -- 索引
  INDEX idx_topics_name (name),
  INDEX idx_topics_category (category),
  INDEX idx_topics_trending (is_trending, trend_score),
  INDEX idx_topics_parent (parent_topic_id)
);

-- 3. 内容主题关联表
CREATE TABLE IF NOT EXISTS content_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_analysis_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  confidence REAL NOT NULL, -- 置信度 (0到1)
  relevance_score REAL DEFAULT 0, -- 相关性分数
  is_primary BOOLEAN DEFAULT FALSE, -- 是否为主要主题
  
  -- 外键
  FOREIGN KEY (content_analysis_id) REFERENCES enhanced_content_analysis(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  
  -- 唯一约束
  UNIQUE(content_analysis_id, topic_id),
  
  -- 索引
  INDEX idx_content_topics_analysis (content_analysis_id),
  INDEX idx_content_topics_topic (topic_id),
  INDEX idx_content_topics_confidence (confidence)
);

-- 4. 关键词表
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL UNIQUE,
  normalized_text TEXT NOT NULL UNIQUE, -- 标准化后的文本
  is_entity BOOLEAN DEFAULT FALSE,
  entity_type TEXT, -- PERSON, ORGANIZATION, LOCATION, etc.
  frequency INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_keywords_text (text),
  INDEX idx_keywords_normalized (normalized_text),
  INDEX idx_keywords_entity (is_entity, entity_type),
  INDEX idx_keywords_frequency (frequency)
);

-- 5. 内容关键词关联表
CREATE TABLE IF NOT EXISTS content_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_analysis_id INTEGER NOT NULL,
  keyword_id INTEGER NOT NULL,
  weight REAL NOT NULL, -- 权重 (0到1)
  context TEXT, -- 上下文信息
  position_in_content INTEGER, -- 在内容中的位置
  is_significant BOOLEAN DEFAULT FALSE, -- 是否为重要关键词
  
  -- 外键
  FOREIGN KEY (content_analysis_id) REFERENCES enhanced_content_analysis(id),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id),
  
  -- 唯一约束
  UNIQUE(content_analysis_id, keyword_id),
  
  -- 索引
  INDEX idx_content_keywords_analysis (content_analysis_id),
  INDEX idx_content_keywords_keyword (keyword_id),
  INDEX idx_content_keywords_weight (weight)
);

-- 6. 内容关联表（用于智能链接）
CREATE TABLE IF NOT EXISTS content_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_content_id INTEGER NOT NULL,
  target_content_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL, -- semantic, temporal, topical, source
  similarity_score REAL NOT NULL, -- 相似度分数 (0到1)
  relation_strength REAL DEFAULT 0, -- 关联强度
  relation_reason TEXT, -- 关联原因说明
  
  -- 时间关联信息
  time_relation TEXT, -- before, after, contemporary
  time_interval TEXT, -- 时间间隔描述
  
  -- 创建和更新时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (source_content_id) REFERENCES enhanced_content_analysis(id),
  FOREIGN KEY (target_content_id) REFERENCES enhanced_content_analysis(id),
  
  -- 唯一约束（避免重复关联）
  UNIQUE(source_content_id, target_content_id, relation_type),
  
  -- 索引
  INDEX idx_relations_source (source_content_id),
  INDEX idx_relations_target (target_content_id),
  INDEX idx_relations_type (relation_type),
  INDEX idx_relations_similarity (similarity_score),
  INDEX idx_relations_created (created_at)
);

-- 7. Obsidian模板表
CREATE TABLE IF NOT EXISTS obsidian_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_content TEXT NOT NULL, -- 模板内容（支持变量替换）
  
  -- 模板配置
  template_type TEXT DEFAULT 'article', -- article, summary, analysis
  yaml_frontmatter_config TEXT, -- JSON格式的YAML frontmatter配置
  
  -- 链接策略
  link_strategies TEXT, -- JSON格式的链接策略配置
  max_links INTEGER DEFAULT 10,
  
  -- 支持的样式
  supported_styles TEXT, -- JSON数组格式
  
  -- 模板属性
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version TEXT DEFAULT '1.0',
  
  -- 创建和更新时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 作者信息
  created_by INTEGER,
  
  -- 外键
  FOREIGN KEY (created_by) REFERENCES users(id),
  
  -- 索引
  INDEX idx_templates_name (name),
  INDEX idx_templates_type (template_type),
  INDEX idx_templates_active (is_active),
  INDEX idx_templates_default (is_default)
);

-- 8. 用户模板偏好表
CREATE TABLE IF NOT EXISTS user_template_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  preference_order INTEGER DEFAULT 0, -- 偏好顺序
  
  -- 自定义配置
  custom_config TEXT, -- JSON格式的自定义配置
  
  -- 使用统计
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  
  -- 创建时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES obsidian_templates(id),
  
  -- 唯一约束
  UNIQUE(user_id, template_id),
  
  -- 索引
  INDEX idx_user_prefs_user (user_id),
  INDEX idx_user_prefs_template (template_id),
  INDEX idx_user_prefs_order (preference_order)
);

-- 9. 知识图谱节点表
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  node_type TEXT NOT NULL, -- content, topic, keyword, tag
  node_id TEXT NOT NULL, -- 对应内容ID、主题ID等
  label TEXT NOT NULL,
  
  -- 节点属性
  properties TEXT, -- JSON格式的节点属性
  
  -- 可视化信息
  x_position REAL, -- 用于布局的X坐标
  y_position REAL, -- 用于布局的Y坐标
  node_size REAL DEFAULT 1, -- 节点大小
  node_color TEXT, -- 节点颜色
  
  -- 统计信息
  connection_count INTEGER DEFAULT 0,
  importance_score REAL DEFAULT 0,
  
  -- 时间信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (user_id) REFERENCES users(id),
  
  -- 唯一约束
  UNIQUE(user_id, node_type, node_id),
  
  -- 索引
  INDEX idx_nodes_user (user_id),
  INDEX idx_nodes_type (node_type),
  INDEX idx_nodes_importance (importance_score),
  INDEX idx_nodes_connections (connection_count)
);

-- 10. 知识图谱边表
CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_node_id INTEGER NOT NULL,
  target_node_id INTEGER NOT NULL,
  edge_type TEXT NOT NULL, -- relates_to, similar_to, references, etc.
  weight REAL DEFAULT 1, -- 边权重
  properties TEXT, -- JSON格式的边属性
  
  -- 时间信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (source_node_id) REFERENCES knowledge_graph_nodes(id),
  FOREIGN KEY (target_node_id) REFERENCES knowledge_graph_nodes(id),
  
  -- 索引
  INDEX idx_edges_user (user_id),
  INDEX idx_edges_source (source_node_id),
  INDEX idx_edges_target (target_node_id),
  INDEX idx_edges_type (edge_type),
  INDEX idx_edges_weight (weight)
);

-- 11. 智能链接生成日志表
CREATE TABLE IF NOT EXISTS smart_link_generation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content_analysis_id INTEGER NOT NULL,
  
  -- 生成统计
  total_links_generated INTEGER DEFAULT 0,
  tag_links_count INTEGER DEFAULT 0,
  topic_links_count INTEGER DEFAULT 0,
  similarity_links_count INTEGER DEFAULT 0,
  temporal_links_count INTEGER DEFAULT 0,
  
  -- 生成配置
  generation_config TEXT, -- JSON格式的生成配置
  
  -- 性能指标
  generation_time INTEGER DEFAULT 0, -- 生成时间（毫秒）
  
  -- 结果质量
  average_link_quality REAL DEFAULT 0, -- 平均链接质量分数
  
  -- 时间信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (content_analysis_id) REFERENCES enhanced_content_analysis(id),
  
  -- 索引
  INDEX idx_link_logs_user (user_id),
  INDEX idx_link_logs_content (content_analysis_id),
  INDEX idx_link_logs_created (created_at)
);

-- 12. 创建触发器：自动更新主题的trending状态
CREATE TRIGGER update_topic_trending 
AFTER INSERT ON content_topics
BEGIN
  -- 更新主题的trending状态基于最近24小时的内容关联数量
  UPDATE topics 
  SET is_trending = (
    SELECT COUNT(*) > 5 
    FROM content_topics ct
    JOIN enhanced_content_analysis eca ON ct.content_analysis_id = eca.id
    WHERE ct.topic_id = NEW.topic_id 
    AND eca.processed_at >= datetime('now', '-24 hours')
  ),
  trend_score = (
    SELECT COUNT(*)
    FROM content_topics ct
    JOIN enhanced_content_analysis eca ON ct.content_analysis_id = eca.id
    WHERE ct.topic_id = NEW.topic_id 
    AND eca.processed_at >= datetime('now', '-24 hours')
  ),
  updated_at = CURRENT_TIMESTAMP
  WHERE topics.id = NEW.topic_id;
END;

-- 13. 创建触发器：自动更新关键词频率
CREATE TRIGGER update_keyword_frequency
AFTER INSERT ON content_keywords
BEGIN
  UPDATE keywords 
  SET frequency = frequency + 1,
  updated_at = CURRENT_TIMESTAMP
  WHERE keywords.id = NEW.keyword_id;
END;

-- 14. 创建触发器：自动更新知识图谱节点连接数
CREATE TRIGGER update_node_connection_count
AFTER INSERT ON knowledge_graph_edges
BEGIN
  -- 更新源节点连接数
  UPDATE knowledge_graph_nodes 
  SET connection_count = connection_count + 1,
  updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.source_node_id;
  
  -- 更新目标节点连接数
  UPDATE knowledge_graph_nodes 
  SET connection_count = connection_count + 1,
  updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.target_node_id;
END;

-- 15. 插入默认Obsidian模板
INSERT OR IGNORE INTO obsidian_templates (name, description, template_content, template_type, is_default) VALUES 
(
  '标准新闻文章',
  '标准的新闻文章模板，包含完整的YAML frontmatter和智能链接',
  '---
title: {{title}}
date: {{date}}
source: {{source}}
original_url: {{original_url}}
categories: {{categories}}
keywords: {{keywords}}
tags: {{tags}}
sentiment: {{sentiment}}
importance: {{importance}}
readability: {{readability}}
ai_model: {{ai_model}}
processing_time: {{processing_time}}

# Obsidian特有字段
cssclass: [news-article, {{primary_category}}]
aliases: [{{title}}]
publish: false
permalink: {{content_id}}

# 关联和导航
related: {{related_content}}
topics: {{topics}}
timeline: {{timeline}}

# 元数据
created_at: {{created_at}}
updated_at: {{updated_at}}
---

# {{title}}

**来源**: [{{source}}]({{original_url}})  
**时间**: {{published_date}}  
**重要性**: {{importance_score}}/10  
**情感倾向**: {{sentiment_label}}  

## 摘要

{{summary}}

## 主要内容

{{content}}

## 主题标签

{{#each tags}}
- [[{{this}}]]
{{/each}}

## 相关内容

{{#each related_content}}
- [[{{this.title}}]] (相似度: {{this.similarity}}%)
{{/each}}

## 智能链接

{{smart_links}}

---
*由AI模型 {{ai_model}} 于 {{processing_time}} 处理生成*',
  'article',
  TRUE
),
(
  '简洁摘要',
  '简洁的内容摘要模板，专注于核心信息',
  '---
title: {{title}}
date: {{date}}
source: {{source}}
cssclass: [news-summary, {{primary_category}}]
tags: {{tags}}
importance: {{importance}}
---

# {{title}}

**{{source}}** | {{published_date}} | 重要性: {{importance_score}}/10

## 核心摘要

{{summary}}

## 关键要点

{{key_points}}

## 主题标签

{{#each tags}}
#{{this}} 
{{/each}}',
  'summary',
  FALSE
),
(
  '深度分析',
  '深度分析模板，包含详细的主题分析和关联',
  '---
title: {{title}}
date: {{date}}
source: {{source}}
original_url: {{original_url}}
cssclass: [news-analysis, {{primary_category}}]
categories: {{categories}}
tags: {{tags}}
sentiment: {{sentiment}}
importance: {{importance}}

# 分析元数据
ai_model: {{ai_model}}
analysis_depth: detailed
related_topics: {{topics}}
content_vector: {{content_vector_summary}}
---

# {{title}}

## 原文信息

- **来源**: {{source}}
- **发布时间**: {{published_date}}
- **原始链接**: [查看原文]({{original_url}})
- **处理时间**: {{processing_time}}

## AI深度分析

### 情感分析
- **情感倾向**: {{sentiment_label}} (分数: {{sentiment_score}})
- **重要性评分**: {{importance_score}}/10
- **可读性评分**: {{readability_score}}/10

### 核心主题
{{#each topics}}
- **{{this.name}}** (置信度: {{this.confidence}}%)
  - 分类: {{this.category}}
  - 趋势: {{#if this.trending}}🔥 热门{{else}}常规{{/if}}
{{/each}}

### 关键词分析
{{#each keywords}}
- **{{this.text}}** (权重: {{this.weight}})
  {{#if this.is_entity}}[实体: {{this.entity_type}}]{{/if}}
  {{#if this.context}}上下文: {{this.context}}{{/if}}
{{/each}}

### 时间上下文
- **时间位置**: {{timeline_position}}
- **时间窗口**: {{time_window}}
- **相关事件**: {{related_events}}

## 内容摘要

{{summary}}

## 详细内容

{{content}}

## 智能关联

### 相似内容
{{#each similar_content}}
- [[{{this.title}}]] (相似度: {{this.similarity}}%)
  - 关联原因: {{this.reason}}
{{/each}}

### 主题关联
{{#each topic_relations}}
- [[{{this.topic}}]]: {{this.relationship}}
{{/each}}

### 时间序列关联
{{#each temporal_relations}}
- [[{{this.title}}]] ({{this.time_relation}}: {{this.interval}})
{{/each}}

## 知识图谱节点

这个内容在知识图谱中建立了以下连接：
- 主题关联: {{topic_connections_count}} 个
- 内容相似度: {{similarity_connections_count}} 个  
- 时间序列: {{temporal_connections_count}} 个

---
*深度分析由 {{ai_model}} 模型提供，处理耗时 {{processing_time}}*',
  'analysis',
  FALSE
);