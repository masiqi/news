import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 解决开发环境跨域警告
  allowedDevOrigins: ['10.1.0.241'],
  // 配置API重写，将/api请求代理到后端
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8787/api/:path*',
      },
    ];
  },
  // 其他配置
  experimental: {
    // 如果需要其他实验性功能
  },
};

export default nextConfig;
