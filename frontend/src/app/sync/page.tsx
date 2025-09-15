// src/app/sync/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'next/link';
import { 
  Sync, 
  Settings, 
  Shield, 
  FileText, 
  Download, 
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Plus
} from 'lucide-react';

// 同步配置类型
interface SyncConfiguration {
  platform: 'obsidian' | 'logseq' | 'other';
  isConfigured: boolean;
  lastSync?: Date;
  credentialCount?: number;
}

export default function SyncPage() {
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; content: string } | null>(null);

  // 获取同步配置
  const fetchSyncConfigurations = async () => {
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) {
        throw new Error('获取同步配置失败');
      }
      
      const data = await response.json();
      if (data.success) {
        // 模拟一些配置信息（实际应用中应该从用户偏好中获取）
        const mockConfigs: SyncConfiguration[] = [
          {
            platform: 'obsidian',
            isConfigured: data.credentials.length > 0,
            lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1天前
            credentialCount: data.credentials.filter(c => c.isActive).length
          },
          {
            platform: 'logseq',
            isConfigured: false,
            credentialCount: 0
          },
          {
            platform: 'other',
            isConfigured: false,
            credentialCount: 0
          }
        ];
        setConfigurations(mockConfigs);
      }
    } catch (error) {
      console.error('获取同步配置失败:', error);
      setMessage({ type: 'error', content: '获取同步配置失败，请刷新页面' });
    }
  };

  // 获取凭证统计
  const fetchCredentialStats = async () => {
    try {
      const response = await fetch('/api/credentials/stats');
      if (!response.ok) {
        console.error('获取凭证统计失败');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        console.log('凭证统计:', data.stats);
      }
    } catch (error) {
      console.error('获取凭证统计失败:', error);
    }
  };

  // 检查R2服务状态
  const checkR2Status = async () => {
    try {
      const response = await fetch('/api/r2/health');
      if (!response.ok) {
        console.error('R2服务检查失败');
        return;
      }
      
      const data = await response.json();
      console.log('R2服务状态:', data.status);
      
      if (data.status === 'healthy') {
        setMessage({ type: 'success', content: 'R2存储服务正常运行' });
      } else {
        setMessage({ type: 'error', content: `R2服务异常: ${data.message}` });
      }
    } catch (error) {
      setMessage({ type: 'error', content: '无法连接到R2存储服务' });
    }
  };

  // 开始同步
  const startSync = async (platform: string) => {
    setIsLoading(true);
    setSyncStatus('syncing');
    setMessage({ type: 'info', content: `正在同步到${platform}...` });
    
    try {
      // 模拟同步过程
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setSyncStatus('completed');
      setMessage({ type: 'success', content: `${platform}同步完成！` });
      
      // 更新配置状态
      setConfigurations(prev => 
        prev.map(config => 
          config.platform === platform 
            ? { ...config, lastSync: new Date(), isConfigured: true }
            : config
        )
      );
      
    } catch (error) {
      setSyncStatus('error');
      setMessage({ type: 'error', content: `${platform}同步失败: ${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setIsLoading(false);
    }
  };

  // 获取配置指南
  const getConfigurationGuide = async (platform: string) => {
    try {
      const response = await fetch(`/api/credentials/guide/${platform}`);
      if (!response.ok) {
        throw new Error('获取配置指南失败');
      }
      
      const data = await response.json();
      if (data.success) {
        // 在实际应用中，这里应该打开一个模态框显示配置指南
        console.log(`${platform}配置指南:`, data.guide);
        setMessage({ type: 'info', content: `${platform}配置指南已获取，请查看控制台` });
      }
    } catch (error) {
      setMessage({ type: 'error', content: `获取${platform}配置指南失败` });
    }
  };

  // 初始加载
  useEffect(() => {
    fetchSyncConfigurations();
    fetchCredentialStats();
    checkR2Status();
  }, []);

  const getPlatformName = (platform: string) => {
    const names = {
      'obsidian': 'Obsidian',
      'logseq': 'Logseq',
      'other': '其他工具'
    };
    return names[platform as keyof names] || platform;
  };

  const getPlatformIcon = (platform: string) => {
    // 在实际应用中，这里应该返回平台对应的图标
    return <FileText className="h-5 w-5" />;
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'syncing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Sync className="h-5 w-5" />;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">同步配置</h1>
        <p className="text-muted-foreground mt-2">
          配置您的同步工具，将AI处理的新闻笔记安全地同步到您的知识管理工具中。
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-500' : message.type === 'success' ? 'border-green-500' : 'border-blue-500'}`}>
          <Shield className="h-4 w-4" />
          <AlertTitle>{message.type === 'error' ? '同步错误' : message.type === 'success' ? '同步成功' : '系统提示'}</AlertTitle>
          <AlertDescription>{message.content}</AlertDescription>
        </Alert>
      )}

      {/* 主标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="credentials">凭证管理</TabsTrigger>
          <TabsTrigger value="platforms">平台配置</TabsTrigger>
          <TabsTrigger value="guides">配置指南</TabsTrigger>
        </TabsList>

        {/* 概览标签 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>R2存储状态</CardTitle>
                <Shield className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">正常</div>
                <p className="text-sm text-muted-foreground">R2存储服务运行正常</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>同步凭证</CardTitle>
                <FileText className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {configurations.filter(c => c.isConfigured).reduce((sum, c) => sum + (c.credentialCount || 0), 0)}
                </div>
                <p className="text-sm text-muted-foreground">活跃的同步凭证</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>已配置平台</CardTitle>
                <Sync className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {configurations.filter(c => c.isConfigured).length}
                </div>
                <p className="text-sm text-muted-foreground">个平台已配置</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>
                常用的同步配置和管理操作
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button asChild>
                  <Link href="/sync/credentials">
                    <Settings className="mr-2 h-4 w-4" />
                    管理凭证
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={fetchSyncConfigurations}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新状态
                </Button>
                <Button 
                  variant="outline"
                  onClick={checkR2Status}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  检查服务
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => getConfigurationGuide('obsidian')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  获取指南
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 凭证管理标签 */}
        <TabsContent value="credentials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>凭证管理</CardTitle>
              <CardDescription>
                管理您的R2同步凭证，包括创建、查看、撤销和重新生成。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild>
                <Link href="/sync/credentials">
                  <Plus className="mr-2 h-4 w-4" />
                  打开凭证管理
                </Link>
              </Button>
              
              <div className="text-sm text-muted-foreground">
                在凭证管理页面，您可以：
              </div>
              <ul className="text-sm space-y-1 ml-4">
                <li>• 创建新的同步凭证</li>
                <li>• 查看和管理现有凭证</li>
                <li>• 撤销或重新生成凭证</li>
                <li>• 查看凭证使用统计</li>
                <li>• 导出凭证配置信息</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 平台配置标签 */}
        <TabsContent value="platforms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>同步平台配置</CardTitle>
              <CardDescription>
                配置和同步您的AI处理新闻到各种知识管理工具。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configurations.map((config) => (
                <Card key={config.platform} className="border-l-0">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-3">
                        {getPlatformIcon(config.platform)}
                        {getPlatformName(config.platform)}
                      </CardTitle>
                      {config.isConfigured ? (
                        <Badge variant="default">已配置</Badge>
                      ) : (
                        <Badge variant="secondary">未配置</Badge>
                      )}
                    </div>
                    {config.lastSync && (
                      <CardDescription>
                        上次同步：{config.lastSync.toLocaleString()}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        {config.credentialCount && config.credentialCount > 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {config.credentialCount} 个凭证可用
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            需要配置同步凭证
                          </p>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        {config.isConfigured && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => startSync(getPlatformName(config.platform))}
                            disabled={isLoading}
                          >
                            <Sync className="mr-2 h-4 w-4" />
                            {syncStatus === 'syncing' ? '同步中...' : '开始同步'}
                          </Button>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => getConfigurationGuide(config.platform)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {syncStatus !== 'idle' && (
                      <div className="mt-4 p-3 bg-muted rounded-md flex items-center space-x-3">
                        {getSyncStatusIcon(syncStatus)}
                        <span className="text-sm">
                          {syncStatus === 'syncing' ? '正在同步...' : 
                           syncStatus === 'completed' ? '同步完成！' : 
                           '同步失败，请重试'}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 配置指南标签 */}
        <TabsContent value="guides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>配置指南</CardTitle>
              <CardDescription>
                查看各平台的详细配置指南，快速设置您的同步工具。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => getConfigurationGuide('obsidian')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      Obsidian
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      强大的知识管理和笔记工具，支持Markdown和双向链接。
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      查看指南
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => getConfigurationGuide('logseq')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      Logseq
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      基于块的笔记工具，支持知识图谱和生物钟记忆。
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      查看指南
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => getConfigurationGuide('other')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      其他工具
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      其他支持S3或R2存储的知识管理工具。
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      查看指南
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">配置指南包含：</p>
                <ul className="space-y-1">
                  <li>• 详细的安装步骤</li>
                  <li>• 凭证配置说明</li>
                  <li>• 常见问题解答</li>
                  <li>• 最佳实践建议</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white">加载中...</div>
        </div>
      )}
    </div>
  );
}