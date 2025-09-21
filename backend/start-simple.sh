#!/bin/bash

# 简单的后端服务启动测试
echo "🧪 测试后端服务启动..."

# 进入后端目录
cd backend

# 检查依赖
echo "🔍 检查依赖..."
if npm list drizzle-orm hono >/dev/null 2>&1; then
    echo "✅ 核心依赖已安装"
else
    echo "❌ 依赖缺失，正在安装..."
    npm install
fi

# 测试导入
echo "📦 测试模块导入..."
if node -e "import { drizzle } from 'drizzle-orm/d1'; import { Hono } from 'hono'; console.log('✅ 导入成功')" 2>/dev/null; then
    echo "✅ 模块导入正常"
else
    echo "❌ 模块导入失败"
    exit 1
fi

# 启动服务器（后台运行）
echo "🚀 启动开发服务器..."
wrangler dev --ip 0.0.0.0 --port 8787 --persist-to=.wrangler/state &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 5

# 测试服务器
echo "🔍 测试服务器响应..."
if curl -s http://localhost:8787/api/status | grep -q "ok\|status\|api"; then
    echo "✅ 后端服务运行正常"
    echo "📡 访问地址: http://localhost:8787"
    echo "🔑 API 状态: http://localhost:8787/api/status"
else
    echo "⚠️  服务器可能仍在启动中..."
    echo "📝 请手动检查: curl http://localhost:8787/api/status"
fi

# 显示进程信息
echo ""
echo "📊 进程信息:"
echo "  PID: $SERVER_PID"
echo "  端口: 8787"
echo ""
echo "🛑 停止服务器: kill $SERVER_PID"
echo "📋 或者使用: pkill -f 'wrangler dev'"

# 等待用户输入
echo ""
echo "按任意键停止服务器..."
read -n 1

# 停止服务器
kill $SERVER_PID 2>/dev/null
echo "✅ 服务器已停止"