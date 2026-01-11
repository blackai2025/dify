#!/bin/bash
#
# Dify 腾讯云部署脚本
#
# 用法:
#   ./deploy.sh              # 首次部署
#   ./deploy.sh pull         # 拉取最新镜像
#   ./deploy.sh up           # 启动服务
#   ./deploy.sh down         # 停止服务
#   ./deploy.sh restart      # 重启服务
#   ./deploy.sh logs [服务名] # 查看日志
#   ./deploy.sh status       # 查看服务状态
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 检查配置文件
check_config() {
    if [ ! -f ".env" ]; then
        log_warn ".env 文件不存在，正在从 .env.example 创建..."
        cp .env.example .env
        log_warn "请编辑 .env 文件配置你的环境变量"
        exit 1
    fi
}

# 创建必要的目录
create_directories() {
    log_info "创建数据目录..."
    mkdir -p volumes/app/storage
    mkdir -p volumes/db/data
    mkdir -p volumes/redis/data
    mkdir -p volumes/weaviate
    mkdir -p volumes/plugin_daemon
    mkdir -p nginx/ssl
    
    # 设置权限
    chmod -R 777 volumes/app/storage
}

# Docker Compose 命令
dc() {
    if docker compose version &> /dev/null; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# 登录 TCR
login_tcr() {
    log_info "登录腾讯云容器镜像服务..."
    echo "请输入腾讯云账号 ID:"
    read -r username
    docker login ccr.ccs.tencentyun.com --username="$username"
}

# 拉取镜像
pull_images() {
    log_info "拉取最新镜像..."
    dc pull
}

# 启动服务
start_services() {
    log_info "启动服务..."
    dc up -d
    
    log_info "等待服务启动..."
    sleep 10
    
    log_info "服务状态:"
    dc ps
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    dc down
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    dc restart
}

# 查看日志
view_logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        dc logs -f --tail=100 "$service"
    else
        dc logs -f --tail=100
    fi
}

# 查看状态
view_status() {
    dc ps
}

# 首次部署
first_deploy() {
    echo "=========================================="
    echo "🚀 Dify 腾讯云首次部署"
    echo "=========================================="
    echo ""
    
    check_docker
    create_directories
    check_config
    
    echo ""
    read -p "是否需要登录腾讯云 TCR? (y/n): " need_login
    if [ "$need_login" = "y" ] || [ "$need_login" = "Y" ]; then
        login_tcr
    fi
    
    pull_images
    start_services
    
    echo ""
    echo "=========================================="
    echo "✅ 部署完成!"
    echo "=========================================="
    echo ""
    echo "访问地址: http://$(hostname -I | awk '{print $1}')"
    echo ""
    echo "常用命令:"
    echo "  ./deploy.sh status    # 查看服务状态"
    echo "  ./deploy.sh logs api  # 查看 API 日志"
    echo "  ./deploy.sh restart   # 重启服务"
    echo ""
}

# 主入口
case "${1:-}" in
    pull)
        pull_images
        ;;
    up)
        check_config
        start_services
        ;;
    down)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        view_logs "$2"
        ;;
    status)
        view_status
        ;;
    login)
        login_tcr
        ;;
    *)
        first_deploy
        ;;
esac
