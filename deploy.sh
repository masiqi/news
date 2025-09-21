#!/bin/bash

# 墨香蒸馏 - Cloudflare Workers 部署脚本
# 作者: Claude Code
# 版本: 1.0

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查必要工具
check_prerequisites() {
    log_info "检查部署环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装，请先安装 npm"
        exit 1
    fi
    
    # 检查 Wrangler
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI 未安装，正在安装..."
        npm install -g wrangler
    fi
    
    # 检查 Git
    if ! command -v git &> /dev/null; then
        log_error "Git 未安装，请先安装 Git"
        exit 1
    fi
    
    # 检查是否已登录 Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_warning "未登录 Cloudflare，正在执行登录..."
        wrangler login
    fi
    
    log_success "环境检查完成"
}

# 加载环境变量
load_env() {
    log_info "加载环境变量..."
    
    if [[ ! -f ".env.deploy" ]]; then
        log_warning "未找到 .env.deploy 文件，创建模板..."
        cat > .env.deploy << EOF
# Cloudflare Workers 部署配置
# 请根据实际情况修改这些值

# JWT 密钥（生产环境必须使用强密钥）
JWT_SECRET=your_super_secure_jwt_secret_key_here

# 管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# AI 服务 API 密钥（可选）
ZHIPUAI_API_KEY=your_zhipuai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# LLM 配置
DEFAULT_LLM_PROVIDER=auto
ENABLE_LLM_FALLBACK=true

# 域名配置（可选）
FRONTEND_DOMAIN=your-frontend-domain.pages.dev
ADMIN_DOMAIN=your-admin-domain.pages.dev
API_DOMAIN=your-api-domain.workers.dev

# Cloudflare Pages 项目名称
FRONTEND_PAGES_PROJECT=moxiang-distill-frontend
ADMIN_PAGES_PROJECT=moxiang-distill-admin
EOF
        log_warning "请编辑 .env.deploy 文件后重新运行脚本"
        exit 1
    fi
    
    # 加载环境变量
    set -a
    source .env.deploy
    set +a
    
    log_success "环境变量加载完成"
}

