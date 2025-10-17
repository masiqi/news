'use client';

import { NotificationSettingsProps, NotificationSettings } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function NotificationSettings({
  settings,
  onUpdate,
  className = '',
}: NotificationSettingsProps) {
  const getFrequencyText = (frequency: NotificationSettings['emailFrequency']) => {
    switch (frequency) {
      case 'immediate': return '立即发送';
      case 'daily': return '每日汇总';
      case 'weekly': return '每周汇总';
      default: return '立即发送';
    }
  };

  const handleUpdate = (newSettings: Partial<NotificationSettings>) => {
    onUpdate && onUpdate(newSettings);
  };

  const toggleRealtime = (checked: boolean) => {
    handleUpdate({ enableRealtimeNotifications: checked });
  };

  const toggleEmail = (checked: boolean) => {
    handleUpdate({ enableEmailNotifications: checked });
  };

  const toggleCompleted = (checked: boolean) => {
    handleUpdate({ notifyOnCompleted: checked });
  };

  const toggleFailed = (checked: boolean) => {
    handleUpdate({ notifyOnFailed: checked });
  };

  const toggleError = (checked: boolean) => {
    handleUpdate({ notifyOnError: checked });
  };

  const toggleQuietHours = (checked: boolean) => {
    handleUpdate({ 
      quietHoursEnabled: checked,
      quietHoursStart: checked ? settings?.quietHoursStart : null,
      quietHoursEnd: checked ? settings?.quietHoursEnd : null,
    });
  };

  const changeEmailFrequency = (frequency: NotificationSettings['emailFrequency']) => {
    handleUpdate({ emailFrequency: frequency });
  };

  const changeQuietTime = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      handleUpdate({ quietHoursStart: value });
    } else {
      handleUpdate({ quietHoursEnd: value });
    }
  };

  const validateTime = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(time);
  };

  if (!settings) {
    return (
      <Card className={cn('border-dashed border-gray-300', className)}>
        <CardContent className="py-8 text-center">
          <svg className="w-8 h-8 mx-auto text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3l3-3V8H5z" />
          </svg>
          <p className="text-gray-500 mt-2">
            加载通知设置...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          通知设置
        </h2>
        <p className="text-gray-600 mt-1">
          自定义您希望接收的通知类型和发送方式
        </p>
      </div>

      {/* 通知方式设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            通知方式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 实时通知 */}
          <div className="flex items-center justify-between">
            <div className="space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="font-medium text-gray-900">实时通知</span>
              </div>
              <span className="text-sm text-gray-500">网页实时推送通知</span>
            </div>
            <Switch
              checked={settings.enableRealtimeNotifications}
              onCheckedChange={toggleRealtime}
            />
          </div>

          {/* 邮件通知 */}
          <div className="flex items-center justify-between">
            <div className="space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="font-medium text-gray-900">邮件通知</span>
              </div>
              <span className="text-sm text-gray-500">发送邮件到您的邮箱</span>
            </div>
            <Switch
              checked={settings.enableEmailNotifications}
              onCheckedChange={toggleEmail}
            />
          </div>
        </CardContent>
      </Card>

      {/* 通知内容设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            通知内容
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 任务完成通知 */}
          <div className="flex items-center justify-between">
            <div className="space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="font-medium text-gray-900">任务完成</span>
              </div>
              <span className="text-sm text-gray-500">任务处理完成时发送通知</span>
            </div>
            <Switch
              checked={settings.notifyOnCompleted}
              onCheckedChange={toggleCompleted}
            />
          </div>

          {/* 任务失败通知 */}
          <div className="flex items-center justify-between">
            <div className="space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                <span className="font-medium text-gray-900">任务失败</span>
              </div>
              <span className="text-sm text-gray-500">任务处理失败时发送通知</span>
            </div>
            <Switch
              checked={settings.notifyOnFailed}
              onCheckedChange={toggleFailed}
            />
          </div>

          {/* 系统错误通知 */}
          <div className="flex items-center justify-between">
            <div className="space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                <span className="font-medium text-gray-900">系统错误</span>
              </div>
              <span className="text-sm text-gray-500">系统出现异常时发送通知</span>
            </div>
            <Switch
              checked={settings.notifyOnError}
              onCheckedChange={toggleError}
            />
          </div>
        </CardContent>
      </Card>

      {/* 邮件设置 */}
      {settings.enableEmailNotifications && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              邮件设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 邮件发送频率 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                邮件发送频率
              </label>
              <Select
                value={settings.emailFrequency}
                onValueChange={changeEmailFrequency}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择邮件发送频率" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">立即发送</SelectItem>
                  <SelectItem value="daily">每日汇总</SelectItem>
                  <SelectItem value="weekly">每周汇总</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500 ml-2">
                {getFrequencyText(settings.emailFrequency)}
              </span>
            </div>

            {/* 静默时间设置 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  静默时间段
                </label>
                <Switch
                  checked={settings.quietHoursEnabled}
                  onCheckedChange={toggleQuietHours}
                />
              </div>
              
              {settings.quietHoursEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      开始时间
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="time"
                        value={settings.quietHoursStart || ''}
                        onChange={(e) => changeQuietTime('start', e.target.value)}
                        className="w-24"
                        placeholder="HH:mm"
                      />
                      <span className="text-sm text-gray-500">格式：HH:mm (23:00)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      结束时间
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="time"
                        value={settings.quietHoursEnd || ''}
                        onChange={(e) => changeQuietTime('end', e.target.value)}
                        className="w-24"
                        placeholder="HH:mm (07:00)"
                      />
                      <span className="text-sm text-gray-500">格式：HH:mm (08:00)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试通知 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            测试通知
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            发送一个测试通知来验证您的设置是否正常工作
          </p>
          
          <div className="flex space-x-4">
            <Button
              onClick={() => console.log('Send test notification')}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l-3 3-3-3m0 0a9 9 0 009 9h0a9 9 0 00-9-9z" />
              </svg>
              发送测试通知
            </Button>
            
            <Button
              variant="outline"
              onClick={() => console.log('Test email notification')}
              disabled={!settings.enableEmailNotifications}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a3 3 0 014.22 0l-14.22 14.22a3 3 0 00-2.122 2.122L3 11z" />
              </svg>
              测试邮件发送
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-center pt-6">
        <Button
          size="lg"
          onClick={() => console.log('Save notification settings')}
          className="px-8"
        >
          保存设置
        </Button>
      </div>

      {/* 状态指示器 */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
        <span>所有设置已保存并生效</span>
      </div>
    </div>
  );
}