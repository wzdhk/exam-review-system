#!/bin/bash

# 切换到项目根目录（脚本位于 deploy/ 子目录）
cd "$(dirname "$0")/.." || exit 1

echo "======================================"
echo "   答题系统 - 生产环境部署脚本"
echo "======================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js 14+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "错误: Node.js 版本过低，需要 14+，当前版本: $(node -v)"
    exit 1
fi

echo "✓ Node.js 版本: $(node -v)"
echo ""

# 安装依赖
echo "步骤 1/3: 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败"
    exit 1
fi
echo "✓ 依赖安装完成"
echo ""

# 构建前端
echo "步骤 2/3: 构建前端..."
npm run build
if [ $? -ne 0 ]; then
    echo "错误: 前端构建失败"
    exit 1
fi
echo "✓ 前端构建完成"
echo ""

# 创建必要的目录
echo "步骤 3/3: 创建运行目录..."
mkdir -p uploads
echo "✓ 目录创建完成"
echo ""

# 检查是否安装了 PM2
if command -v pm2 &> /dev/null; then
    echo "检测到 PM2，是否使用 PM2 启动服务？(y/n)"
    read -r use_pm2
    if [ "$use_pm2" = "y" ] || [ "$use_pm2" = "Y" ]; then
        echo "使用 PM2 启动服务..."
        NODE_ENV=production pm2 start server/index.js --name exam-system
        pm2 save
        echo ""
        echo "======================================"
        echo "   部署完成！"
        echo "======================================"
        echo ""
        echo "服务已使用 PM2 启动"
        echo "访问地址: http://localhost:3000"
        echo ""
        echo "常用命令:"
        echo "  pm2 logs exam-system     - 查看日志"
        echo "  pm2 restart exam-system  - 重启服务"
        echo "  pm2 stop exam-system     - 停止服务"
        echo "  pm2 monit                - 监控服务"
        exit 0
    fi
fi

echo "======================================"
echo "   部署完成！"
echo "======================================"
echo ""
echo "启动服务:"
echo "  NODE_ENV=production npm start"
echo ""
echo "或使用 PM2 (推荐):"
echo "  npm install -g pm2"
echo "  NODE_ENV=production pm2 start server/index.js --name exam-system"
echo ""
echo "访问地址: http://localhost:3000"
echo ""
echo "详细部署指南: 查看 docs/DEPLOYMENT.md"
