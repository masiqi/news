#!/bin/bash

# Admin启动脚本
# 默认端口: 8000

PORT=8000

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "端口 $PORT 被占用，正在终止相关进程..."
    # 杀掉占用端口的进程
    lsof -ti :$PORT | xargs kill -9
    sleep 2
fi

# 检查Python是否可用
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3"
    exit 1
fi

# 启动管理后台服务，监听所有接口
echo "正在启动管理后台服务..."
python3 -m http.server $PORT --bind 0.0.0.0