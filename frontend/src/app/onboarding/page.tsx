'use client';

import { WelcomePageProps } from '@/types/onboarding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WelcomePage({ onStart, onSkip }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Logo和欢迎信息 */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-2xl font-bold text-white">
              📰
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            欢迎使用新闻聚合平台
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            让我们一起开始个性化您的新闻体验。通过选择您感兴趣的领域，
            我们将为您推荐最相关的优质新闻源。
          </p>
        </div>

        {/* 功能介绍卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 18.903a9 9 0 011.613 0M12 15a1 1 0 100-2 0V5a2 2 0 00-2-2h0a2 2 0 00-2 2v12a2 2 0 002 2h0a2 2 0 002-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0h.01M12 15h.01" />
                </svg>
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                个性化推荐
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 leading-relaxed">
                基于您的兴趣智能推荐相关新闻源，
                让您第一时间获取感兴趣的内容。
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-11 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 19l-6.626-6.626A1 1 0 012 17.252V19a1 1 0 01-1 1h-8a1 1 0 01-1-1v-.748a1 1 0 01-.748-.748z" />
                </svg>
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                质量保证
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 leading-relaxed">
                所有推荐源都经过严格质量审核，
                确保内容的准确性和更新频率。
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0H8a3 3 0 00-3 3v6a3 3 0 003 3h8a3 3 0 003-3V9a3 3 0 00-3-3h8a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-3-3m0 0l-3 3m6 0l-3-3m6 0l-3-3" />
                </svg>
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                灵活设置
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 leading-relaxed">
                随时可以调整您的兴趣偏好，
                系统会相应优化推荐结果。
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 justify-center">
          <Button
            onClick={onSkip}
            variant="outline"
            size="lg"
            className="w-full md:w-auto"
          >
            跳过引导，稍后设置
          </Button>
          <Button
            onClick={onStart}
            size="lg"
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700"
          >
            开始个性化设置
          </Button>
        </div>

        {/* 底部提示 */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            预计耗时 2-3 分钟 • 随时可以保存进度
          </p>
        </div>
      </div>
    </div>
  );
}