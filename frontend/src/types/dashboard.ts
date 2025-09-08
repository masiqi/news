// 状态管理相关类型
export interface ProcessingTask {
  id: string;
  userId: string;
  sourceId: string;
  type: 'rss_fetch' | 'ai_process' | 'content_storage' | 'error_retry';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  progress: number; // 0-100
  title: string;
  description?: string;
  errorMessage?: string;
  resultData?: any;
  retryCount: number;
  maxRetries: number;
  estimatedDuration?: number; // 预估时间（秒）
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  taskId: string;
  previousStatus: string;
  newStatus: string;
  progress: number;
  message?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface UserStatistics {
  id: string;
  userId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  processingTasks: number;
  averageProcessingTime: number; // 平均处理时间（秒）
  tasksToday: number;
  tasksThisWeek: number;
  tasksThisMonth: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

// 通知相关类型
export interface NotificationSettings {
  id: string;
  userId: string;
  enableRealtimeNotifications: boolean;
  enableEmailNotifications: boolean;
  notifyOnCompleted: boolean;
  notifyOnFailed: boolean;
  notifyOnError: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
  };
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'task_completed' | 'task_failed' | 'task_progress' | 'error' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  sentVia: 'realtime' | 'email';
  scheduledFor?: string;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}

// 扩展的统计类型
export interface ExtendedUserStatistics extends UserStatistics {
  // 网络统计
  networkStats: {
    totalSources: number;
    activeSources: number;
    inactiveSources: number;
    averageFetchTime: number;
    totalEntries: number;
    averageEntriesPerSource: number;
    errorSources: number;
  };
  // 性能指标
  performanceMetrics: {
    throughput: number;
    averageResponseTime: number;
    successRate: string;
    errorRate: string;
    uptime: string;
  };
}

export interface TaskSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  successRate: string;
  averageTime: number;
}

export interface DetailedTaskStatistics {
  byType: Record<string, {
    total: number;
    completed: number;
    failed: number;
    averageTime: number;
  }>;
  byStatus: Record<string, number>;
  timeDistribution: {
    under1Min: number;
    under5Min: number;
    under10Min: number;
    over10Min: number;
  };
  failureRate: string;
  completionRate: string;
  averageTime: number;
}

export interface PerformanceMetrics {
  throughput: number;
  averageResponseTime: number;
  successRate: string;
  errorRate: string;
  uptime: string;
}

export interface SourcePerformanceStatistics {
  totalSources: number;
  activeSources: number;
  inactiveSources: number;
  averageFetchTime: number;
  totalEntries: number;
  averageEntriesPerSource: number;
  errorSources: number;
}

export interface SystemHealthReport {
  userHealth: {
    totalTasks: number;
    completionRate: string;
    averageResponseTime: number;
    activeSources: number;
    errorSources: number;
  };
  systemMetrics: {
    totalUsers: number;
    activeTasks: number;
    failedTasks: number;
    systemUptime: number;
  };
  recommendations: string[];
  generatedAt: string;
}

// 用户状态类型
export interface UserStatus {
  tasks: ProcessingTask[];
  statistics: ExtendedUserStatistics;
  unreadNotifications: number;
}

// API请求/响应类型
export interface CreateTaskRequest {
  sourceId: string;
  type: ProcessingTask['type'];
  title: string;
  description?: string;
  estimatedDuration?: number;
  maxRetries?: number;
}

export interface UpdateTaskProgressRequest {
  progress: number;
  message?: string;
}

export interface UpdateTaskRequest {
  status?: ProcessingTask['status'];
  progress?: number;
  errorMessage?: string;
  resultData?: any;
  startedAt?: string;
  completedAt?: string;
}

// 组件Props类型
export interface StatusOverviewProps {
  statistics: ExtendedUserStatistics;
  taskSummary: TaskSummary;
  performanceMetrics: PerformanceMetrics;
  className?: string;
}

export interface TaskProgressProps {
  tasks: ProcessingTask[];
  className?: string;
}

export interface ProcessingResultsProps {
  tasks: ProcessingTask[];
  onRetry?: (taskId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

export interface ErrorNotificationsProps {
  tasks: ProcessingTask[];
  onRefresh?: () => void;
  onRetry?: (taskId: string) => void;
  className?: string;
}

export interface StatisticsPanelProps {
  statistics: ExtendedUserStatistics;
  detailedStats?: DetailedTaskStatistics;
  sourceStats?: SourcePerformanceStatistics;
  healthReport?: SystemHealthReport;
  onRefresh?: () => void;
  onExport?: () => void;
  className?: string;
}

export interface NotificationCenterProps {
  notifications: NotificationRecord[];
  unreadCount: number;
  onMarkRead?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  onDelete?: (notificationId: string) => void;
  onSettings?: () => void;
  className?: string;
}

export interface NotificationSettingsProps {
  settings: NotificationSettings;
  onUpdate?: (settings: Partial<NotificationSettings>) => void;
  className?: string;
}

// Realtime Events类型
export interface RealtimeEvent {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'status_update' | 'notification_created';
  data: {
    taskId?: string;
    progress?: number;
    message?: string;
    notification?: NotificationRecord;
    [key: string]: any;
  };
}

// Hooks返回类型
export interface UseStatusReturn {
  status: UserStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface UseStatisticsReturn {
  statistics: ExtendedUserStatistics | null;
  loading: boolean;
  error: string | null;
  refresh: (period?: 'today' | 'week' | 'month') => void;
}

export interface UseNotificationsReturn {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
}

export interface UseNotificationSettingsReturn {
  settings: NotificationSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  refresh: () => void;
}

// 页面组件Props类型
export interface DashboardPageProps {
  children: React.ReactNode;
}

// 工具函数类型
export type TaskType = ProcessingTask['type'];
export type TaskStatus = ProcessingTask['status'];
export type NotificationType = NotificationRecord['type'];