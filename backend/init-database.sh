#!/bin/bash

# 数据库初始化脚本
# 用于重新创建数据库表结构

echo "🗄️  数据库初始化脚本"
echo "================================"

# 检查环境
check_environment() {
    echo "🔍 检查环境..."
    
    if ! command -v wrangler &> /dev/null; then
        echo "❌ Wrangler CLI 未安装"
        exit 1
    fi
    
    if ! wrangler whoami &> /dev/null; then
        echo "⚠️  未登录 Cloudflare，但本地模式可以继续"
    fi
    
    echo "✅ 环境检查完成"
}

# 获取迁移文件列表
get_migrations() {
    echo "📋 获取迁移文件..."
    
    local migrations=(
        # 基础表结构
        "src/db/migrations/0001_create_initial_tables.sql"
        
        # 功能增强
        "src/db/migrations/0002_fearless_sprite.sql"
        "src/db/migrations/0003_add_source_visibility_and_copy_fields.sql"
        "src/db/migrations/0004_add_rss_content_caching_tables.sql"
        "src/db/migrations/0005_add_failure_tracking_fields.sql"
        "src/db/migrations/0006_add_source_description_field.sql"
        "src/db/migrations/0007_add_source_fetch_tracking_fields.sql"
        
        # 新功能模块
        "src/db/migrations/2025-09-08-add-dashboard-notifications.sql"
        "src/db/migrations/2025-09-08-add-queue-processing-tables.sql"
        "src/db/migrations/2025-09-08-add-recommended-sources.sql"
        "src/db/migrations/2025-09-08-add-user-onboarding.sql"
        "src/db/migrations/2025-09-09-add-user-management.sql"
        "src/db/migrations/2025-09-13-add-ai-processing-fields.sql"
        
        # AI 和存储功能
        "src/db/migrations/2025-09-14-add-glm-integration.sql"
        "src/db/migrations/2025-09-14-add-multiuser-r2-access.sql"
        "src/db/migrations/2025-09-14-add-obsidian-smart-links.sql"
        "src/db/migrations/2025-09-14-add-auto-markdown-storage.sql"
        
        # 自动存储功能（关键修复）
        "db/migrations/2025-09-14-add-user-auto-storage.sql"
        
        # 标签聚合
        "db/migrations/003_create_user_tag_aggregation_tables.sql"
    )
    
    echo "✅ 找到 ${#migrations[@]} 个迁移文件"
    printf '%s\n' "${migrations[@]}"
}

# 执行迁移
execute_migrations() {
    echo ""
    echo "🚀 开始执行数据库迁移..."
    echo "================================"
    
    local migrations=("$@")
    local success_count=0
    local fail_count=0
    
    for migration in "${migrations[@]}"; do
        if [[ -f "$migration" ]]; then
            echo "📝 执行迁移: $migration"
            
            if wrangler d1 execute news-db --file="$migration" --local; then
                echo "✅ 迁移成功: $migration"
                ((success_count++))
            else
                echo "❌ 迁移失败: $migration"
                ((fail_count++))
                
                # 如果关键迁移失败，停止执行
                if [[ "$migration" == *"0001_create_initial_tables.sql"* ]]; then
                    echo "🛑 基础表创建失败，停止执行"
                    exit 1
                fi
            fi
        else
            echo "⚠️  迁移文件不存在: $migration"
            ((fail_count++))
        fi
        
        echo "--------------------------------"
    done
    
    echo ""
    echo "📊 迁移结果:"
    echo "  成功: $success_count"
    echo "  失败: $fail_count"
    echo "  总计: $((success_count + fail_count))"
}

