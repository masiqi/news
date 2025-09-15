// 知识图谱服务和推荐引擎
// 构建文档关系图并提供智能推荐功能

import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  knowledgeGraphNodes, 
  knowledgeGraphEdges, 
  contentRelations, 
  enhancedContentAnalysis,
  obsidianTemplates 
} from '../db/schema';
import { 
  type EnhancedAnalysisResult,
  type ContentRelation,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type ContentRecommendation,
  getObsidianConfigFromEnv,
  defaultGraphConfig
} from '../config/obsidian.config';

// 知识图谱节点类型
export type NodeType = 'content' | 'topic' | 'keyword' | 'tag' | 'category';

// 知识图谱边类型
export type EdgeType = 'contains' | 'related' | 'similar' | 'temporal' | 'hierarchical';

// 图谱查询参数
export interface GraphQuery {
  userId: number;
  centerNodeId?: string;
  maxDepth?: number;
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

// 图谱可视化数据
export interface GraphVisualization {
  nodes: Array<{
    id: string;
    label: string;
    type: NodeType;
    x: number;
    y: number;
    size: number;
    color: string;
    metadata: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    weight: number;
    label?: string;
    metadata: Record<string, any>;
  }>;
}

// 推荐请求参数
export interface RecommendationRequest {
  userId: number;
  contentId?: number;
  limit?: number;
  algorithm?: 'collaborative' | 'content-based' | 'hybrid' | 'trending';
  timeRange?: number; // 天数
  excludeViewed?: boolean;
}

export class KnowledgeGraphService {
  private config = getObsidianConfigFromEnv();
  
  /**
   * 构建知识图谱
   */
  async buildKnowledgeGraph(userId: number): Promise<void> {
    // 获取用户的所有增强分析内容
    const analyses = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId));
    
    // 清理现有图谱数据
    await this.clearUserGraph(userId);
    
    // 构建节点
    const nodes = await this.buildGraphNodes(userId, analyses);
    
    // 构建边
    const edges = await this.buildGraphEdges(userId, analyses, nodes);
    
