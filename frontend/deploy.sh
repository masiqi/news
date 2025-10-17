#!/bin/bash

# 前端部署脚本
# 用于部署静态前端到 Cloudflare Pages

set -e

echo "🚀 开始部署前端到 Cloudflare Pages..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="moxiang-distill-frontend"
BUILD_DIR="out"
COMMIT_MESSAGE="Deploy frontend at $(date '+%Y-%m-%d %H:%M:%S')"

# 检查是否安装了 wrangler
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ 错误: npx 未安装，请先安装 Node.js${NC}"
    exit 1
fi

# 安装依赖
echo -e "${YELLOW}📦 安装依赖...${NC}"
npm install

# 构建项目
echo -e "${YELLOW}🔨 构建静态网站...${NC}"
npm run build

# 检查构建输出
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ 错误: 构建目录 $BUILD_DIR 不存在${NC}"
    exit 1
fi

# 检查是否已登录 Cloudflare
echo -e "${YELLOW}🔐 检查 Cloudflare 登录状态...${NC}"
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ 未登录 Cloudflare，请先运行: npx wrangler login${NC}"
    exit 1
fi

# 部署到 Cloudflare Pages
echo -e "${YELLOW}☁️  部署到 Cloudflare Pages...${NC}"
npx wrangler pages deploy "$BUILD_DIR" \
    --project-name="$PROJECT_NAME" \
    --commit-dirty=true \
    --commit-message="$COMMIT_MESSAGE"

# 部署成功
echo -e "${GREEN}✅ 前端部署成功！${NC}"
echo -e "${GREEN}🌐 访问地址: https://$PROJECT_NAME.pages.dev${NC}"
