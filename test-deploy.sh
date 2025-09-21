#!/bin/bash

# 简单的部署脚本测试脚本
# 用于验证部署脚本的各个部分是否正常工作

set -e

echo "🧪 测试部署脚本..."

# 检查部署脚本是否存在
if [[ ! -f "deploy.sh" ]]; then
    echo "❌ deploy.sh 不存在"
    exit 1
fi

# 检查脚本是否有执行权限
if [[ ! -x "deploy.sh" ]]; then
    echo "❌ deploy.sh 没有执行权限"
    exit 1
fi

# 测试帮助信息
echo "📖 测试帮助信息..."
./deploy.sh --help

# 测试环境检查
echo "🔍 测试环境检查..."
./deploy.sh --check-only

echo "✅ 基本测试通过"

# 测试环境变量模板
echo "📋 测试环境变量模板..."
if [[ -f ".env.deploy.template" ]]; then
    echo "✅ 环境变量模板存在"
else
    echo "❌ 环境变量模板不存在"
    exit 1
fi

# 测试 GitHub Actions 配置
echo "🔄 测试 GitHub Actions 配置..."
if [[ -d ".github/workflows" ]]; then
    if [[ -f ".github/workflows/deploy.yml" ]]; then
        echo "✅ GitHub Actions 配置存在"
    else
        echo "❌ GitHub Actions 配置文件不存在"
        exit 1
    fi
else
    echo "❌ GitHub Actions 目录不存在"
    exit 1
fi

# 测试文档
echo "📚 测试部署文档..."
if [[ -f "docs/deployment/README.md" ]]; then
    echo "✅ 部署文档存在"
else
    echo "❌ 部署文档不存在"
    exit 1
fi

if [[ -f "docs/deployment/secrets-setup.md" ]]; then
    echo "✅ Secrets 配置文档存在"
else
    echo "❌ Secrets 配置文档不存在"
    exit 1
fi

# 测试前端配置
echo "🎨 测试前端配置..."
if [[ -f "frontend/next.config.ts" ]]; then
    if grep -q "output: 'export'" frontend/next.config.ts; then
        echo "✅ 前端支持静态导出"
    else
        echo "❌ 前端配置不支持静态导出"
        exit 1
    fi
else
    echo "❌ 前端配置文件不存在"
    exit 1
fi

# 测试后端配置
echo "⚙️ 测试后端配置..."
if [[ -f "backend/wrangler.jsonc" ]]; then
    echo "✅ 后端配置文件存在"
else
    echo "❌ 后端配置文件不存在"
    exit 1
fi

echo ""
echo "🎉 所有测试通过！部署脚本已准备就绪。"
echo ""
echo "下一步："
echo "1. 复制环境变量模板: cp .env.deploy.template .env.deploy"
echo "2. 编辑 .env.deploy 文件，填入你的配置"
echo "3. 运行部署: ./deploy.sh"
echo ""