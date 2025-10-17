#!/bin/bash
# 前端和管理后台部署脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 部署前端
deploy_frontend() {
    log_info "开始部署前端应用..."

    cd frontend

    # 检查是否已安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装前端依赖..."
        npm ci
    fi

    # 构建前端
    log_info "构建前端应用..."
    NODE_ENV=production npm run build

    if [ ! -d "out" ]; then
        log_error "构建失败：未找到 out 目录"
        exit 1
    fi

    log_success "前端构建完成！"

    # 部署到 Cloudflare Pages
    log_info "部署到 Cloudflare Pages..."

    # 检查是否有 Pages 项目
    read -p "请输入 Cloudflare Pages 项目名称（默认：moxiang-distill-frontend）: " PAGES_PROJECT
    PAGES_PROJECT=${PAGES_PROJECT:-moxiang-distill-frontend}

    # 尝试部署
    if wrangler pages deploy out --project-name="$PAGES_PROJECT"; then
        log_success "前端部署成功！"
        log_info "访问地址：https://$PAGES_PROJECT.pages.dev"
    else
        log_warning "自动部署失败，请手动部署："
        log_info "1. 前往 Cloudflare Dashboard: https://dash.cloudflare.com/pages"
        log_info "2. 创建新项目或选择现有项目"
        log_info "3. 上传 frontend/out 目录"
        log_info "4. 配置环境变量："
        log_info "   NEXT_PUBLIC_API_URL=https://moxiang-distill-api.masiqi.workers.dev"
    fi

    cd ..
}

# 部署管理后台
deploy_admin() {
    log_info "开始部署管理后台..."

    cd admin

    # 管理后台是纯静态文件，不需要构建
    log_info "准备管理后台文件..."

    # 更新配置文件中的 API 地址
    if [ -f "config.json" ]; then
        log_info "更新 API 配置..."
        cat > config.json << EOF
{
  "apiUrl": "https://moxiang-distill-api.masiqi.workers.dev",
  "adminTitle": "墨香蒸馏 - 管理后台"
}
EOF
    fi

    # 部署到 Cloudflare Pages
    log_info "部署到 Cloudflare Pages..."

    read -p "请输入 Cloudflare Pages 项目名称（默认：moxiang-distill-admin）: " PAGES_PROJECT
    PAGES_PROJECT=${PAGES_PROJECT:-moxiang-distill-admin}

    # 尝试部署（部署当前目录）
    if wrangler pages deploy . --project-name="$PAGES_PROJECT"; then
        log_success "管理后台部署成功！"
        log_info "访问地址：https://$PAGES_PROJECT.pages.dev"
    else
        log_warning "自动部署失败，请手动部署："
        log_info "1. 前往 Cloudflare Dashboard: https://dash.cloudflare.com/pages"
        log_info "2. 创建新项目或选择现有项目"
        log_info "3. 上传 admin 目录"
        log_info "4. 默认管理员账号："
        log_info "   用户名：admin"
        log_info "   密码：Admin@123456"
    fi

    cd ..
}

# 主函数
main() {
    echo "🚀 墨香蒸馏 - 前端部署脚本"
    echo "================================================"

    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        echo "用法: $0 [选项]"
        echo
        echo "选项:"
        echo "  --help, -h          显示帮助信息"
        echo "  --frontend-only     仅部署前端"
        echo "  --admin-only        仅部署管理后台"
        echo
        echo "示例:"
        echo "  $0                  # 完整部署"
        echo "  $0 --frontend-only  # 仅部署前端"
        echo
        exit 0
    fi

    case "$1" in
        --frontend-only)
            deploy_frontend
            ;;
        --admin-only)
            deploy_admin
            ;;
        "")
            deploy_frontend
            echo
            deploy_admin
            ;;
        *)
            log_error "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac

    echo
    log_success "部署完成！"
    echo
    echo "📋 下一步："
    echo "1. 访问前端应用测试用户功能"
    echo "2. 访问管理后台进行系统配置"
    echo "3. 配置自定义域名（可选）"
    echo
}

main "$@"
