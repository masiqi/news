#!/bin/bash

# 一键部署所有服务
# 部署顺序: 后端 -> 管理后台 -> 前端

set -e

echo "🚀 墨香蒸馏 - 一键部署脚本"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -d "backend" ] || [ ! -d "frontend" ] || [ ! -d "admin" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 检查是否安装了必要工具
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

echo -e "${GREEN}✅ 环境检查通过${NC}"
echo ""

# 部署选项（支持命令行参数，默认全部部署）
DEPLOY_OPTION=${1:-1}

DEPLOY_BACKEND=false
DEPLOY_ADMIN=false
DEPLOY_FRONTEND=false

case $DEPLOY_OPTION in
    1|all)
        echo -e "${CYAN}📋 部署模式: 全部部署 (后端 + 管理后台 + 前端)${NC}"
        DEPLOY_BACKEND=true
        DEPLOY_ADMIN=true
        DEPLOY_FRONTEND=true
        ;;
    2|backend)
        echo -e "${CYAN}📋 部署模式: 仅部署后端${NC}"
        DEPLOY_BACKEND=true
        ;;
    3|admin)
        echo -e "${CYAN}📋 部署模式: 仅部署管理后台${NC}"
        DEPLOY_ADMIN=true
        ;;
    4|frontend)
        echo -e "${CYAN}📋 部署模式: 仅部署前端${NC}"
        DEPLOY_FRONTEND=true
        ;;
    5|backend-admin)
        echo -e "${CYAN}📋 部署模式: 后端 + 管理后台${NC}"
        DEPLOY_BACKEND=true
        DEPLOY_ADMIN=true
        ;;
    6|admin-frontend)
        echo -e "${CYAN}📋 部署模式: 管理后台 + 前端${NC}"
        DEPLOY_ADMIN=true
        DEPLOY_FRONTEND=true
        ;;
    *)
        echo -e "${RED}❌ 无效选项: $DEPLOY_OPTION${NC}"
        echo ""
        echo -e "${CYAN}用法: bash deploy-all.sh [选项]${NC}"
        echo "选项:"
        echo "  1 或 all             - 全部部署 (默认)"
        echo "  2 或 backend         - 仅部署后端"
        echo "  3 或 admin           - 仅部署管理后台"
        echo "  4 或 frontend        - 仅部署前端"
        echo "  5 或 backend-admin   - 后端 + 管理后台"
        echo "  6 或 admin-frontend  - 管理后台 + 前端"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}开始部署流程...${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# 部署后端
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${YELLOW}📦 [1/3] 部署后端...${NC}"
    cd backend
    if [ -f "deploy.sh" ]; then
        bash deploy.sh
    else
        echo -e "${RED}❌ backend/deploy.sh 不存在${NC}"
        exit 1
    fi
    cd ..
    echo ""
fi

# 部署管理后台
if [ "$DEPLOY_ADMIN" = true ]; then
    echo -e "${YELLOW}📦 [2/3] 部署管理后台...${NC}"
    cd admin
    if [ -f "deploy.sh" ]; then
        bash deploy.sh
    else
        echo -e "${RED}❌ admin/deploy.sh 不存在${NC}"
        exit 1
    fi
    cd ..
    echo ""
fi

# 部署前端
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${YELLOW}📦 [3/3] 部署前端...${NC}"
    cd frontend
    if [ -f "deploy.sh" ]; then
        bash deploy.sh
    else
        echo -e "${RED}❌ frontend/deploy.sh 不存在${NC}"
        exit 1
    fi
    cd ..
    echo ""
fi

# 部署完成总结
echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${GREEN}🔧 后端 API:${NC}"
    echo -e "   https://moxiang-distill-api.masiqi.workers.dev"
    echo -e "   健康检查: https://moxiang-distill-api.masiqi.workers.dev/api/health"
    echo ""
fi

if [ "$DEPLOY_ADMIN" = true ]; then
    echo -e "${GREEN}⚙️  管理后台:${NC}"
    echo -e "   https://moxiang-distill-admin.pages.dev"
    echo ""
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${GREEN}🌐 前端网站:${NC}"
    echo -e "   https://moxiang-distill-frontend.pages.dev"
    echo ""
fi

echo -e "${YELLOW}📝 提示:${NC}"
echo -e "   - 首次部署后，域名可能需要几分钟才能完全生效"
echo -e "   - 可以在 Cloudflare Dashboard 中绑定自定义域名"
echo -e "   - 查看日志: npx wrangler tail [worker-name]"
echo ""