# 验证数据库
verify_database() {
    echo ""
    echo "🔍 验证数据库结构..."
    
    # 检查关键表是否存在
    local tables=(
        "users"
        "sources"
        "rss_entries"
        "processed_contents"
        "user_auto_storage_configs"
        "user_storage_logs"
        "user_storage_stats"
    )
    
    local missing_tables=()
    
    for table in "${tables[@]}"; do
        if wrangler d1 execute news-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" --local | grep -q "$table"; then
            echo "✅ 表 $table 存在"
        else
            echo "❌ 表 $table 缺失"
            missing_tables+=("$table")
        fi
    done
    
    if [[ ${#missing_tables[@]} -eq 0 ]]; then
        echo "✅ 所有关键表都存在"
        return 0
    else
        echo "❌ 以下表缺失: ${missing_tables[*]}"
        return 1
    fi
}

# 创建测试用户
create_test_user() {
    echo ""
    echo "👤 创建测试用户..."
    
    # 检查是否已有用户
    local user_count=$(wrangler d1 execute news-db --command="SELECT COUNT(*) as count FROM users;" --local | jq -r '.results[0].count')
    
    if [[ "$user_count" -eq 0 ]]; then
        echo "📝 创建默认用户..."
        
        wrangler d1 execute news-db --command="
            INSERT INTO users (email, password_hash, created_at) 
            VALUES ('test@example.com', 'hashed_password_here', strftime('%s', 'now'));
        " --local
        
        echo "✅ 测试用户创建成功"
    else
        echo "ℹ️  已存在 $user_count 个用户"
    fi
}

# 显示数据库信息
show_database_info() {
    echo ""
    echo "📊 数据库信息:"
    echo "================================"
    
    # 显示所有表
    echo "📋 数据库表:"
    wrangler d1 execute news-db --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --local | jq -r '.results[].name'
    
    echo ""
    
    # 显示用户数量
    local user_count=$(wrangler d1 execute news-db --command="SELECT COUNT(*) as count FROM users;" --local | jq -r '.results[0].count')
    echo "👥 用户数量: $user_count"
    
    # 显示源数量
    local source_count=$(wrangler d1 execute news-db --command="SELECT COUNT(*) as count FROM sources;" --local | jq -r '.results[0].count')
    echo "📡 RSS源数量: $source_count"
    
    # 显示条目数量
    local entry_count=$(wrangler d1 execute news-db --command="SELECT COUNT(*) as count FROM rss_entries;" --local | jq -r '.results[0].count')
    echo "📝 RSS条目数量: $entry_count"
    
    # 检查自动存储配置
    local storage_count=$(wrangler d1 execute news-db --command="SELECT COUNT(*) as count FROM user_auto_storage_configs;" --local | jq -r '.results[0].count')
    echo "🗄️  自动存储配置: $storage_count"
}

# 主函数
main() {
    echo "🗄️  开始数据库初始化..."
    echo "================================"
    
    # 检查环境
    check_environment
    
    # 获取迁移文件
    local migrations=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && migrations+=("$line")
    done < <(get_migrations)
    
    # 执行迁移
    execute_migrations "${migrations[@]}"
    
    # 验证数据库
    if verify_database; then
        echo "✅ 数据库验证通过"
        
        # 创建测试用户
        create_test_user
        
        # 显示数据库信息
        show_database_info
        
        echo ""
        echo "🎉 数据库初始化完成！"
        echo ""
        echo "💡 现在可以启动后端服务："
        echo "  wrangler dev"
        echo ""
        echo "🔍 测试自动存储功能："
        echo "  访问 /api/auto-storage/config 端点"
        echo ""
    else
        echo "❌ 数据库验证失败"
        exit 1
    fi
}

# 备份数据库（可选）
backup_database() {
    echo ""
    echo "💾 备份数据库..."
    
    local backup_dir="backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/database_$timestamp.sql"
    
    mkdir -p "$backup_dir"
    
    # 导出数据库架构
    wrangler d1 execute news-db --command=".schema" --local > "$backup_file"
    
    echo "✅ 数据库已备份到: $backup_file"
}

# 如果指定了备份参数，先备份数据库
if [[ "$1" == "--backup" ]]; then
    backup_database
fi

# 运行主函数
main "$@"