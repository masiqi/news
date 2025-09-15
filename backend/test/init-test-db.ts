// 测试数据库初始化脚本
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

// 创建测试数据库连接
const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

function initTestDatabase() {
  // 创建users表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建增强内容分析表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS enhanced_content_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_url TEXT,
      categories TEXT, -- JSON
      keywords TEXT, -- JSON
      topics TEXT, -- JSON
      tags TEXT, -- JSON
      summary TEXT,
      sentiment TEXT, -- JSON
      importance REAL DEFAULT 0,
      readability REAL DEFAULT 0,
      content_vector TEXT, -- JSON
      ai_model TEXT,
      processing_time INTEGER,
      timeline_position TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建知识图谱节点表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      label TEXT NOT NULL,
      metadata TEXT, -- JSON
      importance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建知识图谱边表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      edge_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      weight REAL DEFAULT 0,
      metadata TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建内容关系表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS content_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      strength REAL DEFAULT 0,
      metadata TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建Obsidian模板表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS obsidian_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      template_content TEXT NOT NULL,
      template_type TEXT NOT NULL,
      yaml_frontmatter_config TEXT, -- JSON
      link_strategies TEXT, -- JSON
      max_links INTEGER DEFAULT 10,
      supported_styles TEXT, -- JSON
      is_active BOOLEAN DEFAULT 1,
      is_default BOOLEAN DEFAULT 0,
      version TEXT DEFAULT '1.0',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建用户模板偏好表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_template_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      preference_order INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, template_id)
    )
  `);

  // 插入默认模板
  const defaultTemplate = sqlite.prepare(`
    INSERT OR IGNORE INTO obsidian_templates (
      id, name, description, template_content, template_type, 
      yaml_frontmatter_config, link_strategies, max_links, supported_styles,
      is_active, is_default, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  defaultTemplate.run(
    1,
    'standard-news-article',
    '标准新闻文章模板',
    '# {{title}}\n\n{{summary}}\n\n## 内容\n\n{{content}}\n\n## 元数据\n- **来源**: {{source}}\n- **日期**: {{date}}\n- **分类**: {{categories}}\n- **标签**: {{tags}}',
    'article',
    JSON.stringify({
      includeBasicFields: true,
      includeAnalysisFields: true,
      includeObsidianFields: true,
      includeNavigationFields: true,
      customFields: {},
      fieldMappings: {}
    }),
    JSON.stringify([]),
    10,
    JSON.stringify(['default']),
    1,
    1,
    '1.0',
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log('Test database initialized successfully');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  initTestDatabase();
}

export { initTestDatabase };