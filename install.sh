#!/bin/bash
# DeepSeek Bridge - 一键安装脚本
# 用法: bash install.sh

set -e

echo "=== DeepSeek Bridge 安装 ==="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js,请先安装 Node.js 20+"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "错误: Node.js 版本过低(当前: $(node -v)),需要 20+"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# 安装依赖
echo "安装 npm 依赖..."
npm install

# 安装 Playwright Chromium
echo "安装 Playwright Chromium 浏览器..."
npx playwright install chromium

echo ""
echo "=== 安装完成 ==="
echo ""
echo "下一步: 运行 bash setup.sh 保存 DeepSeek 登录态"
echo ""
echo "使用方式:"
echo "  node src/index.js \"你的问题\""
echo "  node src/index.js --help"
