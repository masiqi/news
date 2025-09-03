#!/bin/bash

# Backend启动脚本
# 默认端口: 8787

PORT=8787

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "端口 $PORT 被占用，正在终止相关进程..."
    # 杀掉占用端口的进程
    lsof -ti :$PORT | xargs kill -9
    sleep 2
fi

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
fi

# 启动后端服务
echo "正在启动后端服务..."
npm run dev