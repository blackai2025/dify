#!/bin/bash
#
# Dify 镜像推送到腾讯云 TCR 脚本
#
# 用法:
#   ./push-tcr.sh                    # 构建并推送所有镜像 (latest)
#   ./push-tcr.sh v1.0.0             # 构建并推送指定版本
#   ./push-tcr.sh v1.0.0 web         # 仅构建并推送 web 镜像
#   ./push-tcr.sh v1.0.0 api         # 仅构建并推送 api 镜像
#
# 首次使用前请执行:
#   docker login ccr.ccs.tencentyun.com --username=<腾讯云账号ID>
#

set -e

# ============================================
# 配置区域 - 请修改为你的实际值
# ============================================
TCR_REGISTRY="ccr.ccs.tencentyun.com"
NAMESPACE="blackai2"
PLATFORMS="linux/amd64"
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${1:-latest}"
SERVICE="${2:-all}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 docker buildx 是否可用
check_buildx() {
    if ! docker buildx version &> /dev/null; then
        log_error "docker buildx 不可用，请确保 Docker 版本 >= 19.03"
        exit 1
    fi
}

# 创建或使用 buildx builder
setup_builder() {
    local builder_name="dify-multiarch"
    
    if ! docker buildx inspect "$builder_name" &> /dev/null; then
        log_info "创建 buildx builder: $builder_name"
        docker buildx create --name "$builder_name" --use --bootstrap
    else
        log_info "使用已存在的 builder: $builder_name"
        docker buildx use "$builder_name"
    fi
}

# 构建并推送镜像
build_and_push() {
    local service=$1
    local context_dir=$2
    local image_name="${TCR_REGISTRY}/${NAMESPACE}/dify-${service}"
    
    log_info "构建 ${service} 镜像..."
    log_info "  - 镜像: ${image_name}:${VERSION}"
    log_info "  - 平台: ${PLATFORMS}"
    
    docker buildx build \
        --platform "${PLATFORMS}" \
        --tag "${image_name}:${VERSION}" \
        --tag "${image_name}:latest" \
        --push \
        --progress=plain \
        "${context_dir}"
    
    log_info "✅ ${service} 镜像推送完成"
}

# 主流程
main() {
    echo "=========================================="
    echo "🚀 Dify 镜像推送到腾讯云 TCR"
    echo "=========================================="
    echo ""
    echo "配置信息:"
    echo "  - 仓库地址: ${TCR_REGISTRY}"
    echo "  - 命名空间: ${NAMESPACE}"
    echo "  - 版本标签: ${VERSION}"
    echo "  - 目标平台: ${PLATFORMS}"
    echo "  - 构建服务: ${SERVICE}"
    echo ""
    
    # 检查命名空间是否已配置
    if [ "$NAMESPACE" = "your-namespace" ]; then
        log_error "请先修改脚本中的 NAMESPACE 变量为你的腾讯云 TCR 命名空间"
        exit 1
    fi
    
    # 检查 buildx
    check_buildx
    
    # 设置 builder
    setup_builder
    
    echo ""
    
    # 根据参数构建指定服务
    case "$SERVICE" in
        web)
            build_and_push "web" "${SCRIPT_DIR}/web"
            ;;
        api)
            build_and_push "api" "${SCRIPT_DIR}/api"
            ;;
        all)
            build_and_push "web" "${SCRIPT_DIR}/web"
            echo ""
            build_and_push "api" "${SCRIPT_DIR}/api"
            ;;
        *)
            log_error "未知服务: ${SERVICE}"
            echo "可用服务: web, api, all"
            exit 1
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo "✅ 所有镜像推送完成!"
    echo "=========================================="
    echo ""
    echo "镜像列表:"
    if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "web" ]; then
        echo "  - ${TCR_REGISTRY}/${NAMESPACE}/dify-web:${VERSION}"
    fi
    if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "api" ]; then
        echo "  - ${TCR_REGISTRY}/${NAMESPACE}/dify-api:${VERSION}"
    fi
    echo ""
}

main
