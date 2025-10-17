#!/bin/bash
# 一键同步所有数据库
# 使用方法: bash sync-all-databases.sh [--local|--remote]

set -e

echo "🗄️  墨香蒸馏 - 数据库同步工具"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 解析参数
MODE=${1:---remote}

if [ "$MODE" == "--local" ]; then
    echo -e "${BLUE}📍 同步模式: 本地数据库${NC}"
elif [ "$MODE" == "--remote" ]; then
    echo -e "${BLUE}📍 同步模式: 远程数据库（生产环境）${NC}"
else
    echo -e "${RED}❌ 无效参数: $MODE${NC}"
    echo -e "${CYAN}用法: bash sync-all-databases.sh [--local|--remote]${NC}"
    exit 1
fi

echo ""

# 检查必要工具
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ 错误: npx 未安装，请先安装 Node.js${NC}"
    exit 1
fi

# 检查是否已登录 Cloudflare（远程模式需要）
if [ "$MODE" == "--remote" ]; then
    echo -e "${YELLOW}🔐 检查 Cloudflare 登录状态...${NC}"
    if ! npx wrangler whoami &> /dev/null; then
        echo -e "${RED}❌ 未登录 Cloudflare，请先运行: npx wrangler login${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 已登录 Cloudflare${NC}"
    echo ""
fi

# 进入后端目录并执行同步
echo -e "${CYAN}📦 同步后端数据库...${NC}"
echo ""
cd backend

if [ -f "sync-database.sh" ]; then
    bash sync-database.sh "$MODE"
else
    echo -e "${RED}❌ 错误: backend/sync-database.sh 不存在${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${GREEN}🎉 所有数据库同步完成！${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

if [ "$MODE" == "--remote" ]; then
    echo -e "${BLUE}💡 提示:${NC}"
    echo -e "   - 数据库已同步到生产环境"
    echo -e "   - 可以使用 ${CYAN}bash deploy-all.sh${NC} 部署代码"
    echo -e "   - 查看数据库: ${CYAN}npx wrangler d1 info news-db${NC}"
elif [ "$MODE" == "--local" ]; then
    echo -e "${BLUE}💡 提示:${NC}"
    echo -e "   - 本地数据库已更新"
    echo -e "   - 同步到远程: ${CYAN}bash sync-all-databases.sh --remote${NC}"
    echo -e "   - 本地开发: ${CYAN}cd backend && npm run dev${NC}"
fi

echo ""
