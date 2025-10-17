#!/bin/bash

# 后端部署脚本
# 用于部署 Cloudflare Workers API

set -e

echo "🚀 开始部署后端到 Cloudflare Workers..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否安装了 wrangler
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ 错误: npx 未安装，请先安装 Node.js${NC}"
    exit 1
fi

# 检查是否已登录 Cloudflare
echo -e "${YELLOW}🔐 检查 Cloudflare 登录状态...${NC}"
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ 未登录 Cloudflare，请先运行: npx wrangler login${NC}"
    exit 1
fi

# 安装依赖
echo -e "${YELLOW}📦 安装依赖...${NC}"
npm install

# 部署到 Cloudflare Workers
echo -e "${YELLOW}☁️  部署到 Cloudflare Workers...${NC}"
npx wrangler deploy

# 获取部署的 URL
WORKER_URL=$(npx wrangler deployments list --name=moxiang-distill-api 2>/dev/null | grep -o 'https://[^ ]*' | head -1)

# 测试健康检查
echo -e "${YELLOW}🏥 测试健康检查...${NC}"
sleep 3
HEALTH_RESPONSE=$(curl -s https://moxiang-distill-api.masiqi.workers.dev/api/health || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ 后端部署成功！健康检查通过${NC}"
    echo -e "${GREEN}🌐 API 地址: https://moxiang-distill-api.masiqi.workers.dev${NC}"
    echo -e "${GREEN}🏥 健康检查: https://moxiang-distill-api.masiqi.workers.dev/api/health${NC}"
else
    echo -e "${YELLOW}⚠️  后端已部署，但健康检查未通过，请检查日志${NC}"
fi
