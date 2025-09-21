#!/bin/bash

# 后端服务测试脚本
# 用于验证后端服务是否正常启动

echo "🧪 测试后端服务..."

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ 端口 $port 已被占用"
        return 1
    else
        echo "✅ 端口 $port 可用"
        return 0
    fi
}

# 检查必要的文件
check_files() {
    local files=(
        "src/index.ts"
        "package.json"
        "wrangler.jsonc"
    )
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "✅ $file 存在"
        else
            echo "❌ $file 不存在"
            return 1
        fi
    done
}

# 检查依赖
check_dependencies() {
    if [[ -d "node_modules" ]]; then
        echo "✅ node_modules 目录存在"
        
        # 检查关键依赖
        local deps=(
            "drizzle-orm"
            "hono"
            "@cloudflare/d1"
        )
        
        for dep in "${deps[@]}"; do
            if npm list "$dep" >/dev/null 2>&1; then
                echo "✅ $dep 已安装"
            else
                echo "❌ $dep 未安装"
                return 1
            fi
        done
    else
        echo "❌ node_modules 目录不存在"
        return 1
    fi
}

# 测试导入
test_imports() {
    echo "🔍 测试模块导入..."
    
    # 创建临时测试文件
    cat > test-import.mjs << 'EOF'
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

console.log('✅ 所有模块导入成功');
EOF

    if node test-import.mjs; then
        echo "✅ 模块导入测试通过"
        rm test-import.mjs
        return 0
    else
        echo "❌ 模块导入测试失败"
        rm test-import.mjs
        return 1
    fi
}

# 启动开发服务器
start_server() {
    echo "🚀 启动开发服务器..."
    
    # 检查 wrangler 命令
    if ! command -v wrangler &> /dev/null; then
        echo "❌ wrangler 命令不存在"
        return 1
    fi
    
    echo "✅ wrangler 命令可用"
    
    # 显示 wrangler 版本
    echo "📋 wrangler 版本: $(wrangler --version)"
    
    # 测试配置文件
    if wrangler whoami >/dev/null 2>&1; then
        echo "✅ Cloudflare 认证正常"
    else
        echo "⚠️  未登录 Cloudflare，开发模式可以继续"
    fi
    
    echo ""
    echo "🎯 启动命令："
    echo "  wrangler dev --persist-to=.wrangler/state"
    echo ""
    echo "📝 或者使用项目的启动脚本："
    echo "  cd .. && ./start.sh"
    echo ""
}

# 主测试流程
main() {
    echo "🔧 后端服务测试开始..."
    echo "================================"
    
    check_files
    echo ""
    
    check_dependencies
    echo ""
    
    test_imports
    echo ""
    
    check_port 8787
    echo ""
    
    start_server
    
    echo "✅ 后端服务测试完成"
    echo ""
    echo "💡 下一步："
    echo "  1. 运行 'wrangler dev' 启动开发服务器"
    echo "  2. 访问 http://localhost:8787/api/status 测试 API"
    echo "  3. 运行 '../start.sh' 启动完整服务"
}

# 运行测试
main "$@"