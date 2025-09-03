#!/bin/bash

# Frontend启动脚本
# 默认端口: 3000

PORT=3000

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "端口 $PORT 被占用，正在终止相关进程..."
    # 杀掉占用端口的进程
    lsof -ti :$PORT | xargs kill -9
    sleep 2
fi

# 检查Node.js版本
NODE_VERSION=$(node --version)
echo "当前Node.js版本: $NODE_VERSION"

# 检查是否为兼容版本
if [[ $NODE_VERSION == v24* ]]; then
    echo "警告: Node.js v24可能与Next.js不兼容"
    echo "建议使用nvm切换到LTS版本:"
    echo "  nvm install 18 && nvm use 18"
    echo "或"
    echo "  nvm install 20 && nvm use 20"
    echo ""
fi

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi

# 启动前端服务，监听所有接口
echo "正在启动前端服务..."
npm run dev -- --hostname 0.0.0.0