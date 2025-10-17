import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产环境静态导出配置
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: process.env.NODE_ENV === 'production',

  // 禁用 ESLint 检查
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 禁用 TypeScript 类型检查
  typescript: {
    ignoreBuildErrors: true,
  },

  // 图片优化配置（静态导出时需要）
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
  },
  
  // 解决开发环境跨域警告
  allowedDevOrigins: ['10.1.0.241'],
  
  // 配置API重写，仅在开发环境生效
  async rewrites() {
    // 仅在开发环境代理API请求
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8787/api/:path*',
        },
      ];
    }
    // 生产环境不重写，直接使用 Cloudflare Workers 地址
    return [];
  },
  
  // 禁用中间件（在静态导出时）
  webpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      // 静态导出时禁用一些不需要的功能
      config.optimization.splitChunks = false;
    }
    return config;
  },
  
  // 实验性功能
  experimental: {
    // 如果需要其他实验性功能
  },
};

export default nextConfig;
