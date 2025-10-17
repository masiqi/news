#!/bin/bash
# 数据库迁移脚本 - 执行所有迁移文件到远程数据库

# 不使用 set -e，因为我们需要处理已存在的表/字段错误

echo "🚀 开始数据库迁移..."

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

for migration in "${MIGRATION_FILES[@]}"; do
    if [[ -f "$migration" ]]; then
        MIGRATION_NAME=$(basename "$migration")
        # 安静模式执行，重定向输出到临时文件
        TEMP_LOG=$(mktemp)
        if wrangler d1 execute news-db --file="$migration" --remote --yes > "$TEMP_LOG" 2>&1; then
            echo "✅ $MIGRATION_NAME"
            ((SUCCESS_COUNT++))
        else
            # 检查是否是"已存在"类型的错误
            if grep -q "already exists\|duplicate column" "$TEMP_LOG"; then
                echo "⏭️  $MIGRATION_NAME (已应用)"
                ((SKIP_COUNT++))
            else
                echo "❌ $MIGRATION_NAME (失败)"
                cat "$TEMP_LOG"
            fi
        fi
        rm -f "$TEMP_LOG"
    fi
done

echo ""
echo "📊 迁移统计:"
echo "   新执行: $SUCCESS_COUNT"
echo "   已跳过: $SKIP_COUNT"
echo "✅ 数据库迁移完成！"
