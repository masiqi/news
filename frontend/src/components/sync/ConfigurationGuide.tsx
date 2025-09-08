// src/components/sync/ConfigurationGuide.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ExternalLink, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Settings,
  Terminal,
  FileText,
  ArrowRight
} from 'lucide-react';

// 配置指南类型
interface ConfigurationGuide {
  platform: 'obsidian' | 'logseq' | 'other';
  title: string;
  description: string;
  sections: GuideSection[];
  setupSteps: SetupStep[];
  screenshots?: string[];
  troubleshootingTips?: string[];
  lastUpdated: Date;
  version: string;
}

interface GuideSection {
  title: string;
  content: string;
  importance: 'required' | 'recommended' | 'optional';
}

interface SetupStep {
  step: number;
  title: string;
  description: string;
  instructions: string[];
  expectedOutput?: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface ConfigurationGuideProps {
  platform: 'obsidian' | 'logseq' | 'other';
  title?: string;
  className?: string;
}

export function ConfigurationGuide({ platform, title, className }: ConfigurationGuideProps) {
  const [guide, setGuide] = useState<ConfigurationGuide | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; content: string } | null>(null);
  const [showFullGuide, setShowFullGuide] = useState(false);

  // 获取配置指南
  const fetchGuide = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(`/api/credentials/guide/${platform}`);
      if (!response.ok) {
        throw new Error('获取配置指南失败');
      }
      
