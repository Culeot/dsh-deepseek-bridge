# dsh-deepseek-bridge

🇨🇳 让 DSH agent 自动向 DeepSeek 网页端 V4 Pro 提问,获取架构方案后回来执行。
🇬🇧 Automatically ask DeepSeek web V4 Pro for architecture solutions, then execute them.

---

## 底层规则 / Core Rules

详见 [RULES.md](RULES.md)。/ See [RULES.md](RULES.md) for details.

1. **每句话必辩证判断 / Dialectical Judgment** - 回复开头必须包含【DS-Bridge 判断】/ Start every reply with [DS-Bridge Judgment]
2. **防衰退机制 / Anti-Decay** - 连续 3 次未判断 = 衰退 / 3 consecutive misses = decay
3. **思考过程可见化 / Visible Thinking** - 展示判断依据和执行方式 / Show reasoning and execution

---

## 核心规则:每句话先辩证判断 / Core Rule: Judge First

用户每发一句话,先判断是否需要找 V4 / Judge whether to ask V4 for every message:

### 判断框架(三步停) / Judgment Framework

1. **【条件】当前任务需要什么? / What does the task need?**
   - 知识/推理/方案 → 考虑 V4 / Knowledge/reasoning/solution → consider V4
   - 代码执行/文件操作 → 龙猫自己做 / Code execution/file ops → agent does it

2. **【主要矛盾】是"深度思考"还是"快速执行"? / Deep thinking or quick execution?**
   - 复杂架构/策略/多方案对比 → 问 V4 / Complex architecture/strategy/comparison → ask V4
   - 简单任务(<10行代码/纯信息) → 龙猫自己做 / Simple task → agent does it

3. **【规律】V4 强在推理,弱在无工具;龙猫强在有工具,弱在推理深度 / V4 is strong in reasoning, weak without tools**

### 决策规则 / Decision Rules

| 场景 / Scenario | 谁做 / Who | 原因 / Reason |
|---|---|---|
| 简单任务(搜索/文件/执行) / Simple task | 龙猫 / Agent | V4 无工具 / V4 has no tools |
| 复杂架构/策略/方案 / Complex architecture | V4 | V4 推理深度 > 龙猫 / V4 reasoning > agent |
| 代码编写/调试 / Code writing | 龙猫 / Agent | V4 无执行能力 / V4 can't execute |
| 多方案对比/风险评估 / Multi-solution comparison | V4 | V4 辩证分析能力强 / V4 dialectical analysis |

---

## 配置 / Configuration

### 环境变量 / Environment Variables

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DS_AGENT_NAME` | DSH Agent | agent 名称(显示在提示词中) |
| `DS_RUNTIME_ENV` | DSH (DeepSeek Harness) | 运行环境描述 |

### 示例 / Example

```bash
# 自定义 agent 名称
DS_AGENT_NAME="My Agent" DS_RUNTIME_ENV="本地开发环境" node src/index.js "问题"
```

### 前提条件 / Prerequisites

- Node.js 20+
- Git
- DeepSeek 账号(网页端免费) / DeepSeek account (free web)

### 步骤 / Steps

```bash
# 1. 克隆仓库 / Clone
git clone https://github.com/Culeot/dsh-deepseek-bridge.git
cd dsh-deepseek-bridge

# 2. 安装依赖 / Install dependencies
npm install
npx playwright install chromium

# 3. 保存登录态 / Save login state
bash setup.sh      # macOS/Linux
setup.cmd          # Windows
```

### 添加到 DSH(可选) / Add to DSH (optional)

```bash
npm pack
dsh plugin --profile web add ./dsh-deepseek-bridge-0.1.0.tgz
```

---

## 使用 / Usage

### 1. 保存登录态 / Save Login State

```bash
bash setup.sh      # macOS/Linux
setup.cmd          # Windows
```

浏览器打开后登录 DeepSeek,脚本自动保存登录态。/ Log in to DeepSeek in the browser, script auto-saves state.

### 2. 提问 V4 / Ask V4

```bash
# 基础提问(专家模式 + 深度思考) / Basic (expert mode + deep thinking)
node src/index.js --project "项目名/project" "问题/question"

# 要求 JSON 输出(推荐) / Require JSON output (recommended)
node src/index.js --project "项目名/project" "问题/question"

# 强制新建对话 / Force new conversation
node src/index.js --new --project "新项目/new" "问题/question"
```

### 3. 查看和管理 / View & Manage

```bash
# 列出所有会话 / List all sessions
node src/index.js --list

# 列出运行记录 / List run records
node src/index.js --runs

# 删除项目会话 / Delete project session
node src/index.js --delete "项目名/project"
```

### 4. 执行计划 / Execute Plan

```bash
# 演练(不实际执行) / Dry run
node src/index.js --dry-run --run "runs/xxx"

# 实际执行 / Execute
node src/index.js --run "runs/xxx"
```

---

## 提示词模板 / Prompt Template

发给 V4 的提示词必须包含 / Prompts to V4 must include:

1. **项目背景 / Project Context**: 已完成/待做状态、技术栈、约束 / Status, tech stack, constraints
2. **辩证思维框架 / Dialectical Framework**: 条件/主要矛盾/规律/一分为二/盲区 / Conditions/contradictions/laws/pros-cons/blindspots
3. **输出格式 / Output Format**: JSON 结构 / JSON structure
4. **Jack 审查关 / Jack Review**: 拆前提、核来源、敢反对、点盲区 / Check premises, verify sources, dare to object, point out blindspots

---

## 跨平台支持 / Cross-Platform

- ✅ Windows: 自动翻译 Unix 命令 / Auto-translate Unix commands
- ✅ macOS/Linux: 原生支持 / Native support
- ⚠️ 复杂 shell 语法需人工适配 / Complex shell syntax needs manual adaptation

---

## 参考 / References

- 技术路线 / Tech: DSH Playwright MCP 直接操控浏览器 / Direct browser control via MCP
- 参考项目 / Reference: kusoidev/deepseek-bridge (XHR interception architecture)
- 辩证思维 / Dialectical thinking: bianzheng-siwei skill

---

## License / 许可证

MIT
