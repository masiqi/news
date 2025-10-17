#!/bin/bash

# 重新处理未分析的 RSS 条目
# 策略：将 processed=0 的条目重新发送给队列处理

echo "🔍 查询未分析的条目数量..."

# 查询未分析条目
RESULT=$(npx wrangler d1 execute news-db --remote --command "SELECT COUNT(*) as count FROM rss_entries WHERE processed = 0" --json)
UNPROCESSED_COUNT=$(echo "$RESULT" | jq -r '.[0].results[0].count')

echo "📊 发现 $UNPROCESSED_COUNT 条未分析的条目"

if [ "$UNPROCESSED_COUNT" -eq 0 ]; then
  echo "✅ 所有条目都已分析，无需重新处理"
  exit 0
fi

echo ""
echo "📋 未分析条目列表（前10条）："
npx wrangler d1 execute news-db --remote --command "SELECT id, title, created_at FROM rss_entries WHERE processed = 0 ORDER BY created_at DESC LIMIT 10"

echo ""
echo "⚠️  当前方案：重新触发所有 RSS 源的获取"
echo "   这会重新抓取 RSS，并对未处理的条目进行 LLM 分析"
echo ""

# 获取所有 RSS 源
SOURCES=$(npx wrangler d1 execute news-db --remote --command "SELECT id, name, url FROM sources" --json | jq -r '.[0].results[] | @json')

echo "📡 找到以下 RSS 源："
echo "$SOURCES" | jq -r '"  [\(.id)] \(.name)"'

echo ""
read -p "是否继续重新触发这些源的抓取？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 0
fi

echo ""
echo "🚀 开始触发 RSS 源抓取..."

# 获取登录 token（需要你的凭据）
echo "请输入管理员邮箱:"
read -r EMAIL
echo "请输入管理员密码:"
read -rs PASSWORD

AUTH_RESPONSE=$(curl -s -X POST "https://moxiang-distill-api.masiqi.workers.dev/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.data.token // .token // empty')

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  echo "响应: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ 登录成功"
echo ""

# 触发每个源
echo "$SOURCES" | while IFS= read -r source; do
  SOURCE_ID=$(echo "$source" | jq -r '.id')
  SOURCE_NAME=$(echo "$source" | jq -r '.name')

  echo "  🔄 触发源 [$SOURCE_ID] $SOURCE_NAME"

  TRIGGER_RESPONSE=$(curl -s -X POST "https://moxiang-distill-api.masiqi.workers.dev/api/v1/sources/$SOURCE_ID/trigger-fetch" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json")

  SUCCESS=$(echo "$TRIGGER_RESPONSE" | jq -r '.success // false')

  if [ "$SUCCESS" = "true" ]; then
    echo "     ✅ 已触发"
  else
    echo "     ❌ 触发失败: $(echo "$TRIGGER_RESPONSE" | jq -r '.error // "未知错误"')"
  fi

  # 避免请求过快
  sleep 2
done

echo ""
echo "✅ 所有源已触发重新抓取"
echo "📊 请等待 5-10 分钟后检查处理结果"
echo ""
echo "💡 检查方法："
echo "   npx wrangler d1 execute news-db --remote --command \"SELECT COUNT(*) as total, SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed FROM rss_entries\""
