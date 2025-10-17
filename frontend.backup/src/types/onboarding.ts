// 兴趣分类相关类型
export interface InterestCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  relatedTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterestCategoryWithStats extends InterestCategory {
  userCount: number;
  averagePriority: number;
}

// 用户兴趣相关类型
export interface UserInterest {
  id: string;
  userId: string;
  categoryId: string;
  level: 'low' | 'medium' | 'high';
  priority: number;
  selectedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserInterestWithCategory extends UserInterest {
  category?: InterestCategory;
}

// 推荐源相关类型
export interface RecommendedSource {
  id: string;
  name: string;
  url: string;
  description?: string;
  icon?: string;
  recommendationLevel: 'basic' | 'premium' | 'featured';
  qualityAvailability: number;
  qualityContentQuality: number;
  qualityUpdateFrequency: number;
  qualityValidationStatus: 'pending' | 'approved' | 'rejected';
  isRecommended: boolean;
  categories?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
  }>;
  tags?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  matchScore: number;
  relevanceScore: number;
  createdAt: string;
}

// 引导状态相关类型
export interface OnboardingStatus {
  id: string;
  userId: string;
  step: 'welcome' | 'interests' | 'recommendations' | 'confirmation' | 'completed' | 'skipped';
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  completedAt?: string;
  selectedInterests?: string[];
  recommendedSources?: string[];
  confirmedSources?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  progress: number;
}

// API请求/响应类型
export interface InterestInput {
  categoryId: string;
  level: 'low' | 'medium' | 'high';
}

export interface OnboardingStepUpdate {
  step: string;
  data?: any;
}

// 组件Props类型
export interface InterestSelectorProps {
  categories: InterestCategory[];
  selectedInterests: string[];
  onSelectionChange: (interests: InterestInput[]) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export interface CategoryTreeProps {
  categories: InterestCategory[];
  selectedCategories: string[];
  onSelectionChange: (categoryIds: string[]) => void;
  maxSelections?: number;
}

export interface SourcePreviewProps {
  sources: RecommendedSource[];
  selectedSources: string[];
  onSelectionChange: (sourceIds: string[]) => void;
  onConfirm: () => void;
  onBack?: () => void;
  maxSelections?: number;
}

export interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  progress: number;
}

// 引导流程相关hooks类型
export interface UseOnboardingReturn {
  status: OnboardingStatus | null;
  progress: OnboardingProgress;
  loading: boolean;
  updateStep: (step: string, data?: any) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

export interface UseInterestsReturn {
  interests: UserInterestWithCategory[];
  loading: boolean;
  saveInterests: (interests: InterestInput[]) => Promise<void>;
  updateInterest: (interestId: string, level: 'low' | 'medium' | 'high') => Promise<void>;
  deleteInterest: (interestId: string) => Promise<void>;
}

export interface UseRecommendationsReturn {
  recommendations: RecommendedSource[];
  loading: boolean;
  getRecommendations: (interests: InterestInput[]) => Promise<void>;
  confirmSources: (sourceIds: string[]) => Promise<{ success: boolean; importedCount: number }>;
}

// 页面组件Props类型
export interface OnboardingPageProps {
  children: React.ReactNode;
}

export interface WelcomePageProps {
  onStart: () => void;
  onSkip: () => void;
}

export interface InterestsPageProps {
  onComplete: (interests: InterestInput[]) => void;
  onBack: () => void;
}

export interface RecommendationsPageProps {
  interests: InterestInput[];
  onComplete: (sourceIds: string[]) => void;
  onBack: () => void;
}

export interface ConfirmationPageProps {
  sources: RecommendedSource[];
  selectedSources: string[];
  onSelectionChange: (sourceIds: string[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  onSkip: () => void;
}