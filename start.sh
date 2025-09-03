#!/bin/bash

# 项目根目录启动脚本
# 同时启动frontend、backend和admin服务

echo "正在启动AI资讯服务平台所有服务..."

# 启动前端服务
echo "启动前端服务..."
cd frontend
./start.sh &
FRONTEND_PID=$!
cd ..

# 启动后端服务
echo "启动后端服务..."
cd backend
./start.sh &
BACKEND_PID=$!
cd ..

# 启动管理后台服务
echo "启动管理后台服务..."
cd admin
./start.sh &
ADMIN_PID=$!
cd ..

echo "所有服务已启动:"
echo "  前端服务 PID: $FRONTEND_PID (http://localhost:3000)"
echo "  后端服务 PID: $BACKEND_PID (http://localhost:8787)"
echo "  管理后台 PID: $ADMIN_PID (http://localhost:8000)"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待所有后台进程
wait $FRONTEND_PID $BACKEND_PID $ADMIN_PID