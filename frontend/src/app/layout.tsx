import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '墨香蒸馏 - AI 新闻平台',
  description: '基于 AI 的个性化新闻聚合与推送平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
