#!/bin/bash

# 项目根目录启动脚本
# 同时启动frontend、backend和admin服务

echo "正在启动AI资讯服务平台所有服务..."

# 用于跟踪启动的进程PID
PIDS=()

# 启动前端服务
echo "启动前端服务..."
cd frontend
./start.sh &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)
cd ..

# 启动后端服务
echo "启动后端服务..."
cd backend
./start.sh &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
cd ..

# 启动管理后台服务
echo "启动管理后台服务..."
cd admin
./start.sh &
ADMIN_PID=$!
PIDS+=($ADMIN_PID)
cd ..

echo "所有服务已启动:"
echo "  前端服务 PID: $FRONTEND_PID (http://localhost:3000)"
echo "  后端服务 PID: $BACKEND_PID (http://localhost:8787)"
echo "  管理后台 PID: $ADMIN_PID (http://localhost:8000)"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 信号处理函数
cleanup() {
    echo ""
    echo "正在停止所有服务..."
    for pid in ${PIDS[@]}; do
        if ps -p $pid > /dev/null; then
            echo "终止进程 $pid"
            kill $pid 2>/dev/null
        fi
    done
    
    # 等待所有进程结束
    for pid in ${PIDS[@]}; do
        if ps -p $pid > /dev/null; then
            echo "等待进程 $pid 结束..."
            wait $pid 2>/dev/null
        fi
    done
    
    echo "所有服务已停止"
    exit 0
}

# 注册信号处理函数
trap cleanup SIGINT SIGTERM

# 等待所有后台进程
for pid in ${PIDS[@]}; do
    if ps -p $pid > /dev/null; then
        wait $pid
    fi
done