# 验证环境变量
validate_env() {
    log_info "验证环境变量..."
    
    required_vars=(
        "JWT_SECRET"
        "ADMIN_USERNAME"
        "ADMIN_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done
    
    # 检查 JWT_SECRET 强度
    if [[ ${#JWT_SECRET} -lt 32 ]]; then
        log_error "JWT_SECRET 长度必须至少 32 个字符"
        exit 1
    fi
    
    log_success "环境变量验证完成"
}

# 部署数据库
deploy_database() {
    log_info "部署数据库..."
    
    cd backend
    
    # 检查数据库是否存在
    if ! wrangler d1 execute news-db --command="SELECT name FROM sqlite_master WHERE type='table';" &> /dev/null; then
        log_info "创建数据库表结构..."
        
        # 按顺序执行迁移
        migration_files=(
            "../db/migrations/0001_create_initial_tables.sql"
            "../db/migrations/0002_fearless_sprite.sql"
            "../db/migrations/0003_add_source_visibility_and_copy_fields.sql"
            "../db/migrations/0004_add_rss_content_caching_tables.sql"
            "../db/migrations/0005_add_failure_tracking_fields.sql"
            "../db/migrations/0006_add_source_description_field.sql"
            "../db/migrations/0007_add_source_fetch_tracking_fields.sql"
            "../db/migrations/2025-09-08-add-dashboard-notifications.sql"
            "../db/migrations/2025-09-08-add-queue-processing-tables.sql"
            "../db/migrations/2025-09-08-add-recommended-sources.sql"
            "../db/migrations/2025-09-08-add-user-onboarding.sql"
            "../db/migrations/2025-09-09-add-user-management.sql"
            "../db/migrations/2025-09-13-add-ai-processing-fields.sql"
            "../db/migrations/2025-09-14-add-glm-integration.sql"
            "../db/migrations/2025-09-14-add-multiuser-r2-access.sql"
            "../db/migrations/2025-09-14-add-obsidian-smart-links.sql"
        )
        
        for migration in "${migration_files[@]}"; do
            if [[ -f "$migration" ]]; then
                log_info "执行迁移: $migration"
                wrangler d1 execute news-db --file="$migration" --env=production
            else
                log_warning "迁移文件不存在: $migration"
            fi
        done
    else
        log_info "数据库已存在，跳过创建"
    fi
    
    cd ..
    log_success "数据库部署完成"
}

# 部署后端 API
deploy_backend() {
    log_info "部署后端 API..."
    
    cd backend
    
    # 安装依赖
    log_info "安装后端依赖..."
    npm ci
    
    # 备份原始配置并创建生产配置
    log_info "配置生产环境..."
    
    # 备份原始 wrangler.jsonc
    cp wrangler.jsonc wrangler-backup.jsonc
    
    # 更新 wrangler.jsonc 为生产环境配置
    cat > wrangler.jsonc << EOF
{
  "name": "moxiang-distill",
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "news"
    }
  ],
  "vars": {
    "JWT_SECRET": "${JWT_SECRET}",
    "ADMIN_USERNAME": "${ADMIN_USERNAME}",
    "ADMIN_PASSWORD": "${ADMIN_PASSWORD}",
    "DEFAULT_LLM_PROVIDER": "${DEFAULT_LLM_PROVIDER}",
    "ENABLE_LLM_FALLBACK": "${ENABLE_LLM_FALLBACK}",
    "NODE_ENV": "production"
  },
  "ai": {
    "binding": "AI"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "news-db",
      "database_id": "${D1_DATABASE_ID:-production}"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "RSS_FETCHER_QUEUE",
        "queue": "RSS_FETCHER_QUEUE"
      },
      {
        "binding": "AI_PROCESSOR_QUEUE",
        "queue": "AI_PROCESSOR_QUEUE"
      }
    ],
    "consumers": [
      {
        "queue": "RSS_FETCHER_QUEUE"
      },
      {
        "queue": "AI_PROCESSOR_QUEUE"
      }
    ]
  }
}
EOF
    
    # 设置 AI API 密钥（如果有）
    if [[ -n "$ZHIPUAI_API_KEY" ]]; then
        log_info "设置 ZhipuAI API 密钥..."
        echo "$ZHIPUAI_API_KEY" | wrangler secret put ZHIPUAI_API_KEY
    fi
    
    if [[ -n "$OPENROUTER_API_KEY" ]]; then
        log_info "设置 OpenRouter API 密钥..."
        echo "$OPENROUTER_API_KEY" | wrangler secret put OPENROUTER_API_KEY
    fi
    
    # 部署 Worker
    log_info "部署 Worker..."
    wrangler deploy
    
    # 恢复原始配置
    log_info "恢复开发环境配置..."
    mv wrangler-backup.jsonc wrangler.jsonc
    
    cd ..
    log_success "后端 API 部署完成"
}

# 构建前端
build_frontend() {
    log_info "构建前端应用..."
    
    cd frontend
    
    # 安装依赖
    log_info "安装前端依赖..."
    npm ci
    
    # 构建静态文件
    log_info "构建静态文件..."
    npm run build
    
    cd ..
    log_success "前端构建完成"
}

# 部署前端到 Pages
deploy_frontend() {
    log_info "部署前端到 Cloudflare Pages..."
    
    cd frontend
    
    # 如果没有配置 wrangler pages，则使用手动上传
    if [[ -z "$FRONTEND_PAGES_PROJECT" ]]; then
        log_warning "未配置 FRONTEND_PAGES_PROJECT，需要手动部署"
        log_info "请将 frontend/out 目录上传到 Cloudflare Pages"
    else
        # 使用 Wrangler 部署到 Pages
        log_info "部署到 Pages 项目: $FRONTEND_PAGES_PROJECT"
        wrangler pages deploy out --project-name="$FRONTEND_PAGES_PROJECT"
    fi
    
    cd ..
    log_success "前端部署完成"
}

