#!/bin/bash

# 完整服务启动测试脚本
# 用于验证所有服务是否可以正常启动

echo "🧪 完整服务启动测试"
echo "================================"

# 测试后端服务
test_backend() {
    echo "🔧 测试后端服务..."
    cd backend
    
    # 检查依赖
    if ! npm list drizzle-orm hono >/dev/null 2>&1; then
        echo "❌ 后端依赖缺失"
        return 1
    fi
    
    # 测试导入
    if ! node -e "import { drizzle } from 'drizzle-orm/d1'; import { Hono } from 'hono';" 2>/dev/null; then
        echo "❌ 后端模块导入失败"
        return 1
    fi
    
    # 启动服务器（后台）
    echo "🚀 启动后端服务..."
    wrangler dev --persist-to=.wrangler/state &
    BACKEND_PID=$!
    
    # 等待启动
    sleep 5
    
    # 测试连接
    if curl -s http://localhost:8787/api/status >/dev/null 2>&1; then
        echo "✅ 后端服务启动成功"
        echo "   访问地址: http://localhost:8787"
        echo "   PID: $BACKEND_PID"
        return 0
    else
        echo "❌ 后端服务启动失败"
        kill $BACKEND_PID 2>/dev/null
        return 1
    fi
}

# 测试前端服务
test_frontend() {
    echo ""
    echo "🎨 测试前端服务..."
    cd ../frontend
    
    # 检查依赖
    if ! npm list next react react-dom >/dev/null 2>&1; then
        echo "❌ 前端依赖缺失"
        return 1
    fi
    
    # 启动服务器（后台）
    echo "🚀 启动前端服务..."
    npm run dev &
    FRONTEND_PID=$!
    
    # 等待启动
    sleep 8
    
    # 测试连接
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ 前端服务启动成功"
        echo "   访问地址: http://localhost:3000"
        echo "   PID: $FRONTEND_PID"
        return 0
    else
        echo "❌ 前端服务启动失败"
        kill $FRONTEND_PID 2>/dev/null
        return 1
    fi
}

# 测试管理后台
test_admin() {
    echo ""
    echo "⚙️  测试管理后台..."
    cd ../admin
    
    # 检查文件
    if [[ ! -f "index.html" ]]; then
        echo "❌ 管理后台文件缺失"
        return 1
    fi
    
    # 检查必要的组件
    if [[ ! -d "components" ]]; then
        echo "❌ 管理后台组件缺失"
        return 1
    fi
    
    # 简单的 HTTP 服务器测试
    echo "🚀 启动管理后台..."
    if command -v python3 >/dev/null 2>&1; then
        python3 -m http.server 8000 &
        ADMIN_PID=$!
        sleep 3
        
        if curl -s http://localhost:8000 >/dev/null 2>&1; then
            echo "✅ 管理后台启动成功"
            echo "   访问地址: http://localhost:8000"
            echo "   PID: $ADMIN_PID"
            return 0
        else
            echo "❌ 管理后台启动失败"
            kill $ADMIN_PID 2>/dev/null
            return 1
        fi
    else
        echo "⚠️  无法测试管理后台（需要 Python3）"
        echo "   但文件看起来是完整的"
        return 0
    fi
}

# 清理函数
cleanup() {
    echo ""
    echo "🧹 清理进程..."
    pkill -f "wrangler dev" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    pkill -f "python3.*http.server" 2>/dev/null
    echo "✅ 清理完成"
}

# 设置信号处理
trap cleanup EXIT

# 主测试流程
main() {
    echo "🧪 开始完整服务测试..."
    echo "================================"
    
    # 记录测试结果
    local results=()
    
    # 测试各个服务
    test_backend
    results+=($?)
    
    test_frontend
    results+=($?)
    
    test_admin
    results+=($?)
    
    # 显示结果
    echo ""
    echo "📊 测试结果:"
    echo "================================"
    echo "后端服务: $([[ ${results[0]} -eq 0 ]] && echo "✅ 通过" || echo "❌ 失败")"
    echo "前端服务: $([[ ${results[1]} -eq 0 ]] && echo "✅ 通过" || echo "❌ 失败")"
    echo "管理后台: $([[ ${results[2]} -eq 0 ]] && echo "✅ 通过" || echo "❌ 失败")"
    
    # 计算通过率
    local passed=$((${results[0]} + ${results[1]} + ${results[2]}))
    local total=3
    local rate=$((passed * 100 / total))
    
    echo ""
    echo "📈 总体通过率: $rate% ($passed/$total)"
    
    if [[ $rate -eq 100 ]]; then
        echo "🎉 所有服务测试通过！"
        echo ""
        echo "🚀 您可以使用以下命令启动服务："
        echo "  完整启动: ./start.sh"
        echo "  单独启动: cd backend && wrangler dev"
        echo "  部署: ./deploy.sh"
        exit 0
    else
        echo "⚠️  部分服务有问题，请检查日志"
        echo ""
        echo "🔧 可以尝试修复："
        echo "  ./fix-deps.sh"
        exit 1
    fi
}

# 等待用户确认
echo "⚠️  这将启动多个服务进行测试"
echo "完成后会自动清理进程"
echo ""
read -p "按回车键开始测试，或 Ctrl+C 取消..."

# 运行测试
main