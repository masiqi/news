#!/bin/bash

# 批量重新处理未分析的 RSS 条目
# 使用已有的 reprocess API 逐条处理

echo "🔍 查询未分析的条目..."

# 查询未分析条目的ID列表
ENTRY_IDS=$(npx wrangler d1 execute news-db --remote --command "SELECT id, title FROM rss_entries WHERE processed = 0 ORDER BY created_at DESC LIMIT 100" --json | jq -r '.[0].results[] | "\(.id)|\(.title)"')

# 统计数量
TOTAL_COUNT=$(echo "$ENTRY_IDS" | wc -l)

if [ -z "$ENTRY_IDS" ] || [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "✅ 没有未分析的条目"
  exit 0
fi

echo "📊 发现 $TOTAL_COUNT 条未分析的条目"
echo ""
echo "前 10 条:"
echo "$ENTRY_IDS" | head -10 | awk -F'|' '{print "  [" $1 "] " $2}'
echo ""

# 询问处理数量
read -p "要处理多少条？(输入数字，最多 100，回车默认全部): " PROCESS_COUNT

if [ -z "$PROCESS_COUNT" ]; then
  PROCESS_COUNT=$TOTAL_COUNT
fi

if [ "$PROCESS_COUNT" -gt 100 ]; then
  PROCESS_COUNT=100
fi

echo ""
echo "⚠️  准备处理 $PROCESS_COUNT 条未分析的条目"
echo "   每条约需 10-15 秒（使用 Cerebras）"
echo "   预计总耗时: $(($PROCESS_COUNT * 12 / 60)) 分钟"
echo ""

read -p "是否继续？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 0
fi

echo ""
echo "🚀 开始批量处理..."
echo ""

# 处理计数器
PROCESSED=0
SUCCESS=0
FAILED=0

# 处理条目
echo "$ENTRY_IDS" | head -$PROCESS_COUNT | while IFS='|' read -r ENTRY_ID TITLE; do
  PROCESSED=$((PROCESSED + 1))

  echo "[$PROCESSED/$PROCESS_COUNT] 处理条目 $ENTRY_ID: $TITLE"

  # 调用 reprocess API
  RESPONSE=$(curl -s -X POST "https://moxiang-distill-api.masiqi.workers.dev/api/v1/content/$ENTRY_ID/reprocess" \
    -H "Content-Type: application/json")

  # 检查结果
  SUCCESS_FLAG=$(echo "$RESPONSE" | jq -r '.success // false')

  if [ "$SUCCESS_FLAG" = "true" ]; then
    MODEL=$(echo "$RESPONSE" | jq -r '.data.modelUsed // "unknown"')
    TIME=$(echo "$RESPONSE" | jq -r '.data.processingTime // "N/A"')
    echo "  ✅ 成功 (模型: $MODEL, 耗时: $TIME)"
    SUCCESS=$((SUCCESS + 1))
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // .details // "未知错误"')
    echo "  ❌ 失败: $ERROR"
    FAILED=$((FAILED + 1))
  fi

  # 每处理 5 条暂停一下
  if [ $((PROCESSED % 5)) -eq 0 ]; then
    echo "  ⏸️  已处理 $PROCESSED 条，暂停 2 秒..."
    sleep 2
  fi

  echo ""
done

echo ""
echo "✅ 批量处理完成"
echo "   总计: $PROCESS_COUNT"
echo "   成功: $SUCCESS"
echo "   失败: $FAILED"
echo ""
echo "💡 查看最新统计:"
echo "   npx wrangler d1 execute news-db --remote --command \"SELECT COUNT(*) as total, SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed FROM rss_entries\""
