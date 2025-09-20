#!/bin/bash

# Backend启动脚本
# 默认端口: 8787 (主API) / 8790 (RSS调度Worker)

set -euo pipefail

PORT=${PORT:-8787}
SCHEDULER_PORT=${SCHEDULER_PORT:-8790}
INSPECTOR_PORT=${INSPECTOR_PORT:-9229}
SCHEDULER_INSPECTOR_PORT=${SCHEDULER_INSPECTOR_PORT:-9230}
ENABLE_SCHEDULER=${ENABLE_SCHEDULER:-1}

cleanup() {
    if [[ -n "${SCHEDULER_PID:-}" ]] && ps -p "$SCHEDULER_PID" >/dev/null 2>&1; then
        echo "\n正在停止RSS调度Worker (PID: $SCHEDULER_PID)..."
        kill "$SCHEDULER_PID" 2>/dev/null || true
        wait "$SCHEDULER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

ensure_port_free() {
    local port=$1
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "端口 $port 被占用，正在终止相关进程..."
        lsof -ti :"$port" | xargs kill -9
        sleep 2
    fi
}

ensure_port_free "$PORT"
ensure_port_free "$INSPECTOR_PORT"

if [[ "$ENABLE_SCHEDULER" == "1" ]]; then
    ensure_port_free "$SCHEDULER_PORT"
    ensure_port_free "$SCHEDULER_INSPECTOR_PORT"
fi

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
fi

if [[ "$ENABLE_SCHEDULER" == "1" ]]; then
    echo "正在启动RSS调度Worker (端口: $SCHEDULER_PORT)..."
    npm run dev:scheduler -- \
        --ip 0.0.0.0 \
        --port "$SCHEDULER_PORT" \
        --inspector-port "$SCHEDULER_INSPECTOR_PORT" \
        --test-scheduled &
    SCHEDULER_PID=$!
    echo "RSS调度Worker PID: $SCHEDULER_PID"
fi

# 启动后端服务，监听所有接口
echo "正在启动后端服务 (端口: $PORT)..."
npm run dev -- \
    --ip 0.0.0.0 \
    --port "$PORT" \
    --inspector-port "$INSPECTOR_PORT"