    // 存储图谱数据
    await this.storeGraphData(userId, nodes, edges);
  }
  
  /**
   * 获取知识图谱可视化数据
   */
  async getGraphVisualization(query: GraphQuery): Promise<GraphVisualization> {
    // 获取基础节点和边
    const { nodes, edges } = await this.getGraphData(query);
    
    // 应用布局算法
    const layout = this.applyLayout(nodes, edges, defaultGraphConfig.layout);
    
    // 应用可视化配置
    const visualization = this.applyVisualizationConfig(layout, defaultGraphConfig);
    
    return visualization;
  }
  
  /**
   * 获取内容推荐
   */
  async getRecommendations(request: RecommendationRequest): Promise<ContentRecommendation[]> {
    const { userId, contentId, limit = 10, algorithm = 'hybrid' } = request;
    
    switch (algorithm) {
      case 'collaborative':
        return this.getCollaborativeRecommendations(userId, limit);
      case 'content-based':
        return this.getContentBasedRecommendations(userId, contentId, limit);
      case 'trending':
        return this.getTrendingRecommendations(userId, limit);
      case 'hybrid':
      default:
        return this.getHybridRecommendations(userId, contentId, limit);
    }
  }
  
  /**
   * 查询知识图谱
   */
  async queryGraph(query: GraphQuery): Promise<{
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
    paths: string[][];
  }> {
    const { userId, centerNodeId, maxDepth = 2, nodeTypes, edgeTypes } = query;
    
    // 获取中心节点
    const centerNode = centerNodeId ? await this.getNodeById(centerNodeId) : null;
    
    // 获取相关节点和边
    const { nodes, edges } = await this.getNeighborhood(userId, centerNode, maxDepth, nodeTypes, edgeTypes);
    
    // 计算路径
    const paths = await this.findPaths(nodes, edges, centerNode);
    
    return { nodes, edges, paths };
  }
  
  /**
   * 更新内容关系
   */
  async updateContentRelations(userId: number, contentId: number): Promise<void> {
    // 获取当前内容分析
    const [analysis] = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          eq(enhancedContentAnalysis.contentId, contentId)
        )
      );
    
    if (!analysis) return;
    
    // 删除现有关系
    await db
      .delete(contentRelations)
      .where(
        and(
          eq(contentRelations.sourceId, contentId),
          eq(contentRelations.userId, userId)
        )
      );
    
    // 分析新关系
    const relations = await this.analyzeContentRelations(userId, analysis);
    
    // 存储新关系
    if (relations.length > 0) {
      await db.insert(contentRelations).values(relations);
    }
    
    // 更新知识图谱
    await this.incrementalGraphUpdate(userId, contentId);
  }
  
  /**
   * 获取相似内容
   */
  async getSimilarContent(
    userId: number, 
    contentId: number, 
    limit: number = 5
  ): Promise<Array<{ content: EnhancedAnalysisResult; similarity: number }>> {
    // 获取向量相似度
    const vectorSimilar = await this.getVectorSimilarity(userId, contentId, limit);
    
    // 获取语义相似度
    const semanticSimilar = await this.getSemanticSimilarity(userId, contentId, limit);
    
    // 合并和排序结果
    const combined = this.combineSimilarityResults(vectorSimilar, semanticSimilar);
    
    return combined.slice(0, limit);
  }
  
  /**
   * 构建图节点
   */
  private async buildGraphNodes(
    userId: number, 
    analyses: typeof enhancedContentAnalysis.$inferSelect[]
  ): Promise<Array<{
    id: string;
    type: NodeType;
    label: string;
    metadata: Record<string, any>;
    importance: number;
  }>> {
    const nodes: Array<{
      id: string;
      type: NodeType;
      label: string;
      metadata: Record<string, any>;
      importance: number;
    }> = [];
    
    for (const analysis of analyses) {
      // 内容节点
      nodes.push({
        id: `content-${analysis.contentId}`,
        type: 'content',
        label: analysis.title,
        metadata: {
          contentId: analysis.contentId,
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          importance: analysis.importance,
          createdAt: analysis.createdAt,
          topics: analysis.topics,
          keywords: analysis.keywords
        },
        importance: analysis.importance
      });
      
      // 主题节点
      if (analysis.topics) {
        const topics = Array.isArray(analysis.topics) ? analysis.topics : JSON.parse(analysis.topics || '[]');
        topics.forEach((topic: any) => {
          nodes.push({
            id: `topic-${topic.name}`,
            type: 'topic',
            label: topic.name,
            metadata: {
              weight: topic.weight,
              frequency: topic.frequency
            },
            importance: topic.weight
          });
        });
      }
      
      // 关键词节点
      if (analysis.keywords) {
        const keywords = Array.isArray(analysis.keywords) ? analysis.keywords : JSON.parse(analysis.keywords || '[]');
        keywords.forEach((keyword: any) => {
          nodes.push({
            id: `keyword-${keyword.text}`,
            type: 'keyword',
            label: keyword.text,
            metadata: {
              weight: keyword.weight,
              frequency: keyword.frequency
            },
            importance: keyword.weight
          });
        });
      }
      
      // 标签节点
      if (analysis.tags) {
        const tags = Array.isArray(analysis.tags) ? analysis.tags : JSON.parse(analysis.tags || '[]');
        tags.forEach((tag: string) => {
          nodes.push({
            id: `tag-${tag}`,
            type: 'tag',
            label: tag,
            metadata: {},
            importance: 0.5
          });
        });
      }
      
      // 分类节点
      if (analysis.categories) {
        const categories = Array.isArray(analysis.categories) ? analysis.categories : JSON.parse(analysis.categories || '[]');
        categories.forEach((category: any) => {
          nodes.push({
            id: `category-${category.name}`,
            type: 'category',
            label: category.name,
            metadata: {
              confidence: category.confidence
            },
            importance: category.confidence
          });
        });
      }
    }
    
    // 去重
    return this.deduplicateNodes(nodes);
  }
  
  /**
   * 构建图边
   */
  private async buildGraphEdges(
    userId: number,
    analyses: typeof enhancedContentAnalysis.$inferSelect[],
    nodes: Array<{
      id: string;
      type: NodeType;
      label: string;
      metadata: Record<string, any>;
      importance: number;
    }>
  ): Promise<Array<{
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    weight: number;
    metadata: Record<string, any>;
  }>> {
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      type: EdgeType;
      weight: number;
      metadata: Record<string, any>;
    }> = [];
    
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    
    for (const analysis of analyses) {
      const contentNodeId = `content-${analysis.contentId}`;
      const contentNode = nodeMap.get(contentNodeId);
      
      if (!contentNode) continue;
      
      // 主题关系
      if (analysis.topics) {
        const topics = Array.isArray(analysis.topics) ? analysis.topics : JSON.parse(analysis.topics || '[]');
        topics.forEach((topic: any) => {
          const topicNodeId = `topic-${topic.name}`;
          if (nodeMap.has(topicNodeId)) {
            edges.push({
              id: `${contentNodeId}-${topicNodeId}`,
              source: contentNodeId,
              target: topicNodeId,
              type: 'contains',
              weight: topic.weight,
              metadata: {
                relation: 'contains_topic',
                confidence: topic.weight
              }
            });
          }
        });
      }
      
      // 关键词关系
      if (analysis.keywords) {
        const keywords = Array.isArray(analysis.keywords) ? analysis.keywords : JSON.parse(analysis.keywords || '[]');
        keywords.forEach((keyword: any) => {
          const keywordNodeId = `keyword-${keyword.text}`;
          if (nodeMap.has(keywordNodeId)) {
            edges.push({
              id: `${contentNodeId}-${keywordNodeId}`,
              source: contentNodeId,
              target: keywordNodeId,
              type: 'contains',
              weight: keyword.weight,
              metadata: {
                relation: 'contains_keyword',
                frequency: keyword.frequency
              }
            });
          }
        });
      }
      
      // 标签关系
      if (analysis.tags) {
        const tags = Array.isArray(analysis.tags) ? analysis.tags : JSON.parse(analysis.tags || '[]');
        tags.forEach((tag: string) => {
          const tagNodeId = `tag-${tag}`;
          if (nodeMap.has(tagNodeId)) {
            edges.push({
              id: `${contentNodeId}-${tagNodeId}`,
              source: contentNodeId,
              target: tagNodeId,
              type: 'contains',
              weight: 0.7,
              metadata: {
                relation: 'has_tag'
              }
            });
          }
        });
      }
      
      // 分类关系
      if (analysis.categories) {
        const categories = Array.isArray(analysis.categories) ? analysis.categories : JSON.parse(analysis.categories || '[]');
        categories.forEach((category: any) => {
          const categoryNodeId = `category-${category.name}`;
          if (nodeMap.has(categoryNodeId)) {
            edges.push({
              id: `${contentNodeId}-${categoryNodeId}`,
              source: contentNodeId,
              target: categoryNodeId,
              type: 'hierarchical',
              weight: category.confidence,
              metadata: {
                relation: 'belongs_to_category',
                confidence: category.confidence
              }
            });
          }
        });
      }
    }
    
    // 添加内容间相似关系
    const similarityEdges = await this.calculateContentSimilarityEdges(analyses);
    edges.push(...similarityEdges);
    
    return edges;
  }
  
  /**
   * 清理用户图谱数据
   */
  private async clearUserGraph(userId: number): Promise<void> {
    await db
      .delete(knowledgeGraphEdges)
      .where(eq(knowledgeGraphEdges.userId, userId));
    
    await db
      .delete(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.userId, userId));
  }
  
  /**
   * 存储图谱数据
   */
  private async storeGraphData(
    userId: number,
    nodes: Array<{
      id: string;
      type: NodeType;
      label: string;
      metadata: Record<string, any>;
      importance: number;
    }>,
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: EdgeType;
      weight: number;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    // 存储节点
    if (nodes.length > 0) {
      await db.insert(knowledgeGraphNodes).values(
        nodes.map(node => ({
          userId,
          nodeId: node.id,
          nodeType: node.type,
          label: node.label,
          metadata: JSON.stringify(node.metadata),
          importance: node.importance,
          createdAt: new Date()
        }))
      );
    }
    
    // 存储边
    if (edges.length > 0) {
      await db.insert(knowledgeGraphEdges).values(
        edges.map(edge => ({
          userId,
          edgeId: edge.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          edgeType: edge.type,
          weight: edge.weight,
          metadata: JSON.stringify(edge.metadata),
          createdAt: new Date()
        }))
      );
    }
  }
  
  /**
   * 获取图谱数据
   */
  private async getGraphData(query: GraphQuery): Promise<{
    nodes: typeof knowledgeGraphNodes.$inferSelect[];
    edges: typeof knowledgeGraphEdges.$inferSelect[];
  }> {
    const { userId, nodeTypes, edgeTypes } = query;
    
    // 构建查询条件
    let nodeCondition = eq(knowledgeGraphNodes.userId, userId);
    if (nodeTypes && nodeTypes.length > 0) {
      nodeCondition = and(nodeCondition, inArray(knowledgeGraphNodes.nodeType, nodeTypes));
    }
    
    let edgeCondition = eq(knowledgeGraphEdges.userId, userId);
    if (edgeTypes && edgeTypes.length > 0) {
      edgeCondition = and(edgeCondition, inArray(knowledgeGraphEdges.edgeType, edgeTypes));
    }
    
    const [nodes, edges] = await Promise.all([
      db.select().from(knowledgeGraphNodes).where(nodeCondition),
      db.select().from(knowledgeGraphEdges).where(edgeCondition)
    ]);
    
    return { nodes, edges };
  }
  
  /**
   * 应用布局算法
   */
  private applyLayout(
    nodes: typeof knowledgeGraphNodes.$inferSelect[],
    edges: typeof knowledgeGraphEdges.$inferSelect[],
    config: any
  ): GraphVisualization {
    const layoutNodes = nodes.map(node => ({
      id: node.nodeId,
      label: node.label,
      type: node.nodeType,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      size: 5 + node.importance * 15,
      color: this.getNodeColor(node.nodeType),
      metadata: JSON.parse(node.metadata || '{}')
    }));
    
    const layoutEdges = edges.map(edge => ({
      id: edge.edgeId,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      type: edge.edgeType,
      weight: edge.weight,
      metadata: JSON.parse(edge.metadata || '{}')
    }));
    
    // 应用力导向布局（简化版）
    for (let i = 0; i < config.iterations; i++) {
      this.applyForceDirectedLayout(layoutNodes, layoutEdges, config);
    }
    
    return { nodes: layoutNodes, edges: layoutEdges };
  }
  
  /**
   * 应用可视化配置
   */
  private applyVisualizationConfig(
    graph: GraphVisualization,
    config: any
  ): GraphVisualization {
    // 应用节点配置
    graph.nodes = graph.nodes.map(node => ({
      ...node,
      size: Math.max(config.nodes.sizeRange[0], Math.min(config.nodes.sizeRange[1], node.size)),
      color: config.nodes.colorSchemes[node.type] || node.color
    }));
    
    // 应用边配置
    graph.edges = graph.edges.map(edge => ({
      ...edge,
      weight: Math.max(config.edges.widthRange[0], Math.min(config.edges.widthRange[1], edge.weight * 3))
    }));
    
    return graph;
  }
  
  /**
   * 获取协同过滤推荐
   */
  private async getCollaborativeRecommendations(
    userId: number,
    limit: number
  ): Promise<ContentRecommendation[]> {
    // 获取用户相似度
    const similarUsers = await this.findSimilarUsers(userId, 5);
    
    // 获取相似用户喜欢的内容
    const recommendations: ContentRecommendation[] = [];
    
    for (const similarUser of similarUsers) {
      const userContent = await this.getUserContent(similarUser.userId);
      userContent.forEach(content => {
        recommendations.push({
          contentId: content.contentId,
          title: content.title,
          score: similarUser.similarity * content.importance,
          reason: `与相似用户感兴趣的内容相关`,
          type: 'collaborative'
        });
      });
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * 获取基于内容的推荐
   */
  private async getContentBasedRecommendations(
    userId: number,
    contentId: number | undefined,
    limit: number
  ): Promise<ContentRecommendation[]> {
    if (!contentId) {
      // 如果没有指定内容，获取用户最感兴趣的主题相关内容
      return this.getTopicBasedRecommendations(userId, limit);
    }
    
    // 获取相似内容
    const similarContent = await this.getSimilarContent(userId, contentId, limit * 2);
    
    return similarContent.map(item => ({
      contentId: item.content.contentId,
      title: item.content.title,
      score: item.similarity,
      reason: `与"${item.content.title}"内容相似`,
      type: 'content-based'
    })).slice(0, limit);
  }
  
  /**
   * 获取热门推荐
   */
  private async getTrendingRecommendations(
    userId: number,
    limit: number
  ): Promise<ContentRecommendation[]> {
    // 获取最近7天的热门内容
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    
    const trendingContent = await db
      .select()
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          sql`${enhancedContentAnalysis.createdAt} >= ${recentDate.toISOString()}`
        )
      )
      .orderBy(desc(enhancedContentAnalysis.importance))
      .limit(limit);
    
    return trendingContent.map(content => ({
      contentId: content.contentId,
      title: content.title,
      score: content.importance,
      reason: '近期热门内容',
      type: 'trending'
    }));
  }
  
  /**
   * 获取混合推荐
   */
  private async getHybridRecommendations(
    userId: number,
    contentId: number | undefined,
    limit: number
  ): Promise<ContentRecommendation[]> {
    const [collaborative, contentBased, trending] = await Promise.all([
      this.getCollaborativeRecommendations(userId, Math.ceil(limit / 3)),
      this.getContentBasedRecommendations(userId, contentId, Math.ceil(limit / 3)),
      this.getTrendingRecommendations(userId, Math.ceil(limit / 3))
    ]);
    
    // 合并并去重
    const allRecommendations = [...collaborative, ...contentBased, ...trending];
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
    
    // 重新排序
    return uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * 其他辅助方法
   */
  private deduplicateNodes(nodes: Array<any>): Array<any> {
    const seen = new Set();
    return nodes.filter(node => {
      if (seen.has(node.id)) {
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }
  
  private getNodeColor(type: NodeType): string {
    const colors = {
      content: '#3b82f6',
      topic: '#10b981',
      keyword: '#f59e0b',
      tag: '#ef4444',
      category: '#8b5cf6'
    };
    return colors[type] || '#6b7280';
  }
  
  private applyForceDirectedLayout(nodes: any[], edges: any[], config: any): void {
    // 简化的力导向布局算法
    const repulsion = config.charge || -300;
    const attraction = config.linkDistance || 100;
    
    // 计算斥力
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (distance * distance);
        
        nodes[i].x -= (dx / distance) * force * 0.01;
        nodes[i].y -= (dy / distance) * force * 0.01;
        nodes[j].x += (dx / distance) * force * 0.01;
        nodes[j].y += (dy / distance) * force * 0.01;
      }
    }
    
    // 计算引力
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (distance - attraction) * 0.01 * edge.weight;
        
        sourceNode.x += (dx / distance) * force;
        sourceNode.y += (dy / distance) * force;
        targetNode.x -= (dx / distance) * force;
        targetNode.y -= (dy / distance) * force;
      }
    });
  }
  
  private async findSimilarUsers(userId: number, limit: number): Promise<Array<{ userId: number; similarity: number }>> {
    // 简化的用户相似度计算
    // 实际实现中需要更复杂的协同过滤算法
    return [];
  }
  
  private async getUserContent(userId: number): Promise<Array<{ contentId: number; title: string; importance: number }>> {
    const analyses = await db
      .select({
        contentId: enhancedContentAnalysis.contentId,
        title: enhancedContentAnalysis.title,
        importance: enhancedContentAnalysis.importance
      })
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId))
      .orderBy(desc(enhancedContentAnalysis.importance))
      .limit(10);
    
    return analyses;
  }
  
  private async getTopicBasedRecommendations(userId: number, limit: number): Promise<ContentRecommendation[]> {
    // 获取用户最感兴趣的主题
    const userTopics = await this.getUserTopTopics(userId, 3);
    
    const recommendations: ContentRecommendation[] = [];
    
    for (const topic of userTopics) {
      const topicContent = await this.getContentByTopic(userId, topic.name, 3);
      topicContent.forEach(content => {
        recommendations.push({
          contentId: content.contentId,
          title: content.title,
          score: topic.weight * content.importance,
          reason: `基于您感兴趣的"${topic.name}"主题`,
          type: 'content-based'
        });
      });
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  private async getUserTopTopics(userId: number, limit: number): Promise<Array<{ name: string; weight: number }>> {
    const analyses = await db
      .select({
        topics: enhancedContentAnalysis.topics
      })
      .from(enhancedContentAnalysis)
      .where(eq(enhancedContentAnalysis.userId, userId));
    
    const topicCounts = new Map<string, { totalWeight: number; count: number }>();
    
    analyses.forEach(analysis => {
      if (analysis.topics) {
        const topics = Array.isArray(analysis.topics) ? analysis.topics : JSON.parse(analysis.topics || '[]');
        topics.forEach((topic: any) => {
          const current = topicCounts.get(topic.name) || { totalWeight: 0, count: 0 };
          topicCounts.set(topic.name, {
            totalWeight: current.totalWeight + topic.weight,
            count: current.count + 1
          });
        });
      }
    });
    
    return Array.from(topicCounts.entries())
      .map(([name, stats]) => ({
        name,
        weight: stats.totalWeight / stats.count
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }
  
  private async getContentByTopic(userId: number, topic: string, limit: number): Promise<Array<{ contentId: number; title: string; importance: number }>> {
    const analyses = await db
      .select({
        contentId: enhancedContentAnalysis.contentId,
        title: enhancedContentAnalysis.title,
        importance: enhancedContentAnalysis.importance
      })
      .from(enhancedContentAnalysis)
      .where(
        and(
          eq(enhancedContentAnalysis.userId, userId),
          sql`JSON_EXTRACT(${enhancedContentAnalysis.topics}, '$[*].name') LIKE ${'%"' + topic + '"%'}`
        )
      )
      .orderBy(desc(enhancedContentAnalysis.importance))
      .limit(limit);
    
    return analyses;
  }
  
  private async calculateContentSimilarityEdges(analyses: typeof enhancedContentAnalysis.$inferSelect[]): Promise<Array<{
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    weight: number;
    metadata: Record<string, any>;
  }>> {
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      type: EdgeType;
      weight: number;
      metadata: Record<string, any>;
    }> = [];
    
    // 简化的相似度计算
    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const similarity = this.calculateContentSimilarity(analyses[i], analyses[j]);
        
        if (similarity > 0.3) {
          edges.push({
            id: `content-${analyses[i].contentId}-content-${analyses[j].contentId}`,
            source: `content-${analyses[i].contentId}`,
            target: `content-${analyses[j].contentId}`,
            type: 'similar',
            weight: similarity,
            metadata: {
              relation: 'content_similarity',
              similarity_score: similarity
            }
          });
        }
      }
    }
    
    return edges;
  }
  
  private calculateContentSimilarity(content1: typeof enhancedContentAnalysis.$inferSelect, content2: typeof enhancedContentAnalysis.$inferSelect): number {
    // 简化的内容相似度计算
    let similarity = 0;
    let factors = 0;
    
    // 主题相似度
    if (content1.topics && content2.topics) {
      const topics1 = Array.isArray(content1.topics) ? content1.topics : JSON.parse(content1.topics || '[]');
      const topics2 = Array.isArray(content2.topics) ? content2.topics : JSON.parse(content2.topics || '[]');
      
      const topicSimilarity = this.calculateSetSimilarity(
        topics1.map((t: any) => t.name),
        topics2.map((t: any) => t.name)
      );
      
      similarity += topicSimilarity * 0.4;
      factors += 0.4;
    }
    
    // 关键词相似度
    if (content1.keywords && content2.keywords) {
      const keywords1 = Array.isArray(content1.keywords) ? content1.keywords : JSON.parse(content1.keywords || '[]');
      const keywords2 = Array.isArray(content2.keywords) ? content2.keywords : JSON.parse(content2.keywords || '[]');
      
      const keywordSimilarity = this.calculateSetSimilarity(
        keywords1.map((k: any) => k.text),
        keywords2.map((k: any) => k.text)
      );
      
      similarity += keywordSimilarity * 0.3;
      factors += 0.3;
    }
    
    // 标签相似度
    if (content1.tags && content2.tags) {
      const tags1 = Array.isArray(content1.tags) ? content1.tags : JSON.parse(content1.tags || '[]');
      const tags2 = Array.isArray(content2.tags) ? content2.tags : JSON.parse(content2.tags || '[]');
      
      const tagSimilarity = this.calculateSetSimilarity(tags1, tags2);
      similarity += tagSimilarity * 0.2;
      factors += 0.2;
    }
    
    // 分类相似度
    if (content1.categories && content2.categories) {
      const categories1 = Array.isArray(content1.categories) ? content1.categories : JSON.parse(content1.categories || '[]');
      const categories2 = Array.isArray(content2.categories) ? content2.categories : JSON.parse(content2.categories || '[]');
      
      const categorySimilarity = this.calculateSetSimilarity(
        categories1.map((c: any) => c.name),
        categories2.map((c: any) => c.name)
      );
      
      similarity += categorySimilarity * 0.1;
      factors += 0.1;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }
  
  private calculateSetSimilarity(set1: string[], set2: string[]): number {
    const intersection = set1.filter(item => set2.includes(item));
    const union = [...new Set([...set1, ...set2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }
  
  private async getVectorSimilarity(userId: number, contentId: number, limit: number): Promise<Array<{ content: EnhancedAnalysisResult; similarity: number }>> {
    // 向量相似度计算
    // 实际实现中需要使用向量数据库
    return [];
  }
  
  private async getSemanticSimilarity(userId: number, contentId: number, limit: number): Promise<Array<{ content: EnhancedAnalysisResult; similarity: number }>> {
    // 语义相似度计算
    return [];
  }
  
  private combineSimilarityResults(vectorResults: any[], semanticResults: any[]): Array<{ content: EnhancedAnalysisResult; similarity: number }> {
    // 合并相似度结果
    return [];
  }
  
  private async getNodeById(nodeId: string): Promise<KnowledgeGraphNode | null> {
    const [node] = await db
      .select()
      .from(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.nodeId, nodeId));
    
    return node || null;
  }
  
  private async getNeighborhood(
    userId: number,
    centerNode: KnowledgeGraphNode | null,
    maxDepth: number,
    nodeTypes?: NodeType[],
    edgeTypes?: EdgeType[]
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    // 获取邻域节点和边
    return { nodes: [], edges: [] };
  }
  
  private async findPaths(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[], centerNode: KnowledgeGraphNode | null): Promise<string[][]> {
    // 路径查找算法
    return [];
  }
  
  private async analyzeContentRelations(userId: number, analysis: typeof enhancedContentAnalysis.$inferSelect): Promise<typeof contentRelations.$inferInsert[]> {
    // 分析内容关系
    return [];
  }
  
  private async incrementalGraphUpdate(userId: number, contentId: number): Promise<void> {
    // 增量图谱更新
  }
  
  private deduplicateRecommendations(recommendations: ContentRecommendation[]): ContentRecommendation[] {
    const seen = new Set();
    return recommendations.filter(rec => {
      if (seen.has(rec.contentId)) {
        return false;
      }
      seen.add(rec.contentId);
      return true;
    });
  }
}