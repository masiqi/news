#!/bin/bash

# Frontend启动脚本
# 默认端口: 3000

PORT=3000
PORT2=3001

# 检查端口是否被占用
check_and_kill_process() {
    local port=$1
    local max_attempts=3
    
    # 检查端口是否被占用
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "端口 $port 被占用，正在终止相关进程..."
        
        for attempt in $(seq 1 $max_attempts); do
            echo "尝试终止进程 (第 $attempt 次尝试)..."
            
            # 获取并终止占用端口的进程
            PIDS=$(lsof -ti :$port)
            if [ -n "$PIDS" ]; then
                echo "正在终止进程: $PIDS"
                kill -TERM $PIDS 2>/dev/null || true
                
                # 等待进程优雅终止
                echo "等待进程优雅终止..."
                sleep 3
                
                # 检查进程是否仍然存在
                if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                    echo "进程仍在运行，尝试强制终止..."
                    kill -KILL $PIDS 2>/dev/null || true
                    sleep 2
                else
                    echo "端口 $port 已释放"
                    return 0
                fi
            fi
        done
        
        # 最后检查
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "警告: 仍有进程占用端口 $port，可能需要手动处理"
            return 1
        else
            echo "端口 $port 已成功释放"
            return 0
        fi
    else
        echo "端口 $port 未被占用"
        return 0
    fi
}

# 检查并终止占用端口3000和3001的进程
check_and_kill_process $PORT
check_and_kill_process $PORT2

# 检查系统Node.js版本
SYSTEM_NODE_PATH="/usr/bin/node"
if [ -x "$SYSTEM_NODE_PATH" ]; then
    SYSTEM_NODE_VERSION=$($SYSTEM_NODE_PATH --version)
    echo "系统Node.js版本: $SYSTEM_NODE_VERSION"
    
    # 检查是否为兼容版本
    if [[ $SYSTEM_NODE_VERSION == v18* ]] || [[ $SYSTEM_NODE_VERSION == v20* ]]; then
        echo "使用系统Node.js版本启动..."
        NODE_CMD="$SYSTEM_NODE_PATH"
        NPM_CMD="/usr/bin/npm"
    else
        echo "系统Node.js版本不兼容，使用当前环境Node.js..."
        NODE_CMD="node"
        NPM_CMD="npm"
    fi
else
    echo "未找到系统Node.js，使用当前环境Node.js..."
    NODE_CMD="node"
    NPM_CMD="npm"
fi

NODE_VERSION=$($NODE_CMD --version)
echo "当前使用的Node.js版本: $NODE_VERSION"

# 检查是否为兼容版本
if [[ $NODE_VERSION == v24* ]]; then
    echo "警告: Node.js v24可能与Next.js不兼容"
    echo "建议使用Node.js LTS版本 (v18或v20)"
    echo ""
fi

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    $NPM_CMD install
fi

# 启动前端服务，监听所有接口
echo "正在启动前端服务..."
$NPM_CMD run dev -- --hostname 0.0.0.0