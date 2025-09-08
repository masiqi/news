// src/components/sync/CredentialManager.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Copy, Plus, Trash2, RefreshCw, Shield, Clock, Key, AlertCircle, CheckCircle } from 'lucide-react';

// 凭证类型
interface SyncCredential {
  id: string;
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
}

interface CredentialManagerProps {
  onCredentialCreated?: (credential: SyncCredential) => void;
  onCredentialRevoked?: (credentialId: string) => void;
}

export function CredentialManager({ 
  onCredentialCreated, 
  onCredentialRevoked 
}: CredentialManagerProps) {
  const [credentials, setCredentials] = useState<SyncCredential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState<SyncCredential | null>(null);
  const [newCredential, setNewCredential] = useState({ name: '', bucket: '', region: 'auto' });
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; content: string } | null>(null);

  // 获取凭证列表
  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) throw new Error('获取凭证失败');
      
      const data = await response.json();
      if (data.success) {
        setCredentials(data.credentials);
      } else {
        throw new Error(data.error || '获取凭证失败');
      }
    } catch (error) {
      setMessage({ type: 'error', content: error instanceof Error ? error.message : '获取凭证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  // 创建凭证
  const handleCreateCredential = async () => {
    if (!newCredential.name.trim() || !newCredential.bucket.trim()) {
      setMessage({ type: 'error', content: '请填写完整的凭证信息' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCredential.name.trim(),
          bucket: newCredential.bucket.trim(),
          region: newCredential.region || 'auto'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建凭证失败');
      }

      const data = await response.json();
      if (data.success) {
        setCredentials(prev => [data.credential, ...prev]);
        setShowCreateDialog(false);
        setNewCredential({ name: '', bucket: '', region: 'auto' });
        setMessage({ type: 'success', content: '凭证创建成功！' });
        onCredentialCreated?.(data.credential);
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
  const handleRevokeCredential = async (credentialId: string) => {
    if (!confirm('确定要撤销此凭证吗？撤销后将无法用于同步。')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '撤销凭证失败');
      }

      const data = await response.json();
      if (data.success) {
        setCredentials(prev => prev.filter(cred => cred.id !== credentialId));
        setMessage({ type: 'success', content: '凭证已撤销' });
        onCredentialRevoked?.(credentialId);
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
  const handleRegenerateCredential = async (credentialId: string) => {
    if (!confirm('确定要重新生成此凭证吗？重新生成后，旧的凭证将失效。')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/credentials/${credentialId}/regenerate`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '重新生成凭证失败');
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
      const info = infoType === 'full' ? 
        `# ${credential.name}

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
${credential.expiresAt ? credential.expiresAt.toLocaleString() : '永久'}

---
*请妥善保管此信息，不要分享给他人*` :
        `访问密钥: ${credential.accessKeyId}\n秘密密钥: ${credential.secretAccessKey}`;

      await navigator.clipboard.writeText(info);
      setMessage({ type: 'success', content: `凭证信息已复制到剪贴板` });
    } catch (error) {
      setMessage({ type: 'error', content: '复制失败，请手动复制' });
    }
  };

  // 检查是否过期
  const isExpired = (credential: SyncCredential) => {
    if (!credential.expiresAt) return false;
    return new Date() > credential.expiresAt;
  };

  // 格式化时间
  const formatDate = (date?: Date) => {
    if (!date) return '从未使用';
    return new Date(date).toLocaleString();
  };

  // 初始加载
  useState(() => {
    fetchCredentials();
  });

  return (
    <div className="space-y-4">
      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg border ${message.type === 'error' ? 'border-red-500 bg-red-50' : message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
          <div className="flex items-center space-x-2">
            {message.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-600" /> : 
             message.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> : 
             <Shield className="h-5 w-5 text-blue-600" />}
            <span className="font-medium">{message.type === 'error' ? '错误' : message.type === 'success' ? '成功' : '提示'}</span>
          </div>
          <p className="mt-1 text-sm">{message.content}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">同步凭证</h3>
        <div className="flex space-x-2">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                创建凭证
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>创建同步凭证</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credentialName">凭证名称</Label>
                  <Input
                    id="credentialName"
                    placeholder="例如：我的Obsidian同步"
                    value={newCredential.name}
                    onChange={(e) => setNewCredential(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bucketName">R2桶名称</Label>
                  <Input
                    id="bucketName"
                    placeholder="例如：my-news-sync-bucket"
                    value={newCredential.bucket}
                    onChange={(e) => setNewCredential(prev => ({ ...prev, bucket: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateCredential} disabled={isLoading}>
                    {isLoading ? '创建中...' : '创建'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={fetchCredentials} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* 凭证列表 */}
      {credentials.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Key className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">暂无同步凭证</h3>
          <p className="mt-2 text-sm text-gray-500">
            点击"创建凭证"按钮开始配置您的同步功能。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((credential) => (
            <Card key={credential.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    {isExpired(credential) ? (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDetailDialog(credential)}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  桶：{credential.bucket} | 区域：{credential.region}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">基本信息</TabsTrigger>
                    <TabsTrigger value="advanced">详细信息</TabsTrigger>
                    <TabsTrigger value="actions">操作</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">创建时间</div>
                        <div className="font-medium">{credential.createdAt.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">权限</div>
                        <div className="font-medium">{credential.permissions}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">前缀</div>
                        <div className="font-mono text-xs">{credential.prefix}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">状态</div>
                        <div className="font-medium">
                          {isExpired(credential) ? (
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
                      <div className="text-gray-500">上次使用</div>
                      <div>{formatDate(credential.lastUsedAt)}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-gray-500">过期时间</div>
                      <div>{credential.expiresAt ? formatDate(credential.expiresAt) : '永久'}</div>
                    </div>
                  </TabsContent>

                  <TabsContent value="advanced" className="space-y-3">
                    <div className="space-y-2">
                      <div className="text-gray-500">访问密钥 ID</div>
                      <div className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                        {credential.accessKeyId}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-gray-500">秘密访问密钥</div>
                      <div className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                        {credential.secretAccessKey}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-gray-500">端点 URL</div>
                      <div className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                        {credential.endpoint}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCredentialInfo(credential, 'full')}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      复制完整信息
                    </Button>
                  </TabsContent>

                  <TabsContent value="actions" className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {credential.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeCredential(credential.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          撤销凭证
                        </Button>
                      )}
                      {credential.isActive && (
                        <Button
                          size="sm"
                          onClick={() => handleRegenerateCredential(credential.id)}
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
                          onClick={() => handleCreateCredential}
                          disabled={isLoading}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          重新创建
                        </Button>
                      )}
                    </div>
                    <Separator />
                    <div className="text-sm text-gray-600">
                      <div className="font-medium mb-1">安全提示：</div>
                      <ul className="space-y-1">
                        <li>• 请妥善保管您的凭证信息</li>
                        <li>• 不要将凭证分享给他人</li>
                        <li>• 定期检查凭证的有效性</li>
                        <li>• 如怀疑凭证泄露，请立即撤销</li>
                      </ul>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 凭证详情对话框 */}
      <Dialog open={!!showDetailDialog} onOpenChange={() => setShowDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>凭证详情</DialogTitle>
          </DialogHeader>
          {showDetailDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500">名称</div>
                  <div className="font-medium">{showDetailDialog.name}</div>
                </div>
                <div>
                  <div className="text-gray-500">权限</div>
                  <div className="font-medium">{showDetailDialog.permissions}</div>
                </div>
                <div>
                  <div className="text-gray-500">桶名称</div>
                  <div className="font-mono">{showDetailDialog.bucket}</div>
                </div>
                <div>
                  <div className="text-gray-500">区域</div>
                  <div className="font-mono">{showDetailDialog.region}</div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="text-gray-500">访问密钥 ID</div>
                <div className="font-mono text-sm bg-gray-50 p-3 rounded">
                  {showDetailDialog.accessKeyId}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-gray-500">秘密访问密钥</div>
                <div className="font-mono text-sm bg-gray-50 p-3 rounded break-all">
                  {showDetailDialog.secretAccessKey}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-gray-500">端点</div>
                <div className="font-mono text-sm bg-gray-50 p-3 rounded">
                  {showDetailDialog.endpoint}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => copyCredentialInfo(showDetailDialog, 'full')}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制全部信息
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white">加载中...</div>
        </div>
      )}
    </div>
  );
}