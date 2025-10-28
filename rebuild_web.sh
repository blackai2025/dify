#!/bin/bash
# 重新构建和启动前端服务

cd /Users/sunfuwei/IdeaProjects/dify/docker

echo "🔨 停止现有服务..."
docker-compose stop web

echo "🏗️  重新构建前端镜像（这一次会比较慢，但之后就快了）..."
docker-compose build web

echo "🚀 启动服务..."
docker-compose up -d web

echo "⏳ 等待服务启动..."
sleep 10

echo "📊 查看日志..."
docker-compose logs web | tail -20

echo ""
echo "✅ 完成！前端已预构建，之后重启会很快！"
echo ""
echo "测试访问: http://localhost"

