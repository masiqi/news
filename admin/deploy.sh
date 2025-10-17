#!/bin/bash

# 管理后台部署脚本
# 用于部署静态管理后台到 Cloudflare Pages

set -e

echo "🚀 开始部署管理后台到 Cloudflare Pages..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="moxiang-distill-admin"
COMMIT_MESSAGE="Deploy admin at $(date '+%Y-%m-%d %H:%M:%S')"

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

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo -e "${RED}❌ 错误: config.json 不存在${NC}"
    exit 1
fi

# 显示当前配置
echo -e "${BLUE}📋 当前配置:${NC}"
cat config.json | grep -E '(apiUrl|adminTitle)'
echo ""

# 部署到 Cloudflare Pages
echo -e "${YELLOW}☁️  部署到 Cloudflare Pages...${NC}"
npx wrangler pages deploy . \
    --project-name="$PROJECT_NAME" \
    --commit-dirty=true \
    --commit-message="$COMMIT_MESSAGE"

# 部署成功
echo -e "${GREEN}✅ 管理后台部署成功！${NC}"
echo -e "${GREEN}🌐 访问地址: https://$PROJECT_NAME.pages.dev${NC}"
echo -e "${YELLOW}📝 默认登录凭据请查看后端日志或数据库${NC}"
