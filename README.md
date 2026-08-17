# dsh-deepseek-bridge

让 DSH agent 自动向 DeepSeek 网页端 V4 Pro 提问,获取架构方案后回来执行。

## 底层规则

详细规则见 [RULES.md](RULES.md)。核心:

1. **每句话必辩证判断** - 回复开头必须包含【DS-Bridge 判断】
2. **防衰退机制** - 连续 3 次未判断 = 衰退,需重新读取规则
3. **思考过程可见化** - 展示判断依据和执行方式

## 核心规则:每句话先辩证判断

用户每发一句话,先判断是否需要找 V4:

### 判断框架(三步停)

1. **【条件】当前任务需要什么?**
   - 知识/推理/方案 → 考虑 V4
   - 代码执行/文件操作 → 龙猫自己做

2. **【主要矛盾】是"深度思考"还是"快速执行"?**
   - 复杂架构/策略/多方案对比 → 问 V4
   - 简单任务(<10行代码/纯信息) → 龙猫自己做

3. **【规律】V4 强在推理,弱在无工具;龙猫强在有工具,弱在推理深度**

### 决策规则

| 场景 | 谁做 | 原因 |
|---|---|---|
| 简单任务(搜索/文件/执行) | 龙猫 | V4 无工具,龙猫有 |
| 复杂架构/策略/方案 | V4 | V4 推理深度 > 龙猫 |
| 代码编写/调试 | 龙猫 | V4 无执行能力 |
| 多方案对比/风险评估 | V4 | V4 辩证分析能力强 |

### 一分为二

- **找 V4**:获得深度方案,但消耗时间(60-120秒)
- **不找 V4**:快速响应,但方案可能不够优雅

## 安装

### 前提条件

- Node.js 20+
- Git
- DeepSeek 账号(网页端免费)

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Culeot/dsh-deepseek-bridge.git
cd dsh-deepseek-bridge

# 2. 安装依赖
npm install
npx playwright install chromium

# 3. 保存登录态(macOS/Linux)
bash setup.sh

# 3. 保存登录态(Windows)
setup.cmd
```

### 添加到 DSH(可选)

```bash
# 打包插件
npm pack

# 添加到 DSH profile
dsh plugin --profile web add ./dsh-deepseek-bridge-0.1.0.tgz
```

## 使用

### 1. 首次配置(保存登录态)

```bash
# macOS/Linux
bash setup.sh

# Windows
setup.cmd
```

浏览器打开后登录 DeepSeek,脚本自动保存登录态。

### 2. 提问 V4

```bash
# 基础提问(专家模式 + 深度思考)
node src/index.js --project "项目名" "问题内容"

# 要求 JSON 输出(推荐)
node src/index.js --project "项目名" "问题内容"

# 强制新建对话(不复用旧会话)
node src/index.js --new --project "新项目" "问题"
```

### 3. 查看和管理

```bash
# 列出所有会话
node src/index.js --list

# 列出运行记录
node src/index.js --runs

# 删除项目会话
node src/index.js --delete "项目名"
```

### 4. 执行计划

```bash
# 演练(不实际执行)
node src/index.js --dry-run --run "runs/2026-08-17T08-57-04_python_crawler"

# 实际执行
node src/index.js --run "runs/2026-08-17T08-57-04_python_crawler"
```

## 提示词模板

发给 V4 的提示词必须包含:

1. **项目背景**:已完成/待做状态、技术栈、约束
2. **辩证思维框架**:条件/主要矛盾/规律/一分为二/盲区
3. **输出格式**:JSON 结构(alternatives/recommendation/execution_plan)
4. **Jack 审查关**:拆前提、核来源、敢反对、点盲区

## 跨平台支持

- ✅ Windows:自动翻译 Unix 命令(mkdir -p → mkdir, python3 → python)
- ✅ macOS/Linux:原生支持
- ⚠️ 复杂 shell 语法(heredoc 等)需人工适配

## 参考

- 技术路线:DSH Playwright MCP 直接操控浏览器
- 参考项目:kusoidev/deepseek-bridge(XHR 拦截架构)
- 辩证思维:bianzheng-siwei skill

## License

MIT
