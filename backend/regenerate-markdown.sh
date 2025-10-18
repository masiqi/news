#!/bin/bash

# 为已处理的内容批量生成 Markdown 文件
# 从数据库读取已有的 LLM 分析结果，调用 Markdown 生成服务

API_URL="https://moxiang-distill-api.masiqi.workers.dev"

echo "📊 批量重新生成 Markdown 文件"
echo "================================"
echo ""
echo "此脚本会从数据库中读取所有已经 LLM 处理过的内容，"
echo "基于已有的分析结果生成 Markdown 文件到用户的 R2 空间。"
echo ""
echo "⚠️  注意："
echo "   - 不会重新调用 LLM API"
echo "   - 只处理有用户关联的条目"
echo "   - 已存在的文件会被覆盖"
echo ""

read -p "是否继续？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 0
fi

echo ""
echo "🚀 开始批量生成..."
echo ""

# 调用 API 端点
RESPONSE=$(curl -s -X POST "${API_URL}/api/admin/regenerate-markdown" \
  -H "Content-Type: application/json")

# 解析结果
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
  TOTAL=$(echo "$RESPONSE" | jq -r '.total // 0')
  GENERATED=$(echo "$RESPONSE" | jq -r '.generated // 0')
  FAILED=$(echo "$RESPONSE" | jq -r '.failed // 0')
  SKIPPED=$(echo "$RESPONSE" | jq -r '.skipped // 0')
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message // "完成"')

  echo "✅ 批量生成完成"
  echo ""
  echo "   总计条目: $TOTAL"
  echo "   成功生成: $GENERATED"
  echo "   失败数量: $FAILED"
  echo "   跳过数量: $SKIPPED"
  echo ""
  echo "   $MESSAGE"
  echo ""
  echo "💡 查看生成的文件："
  echo "   访问: ${API_URL}/webdav/news"
  echo "   用户名: 你的注册邮箱"
  echo "   密码: 你的登录密码"
else
  ERROR=$(echo "$RESPONSE" | jq -r '.error // "未知错误"')
  echo "❌ 批量生成失败"
  echo "   错误: $ERROR"
  echo ""
  echo "   完整响应:"
  echo "$RESPONSE" | jq .
fi

echo ""
