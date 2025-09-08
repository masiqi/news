#!/bin/bash

# Admin启动脚本
# 默认端口: 8101

# 检查端口是否被占用
if lsof -Pi :${PORT:-8101} -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "端口 ${PORT:-8101} 被占用，正在终止相关进程..."
    # 杀掉占用端口的进程
    lsof -ti :${PORT:-8101} | xargs kill -9
    sleep 2
fi

# 检查Node.js是否可用
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js"
    exit 1
fi

# 启动管理后台Web服务，监听所有接口
echo "正在启动管理后台Web服务..."
node server.js