      const data = await response.json();
      if (data.success) {
        setGuide(data.guide);
      } else {
        throw new Error(data.error || '获取配置指南失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '获取配置指南失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 复制配置信息
  const copyConfiguration = () => {
    if (!guide) return;
    
    try {
      const configText = `# ${guide.title}

## 平台: ${guide.platform}

## 安装步骤
${guide.setupSteps.map(step => 
  `${step.step}. ${step.title} (${step.estimatedTime}, ${step.difficulty})
     ${step.description}
     步骤：
     ${step.instructions.map(instruction => `     - ${instruction}`).join('\n')}
     ${step.expectedOutput ? `     预期输出: ${step.expectedOutput}` : ''}
`).join('\n\n')}

## 重要说明
${guide.sections.map(section => 
  `${section.title} (${section.importance})
     ${section.content}
`).join('\n\n')}

## 故障排除
${guide.troubleshootingTips?.map(tip => `- ${tip}`).join('\n') || '暂无故障排除信息。'}

---
*生成时间: ${new Date().toLocaleString()}*
*指南版本: ${guide.version}*`;

      navigator.clipboard.writeText(configText);
      setMessage({ type: 'success', content: '配置指南已复制到剪贴板' });
    } catch (error) {
      setMessage({ type: 'error', content: '复制失败，请手动选择复制' });
    }
  };

  // 获取难度颜色
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600';
      case 'intermediate': return 'text-yellow-600';
      case 'advanced': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // 获取重要性颜色
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'required': return 'text-red-600';
      case 'recommended': return 'text-blue-600';
      case 'optional': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  // 获取平台名称
  const getPlatformName = (platform: string) => {
    const names = {
      'obsidian': 'Obsidian',
      'logseq': 'Logseq',
      'other': '其他工具'
    };
    return names[platform as keyof names] || platform;
  };

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    return <FileText className="h-5 w-5" />;
  };

  // 初始加载
  useEffect(() => {
    if (platform) {
      fetchGuide();
    }
  }, [platform]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 头部信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            {getPlatformIcon(platform)}
            {title || `${getPlatformName(platform)} 同步配置指南`}
          </CardTitle>
          <CardDescription>
            {platform === 'obsidian' && '强大的知识管理和笔记工具，支持Markdown和双向链接。'}
            {platform === 'logseq' && '基于块的知识管理工具，支持知识图谱和生物钟记忆。'}
            {platform === 'other' && '其他支持S3或R2存储的知识管理工具配置指南。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <div className="text-sm text-gray-500">加载中...</div>
              ) : guide ? (
                <div className="text-sm text-gray-500">
                  版本 {guide.version} | 更新于 {guide.lastUpdated.toLocaleDateString()}
                </div>
              ) : (
                <div className="text-sm text-red-500">无法加载配置指南</div>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={fetchGuide} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
              <Button size="sm" onClick={() => setShowFullGuide(true)} disabled={!guide}>
                <FileText className="mr-2 h-4 w-4" />
                查看完整指南
              </Button>
            </div>
          </div>
          
          {message && (
            <div className={`mt-3 p-3 rounded-lg ${message.type === 'error' ? 'bg-red-50 border border-red-200' : message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center space-x-2">
                {message.type === 'error' ? <AlertCircle className="h-4 w-4 text-red-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                <span className={`text-sm ${message.type === 'error' ? 'text-red-800' : message.type === 'success' ? 'text-green-800' : 'text-blue-800'}`}>
                  {message.content}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快速预览 */}
      {guide && !showFullGuide && (
        <Card>
          <CardHeader>
            <CardTitle>配置预览</CardTitle>
            <CardDescription>
              以下是{getPlatformName(platform)}配置的核心步骤，点击"查看完整指南"查看详细说明。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 关键信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">安装复杂度</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={guide.setupSteps.every(s => s.difficulty === 'beginner') ? 'default' : guide.setupSteps.some(s => s.difficulty === 'advanced') ? 'destructive' : 'secondary'}>
                      {guide.setupSteps.every(s => s.difficulty === 'beginner') ? '简单' : 
                       guide.setupSteps.some(s => s.difficulty === 'advanced') ? '复杂' : '中等'}
                    </Badge>
                    <div className="text-sm text-gray-600">
                      {guide.setupSteps.length} 个步骤
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">估计时间</div>
                  <div className="text-sm text-gray-600">
                    {guide.setupSteps.reduce((total, step) => {
                      const time = parseInt(step.estimatedTime) || 0;
                      return total + time;
                    }, 0)} 分钟
                  </div>
                </div>
              </div>

              {/* 快速步骤 */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-900">核心步骤预览</div>
                <div className="space-y-2">
                  {guide.setupSteps.slice(0, 3).map((step, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{step.title}</div>
                        <div className="text-sm text-gray-600">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {guide.setupSteps.length > 3 && (
                  <div className="text-sm text-blue-600">
                    还有 {guide.setupSteps.length - 3} 个步骤...
                  </div>
                )}
              </div>

              {/* 重要提示 */}
              {guide.sections.some(s => s.importance === 'required') && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">重要说明</div>
                  <div className="space-y-1">
                    {guide.sections
                      .filter(section => section.importance === 'required')
                      .map((section, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div className="text-sm text-gray-700">{section.content.substring(0, 100)}...</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setShowFullGuide(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  查看完整指南
                </Button>
                <Button variant="outline" size="sm" onClick={copyConfiguration}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制配置
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 完整指南对话框 */}
      <Dialog open={showFullGuide} onOpenChange={setShowFullGuide}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              {getPlatformIcon(platform)}
              {guide?.title}
            </DialogTitle>
          </DialogHeader>
          
          {guide && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-6">
                  {/* 概览信息 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>概览信息</span>
                        <Badge variant="default">版本 {guide.version}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 mb-4">{guide.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-500">步骤数量</div>
                          <div className="font-medium">{guide.setupSteps.length} 个步骤</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-gray-500">估计时间</div>
                          <div className="font-medium">
                            {guide.setupSteps.reduce((total, step) => {
                              const time = parseInt(step.estimatedTime) || 0;
                              return total + time;
                            }, 0)} 分钟
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-gray-500">更新时间</div>
                          <div className="font-medium">{guide.lastUpdated.toLocaleDateString()}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 重要说明 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>重要说明</CardTitle>
                      <CardDescription>
                        在开始配置之前，请仔细阅读以下重要信息。
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {guide.sections.map((section, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                section.importance === 'required' ? 'bg-red-500' :
                                section.importance === 'recommended' ? 'bg-blue-500' :
                                'bg-gray-500'
                              }`}></div>
                              <div className={`font-medium ${getImportanceColor(section.importance)}`}>
                                {section.title}
                              </div>
                            </div>
                            <div className="text-gray-700 text-sm leading-relaxed">
                              {section.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 详细安装步骤 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>详细安装步骤</CardTitle>
                      <CardDescription>
                        请按照以下步骤逐一完成配置。
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {guide.setupSteps.map((step, index) => (
                          <div key={index} className="space-y-3">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-800 text-sm font-bold rounded-full flex items-center justify-center">
                                {step.step}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="font-medium text-gray-900">{step.title}</div>
                                  <Badge variant="outline" className={`text-xs ${getDifficultyColor(step.difficulty)}`}>
                                    {step.difficulty}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {step.estimatedTime}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-700 mb-3">{step.description}</div>
                                
                                <div className="space-y-2">
                                  {step.instructions.map((instruction, i) => (
                                    <div key={i} className="flex items-start space-x-2">
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="text-sm text-gray-600 leading-relaxed">{instruction}</div>
                                    </div>
                                  ))}
                                </div>
                                
                                {step.expectedOutput && (
                                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      <div className="font-medium text-green-800">预期输出</div>
                                    </div>
                                    <div className="text-sm text-green-700">{step.expectedOutput}</div>
                                  </div>
                                )}
                                
                                {index < guide.setupSteps.length - 1 && (
                                  <div className="flex items-center justify-center my-4">
                                    <ArrowRight className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 故障排除 */}
                  {guide.troubleshootingTips && guide.troubleshootingTips.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>故障排除</CardTitle>
                        <CardDescription>
                          如果在配置过程中遇到问题，请参考以下解决方案。
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {guide.troubleshootingTips.map((tip, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                              <div className="text-sm text-gray-700">{tip}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
              
              <div className="border-t p-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {guide.platform} 同步配置指南
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={copyConfiguration}>
                    <Copy className="mr-2 h-4 w-4" />
                    复制指南
                  </Button>
                  <Button variant="outline" onClick={() => setShowFullGuide(false)}>
                    关闭
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">加载配置指南...</span>
        </div>
      )}
    </div>
  );
}