# 部署管理后台
deploy_admin() {
    log_info "部署管理后台..."
    
    # 如果没有配置 wrangler pages，则使用手动上传
    if [[ -z "$ADMIN_PAGES_PROJECT" ]]; then
        log_warning "未配置 ADMIN_PAGES_PROJECT，需要手动部署"
        log_info "请将 admin 目录上传到 Cloudflare Pages"
    else
        # 使用 Wrangler 部署到 Pages
        log_info "部署到 Pages 项目: $ADMIN_PAGES_PROJECT"
        wrangler pages deploy admin --project-name="$ADMIN_PAGES_PROJECT"
    fi
    
    log_success "管理后台部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    # 等待部署生效
    sleep 10
    
    # 检查后端 API
    if [[ -n "$API_DOMAIN" ]]; then
        log_info "检查后端 API: https://$API_DOMAIN/api/status"
        if curl -s "https://$API_DOMAIN/api/status" | grep -q "ok"; then
            log_success "后端 API 运行正常"
        else
            log_error "后端 API 检查失败"
        fi
    fi
    
    # 检查前端
    if [[ -n "$FRONTEND_DOMAIN" ]]; then
        log_info "检查前端: https://$FRONTEND_DOMAIN"
        if curl -s -o /dev/null -w "%{http_code}" "https://$FRONTEND_DOMAIN" | grep -q "200"; then
            log_success "前端运行正常"
        else
            log_error "前端检查失败"
        fi
    fi
    
    # 检查管理后台
    if [[ -n "$ADMIN_DOMAIN" ]]; then
        log_info "检查管理后台: https://$ADMIN_DOMAIN"
        if curl -s -o /dev/null -w "%{http_code}" "https://$ADMIN_DOMAIN" | grep -q "200"; then
            log_success "管理后台运行正常"
        else
            log_error "管理后台检查失败"
        fi
    fi
}

# 显示部署结果
show_result() {
    log_success "部署完成！"
    
    echo
    echo "🎉 墨香蒸馏部署成功！"
    echo
    echo "📋 访问地址："
    if [[ -n "$FRONTEND_DOMAIN" ]]; then
        echo "  前端应用: https://$FRONTEND_DOMAIN"
    fi
    if [[ -n "$ADMIN_DOMAIN" ]]; then
        echo "  管理后台: https://$ADMIN_DOMAIN"
    fi
    if [[ -n "$API_DOMAIN" ]]; then
        echo "  API 服务: https://$API_DOMAIN"
    fi
    echo
    echo "🔑 管理员账户："
    echo "  用户名: $ADMIN_USERNAME"
    echo "  密码: $ADMIN_PASSWORD"
    echo
    echo "⚠️  重要提醒："
    echo "  1. 请及时修改默认密码"
    echo "  2. 确保域名解析正确"
    echo "  3. 检查所有功能是否正常"
    echo
}

# 主函数
main() {
    echo "🚀 墨香蒸馏 - Cloudflare Workers 部署脚本"
    echo "================================================"
    
    # 检查是否提供了参数
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        echo "用法: $0 [选项]"
        echo
        echo "选项:"
        echo "  --help, -h          显示帮助信息"
        echo "  --check-only        仅检查环境和依赖"
        echo "  --db-only           仅部署数据库"
        echo "  --backend-only      仅部署后端"
        echo "  --frontend-only     仅部署前端"
        echo "  --admin-only        仅部署管理后台"
        echo "  --verify-only       仅验证部署"
        echo
        echo "示例:"
        echo "  $0                  # 完整部署"
        echo "  $0 --backend-only   # 仅部署后端"
        echo
        exit 0
    fi
    
    case "$1" in
        --check-only)
            check_prerequisites
            log_success "环境检查完成"
            exit 0
            ;;
        --db-only)
            load_env
            validate_env
            deploy_database
            exit 0
            ;;
        --backend-only)
            load_env
            validate_env
            deploy_backend
            exit 0
            ;;
        --frontend-only)
            build_frontend
            deploy_frontend
            exit 0
            ;;
        --admin-only)
            deploy_admin
            exit 0
            ;;
        --verify-only)
            verify_deployment
            exit 0
            ;;
        "")
            # 完整部署
            ;;
        *)
            log_error "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
    
    # 完整部署流程
    check_prerequisites
    load_env
    validate_env
    deploy_database
    deploy_backend
    build_frontend
    deploy_frontend
    deploy_admin
    verify_deployment
    show_result
}

# 执行主函数
main "$@"