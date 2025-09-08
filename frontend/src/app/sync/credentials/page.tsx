// src/app/sync/credentials/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Copy, CheckCircle, RefreshCw, Trash2, Plus, Shield, Clock, Key } from 'lucide-react';

// 凭证类型定义
interface SyncCredential {
  id: string;
  userId: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  bucket: string;
  prefix: string;
  permissions: 'readonly';
  expiresAt?: Date;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CredentialStats {
  totalCredentials: number;
  activeCredentials: number;
  expiredCredentials: number;
  mostRecentlyUsed: SyncCredential | null;
}

export default function SyncCredentialsPage() {
  const [credentials, setCredentials] = useState<SyncCredential[]>([]);
  const [stats, setStats] = useState<CredentialStats>({
    totalCredentials: 0,
    activeCredentials: 0,
    expiredCredentials: 0,
    mostRecentlyUsed: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCredentialName, setNewCredentialName] = useState('');
  const [newCredentialBucket, setNewCredentialBucket] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; content: string } | null>(null);

  // 获取用户凭证
  const fetchCredentials = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) {
        throw new Error('获取凭证列表失败');
      }
      
      const data = await response.json();
      if (data.success) {
        setCredentials(data.credentials);
        setMessage({ type: 'success', content: `获取到 ${data.credentials.length} 个凭证` });
      } else {
        throw new Error(data.error || '获取凭证失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '获取凭证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 获取凭证统计
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/credentials/stats');
      if (!response.ok) {
        console.error('获取凭证统计失败');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('获取凭证统计失败:', error);
    }
  };

  // 创建新凭证
  const createCredential = async () => {
    if (!newCredentialName.trim()) {
      setMessage({ type: 'error', content: '请输入凭证名称' });
      return;
    }
    
    if (!newCredentialBucket.trim()) {
      setMessage({ type: 'error', content: '请输入桶名称' });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newCredentialName.trim(),
          bucket: newCredentialBucket.trim()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建凭证失败');
      }
      
      const data = await response.json();
      if (data.success) {
        setCredentials(prev => [data.credential, ...prev]);
        setShowCreateForm(false);
        setNewCredentialName('');
        setNewCredentialBucket('');
        setMessage({ type: 'success', content: '凭证创建成功！' });
        // 刷新统计
        fetchStats();
      } else {
        throw new Error('创建凭证失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '创建凭证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 撤销凭证
  const revokeCredential = async (credentialId: string) => {
    if (!confirm('确定要撤销此凭证吗？撤销后将无法使用该凭证进行同步。')) {
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('撤销凭证失败');
      }
      
      const data = await response.json();
      if (data.success) {
        setCredentials(prev => prev.filter(cred => cred.id !== credentialId));
        setMessage({ type: 'success', content: '凭证已撤销' });
        // 刷新统计
        fetchStats();
      } else {
        throw new Error('撤销凭证失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '撤销凭证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 重新生成凭证
  const regenerateCredential = async (credentialId: string) => {
    if (!confirm('确定要重新生成此凭证吗？重新生成后，旧的凭证将失效。')) {
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(`/api/credentials/${credentialId}/regenerate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('重新生成凭证失败');
      }
      
      const data = await response.json();
      if (data.success) {
        setCredentials(prev => 
          prev.map(cred => cred.id === credentialId ? data.credential : cred)
        );
        setMessage({ type: 'success', content: '凭证已重新生成！请保存新的凭证信息。' });
      } else {
        throw new Error('重新生成凭证失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '重新生成凭证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 复制凭证信息
  const copyCredentialInfo = async (credential: SyncCredential, infoType: 'full' | 'minimal') => {
    try {
      if (infoType === 'full') {
        const fullInfo = `# ${credential.name}

## 访问密钥 ID
${credential.accessKeyId}

## 秘密访问密钥
${credential.secretAccessKey}

## 区域
${credential.region}

## 端点
${credential.endpoint}

## 桶名称
${credential.bucket}

## 前缀
${credential.prefix}

## 权限
${credential.permissions}

## 创建时间
${credential.createdAt.toLocaleString()}

## 过期时间
${credential.expiresAt ? credential.expiresAt.toLocaleString() : '永久'}`;
        
        await navigator.clipboard.writeText(fullInfo);
        setMessage({ type: 'success', content: '完整凭证信息已复制到剪贴板' });
      } else {
        const minimalInfo = `访问密钥: ${credential.accessKeyId}\n秘密密钥: ${credential.secretAccessKey}`;
        await navigator.clipboard.writeText(minimalInfo);
        setMessage({ type: 'success', content: '必要凭证信息已复制到剪贴板' });
      }
    } catch (error) {
      setMessage({ type: 'error', content: '复制失败，请手动复制' });
    }
  };

  // 格式化时间
  const formatDate = (date: Date | undefined) => {
    if (!date) return '从未使用';
    return new Date(date).toLocaleString();
  };

  // 检查凭证是否过期
  const isCredentialExpired = (credential: SyncCredential) => {
    if (!credential.expiresAt) return false;
    return new Date() > credential.expiresAt;
  };

  // 初始加载
  useEffect(() => {
    fetchCredentials();
    fetchStats();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">同步凭证管理</h1>
        <p className="text-muted-foreground mt-2">
          管理您的R2同步凭证，安全地将AI处理的新闻笔记同步到Obsidian等工具。
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-500' : message.type === 'success' ? 'border-green-500' : 'border-blue-500'}`}>
          <Shield className="h-4 w-4" />
          <AlertTitle>{message.type === 'error' ? '操作失败' : message.type === 'success' ? '操作成功' : '提示'}</AlertTitle>
          <AlertDescription>{message.content}</AlertDescription>
        </Alert>
      )}

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">总凭证数</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCredentials}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">活跃凭证</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeCredentials}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">过期凭证</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expiredCredentials}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">最近使用</CardTitle>
            <RefreshCw className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {stats.mostRecentlyUsed ? (
                <div>
                  <div className="font-medium">{stats.mostRecentlyUsed.name}</div>
                  <div className="text-muted-foreground">
                    {formatDate(stats.mostRecentlyUsed.lastUsedAt)}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">暂无使用记录</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作按钮 */}
      <div className="mb-6">
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="mb-2">
          <Plus className="mr-2 h-4 w-4" />
          {showCreateForm ? '取消创建' : '创建新凭证'}
        </Button>
        <Button 
          variant="outline" 
          onClick={fetchCredentials} 
          disabled={isLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新列表
        </Button>
      </div>

      {/* 创建凭证表单 */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>创建新凭证</CardTitle>
            <CardDescription>
              创建R2访问凭证用于同步您的AI处理笔记。凭证将具有只读访问权限。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="credentialName">凭证名称</Label>
                <Input
                  id="credentialName"
                  placeholder="例如：我的Obsidian同步"
                  value={newCredentialName}
                  onChange={(e) => setNewCredentialName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bucketName">R2桶名称</Label>
                <Input
                  id="bucketName"
                  placeholder="例如：my-news-sync-bucket"
                  value={newCredentialBucket}
                  onChange={(e) => setNewCredentialBucket(e.target.value)}
                />
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={createCredential} disabled={isLoading || !newCredentialName.trim() || !newCredentialBucket.trim()}>
                  {isLoading ? '创建中...' : '创建凭证'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  取消
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 凭证列表 */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">暂无同步凭证</h3>
            <p className="text-muted-foreground mt-2">
              您还没有创建任何同步凭证。点击"创建新凭证"按钮开始设置您的同步配置。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((credential) => (
            <Card key={credential.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    {isCredentialExpired(credential) ? (
                      <Badge variant="destructive">已过期</Badge>
                    ) : credential.isActive ? (
                      <Badge variant="default">活跃</Badge>
                    ) : (
                      <Badge variant="secondary">已撤销</Badge>
                    )}
                    {credential.name}
                  </CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCredentialInfo(credential, 'minimal')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    </div>
                </div>
                <CardDescription>
                  桶：{credential.bucket} | 区域：{credential.region}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedCredential === credential.id ? 'details' : 'info'} onValueChange={(value) => setSelectedCredential(value === 'details' ? credential.id : null)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="info">基本信息</TabsTrigger>
                    <TabsTrigger value="details">详细信息</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="info" className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground">创建时间</div>
                        <div>{formatDate(credential.createdAt)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">权限</div>
                        <div className="capitalize">{credential.permissions}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">前缀</div>
                        <div className="font-mono text-xs">{credential.prefix}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">状态</div>
                        <div>
                          {isCredentialExpired(credential) ? (
                            <span className="text-red-600">已过期</span>
                          ) : credential.isActive ? (
                            <span className="text-green-600">活跃</span>
                          ) : (
                            <span className="text-gray-600">已撤销</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>上次使用</Label>
                      <div>{formatDate(credential.lastUsedAt)}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>过期时间</Label>
                      <div>{credential.expiresAt ? formatDate(credential.expiresAt) : '永久'}</div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="details" className="space-y-3 mt-4">
                    <div className="space-y-2">
                      <Label>访问密钥 ID</Label>
                      <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {credential.accessKeyId}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>秘密访问密钥</Label>
                      <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {credential.secretAccessKey}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>端点 URL</Label>
                      <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {credential.endpoint}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => copyCredentialInfo(credential, 'full')}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        复制完整信息
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <Separator className="mt-4" />
                
                <div className="flex space-x-2 pt-4">
                  {credential.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeCredential(credential.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      撤销凭证
                    </Button>
                  )}
                  
                  {credential.isActive && (
                    <Button
                      size="sm"
                      onClick={() => regenerateCredential(credential.id)}
                      disabled={isLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      重新生成
                    </Button>
                  )}
                  
                  {!credential.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={createCredential}
                      disabled={isLoading}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      重新创建
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white">加载中...</div>
        </div>
      )}
    </div>
  );
}