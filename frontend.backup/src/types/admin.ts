export interface RecommendedSource {
  id: number;
  userId: number;
  url: string;
  name: string;
  description?: string;
  isPublic: boolean;
  originalSourceId?: number;
  lastFetchedAt?: string;
  fetchFailureCount: number;
  fetchErrorMessage?: string;
  
  // 推荐源相关字段
  isRecommended: boolean;
  recommendationLevel: 'basic' | 'premium' | 'featured';
  
  // 质量评估字段
  qualityAvailability: number; // 0-100
  qualityContentQuality: number; // 0-100
  qualityUpdateFrequency: number; // 0-100
  qualityLastValidatedAt?: string;
  qualityValidationStatus: 'pending' | 'approved' | 'rejected';
  qualityValidationNotes?: string;
  
  // 统计数据字段
  statisticsTotalSubscribers: number;
  statisticsActiveSubscribers: number;
  statisticsAverageUsage: number;
  statisticsSatisfaction: number; // 0-5
  
  // 推荐源元数据
  recommendedBy?: number;
  recommendedAt?: string;
  
  createdAt: string;
  updatedAt?: string;
}

export interface SourceCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceTag {
  id: number;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceValidationHistory {
  id: number;
  sourceId: number;
  validationType: 'automatic' | 'manual';
  availabilityScore?: number;
  contentQualityScore?: number;
  updateFrequencyScore?: number;
  overallScore?: number;
  status: 'passed' | 'failed' | 'warning';
  errorMessage?: string;
  validationDetails?: string;
  validatedBy?: number;
  validatedAt: string;
  createdAt: string;
}

export interface SourceStatistics {
  total: number;
  byLevel: {
    basic: number;
    premium: number;
    featured: number;
  };
  byStatus: {
    pending: number;
    approved: number;
    rejected: number;
  };
  averageQuality: number;
  totalSubscribers: number;
}

export interface QualityMetrics {
  availability: number; // 0-100
  contentQuality: number; // 0-100
  updateFrequency: number; // 0-100
  overall: number; // 0-100
}

export interface ValidationResult {
  sourceId: number;
  metrics: QualityMetrics;
  status: 'passed' | 'failed' | 'warning';
  errorMessage?: string;
  validationDetails: {
    lastFetchSuccess: boolean;
    fetchErrorRate: number;
    averageArticlesPerDay: number;
    contentLengthScore: number;
    lastUpdateTime?: string;
    consecutiveFailures: number;
  };
}