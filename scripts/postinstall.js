#!/usr/bin/env node
/**
 * 安装后脚本
 * - 创建数据目录
 * - 检查 Playwright 浏览器
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pluginDir = path.resolve(__dirname, '..')
const dataDir = path.join(pluginDir, 'data')

// 创建数据目录
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
  console.log('[DS-Bridge] 创建数据目录:', dataDir)
}

// 检查 Playwright 浏览器
try {
  execSync('npx playwright --version', { stdio: 'pipe' })
  console.log('[DS-Bridge] Playwright 已安装')
} catch (e) {
  console.warn('[DS-Bridge] 警告: 未检测到 Playwright,请运行: npx playwright install chromium')
}

console.log('[DS-Bridge] 安装完成!')
console.log('[DS-Bridge] 下一步: 运行 setup.sh 保存 DeepSeek 登录态')
