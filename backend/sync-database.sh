#!/bin/bash
# 数据库同步脚本 - 独立执行数据库迁移
# 使用方法: bash sync-database.sh [--local|--remote]

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🗄️  墨香蒸馏 - 数据库同步脚本${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# 解析参数
MODE="remote"
if [ "$1" == "--local" ]; then
    MODE="local"
    echo -e "${BLUE}📍 模式: 本地数据库${NC}"
elif [ "$1" == "--remote" ]; then
    MODE="remote"
    echo -e "${BLUE}📍 模式: 远程数据库（生产环境）${NC}"
else
    echo -e "${BLUE}📍 模式: 远程数据库（默认）${NC}"
    echo -e "${YELLOW}💡 提示: 使用 --local 同步本地数据库${NC}"
fi

echo ""

# 检查是否登录 Cloudflare（远程模式需要）
if [ "$MODE" == "remote" ]; then
    echo -e "${YELLOW}🔐 检查 Cloudflare 登录状态...${NC}"
    if ! npx wrangler whoami &> /dev/null; then
        echo -e "${RED}❌ 未登录 Cloudflare，请先运行: npx wrangler login${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 已登录 Cloudflare${NC}"
    echo ""
fi

# 迁移文件列表
MIGRATION_FILES=(
    "src/db/migrations/0001_create_initial_tables.sql"
    "src/db/migrations/0002_fearless_sprite.sql"
    "src/db/migrations/0003_add_source_visibility_and_copy_fields.sql"
    "src/db/migrations/0004_add_rss_content_caching_tables.sql"
    "src/db/migrations/0005_add_failure_tracking_fields.sql"
    "src/db/migrations/0006_add_source_description_field.sql"
    "src/db/migrations/0007_add_source_fetch_tracking_fields.sql"
    "src/db/migrations/2025-09-08-add-dashboard-notifications.sql"
    # "src/db/migrations/2025-09-08-add-queue-processing-tables.sql"  # 跳过：包含 COMMENT ON 语法
    "src/db/migrations/2025-09-08-add-recommended-sources.sql"
    "src/db/migrations/2025-09-08-add-user-onboarding.sql"
    "src/db/migrations/2025-09-09-add-user-management.sql"
    "src/db/migrations/2025-09-13-add-ai-processing-fields.sql"
    "src/db/migrations/2025-09-14-add-glm-integration.sql"
    # "src/db/migrations/2025-09-14-add-multiuser-r2-access.sql"  # 跳过：包含 ALTER TABLE IF NOT EXISTS
    # "src/db/migrations/2025-09-14-add-obsidian-smart-links.sql"  # 跳过：包含表内 INDEX 定义
    "../db/migrations/003_create_user_tag_aggregation_tables.sql"
    "../db/migrations/2025-09-14-add-auto-markdown-storage.sql"
    "../db/migrations/2025-09-14-add-user-auto-storage.sql"
)

SUCCESS_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

echo -e "${CYAN}🚀 开始数据库迁移...${NC}"
echo ""

# 执行迁移
for migration in "${MIGRATION_FILES[@]}"; do
    if [[ -f "$migration" ]]; then
        MIGRATION_NAME=$(basename "$migration")

        # 构建 wrangler 命令
        if [ "$MODE" == "local" ]; then
            WRANGLER_CMD="wrangler d1 execute news-db --file=\"$migration\" --local --yes"
        else
            WRANGLER_CMD="wrangler d1 execute news-db --file=\"$migration\" --remote --yes"
        fi

        # 安静模式执行，重定向输出到临时文件
        TEMP_LOG=$(mktemp)
        if eval "$WRANGLER_CMD" > "$TEMP_LOG" 2>&1; then
            echo -e "${GREEN}✅ $MIGRATION_NAME${NC}"
            ((SUCCESS_COUNT++))
        else
            # 检查是否是"已存在"类型的错误
            if grep -q "already exists\|duplicate column" "$TEMP_LOG"; then
                echo -e "${CYAN}⏭️  $MIGRATION_NAME${NC} ${YELLOW}(已应用)${NC}"
                ((SKIP_COUNT++))
            else
                echo -e "${RED}❌ $MIGRATION_NAME${NC} ${RED}(失败)${NC}"
                ((ERROR_COUNT++))
                # 显示错误详情
                if grep -q "syntax error" "$TEMP_LOG"; then
                    ERROR_MSG=$(grep "ERROR" "$TEMP_LOG" | head -1)
                    echo -e "${RED}   错误: $ERROR_MSG${NC}"
                fi
            fi
        fi
        rm -f "$TEMP_LOG"
    else
        echo -e "${YELLOW}⚠️  $migration ${NC}${YELLOW}(文件不存在)${NC}"
    fi
done

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}📊 迁移统计${NC}"
echo -e "${CYAN}================================${NC}"
echo -e "${GREEN}✅ 新执行: $SUCCESS_COUNT${NC}"
echo -e "${CYAN}⏭️  已跳过: $SKIP_COUNT${NC}"
if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${RED}❌ 失败: $ERROR_COUNT${NC}"
fi
echo ""

if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  部分迁移失败，但不影响已成功的迁移${NC}"
    echo -e "${YELLOW}💡 建议检查失败的迁移文件是否有语法错误${NC}"
    echo ""
fi

echo -e "${GREEN}✅ 数据库同步完成！${NC}"
echo ""

# 显示数据库信息（仅远程模式）
if [ "$MODE" == "remote" ]; then
    echo -e "${BLUE}💡 后续操作:${NC}"
    echo -e "   查看数据库: ${CYAN}npx wrangler d1 info news-db${NC}"
    echo -e "   执行查询: ${CYAN}npx wrangler d1 execute news-db --command=\"SELECT * FROM users LIMIT 10\" --remote${NC}"
    echo -e "   查看表结构: ${CYAN}npx wrangler d1 execute news-db --command=\".schema\" --remote${NC}"
elif [ "$MODE" == "local" ]; then
    echo -e "${BLUE}💡 后续操作:${NC}"
    echo -e "   查看本地数据库: ${CYAN}npx wrangler d1 execute news-db --command=\"SELECT * FROM users LIMIT 10\" --local${NC}"
    echo -e "   同步到远程: ${CYAN}bash sync-database.sh --remote${NC}"
fi

echo ""
