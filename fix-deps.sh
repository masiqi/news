#!/bin/bash

# 依赖修复和验证脚本
# 用于修复常见的依赖和启动问题

echo "🔧 开始修复依赖问题..."

# 清理 npm 缓存
echo "🧹 清理 npm 缓存..."
npm cache clean --force

# 删除 node_modules
echo "🗑️  删除 node_modules..."
rm -rf node_modules

# 重新安装依赖
echo "📦 重新安装依赖..."
npm install

# 检查关键文件
echo "🔍 检查关键文件..."

check_file() {
    local file=$1
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file 缺失"
        return 1
    fi
}

check_wasm() {
    local pkg=$1
    if [[ -d "node_modules/$pkg" ]]; then
        local wasm_files=$(find "node_modules/$pkg" -name "*.wasm" 2>/dev/null)
        if [[ -n "$wasm_files" ]]; then
            echo "✅ $pkg WASM 文件存在"
            echo "   $wasm_files"
        else
            echo "⚠️  $pkg WASM 文件缺失"
        fi
    else
        echo "❌ $pkg 包缺失"
    fi
}

# 检查关键依赖
echo ""
echo "📦 检查关键依赖..."
check_file "node_modules/blake3-wasm/dist/wasm/nodejs/blake3_js_bg.wasm"
check_file "node_modules/next/dist/compiled/@vercel/og/resvg.wasm"
check_wasm "blake3-wasm"

# 测试后端服务
echo ""
echo "🧪 测试后端服务..."
cd backend

# 检查后端依赖
if npm list drizzle-orm hono >/dev/null 2>&1; then
    echo "✅ 后端核心依赖正常"
else
    echo "❌ 后端依赖缺失，正在安装..."
    npm install
fi

# 测试模块导入
if node -e "import { drizzle } from 'drizzle-orm/d1'; import { Hono } from 'hono'; console.log('✅ 后端模块导入成功')" 2>/dev/null; then
    echo "✅ 后端模块导入正常"
else
    echo "❌ 后端模块导入失败"
fi

cd ..

# 测试前端服务
echo ""
echo "🎨 测试前端服务..."
cd frontend

# 检查前端依赖
if npm list next react react-dom >/dev/null 2>&1; then
    echo "✅ 前端核心依赖正常"
else
    echo "❌ 前端依赖缺失，正在安装..."
    npm install
fi

# 测试前端构建
if NODE_ENV=production npm run build >/dev/null 2>&1; then
    echo "✅ 前端构建正常"
else
    echo "⚠️  前端构建有问题，但开发模式应该可以工作"
fi

cd ..

# 创建修复报告
echo ""
echo "📋 修复报告..."
echo "================================"

if [[ -f "node_modules/blake3-wasm/dist/wasm/nodejs/blake3_js_bg.wasm" ]]; then
    echo "✅ blake3-wasm 依赖已修复"
else
    echo "❌ blake3-wasm 仍有问题"
fi

if command -v wrangler >/dev/null 2>&1; then
    echo "✅ Wrangler CLI 正常 (版本: $(wrangler --version))"
else
    echo "❌ Wrangler CLI 缺失"
fi

echo ""
echo "🚀 现在可以尝试启动服务："
echo "  开发模式: ./start.sh"
echo "  仅后端: cd backend && wrangler dev"
echo "  仅前端: cd frontend && npm run dev"
echo ""
echo "💡 如果还有问题，请检查："
echo "  1. Node.js 版本兼容性"
echo "  2. 系统权限和文件访问"
echo "  3. 防火墙或安全软件设置"

echo ""
echo "✅ 修复完成！"