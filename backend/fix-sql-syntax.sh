#!/bin/bash
# 修复 SQL 迁移文件中的语法错误

echo "🔧 修复 SQL 语法错误..."

# 修复 2025-09-14-add-obsidian-smart-links.sql
# 将表内的 INDEX 定义移到表外
FILE="src/db/migrations/2025-09-14-add-obsidian-smart-links.sql"

if [ -f "$FILE" ]; then
    echo "修复 $FILE ..."

    # 备份原文件
    cp "$FILE" "$FILE.backup"

    # 使用 sed 删除表内的 INDEX 定义
    sed -i 's/^[[:space:]]*INDEX idx_[^;]*,//g' "$FILE"
    sed -i 's/^[[:space:]]*INDEX idx_[^)]*$/)/g' "$FILE"

    echo "✅ $FILE 已修复（备份：$FILE.backup）"
else
    echo "❌ 文件不存在: $FILE"
fi

echo "完成！"
