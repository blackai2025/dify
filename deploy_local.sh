#!/bin/bash

# Dify 本地容器化编译部署脚本
# 包含 Smart Filter 功能的完整部署

set -e  # 遇到错误立即退出

echo "=================================================="
echo "🚀 Dify 本地容器化编译部署"
echo "=================================================="
echo ""
echo "本脚本将："
echo "  1. 停止当前运行的服务"
echo "  2. 清理旧的镜像和缓存"
echo "  3. 从本地源码重新构建所有镜像"
echo "  4. 启动所有服务"
echo ""
read -p "是否继续？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "已取消部署"
    exit 1
fi

cd /Users/sunfuwei/IdeaProjects/dify/docker

# ============================================================
# 步骤 1: 停止所有服务
# ============================================================
echo ""
echo "📦 步骤 1/5: 停止当前运行的服务..."
docker compose -f docker-compose.local.yaml down || true

# ============================================================
# 步骤 2: 清理旧镜像和缓存
# ============================================================
echo ""
echo "🗑️  步骤 2/5: 清理旧的镜像和缓存..."
echo ""
echo "删除旧的前端镜像..."
docker rmi dify-web:local 2>/dev/null || echo "  (前端镜像不存在，跳过)"

echo "删除旧的后端镜像..."
docker rmi dify-api:local 2>/dev/null || echo "  (后端镜像不存在，跳过)"

echo "删除旧的 worker 镜像..."
docker rmi dify-worker:local 2>/dev/null || echo "  (Worker 镜像不存在，跳过)"

echo ""
echo "清理 Docker 构建缓存..."
docker builder prune -f

# ============================================================
# 步骤 3: 重新构建所有服务镜像
# ============================================================
echo ""
echo "🔨 步骤 3/5: 从本地源码重新构建所有镜像..."
echo ""
echo "这可能需要 10-20 分钟，请耐心等待..."
echo ""

# 构建前端
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 构建前端 (web)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose -f docker-compose.local.yaml build --no-cache web

# 构建后端 API
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 构建后端 API (api)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose -f docker-compose.local.yaml build --no-cache api

# 构建 Worker
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  构建 Worker (worker)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose -f docker-compose.local.yaml build --no-cache worker

echo ""
echo "✅ 所有镜像构建完成！"

# ============================================================
# 步骤 4: 启动所有服务
# ============================================================
echo ""
echo "🚀 步骤 4/5: 启动所有服务..."
docker compose -f docker-compose.local.yaml up -d

# ============================================================
# 步骤 5: 验证服务状态
# ============================================================
echo ""
echo "⏳ 等待服务启动（15秒）..."
sleep 15

echo ""
echo "📊 步骤 5/5: 验证服务运行状态..."
echo ""
docker compose -f docker-compose.local.yaml ps

# ============================================================
# 完成
# ============================================================
echo ""
echo "=================================================="
echo "✅ 部署完成！"
echo "=================================================="
echo ""
echo "🌐 访问地址："
echo "   - 前端: http://localhost:3000"
echo "   - 后端 API: http://localhost:5001"
echo ""
echo "📋 常用命令："
echo "   - 查看所有服务日志: docker compose -f docker-compose.local.yaml logs -f"
echo "   - 查看前端日志:     docker compose -f docker-compose.local.yaml logs -f web"
echo "   - 查看后端日志:     docker compose -f docker-compose.local.yaml logs -f api"
echo "   - 停止所有服务:     docker compose -f docker-compose.local.yaml down"
echo "   - 重启某个服务:     docker compose -f docker-compose.local.yaml restart <service>"
echo ""
echo "🔍 验证 Smart Filter 功能："
echo "   1. 访问 http://localhost:3000"
echo "   2. 登录后创建或打开一个应用"
echo "   3. 进入 Configuration -> Retrieval settings"
echo "   4. 滚动到底部，应该能看到 'Smart Filter' 开关"
echo ""
echo "💡 如果浏览器中还是看不到："
echo "   - 强制刷新: Cmd + Shift + R (Mac) 或 Ctrl + Shift + R (Windows)"
echo "   - 清除浏览器缓存后重新访问"
echo "   - 使用无痕模式测试"
echo ""
echo "=================================================="

